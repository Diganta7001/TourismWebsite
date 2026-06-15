const express = require('express');
const router = express.Router();
const Listing = require("../models/listing.js");
const WrapAsync = require("../utils/WrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { listingSchema } = require("../schema.js");
const { isLoggedIn, isOwner, validateListing } = require("../MiddleWare.js");
const listingController = require("../controllers/listing.js")


//Index - Show all listings
router.get("/", WrapAsync(listingController.index));

//NEW - Form
router.get("/new",isLoggedIn, listingController.renderNewForm);

// CREATE
router.post(
    "/",
    isLoggedIn,
    validateListing ,
    WrapAsync(listingController.createListing)
);

// SHOW
router.get("/:id", WrapAsync(listingController.showListing));

// EDIT FORM
router.get("/:id/edit", isLoggedIn, isOwner, WrapAsync(listingController.renderEditForm));

// UPDATE
router.put(
    "/:id", 
    isLoggedIn,
    isOwner,
    validateListing,
    WrapAsync(listingController.updateListing)
);

// DELETE
router.delete("/:id", isLoggedIn, isOwner, WrapAsync(listingController.destroyListing));

module.exports = router;