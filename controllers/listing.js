const Listing = require("../models/listing");
const {isLoggedIn} = require("../MiddleWare.js");

module.exports.index =async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listing/index.ejs", { allListings });
}

module.exports.renderNewForm = (req, res) => {
    console.log(req.user);
    res.render("listing/new.ejs");
}

module.exports.showListing = async (req, res) => {
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
}

module.exports.createListing = async (req, res) => {
        let url = req.file.path;
        let filename = req.file.filename;
    
        const listing = new Listing(req.body.listing);
        listing.owner = req.user._id;
        listing.image = { url, filename };
        await listing.save();
        req.flash("success", "New listing created!");
        res.redirect("/listings");
    }

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found");
        throw new ExpressError(404, "Listing not found");
    }

    console.log(listing);
    res.render("listing/edit.ejs", { listing });
}

module.exports.updateListing = async (req, res) => {
        const { id } = req.params;
        let listing = await Listing.findById(id);
        if(req.file){
            let url = req.file.path;
            let filename = req.file.filename;
            listing.image = { url, filename };
            await listing.save();
        }
        await Listing.findByIdAndUpdate(
            id,
            { ...req.body.listing },
            { runValidators: true }
        );
        req.flash("success", "Listing updated successfully!");
        res.redirect(`/listings/${id}`);
    }

module.exports.destroyListing = async (req, res) => {
    const { id } = req.params;
    const deletedListing = await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing deleted successfully!");

    if (!deletedListing) {
        throw new ExpressError(404, "Listing not found");
    }

    res.redirect("/listings");
}