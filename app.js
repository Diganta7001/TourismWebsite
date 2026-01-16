const express = require("express");
const app = express()
const mongoose = require("mongoose")
const Listing = require("./models/listing.js");

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

app.get("/testListing",async (req,res)=>{
    let sampleListing = new Listing({
        title: "my villa",
        description : " dscsds",
        price : 1210,
        country : "India"
    })
    await sampleListing.save()
    console.log("sample saved")
    res.send("sample saved successfully")

})