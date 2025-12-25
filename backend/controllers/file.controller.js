const File = require("../models/File.model");
const fs = require("fs");
const path = require("path");

// Upload encrypted file
exports.uploadFile = async (req, res) => {
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
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
};

// Get logged-in user's files
exports.getMyFiles = async (req, res) => {
  try {
    const files = await File.find({ owner: req.user._id })
      .select("_id originalName size createdAt encryptedKey");

    res.status(200).json({
      success: true,
      files,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch files" });
  }
};

// Download encrypted file
exports.downloadFile = async (req, res) => {
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
};
