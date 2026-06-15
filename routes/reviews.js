const express = require('express');
const router = express.Router({ mergeParams: true });
const Listing = require("../models/listing.js");
const WrapAsync = require("../utils/WrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { reviewSchema } = require("../schema.js");
const Review = require("../models/review.js");
const { validateReview,isLoggedIn,isReviewAuthor } = require("../MiddleWare.js");
const reviewController = require("../controllers/review.js")

// CREATE REVIEW

router.post("/", validateReview, isLoggedIn, WrapAsync(reviewController.createReview));

// Delete Review
router.delete("/:reviewId", isLoggedIn, isReviewAuthor, WrapAsync(reviewController.destroyReview));

module.exports = router;