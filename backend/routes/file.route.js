// backend/routes/file.route.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { verifyJWT } = require("../middleware/auth.middleware");
const File = require("../models/File.model");
const fs = require("fs");


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

// Upload encrypted file
router.post(
  "/upload",
  verifyJWT,
  upload.single("file"),
  async (req, res) => {
    try {
      const { encryptedKey } = req.body;

      if (!req.file || !encryptedKey) {
        return res.status(400).json({ error: "Missing file or key" });
      }

      const fileDoc = await File.create({
        owner: req.user._id,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storagePath: req.file.path,
        encryptedKey,
      });

      res.status(201).json({
        success: true,
        file: fileDoc,
      });
    } catch (err) {
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

router.get("/my", verifyJWT, async (req, res) => {
  try {
    const files = await File.find({ owner: req.user._id })
        .select("_id originalName size createdAt encryptedKey");


    console.log("here we are doing testing only delete above line later and uncomment below line");
    // const files = await File.find({ owner: req.user._id })
    //   .select("originalName size createdAt");

    res.status(200).json({
      success: true,
      files,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// GET: download encrypted file
router.get("/download/:id", verifyJWT, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const absolutePath = path.resolve(file.storagePath);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.originalName}.enc"`
    );
    res.setHeader("Content-Type", "application/octet-stream");

    const stream = fs.createReadStream(absolutePath);
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
});



module.exports = router;
