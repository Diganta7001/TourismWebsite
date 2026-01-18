const express = require("express");
const app = express()
const mongoose = require("mongoose")
const Listing = require("./models/listing.js");
const path = require("path")
const methodOverride = require("method-override")

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
app.get("/listings/:id", async (req, res) => {
    let { id } = req.params;
    
    const listingData = await Listing.findById(id);

    if (!listingData) {
        return res.status(404).send("Listing not found");
    }

    res.render("listing/show", { listingData });
});
// create route
app.post("/newListing",async (req,res)=>{
    let newListing = req.body
    console.log(newListing)
    console.log(newListing.listing)
    const addingNewListing = await new Listing(newListing.listing)
    addingNewListing.save()
    res.redirect("/listings")
    
})
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
