const express = require('express');
const router = express.Router({ mergeParams: true });
const Listing = require("../models/listing.js");
const WrapAsync = require("../utils/WrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { reviewSchema } = require("../schema.js");
const Review = require("../models/review.js");

const validateReview = (req, res, next) => {    
    const { error } = reviewSchema.validate(req.body);
    if(error){
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, msg); 
    }
    next();
};

// CREATE REVIEW

router.post("/", validateReview, WrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        throw new ExpressError(404, "Listing not found");
    }

    const review = new Review(req.body.review);
    listing.reviews.push(review);
    await review.save();
    await listing.save();
    res.redirect(`/listings/${id}`);
}));

// Delete Review
router.delete("/:reviewId", WrapAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, {$pull: { reviews: reviewId }});
    await Review.findByIdAndDelete(reviewId);

    res.redirect(`/listings/${id}`);
}));

module.exports = router;