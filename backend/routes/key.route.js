// backend/routes/key.route.js
const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middleware/auth.middleware");
const { 
        savePublicKey,
        restoreEncryptedPrivateKey
 } = require("../controllers/key.controller");

router.post("/public", verifyJWT, savePublicKey);
router.post("/restore", verifyJWT, restoreEncryptedPrivateKey);

module.exports = router;
