const express = require("express");
const app = express()
const mongoose = require("mongoose")
const Listing = require("./models/listing.js");
const path = require("path")
app.set("view engine","ejs")
app.set("views",path.join(__dirname,"views"))
app.use(express.urlencoded ({ extended : true}))

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

app.get("/listings/:id", async (req, res) => {
    let { id } = req.params;
    
    const listingData = await Listing.findById(id);

    if (!listingData) {
        return res.status(404).send("Listing not found");
    }

    res.render("listing/show", { listingData });
});

app.post("/newListing",async (req,res)=>{
    let newListing = req.body
    console.log(newListing)
    console.log(newListing.listing)
    const addingNewListing = await new Listing(newListing.listing)
    addingNewListing.save()
    res.redirect("/listings")
    
})
