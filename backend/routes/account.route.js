// backend/routes/account.route.js
const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middleware/auth.middleware");
const {
  changeUsername,
  changePassword,
  updateRecoveryKey
} = require("../controllers/account.controller");

router.patch("/username", verifyJWT, changeUsername);
router.patch("/password", verifyJWT, changePassword);
router.patch("/recovery-key", verifyJWT, updateRecoveryKey);
module.exports = router;
