const express = require("express");
const app = express()
const mongoose = require("mongoose")
const Listing = require("./models/listing.js");
const path = require("path")
const methodOverride = require("method-override")
const ejsMate = require("ejs-mate")
const WrapAsync = require("./utils/WrapAsync.js")
const ExpressError = require("./utils/ExpressError.js")


app.use(express.static(path.join(__dirname,"/public")))
app.engine('ejs', ejsMate);
app.set("view engine","ejs")
app.set("views",path.join(__dirname,"views"))
app.use(express.urlencoded ({ extended : true}))
app.use(methodOverride("_method"))

const mongo_url = "mongodb://127.0.0.1:27017/WonderLust2"
main().then(()=>{
    console.log("connected to mongodb")
}).catch((e)=>{
    console.log(`error occured ${e}`)
})

async function main(){
   await mongoose.connect(mongo_url)
}

app.listen(8080,()=>{
    console.log("listining to port 8080")
})

app.get("/",(req,res)=>{
    res.send("it is working")
})

app.get("/listings",async (req,res)=>{

    const allListings = await Listing.find({})
    res.render("listing/index.ejs",{allListings})

})
app.get("/listings/new",(req,res)=>{
    res.render("listing/new.ejs")
})
// show route
app.get("/listings/:id", WrapAsync(async (req, res) => {
    let { id } = req.params;
    
    const listingData = await Listing.findById(id);

    if (!listingData) {
        return res.status(404).send("Listing not found");
    }

    res.render("listing/show", { listingData });
}));
// create route
app.post("/newListing", async (req, res,next) => {
  try {
    const listing = new Listing(req.body.listing);
    await listing.save();
    res.redirect("/listings");
  } catch (err) {
    next(err);
    console.log("Validation error:", err.message);
    res.status(400).send("Validation failed");
  }
});

//edit route

app.get("/listing/:id/edit",async (req,res)=>{
    let {id} = req.params
    console.log(id)
    let listing = await Listing.findById(id)
    console.log(listing)
    res.render("listing/edit.ejs",{listing})

})

app.put("/listings/:id", async (req,res)=>{
    let {id} = req.params
    console.log(id)
    console.log(req.body.listing)
    await Listing.findByIdAndUpdate(id,{...req.body.listing})
    res.redirect(`/listings/${id}`)

})

// Delete route

app.delete("/listing/:id",async (req,res)=>{
    let {id} = req.params
    console.log(id)
    let deletedElement = await Listing.findByIdAndDelete(id)
    console.log(deletedElement)
    res.redirect("/listings")
})

// 404 handler (NO PATH)
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found!!!"));
});
// custom error 
app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("listing/error", { statusCode, message });
});