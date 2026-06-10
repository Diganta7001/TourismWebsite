const express = require('express');
const router = express.Router({ mergeParams: true });
const User = require("../models/users.js");
const WrapAsync = require("../utils/WrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const passport = require("passport");
const LocalStrategy = require("passport-local");

router.get("/signup",(req,res)=>{
    res.render("Users/signup.ejs");
})

router.post("/signup", WrapAsync(async (req, res) => {
        try{
        const { username,email, password } = req.body;
        const user = new User({ email: email, username: username });
        const registeredUser = await User.register(user, password);
        console.log(registeredUser);
        req.flash("success", "Welcome to WonderLust!");
        res.redirect("/listings");
        }catch(e){
            req.flash("error", e.message);
            res.redirect("/signup");
        }
}));

router.get("/login",(req,res)=>{
    res.render("Users/login.ejs");
})

router.post("/login", passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }), WrapAsync(async (req, res) => {
    res.send("Logged in successfully!");
}));


module.exports = router;

