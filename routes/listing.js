const express = require('express');
const router = express.Router();
const Listing = require("../models/listing.js");
const WrapAsync = require("../utils/WrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { listingSchema } = require("../schema.js");
const { isLoggedIn, isOwner, validateListing } = require("../MiddleWare.js");
const listingController = require("../controllers/listing.js")
const multer  = require('multer')
const {storage} = require("../cloudConfig.js")
const upload = multer({storage})



router.route("/")
    .get(WrapAsync(listingController.index))
    // .post(isLoggedIn, validateListing, WrapAsync(listingController.createListing));
    .post(upload.single("listing[image]"), (req,res)=>{
        res.send(req.file);
    });


//New- Form
router.get("/new",isLoggedIn, listingController.renderNewForm);


router.route("/:id")
    .get(WrapAsync(listingController.showListing))
    .put(isLoggedIn, isOwner, validateListing, WrapAsync(listingController.updateListing))
    .delete(isLoggedIn, isOwner, WrapAsync(listingController.destroyListing));

// EDIT FORM
router.get("/:id/edit", isLoggedIn, isOwner, WrapAsync(listingController.renderEditForm));



module.exports = router;