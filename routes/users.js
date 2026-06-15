const express = require('express');
const router = express.Router({ mergeParams: true });
const User = require("../models/users.js");
const WrapAsync = require("../utils/WrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { saveRediectUrl } = require('../MiddleWare.js');
const userController = require("../controllers/users.js")

router.route("/signup")
.get(userController.renderSignupForm)
.post(WrapAsync(userController.signup));

router.route("/login")
    .get(userController.renderLoginForm)
    .post(
        saveRediectUrl,
        passport.authenticate("local", {
            failureRedirect: "/login",
            failureFlash: true
        }),
    userController.login
    
)

router.get("/logout", userController.logout);

module.exports = router;

