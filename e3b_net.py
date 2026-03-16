#!/usr/bin/env python3
"""
E3B-Net: Encoder + Three Deep Blocks Network for Biotic Crop Stress Identification.

Reference:
    Chiranjit Pal, Imon Mukherjee et al., "Robust Deep Convolutional Solutions for
    Identifying Biotic Crop Stress in Wild Environments," IEEE Transactions on
    AgriFood Electronics, Vol. 2, No. 2, Sept/Oct 2024.

Architecture:
    INPUT 128×128×3 → two parallel branches →
      Branch-1 (CAE Encoder)   → 64×64×α  (α=12)
      Branch-2 (3DB Model)     → 64×64×β  (β=24)
    → Concatenate (64×64×36) → DepthwiseConv → GAP → Dense(28, softmax)

Target: ~0.37 M trainable parameters.
Framework: TensorFlow 2.19 / Keras 3.
"""

import matplotlib
matplotlib.use('Agg')           # headless rendering — must come before pyplot

import matplotlib.pyplot as plt
import numpy as np
import os
import sys
import textwrap
import warnings

warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf
import keras
from keras import layers, ops, Model, Input

import kagglehub
from pathlib import Path
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)

# ── Output directory ──────────────────────────────────────────────────────────
_OUT_PREFERRED = Path('/mnt/user-data/outputs')
try:
    _OUT_PREFERRED.mkdir(parents=True, exist_ok=True)
    OUT = _OUT_PREFERRED
except PermissionError:
    OUT = Path('./outputs')
    OUT.mkdir(parents=True, exist_ok=True)

# ── Hyper-parameters ──────────────────────────────────────────────────────────
IMG_SIZE     = 128
BATCH_SIZE   = 8
EPOCHS       = 40
ALPHA        = 12    # α-SBFS output channels
BETA         = 24    # β-SBFS output channels
NUM_CLASSES  = 28
DENSE_UNITS  = 576   # Tuned so that trainable params ≈ 370 K


# =============================================================================
# 1.  SBFS Block  (keras.ops ONLY — no tf.* on KerasTensors)
# =============================================================================
class SBFSBlock(keras.Layer):
    """Structural Block for Feature Selection (Eqs. 5-9 of the paper).

    For each channel c, compute:
        σ_c  = std(F[:,:,c])
        e_c  = Shannon entropy of |F[:,:,c]| / sum|F[:,:,c]|
        μ_c  = winsorised mean (approximated by plain mean here)
        FDF_c = φ1·σ_c + φ2·e_c + φ3·μ_c,
                φi = xi / (σ_c + e_c + μ_c)

    FDF is normalised to [0,1] and used as a soft channel-attention mask.
    Output is projected to k channels via a 1×1 convolution.
    """

    def __init__(self, k: int, **kwargs):
        super().__init__(**kwargs)
        self.k    = k
        self.proj = layers.Conv2D(k, 1, padding='same', use_bias=True)

    def call(self, x, training=False):
        # ── per-channel statistics over (H, W) ───────────────────────────────
        sigma   = ops.std(x, axis=[1, 2])                            # (B, C)

        x_abs   = ops.abs(x) + 1e-8
        x_norm  = x_abs / ops.sum(x_abs, axis=[1, 2], keepdims=True)
        entropy = -ops.sum(
            x_norm * ops.log(x_norm + 1e-8), axis=[1, 2]
        )                                                            # (B, C)

        mu      = ops.mean(x, axis=[1, 2])                           # (B, C)

        # ── fitness score ─────────────────────────────────────────────────────
        s, e, m = ops.abs(sigma), ops.abs(entropy), ops.abs(mu)
        tot     = s + e + m + 1e-8
        FDF     = (s / tot) * s + (e / tot) * e + (m / tot) * m     # (B, C)

        # ── normalise → [0,1] and broadcast over spatial dims ────────────────
        fmin = ops.min(FDF, axis=1, keepdims=True)
        fmax = ops.max(FDF, axis=1, keepdims=True)
        attn = (FDF - fmin) / (fmax - fmin + 1e-8)                  # (B, C)
        attn = ops.expand_dims(ops.expand_dims(attn, 1), 1)         # (B,1,1,C)

        return self.proj(x * attn)

    def get_config(self):
        cfg = super().get_config()
        cfg['k'] = self.k
        return cfg


# =============================================================================
# 2.  Model sub-graphs
# =============================================================================

# ── Branch 1: CAE Encoder ─────────────────────────────────────────────────────
def _branch1(inp):
    """Convolutional Auto-Encoder encoder → 64×64×α."""
    # Encoder Part 1  →  64×64×32
    x = layers.Conv2D(32, 3, padding='same', activation='relu')(inp)
    x = layers.Conv2D(32, 3, padding='same', activation='relu')(x)
    x = layers.MaxPooling2D(2)(x)
    x = layers.Dropout(0.2)(x)

    # Encoder Part 2  →  32×32×32
    x = layers.Conv2D(32, 3, padding='same', activation='relu')(x)
    x = layers.Conv2D(32, 3, padding='same', activation='relu')(x)
    x = layers.MaxPooling2D(2)(x)
    x = layers.Dropout(0.2)(x)

    # g1 block: upsample 32→64
    x = layers.UpSampling2D(2)(x)

    # α-SBFS  →  64×64×α
    return SBFSBlock(ALPHA, name='sbfs_alpha')(x)


# ── Branch 2: Three Deep Blocks (3DB) ─────────────────────────────────────────
def _block_up(inp):
    """Block-UP: MaxPool(2×2) → Conv(64,1×1) → DilConv(64,3×3,d=1) → Up(1×1)."""
    x = layers.MaxPooling2D(2)(inp)                                  # 64×64×3
    x = layers.Conv2D(64, 1, padding='same', activation='relu')(x)
    x = layers.Conv2D(
        64, 3, padding='same', dilation_rate=(1, 1), activation='relu'
    )(x)
    x = layers.UpSampling2D(size=(1, 1))(x)                         # no-op
    return x                                                         # 64×64×64


def _block_mid(inp):
    """Block-MID: AvgPool(4×4) → Conv(64,1×1) → DilConv(64,3×3,d=2) → Up(2×2)."""
    x = layers.AveragePooling2D(4)(inp)                              # 32×32×3
    x = layers.Conv2D(64, 1, padding='same', activation='relu')(x)
    x = layers.Conv2D(
        64, 3, padding='same', dilation_rate=(2, 2), activation='relu'
    )(x)
    x = layers.UpSampling2D(2)(x)                                   # 64×64×64
    return x


def _block_down(inp):
    """Block-DOWN: GlobalMaxPool → Conv(64,1×1) → DilConv(64,3×3,d=3) → Up(64×64)."""
    x = layers.GlobalMaxPooling2D(keepdims=True)(inp)               # 1×1×3
    x = layers.Conv2D(64, 1, padding='same', activation='relu')(x)
    x = layers.Conv2D(
        64, 3, padding='same', dilation_rate=(3, 3), activation='relu'
    )(x)
    x = layers.UpSampling2D(size=(64, 64))(x)                      # 64×64×64
    return x


def _branch2(inp):
    """Three Deep Blocks model → 64×64×β."""
    up   = _block_up(inp)
    mid  = _block_mid(inp)
    down = _block_down(inp)

    Fcon = layers.Concatenate()([up, mid, down])                    # 64×64×192

    x = layers.DepthwiseConv2D(3, padding='same', activation='relu')(Fcon)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(DENSE_UNITS, activation='relu')(x)             # channel-wise FC
    x = layers.Dropout(0.3)(x)

    # g2 block: 1×1 conv, restore 192 channels
    x = layers.Conv2D(192, 1, padding='same', activation='relu')(x)

    # β-SBFS  →  64×64×β
    return SBFSBlock(BETA, name='sbfs_beta')(x)


# ── Full E3B-Net ──────────────────────────────────────────────────────────────
def build_e3b_net(num_classes: int = NUM_CLASSES) -> Model:
    """Build and return the E3B-Net model (≈ 370 K trainable params)."""
    inp = Input(shape=(IMG_SIZE, IMG_SIZE, 3), name='input')

    F1 = _branch1(inp)                                              # 64×64×12
    F2 = _branch2(inp)                                              # 64×64×24

    # Fusion
    Fc  = layers.Concatenate(name='fusion')([F1, F2])              # 64×64×36
    x   = layers.DepthwiseConv2D(
        3, padding='same', activation='relu', name='fusion_dw'
    )(Fc)

    # Classification head
    x   = layers.GlobalAveragePooling2D(name='gap')(x)
    out = layers.Dense(num_classes, activation='softmax', name='predictions')(x)

    return Model(inp, out, name='E3B-Net')


# =============================================================================
# 3.  Dataset helpers
# =============================================================================

def _find_split_dirs(root: Path):
    """Locate the train/ and test/ sub-directories under the dataset root."""
    for candidate in [root, *sorted(root.rglob('*'))]:
        if candidate.is_dir() and (candidate / 'train').is_dir() \
                and (candidate / 'test').is_dir():
            return candidate / 'train', candidate / 'test'
    raise FileNotFoundError(f'Cannot find train/test split under {root}')


def load_datasets(train_dir: Path, test_dir: Path):
    """Return (train_ds, val_ds, test_ds, class_names).

    * 80/20 split taken from the train/ directory.
    * Test set is loaded WITHOUT the deprecated 'classes' kwarg; labels are
      remapped to the training-set class indices via a StaticHashTable so that
      any class present in test but absent in train is silently dropped.
    """
    common_kw = dict(
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode='int',
    )

    # 80 / 20 split from train/
    train_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir, validation_split=0.2, subset='training',  seed=42, **common_kw
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir, validation_split=0.2, subset='validation', seed=42, **common_kw
    )
    class_names = train_ds.class_names          # 28 classes

    # Test set — load without 'classes' kwarg, then remap
    test_raw    = tf.keras.utils.image_dataset_from_directory(
        test_dir, shuffle=False, **common_kw
    )
    test_cls    = test_raw.class_names          # may be only 27
    cls_idx     = {c: i for i, c in enumerate(class_names)}  # O(1) lookups

    t_keys = tf.constant(
        [i for i, c in enumerate(test_cls) if c in cls_idx], dtype=tf.int64
    )
    t_vals = tf.constant(
        [cls_idx[c] for c in test_cls if c in cls_idx], dtype=tf.int64
    )
    table = tf.lookup.StaticHashTable(
        tf.lookup.KeyValueTensorInitializer(t_keys, t_vals),
        default_value=tf.constant(-1, dtype=tf.int64),
    )

    test_ds = (
        test_raw
        .map(
            lambda x, y: (x, table.lookup(tf.cast(y, tf.int64))),
            num_parallel_calls=tf.data.AUTOTUNE,
        )
        .filter(lambda x, y: tf.reduce_all(y >= 0))
    )

    # Normalise to [0, 1]
    def _norm(img, lbl):
        return tf.cast(img, tf.float32) / 255.0, lbl

    # Simple augmentation for training (tf.image — safe inside tf.data.map)
    def _aug(img, lbl):
        img = tf.cast(img, tf.float32) / 255.0
        img = tf.image.random_flip_left_right(img)
        img = tf.image.random_brightness(img, max_delta=0.1)
        img = tf.image.random_contrast(img, lower=0.9, upper=1.1)
        img = tf.clip_by_value(img, 0.0, 1.0)
        return img, lbl

    train_ds = train_ds.map(_aug,  num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)
    val_ds   = val_ds.map(_norm,   num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)
    test_ds  = test_ds.map(_norm,  num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)

    return train_ds, val_ds, test_ds, class_names


# =============================================================================
# 4.  Plotting helpers
# =============================================================================

def _short(name: str, max_len: int = 16) -> str:
    return textwrap.shorten(name, max_len, placeholder='…')


def plot_training_curves(history, path: Path) -> None:
    ep  = range(1, len(history.history['loss']) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))

    ax1.plot(ep, history.history['loss'],        label='train loss')
    ax1.plot(ep, history.history['val_loss'],    label='val loss')
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Loss')
    ax1.set_title('Training / Validation Loss')
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2.plot(ep, history.history['accuracy'],    label='train acc')
    ax2.plot(ep, history.history['val_accuracy'], label='val acc')
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Accuracy')
    ax2.set_title('Training / Validation Accuracy')
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f'Saved: {path}')


def plot_confusion_matrix(y_true, y_pred, class_names: list, path: Path) -> None:
    n   = len(class_names)
    cm  = confusion_matrix(y_true, y_pred, labels=list(range(n)))
    cmn = cm.astype(float) / (cm.sum(axis=1, keepdims=True) + 1e-8)

    fig, ax = plt.subplots(figsize=(max(14, n * 0.55), max(12, n * 0.5)))
    im = ax.imshow(cmn, cmap='Blues', vmin=0, vmax=1)
    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    short = [_short(c) for c in class_names]
    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    ax.set_xticklabels(short, rotation=90, fontsize=7)
    ax.set_yticklabels(short, fontsize=7)
    ax.set_xlabel('Predicted')
    ax.set_ylabel('True')
    ax.set_title('Normalised Confusion Matrix — E3B-Net on PlantDoc')

    plt.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f'Saved: {path}')


def plot_per_class_metrics(y_true, y_pred, class_names: list, path: Path) -> None:
    n = len(class_names)
    p, r, f, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=list(range(n)), zero_division=0
    )

    x     = np.arange(n)
    width = 0.25
    fig, ax = plt.subplots(figsize=(max(16, n * 0.65), 6))
    ax.bar(x - width, p, width, label='Precision', alpha=0.85)
    ax.bar(x,         r, width, label='Recall',    alpha=0.85)
    ax.bar(x + width, f, width, label='F1-score',  alpha=0.85)

    short = [_short(c) for c in class_names]
    ax.set_xticks(x)
    ax.set_xticklabels(short, rotation=45, ha='right', fontsize=7)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel('Score')
    ax.set_title('Per-class Precision / Recall / F1  —  E3B-Net on PlantDoc')
    ax.legend()
    ax.grid(axis='y', alpha=0.3)

    plt.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f'Saved: {path}')


def plot_summary_table(metrics: dict, path: Path) -> None:
    cols = ['Metric', 'This run (train-from-scratch)', 'Paper (w/ pretraining)']
    rows = [
        ['Accuracy',        f"{metrics['accuracy']:.4f}",  '0.8456'],
        ['Macro Precision', f"{metrics['precision']:.4f}", '—'],
        ['Macro Recall',    f"{metrics['recall']:.4f}",    '—'],
        ['Macro F1-score',  f"{metrics['f1']:.4f}",        '—'],
        ['Trainable params', f"~{metrics['params'] / 1e6:.3f} M", '~0.37 M'],
    ]

    fig, ax = plt.subplots(figsize=(10, 3))
    ax.axis('off')
    tbl = ax.table(cellText=rows, colLabels=cols, loc='center', cellLoc='center')
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(11)
    tbl.scale(1, 1.9)
    for j in range(len(cols)):
        tbl[(0, j)].set_facecolor('#2c7bb6')
        tbl[(0, j)].set_text_props(color='white', fontweight='bold')

    ax.set_title(
        'E3B-Net Results vs. Paper\n'
        '(paper trained on PlantVillage then fine-tuned on PlantDoc;\n'
        ' this run is end-to-end train-from-scratch on PlantDoc)',
        pad=14, fontsize=9,
    )
    plt.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'Saved: {path}')


# =============================================================================
# 5.  Main
# =============================================================================

def main() -> None:
    print('TensorFlow :', tf.__version__)
    print('Keras      :', keras.__version__)

    # ── Download dataset ──────────────────────────────────────────────────────
    print('\n[1/5] Downloading PlantDoc via KaggleHub …')
    ds_root = Path(kagglehub.dataset_download('nirmalsankalana/plantdoc-dataset'))
    train_dir, test_dir = _find_split_dirs(ds_root)
    print(f'      train dir : {train_dir}')
    print(f'      test  dir : {test_dir}')

    # ── Load data ─────────────────────────────────────────────────────────────
    print('\n[2/5] Loading & preprocessing datasets …')
    train_ds, val_ds, test_ds, class_names = load_datasets(train_dir, test_dir)
    print(f'      {len(class_names)} classes: {class_names[:4]} …')

    # ── Build model ───────────────────────────────────────────────────────────
    print('\n[3/5] Building E3B-Net …')
    model = build_e3b_net(num_classes=len(class_names))
    model.summary(line_length=110)

    trainable_params = sum(
        int(np.prod(v.shape)) for v in model.trainable_variables
    )
    total_params = model.count_params()
    print(f'\n      Trainable params : {trainable_params:,}  (target ≈ 370,000)')
    print(f'      Total     params : {total_params:,}')

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy'],
    )

    callbacks = [
        keras.callbacks.ModelCheckpoint(
            OUT / 'e3b_best.keras',
            monitor='val_accuracy', save_best_only=True, verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss', factor=0.5, patience=5,
            min_lr=1e-6, verbose=1,
        ),
        keras.callbacks.EarlyStopping(
            monitor='val_accuracy', patience=10,
            restore_best_weights=True, verbose=1,
        ),
    ]

    # ── Train ─────────────────────────────────────────────────────────────────
    print('\n[4/5] Training …')
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=EPOCHS,
        callbacks=callbacks,
        verbose=1,
    )

    # ── Evaluate ──────────────────────────────────────────────────────────────
    print('\n[5/5] Evaluating on test set …')
    # Collect true labels (labels are already remapped to train indices)
    all_labels = []
    for _, labels in test_ds:
        all_labels.extend(labels.numpy())
    y_true   = np.array(all_labels, dtype=np.int64)

    # Predict using the dataset directly (memory-efficient)
    y_pred_p = model.predict(test_ds, verbose=1)
    y_pred   = np.argmax(y_pred_p, axis=1)

    n_cls = len(class_names)
    report = classification_report(
        y_true, y_pred,
        target_names=class_names,
        labels=list(range(n_cls)),
        zero_division=0,
        output_dict=True,
    )
    acc  = report['accuracy']
    prec = report['macro avg']['precision']
    rec  = report['macro avg']['recall']
    f1   = report['macro avg']['f1-score']

    print(f'\n  Accuracy        : {acc:.4f}')
    print(f'  Macro Precision : {prec:.4f}')
    print(f'  Macro Recall    : {rec:.4f}')
    print(f'  Macro F1-score  : {f1:.4f}')
    print()
    print(classification_report(
        y_true, y_pred,
        target_names=class_names,
        labels=list(range(n_cls)),
        zero_division=0,
    ))

    # ── Save plots ────────────────────────────────────────────────────────────
    print('\nSaving plots …')
    plot_training_curves(history,  OUT / 'e3b_training_curves.png')
    plot_confusion_matrix(y_true, y_pred, class_names,
                          OUT / 'e3b_confusion_matrix.png')
    plot_per_class_metrics(y_true, y_pred, class_names,
                           OUT / 'e3b_per_class_metrics.png')
    plot_summary_table(
        {'accuracy': acc, 'precision': prec, 'recall': rec,
         'f1': f1, 'params': trainable_params},
        OUT / 'e3b_summary_table.png',
    )

    print(f'\nAll outputs saved to {OUT}')


if __name__ == '__main__':
    main()
