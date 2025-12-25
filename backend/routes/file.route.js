// backend/routes/file.route.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { verifyJWT } = require("../middleware/auth.middleware");
const {
  uploadFile,
  getMyFiles,
  downloadFile,
} = require("../controllers/file.controller");

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Routes
router.post(
  "/upload",
  verifyJWT,
  upload.single("file"),
  uploadFile
);

router.get("/my", verifyJWT, getMyFiles);

router.get("/download/:id", verifyJWT, downloadFile);

module.exports = router;
