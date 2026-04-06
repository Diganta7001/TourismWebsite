const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const WrapAsync = require("./utils/WrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema,reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");
const listingRoutes = require("./routes/listing.js");

// app config..

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// db connection


const mongo_url = "mongodb://127.0.0.1:27017/WonderLust2";

mongoose.connect(mongo_url)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.log("MongoDB Connection Error:", err));


// joi validation middleware


const validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);

    if (error) {
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, msg);
    }
    next();
};

const validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body);
    if(error){
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, msg);   
    }
    next();
};
//listing routes

app.use("/listings", listingRoutes);

//Home
app.get("/", (req, res) => {
    res.send("It is working");
});

// CREATE REVIEW
app.post("/listings/:id/reviews", validateReview, WrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    const review = new Review(req.body.review);
    listing.reviews.push(review);
    await review.save();
    await listing.save();
    res.redirect(`/listings/${id}`);
}));

// Delete Review
app.delete("/listings/:id/reviews/:reviewId", WrapAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, {$pull: { reviews: reviewId }});
    await Review.findByIdAndDelete(reviewId);

    res.redirect(`/listings/${id}`);
}));


//ERROR 404 HANDLER


app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found !!!"));
});


// GLOBAL ERROR HANDLER


app.use((err, req, res, next) => {
    let { statusCode = 500, message = "OOps!! Something went wrong ! " } = err;
    res.status(statusCode).render("error", { statusCode, message });
});


// SERVER START


app.listen(8080, () => {
    console.log("Server listening on port 8080 !!!");
});