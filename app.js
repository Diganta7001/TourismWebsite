const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema,reviewSchema } = require("./schema.js");
const listingRoutes = require("./routes/listing.js");
const reviewRoutes = require("./routes/reviews.js");
const session = require("express-session");


// app config..

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// session config
const sessionConfig = {
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: true,
    cookie:{
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, 
        maxAge: 1000 * 60 * 60 * 24 * 7, 
    }
};
app.use(session(sessionConfig));

// db connection


const mongo_url = "mongodb://127.0.0.1:27017/WonderLust2";

mongoose.connect(mongo_url)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.log("MongoDB Connection Error:", err));


// joi validation middleware
const validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);

    if (error) {
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, msg);
    }
    next();
};
const validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body);
    if(error){
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, msg);   
    }
    next();
};


//listing routes
app.use("/listings", listingRoutes);


//review routes
app.use("/listings/:id/reviews", reviewRoutes);


//Home
app.get("/", (req, res) => {
    res.send("It is working");
});



//ERROR 404 HANDLER
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found !!!"));
});


// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
    let { statusCode = 500, message = "OOps!! Something went wrong ! " } = err;
    res.status(statusCode).render("error", { statusCode, message });
});


// SERVER START
app.listen(8080, () => {
    console.log("Server listening on port 8080 !!!");
});