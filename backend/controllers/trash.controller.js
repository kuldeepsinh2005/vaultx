// backend/controllers/trash.controller.js
const File = require("../models/File.model");
const Folder = require("../models/Folder.model");
const { getStorageProvider } = require("../storage");
const StorageUsage = require("../models/StorageUsage.model");
const User = require("../models/User.model");



exports.getTrash = async (req, res) => {
  const deletedFolders = await Folder.find({
    owner: req.user._id,
    isDeleted: true,
  }).lean();

  const deletedFiles = await File.find({
    owner: req.user._id,
    isDeleted: true,
  }).lean();

  const folderMap = {};

  // Initialize deleted folders
  deletedFolders.forEach(folder => {
    folderMap[folder._id] = {
      ...folder,
      children: [],
      files: [],
      isRoot: false,
    };
  });

  // Build folder hierarchy
  deletedFolders.forEach(folder => {
    if (folder.parent && folderMap[folder.parent]) {
      folderMap[folder.parent].children.push(folderMap[folder._id]);
    }
  });

  // Attach files to deleted folders ONLY
  deletedFiles.forEach(file => {
    if (file.folder && folderMap[file.folder]) {
      folderMap[file.folder].files.push(file);
    }
  });

  // Root folders = deleted folders whose parent is NOT deleted
  const rootFolders = Object.values(folderMap).filter(folder => {
    if (!folder.parent) return true;
    return !folderMap[folder.parent];
  });

  rootFolders.forEach(f => (f.isRoot = true));

  // Root files = deleted files whose parent folder is NOT deleted
  const rootFiles = deletedFiles.filter(file => {
    return !file.folder || !folderMap[file.folder];
  });

  res.json({
    folders: rootFolders || [],
    files: rootFiles || [],
  });
};



exports.restoreFile = async (req, res) => {
  await File.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    { isDeleted: false, deletedAt: null }
  );

  res.json({ success: true });
};

const restoreFolderRecursive = async (folderId, userId) => {
  await Folder.findOneAndUpdate(
    { _id: folderId, owner: userId },
    { isDeleted: false, deletedAt: null }
  );

  await File.updateMany(
    { folder: folderId, owner: userId },
    { isDeleted: false, deletedAt: null }
  );

  const children = await Folder.find({ parent: folderId, owner: userId });

  for (const child of children) {
    await restoreFolderRecursive(child._id, userId);
  }
};

exports.restoreFolder = async (req, res) => {
  await restoreFolderRecursive(req.params.id, req.user._id);
  res.json({ success: true });
};

// ... keep your existing getTrash, restoreFile, and restoreFolder functions ...

exports.permanentDeleteFile = async (req, res) => {
  const file = await File.findOne({
    _id: req.params.id,
    owner: req.user._id,
    isDeleted: true,
  });

  if (!file) {
    return res.status(404).json({ error: "File not found in trash" });
  }

  const storage = getStorageProvider();

  try {
    // 1️⃣ Delete from storage WITH ROBUST ERROR HANDLING
    try {
      await storage.delete(file.storagePath);
    } catch (storageErr) {
      // Handle both Local (ENOENT) and S3 (NoSuchKey/NotFound) missing file errors
      if (storageErr.code !== "ENOENT" && storageErr.code !== "NoSuchKey" && storageErr.name !== "NotFound") {
        console.error(`[Storage] Hard fail deleting ${file.storagePath}:`, storageErr.message);
        return res.status(500).json({ error: "Storage provider failed to delete the file." });
      }
      console.warn(`[Storage] File already missing from S3/Local. Proceeding with DB cleanup.`);
    }

    // 2️⃣ Stop billing
    await StorageUsage.findOneAndUpdate(
      { file: file._id, effectiveTo: null },
      { effectiveTo: new Date() }
    );

    // 3️⃣ Free quota safely (Anti-Negative Storage Protection)
    const updatedUser = await User.findByIdAndUpdate(file.owner, {
      $inc: { usedStorage: -file.size },
    }, { new: true });

    // Fallback: If out-of-sync DB causes negative storage, reset it to 0
    if (updatedUser && updatedUser.usedStorage < 0) {
      await User.findByIdAndUpdate(file.owner, { usedStorage: 0 });
    }

    // 4️⃣ Delete DB record
    await File.deleteOne({ _id: file._id });

    res.json({ success: true });

  } catch (err) {
    console.error("Permanent delete failed:", err);
    return res.status(500).json({ error: "Permanent delete failed" });
  }
};


const permanentDeleteFolderRecursive = async (folderId, userId) => {
  const storage = getStorageProvider();

  const files = await File.find({
    folder: folderId,
    owner: userId,
    isDeleted: true,
  });

  for (const file of files) {
    try {
      // 1️⃣ Delete from storage
      try {
        await storage.delete(file.storagePath);
      } catch (storageErr) {
        if (storageErr.code !== "ENOENT" && storageErr.code !== "NoSuchKey" && storageErr.name !== "NotFound") {
          throw storageErr; // Real error, abort this specific file
        }
      }

      // 2️⃣ Stop billing
      await StorageUsage.findOneAndUpdate(
        { file: file._id, effectiveTo: null },
        { effectiveTo: new Date() }
      );

      // 3️⃣ Free quota safely
      const updatedUser = await User.findByIdAndUpdate(userId, {
        $inc: { usedStorage: -file.size },
      }, { new: true });

      if (updatedUser && updatedUser.usedStorage < 0) {
        await User.findByIdAndUpdate(userId, { usedStorage: 0 });
      }

      // 4️⃣ Delete DB record
      await File.deleteOne({ _id: file._id });

    } catch (err) {
      // Log the error but continue the loop so one bad file doesn't block the folder deletion
      console.error(`Failed to process file ${file._id} during folder deletion:`, err.message);
    }
  }

  // Recurse children
  const children = await Folder.find({
    parent: folderId,
    owner: userId,
    isDeleted: true,
  });

  for (const child of children) {
    await permanentDeleteFolderRecursive(child._id, userId);
  }

  // Delete folder metadata
  await Folder.deleteOne({
    _id: folderId,
    owner: userId,
    isDeleted: true,
  });
};

exports.permanentDeleteFolder = async (req, res) => {
  try {
    await permanentDeleteFolderRecursive(req.params.id, req.user._id);
    res.json({ success: true });
  } catch (err) {
    console.error("Folder permanent delete error:", err);
    res.status(500).json({ error: "Permanent folder delete failed" });
  }
};