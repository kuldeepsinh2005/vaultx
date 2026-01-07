// backend/routes/account.route.js
const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middleware/auth.middleware");
const {
  changeUsername,
  changePassword,
} = require("../controllers/account.controller");

router.patch("/username", verifyJWT, changeUsername);
router.patch("/password", verifyJWT, changePassword);

module.exports = router;
