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
} = require("../controllers/file.controller");

// Storage config
const upload = multer({ storage: multer.memoryStorage() });

// Routes
router.post(
  "/upload",
  verifyJWT,
  upload.single("file"),
  uploadFile
);

router.get("/my", verifyJWT, getMyFiles);

router.get("/download/:id", verifyJWT, downloadFile);
router.patch("/:id/move", verifyJWT, moveFile);

module.exports = router;
