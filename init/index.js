const mongoose = require("mongoose")
const initData = require("./data.js")
const Listing = require("../models/listing.js")
mongo_url = "mongodb://127.0.0.1:27017/WonderLust2"
async function connectToDB(){
    await mongoose.connect(mongo_url)
}
connectToDB().then(()=>{
    console.log("connection successful from index.js")
}).catch((e)=>{
    console.log(`error occured ${e}`)
})
async function insertToDB() {
   await Listing.deleteMany({})
   await Listing.insertMany(initData.data)
   console.log(`data initalized`)
}
insertToDB()