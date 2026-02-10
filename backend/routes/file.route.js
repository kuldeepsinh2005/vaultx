// backend/routes/file.route.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { verifyJWT } = require("../middleware/auth.middleware");
const {
  uploadFile,
  getMyFiles,
  downloadFile,
  moveFile,
  deleteFile
} = require("../controllers/file.controller");
const { enforceBillingClear } = require("../middleware/billing.middleware");

// Storage config
const upload = multer({ storage: multer.memoryStorage() });

// Routes
router.post(
  "/upload",
  verifyJWT,
  enforceBillingClear,  
  upload.single("file"),
  uploadFile
);

router.get("/my", verifyJWT, getMyFiles);

router.get("/download/:id", verifyJWT, enforceBillingClear,downloadFile);
router.patch("/:id/move", verifyJWT, moveFile);
router.patch("/:id/delete", verifyJWT, deleteFile);

module.exports = router;
