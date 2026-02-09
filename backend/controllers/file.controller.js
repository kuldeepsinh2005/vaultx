// backend/controllers/file.controller.js
const File = require("../models/File.model");
const { getStorageProvider } = require("../storage");
const { ensureFolderPath } = require("../utils/folderHelper");
const mongoose = require("mongoose");
const StorageUsage = require("../models/StorageUsage.model");

// Upload encrypted file
exports.uploadFile = async (req, res) => {
  try {
    const { wrappedKey, iv } = req.body;

    if (!req.file || !wrappedKey || !iv) {
      return res.status(400).json({ error: "Missing file or encryption data" });
    }

    const user = req.user;
    const fileSize = req.file.buffer.length;

    // 🔒 BILLING / QUOTA CHECK
    if (user.usedStorage + fileSize > user.maxStorage) {
      return res.status(403).json({
        error: "Storage limit exceeded",
      });
    }

    const originalFilename = req.file.originalname;
    let folderId = null;

    const relativePath = req.body.relativePath || null;
    if (relativePath && relativePath.includes("/")) {
      const parts = relativePath.split("/");
      parts.pop(); // remove filename

      if (req.body.folder) {
        folderId = await ensureFolderPath(
          user._id,
          parts,
          req.body.folder
        );
      } else {
        folderId = await ensureFolderPath(user._id, parts);
      }
    } else if (req.body.folder) {
      folderId = req.body.folder;
    }

    const storage = getStorageProvider();

    // ✅ STABLE FILE ID (IMPORTANT FOR S3)
    const fileId = new mongoose.Types.ObjectId();

    // ✅ S3 / storage key (provider-agnostic)
    const storageKey = `vaultx/users/${user._id}/${fileId}.enc`;

    const result = await storage.save(req.file.buffer, {
      filename: storageKey,
      contentType: "application/octet-stream",
    });

    const fileDoc = await File.create({
      _id: fileId,
      owner: user._id,
      originalName: originalFilename,
      mimeType: req.file.mimetype,
      size: result.size,
      storagePath: result.path,
      storageProvider: result.provider,
      wrappedKey,
      iv,
      folder: folderId || null,
    });

    // 📊 UPDATE STORAGE USAGE
    user.usedStorage += result.size;
    await user.save();

    await StorageUsage.create({
      user: user._id,
      file: fileDoc._id,
      size: result.size,
      effectiveFrom: new Date(),
      effectiveTo: null, // still stored
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
    const folder = req.query.folder || null;

    const files = await File.find({
      owner: req.user._id,
      folder,
      isDeleted: false,
    }).select("_id originalName size createdAt wrappedKey iv");

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
      isDeleted: false,
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const storage = getStorageProvider();
    const stream = await storage.getStream(file.storagePath);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.originalName}.enc"`
    );
    res.setHeader("Content-Type", "application/octet-stream");

    stream.pipe(res);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
};

// PATCH /api/files/:id/move
exports.moveFile = async (req, res) => {
  try {
    const { folderId } = req.body;

    await File.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { folder: folderId || null }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Move failed" });
  }
};

// PATCH /api/files/:id/delete
// PATCH /api/files/:id/delete
exports.deleteFile = async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.user._id,
      isDeleted: false,
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // 🗑️ SOFT DELETE ONLY
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();
    


    // ❌ DO NOT delete from S3 here
    // ❌ DO NOT update usedStorage here

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "File delete failed" });
  }
};



/*

// PATCH /api/files/:id/delete
  exports.deleteFile = async (req, res) => {
    try {
      console.log("1");
      await File.findOneAndUpdate(
        { _id: req.params.id, owner: req.user._id },
        { isDeleted: true, deletedAt: new Date() }
      );
      console.log("2");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "File delete failed" });
    }
  };

  */