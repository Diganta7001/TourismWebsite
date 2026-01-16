const express = require("express");
const app = express()
const mongoose = require("mongoose")

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