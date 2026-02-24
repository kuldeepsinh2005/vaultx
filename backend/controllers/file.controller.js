// backend/controllers/file.controller.js
const File = require("../models/File.model");
const { getStorageProvider } = require("../storage");
const { ensureFolderPath } = require("../utils/folderHelper");
const mongoose = require("mongoose");
const StorageUsage = require("../models/StorageUsage.model");
const crypto = require("crypto");
const User = require("../models/User.model");

// backend/controllers/file.controller.js

exports.initiateMultipart = async (req, res) => {
  try {
    const { fileSize, partsCount } = req.body;
    const user = await User.findById(req.user._id);
    
    // 🔒 BILLING / QUOTA CHECK
    if (user.usedStorage + fileSize > user.maxStorage) {
      return res.status(403).json({ error: "Storage quota exceeded" });
    }

    const uniqueId = crypto.randomBytes(16).toString("hex");
    const storagePath = `vaultx/users/${req.user._id}/${uniqueId}.enc`;

    const storage = getStorageProvider();
    const uploadId = await storage.initiateMultipartUpload(storagePath);
    const urls = await storage.getMultipartUploadUrls(storagePath, uploadId, partsCount);

    res.json({ success: true, uploadId, storagePath, urls });
  } catch (err) {
    console.error("Initiate Multipart Error:", err);
    res.status(500).json({ error: "Failed to start upload" });
  }
};

exports.completeMultipart = async (req, res) => {
  const { uploadId, storagePath, parts, originalName, wrappedKey, iv, size, mimeType, folderId, relativePath } = req.body;
  const storage = getStorageProvider();

  try {
    // 1️⃣ Tell AWS S3 to stitch the file together
    await storage.completeMultipartUpload(storagePath, uploadId, parts);

    // 2️⃣ MONGODB TRANSACTION BLOCK
    try {
      let finalFolderId = folderId || null;
      if (relativePath && relativePath.includes("/")) {
        const partsArray = relativePath.split("/");
        partsArray.pop();
        finalFolderId = folderId 
          ? await ensureFolderPath(req.user._id, partsArray, folderId)
          : await ensureFolderPath(req.user._id, partsArray);
      }

      const newFile = await File.create({
        owner: req.user._id,
        originalName,
        wrappedKey,
        iv,
        size,
        mimeType,
        folder: finalFolderId,
        storagePath,
        storageProvider: "s3" 
      });

      // Update quota
      const user = await User.findById(req.user._id);
      user.usedStorage += size;
      await user.save();

      await StorageUsage.create({
        user: user._id, file: newFile._id, size, effectiveFrom: new Date(), effectiveTo: null
      });

      res.status(201).json({ success: true, file: newFile });

    } catch (dbError) {
      // 🚨 ROLLBACK: Database failed! Delete the file from S3 so it doesn't become an orphan.
      console.error("DB Save Failed! Rolling back S3...", dbError);
      await storage.delete(storagePath);
      throw new Error("Database save failed, S3 file rolled back.");
    }

  } catch (err) {
    console.error("Complete Multipart Error:", err);
    res.status(500).json({ error: "Failed to complete upload and sync database" });
  }
};
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
// 1️⃣ Generate the Upload Ticket
exports.getUploadTicket = async (req, res) => {
  try {
    const { fileSize } = req.body;

    // Security Check: Does the user have enough storage space?
    const user = await User.findById(req.user._id);
    if (user.usedStorage + fileSize > user.totalStorage) {
      return res.status(400).json({ error: "Storage quota exceeded. Please upgrade your plan." });
    }

    // Generate a secure, randomized path for S3
    const uniqueId = crypto.randomBytes(16).toString("hex");
    const storagePath = `vaultx/users/${req.user._id}/${uniqueId}.enc`;

    // Get the Presigned PUT URL from your storage provider
    const storage = getStorageProvider(); 
    const ticketData = await storage.getUploadUrlPost(storagePath);

    // Send the URL and the fields to the frontend
    res.json({ 
      success: true, 
      ticketUrl: ticketData.url, 
      fields: ticketData.fields, // ✅ New! AWS requires these fields in the form
      storagePath 
    });
  } catch (err) {
    console.error("Upload Ticket Error:", err);
    res.status(500).json({ error: "Failed to generate upload ticket" });
  }
};

// 2️⃣ Save to MongoDB after S3 upload succeeds
exports.finalizeUpload = async (req, res) => {
  try {
    const { 
      originalName, wrappedKey, iv, size, mimeType, folderId, storagePath 
    } = req.body;

    // Create the File document
    const newFile = new File({
      owner: req.user._id,
      originalName,
      wrappedKey,
      iv,
      size,
      mimeType,
      folder: folderId || null,
      storagePath,
      storageProvider: "s3" // ✅ FIX: Changed from 'provider' to 'storageProvider'
    });

    await newFile.save();

    // Safely increment the user's used storage
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { usedStorage: size }
    });

    res.status(201).json({ success: true, file: newFile });
  } catch (err) {
    console.error("Finalize Upload Error:", err);
    res.status(500).json({ error: "Failed to save file metadata" });
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
    res.setHeader('Content-Length', file.size);
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


exports.getPresignedDownloadUrl = async (req, res) => {
  try {
    // 1. Verify file exists and user owns it
    const file = await File.findOne({ _id: req.params.id, owner: req.user._id });
    if (!file) {
      return res.status(404).json({ error: "File not found or unauthorized" });
    }

    // 2. Get storage instance and generate URL
    const storage = getStorageProvider(); // or however you initialize your S3 class
    
    // Fallback if testing locally without S3
    if (typeof storage.getDownloadUrl !== "function") {
      return res.status(400).json({ error: "Direct download not supported in local mode." });
    }

    const url = await storage.getDownloadUrl(file.storagePath);

    // 3. Return the ticket to the frontend
    res.json({ success: true, url });

  } catch (err) {
    console.error("Presigned URL error:", err);
    res.status(500).json({ error: "Failed to generate secure download link" });
  }
};

// ✅ NEW: Explicitly abort a failed upload
exports.abortMultipart = async (req, res) => {
  try {
    const { uploadId, storagePath } = req.body;
    if (uploadId && storagePath) {
      const storage = getStorageProvider();
      await storage.abortMultipartUpload(storagePath, uploadId);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Abort Failed:", err);
    res.status(500).json({ error: "Failed to abort" });
  }
};