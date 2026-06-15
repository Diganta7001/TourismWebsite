const express = require('express');
const router = express.Router({ mergeParams: true });
const User = require("../models/users.js");
const WrapAsync = require("../utils/WrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { saveRediectUrl } = require('../MiddleWare.js');
const userController = require("../controllers/users.js")

router.get("/signup",userController.renderSignupForm);

router.post("/signup", WrapAsync(userController.signup));

router.get("/login",userController.renderLoginForm)

router.post(
    "/login",
    saveRediectUrl,
    passport.authenticate("local", {
        failureRedirect: "/login",
        failureFlash: true
    }),
    userController.login
    
)

router.get("/logout", userController.logout);

module.exports = router;

