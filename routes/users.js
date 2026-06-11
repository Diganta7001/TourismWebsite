const express = require('express');
const router = express.Router({ mergeParams: true });
const User = require("../models/users.js");
const WrapAsync = require("../utils/WrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { saveRediectUrl } = require('../MiddleWare.js');

router.get("/signup",(req,res)=>{
    res.render("Users/signup.ejs");
})

router.post("/signup", WrapAsync(async (req, res,next) => {
        try{
        const { username,email, password } = req.body;
        const user = new User({ email: email, username: username });
        const registeredUser = await User.register(user, password);
        console.log(registeredUser);
        req.login(registeredUser, err => {
            if (err) {
                return next(err);
            }
            req.flash("success", `Welcome to WonderLust, ${registeredUser.username}!`);
            res.redirect("/listings");
        });
        // req.flash("success", "Welcome to WonderLust!");
        // res.redirect("/listings");
        }catch(e){
            req.flash("error", e.message);
            res.redirect("/signup");
        }
}));

router.get("/login",(req,res)=>{
    res.render("Users/login.ejs");
})

router.post(
    "/login",
    saveRediectUrl,
    passport.authenticate("local", {
        failureRedirect: "/login",
        failureFlash: true
    }),
    (req, res) => {
        req.flash("success", `Welcome back! ${req.user.username}`);

        let redirectUrl = res.locals.redirectUrl || "/listings";
        res.redirect(redirectUrl);
    }
);

router.get("/logout", (req, res,next) => {
    req.logout((err) => {
        if (err) { 
            return next(err); 
        }
        req.flash("success", "You have been logged out!");
        res.redirect("/listings");
    });
});

module.exports = router;

