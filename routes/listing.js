const express = require('express');
const router = express.Router();
const Listing = require("../models/listing.js");
const WrapAsync = require("../utils/WrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { listingSchema } = require("../schema.js");
const { isLoggedIn, isOwner, validateListing } = require("../MiddleWare.js");


//Index - Show all listings
router.get("/", WrapAsync(async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listing/index.ejs", { allListings });
}));

//NEW - Form
router.get("/new", isLoggedIn, (req, res) => {
    console.log(req.user);
    res.render("listing/new.ejs");
});

// CREATE
router.post(
    "/",
    isLoggedIn,
    validateListing ,
    WrapAsync(async (req, res) => {
        const listing = new Listing(req.body.listing);
        listing.owner = req.user._id;
        await listing.save();
        req.flash("success", "New listing created!");
        res.redirect("/listings");
    })
);

// SHOW
router.get("/:id", WrapAsync(async (req, res) => {
    const { id } = req.params;
    const listingData = await Listing.findById(id)
    .populate({path: "reviews", populate: { path: "author" }})
    .populate("owner");

    if (!listingData) {
        req.flash("error", "Listing not found");
        throw new ExpressError(404, "Listing not found");
    }
    console.log(listingData);
    res.render("listing/show.ejs", { listingData });
}));

// EDIT FORM
router.get("/:id/edit", isLoggedIn, isOwner, WrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found");
        throw new ExpressError(404, "Listing not found");
    }

    console.log(listing);
    res.render("listing/edit.ejs", { listing });
}));

// UPDATE
router.put(
    "/:id", 
    isLoggedIn,
    isOwner,
    validateListing,
    WrapAsync(async (req, res) => {
        const { id } = req.params;
        let listing = await Listing.findById(id);
        await Listing.findByIdAndUpdate(
            id,
            { ...req.body.listing },
            { runValidators: true }
        );
        req.flash("success", "Listing updated successfully!");
        res.redirect(`/listings/${id}`);
    })
);

// DELETE
router.delete("/:id", isLoggedIn, isOwner, WrapAsync(async (req, res) => {
    const { id } = req.params;
    const deletedListing = await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing deleted successfully!");

    if (!deletedListing) {
        throw new ExpressError(404, "Listing not found");
    }

    res.redirect("/listings");
}));

module.exports = router;