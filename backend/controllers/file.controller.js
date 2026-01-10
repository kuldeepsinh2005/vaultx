// backend/controllers/file.controller.js
const File = require("../models/File.model");
const { getStorageProvider } = require("../storage");
const { ensureFolderPath } = require("../utils/folderHelper");
// Upload encrypted file
exports.uploadFile = async (req, res) => {
  try {
    const { wrappedKey } = req.body;

    if (!req.file || !wrappedKey) {
      return res.status(400).json({ error: "Missing file or wrapped key" });
    }

    const originalFilename = req.file.originalname; // ✅ FIX
    let folderId = null;
    const relativePath = req.body.relativePath || null;
    if (relativePath && relativePath.includes("/")) {
      const parts = relativePath.split("/");

      // remove filename
      parts.pop();

      // 👇 IMPORTANT: If user selected a target folder
      if (req.body.folder) {
        // Create uploaded folder INSIDE selected folder
        folderId = await ensureFolderPath(
          req.user._id,
          parts,
          req.body.folder   // 👈 base folder
        );
      } else {
        // Normal folder upload at root
        folderId = await ensureFolderPath(
          req.user._id,
          parts
        );
      }
    } else if (req.body.folder) {
      // Single file upload into selected folder
      folderId = req.body.folder;
    }

    const storage = getStorageProvider();

    // Always unique name in storage
    const storageFilename = `${Date.now()}-${originalFilename}`;

    const result = await storage.save(req.file.buffer, {
      filename: storageFilename,
      mimeType: req.file.mimetype,
    });

    const fileDoc = await File.create({
      owner: req.user._id,
      originalName: originalFilename,
      mimeType: req.file.mimetype,
      size: result.size,
      storagePath: result.path,
      storageProvider: result.provider,
      wrappedKey,
      folder: folderId || null,
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
    }).select("_id originalName size createdAt wrappedKey");


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



/*
// for future use with storage providers
const { getStorageProvider } = require("../storage");
const File = require("../models/File.model");

exports.uploadEncryptedFile = async (req, res) => {
  const storage = getStorageProvider();

  const result = await storage.save(req.file.buffer, {
    filename: `${Date.now()}-${req.file.originalname}`,
  });

  const file = await File.create({
    owner: req.user._id,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: result.size,
    storagePath: result.path,
    storageProvider: result.provider,
    encryptedKey: req.body.encryptedKey,
  });

  res.status(201).json({ success: true, file });
};


*/