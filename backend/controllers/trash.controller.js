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


// ✅ NEW: The Enterprise Bulk Processing Engine
const permanentDeleteFolderFlattened = async (folderId, userId) => {
  const storage = getStorageProvider();

  // 🚀 PHASE 1: FLATTEN THE FOLDER TREE
  // Find all nested folder IDs in a few quick loops instead of deep recursion
  const folderIdsToDelete = [folderId];
  let queue = [folderId];

  while (queue.length > 0) {
    const children = await Folder.find({ 
      parent: { $in: queue }, 
      owner: userId, 
      isDeleted: true 
    }, '_id').lean();
    
    const childIds = children.map(c => c._id);
    if (childIds.length > 0) {
      folderIdsToDelete.push(...childIds);
    }
    queue = childIds;
  }

  // Find ALL files inside ALL of these folders in one single query
  const filesToDelete = await File.find({
    folder: { $in: folderIdsToDelete },
    owner: userId,
    isDeleted: true,
  }).lean();

  let totalBytesFreed = 0;
  const successfulFileIds = [];

  // 🚀 PHASE 2: BATCH S3 DELETIONS (Fast, but safe for the network)
  const BATCH_SIZE = 10; 
  for (let i = 0; i < filesToDelete.length; i += BATCH_SIZE) {
    const batch = filesToDelete.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (file) => {
      try {
        await storage.delete(file.storagePath);
        totalBytesFreed += file.size;
        successfulFileIds.push(file._id);
      } catch (storageErr) {
        if (storageErr.code !== "ENOENT" && storageErr.code !== "NoSuchKey" && storageErr.name !== "NotFound") {
          console.error(`[Storage] Hard fail deleting ${file.storagePath}:`, storageErr.message);
        } else {
          // Already missing from S3, safe to clean up DB
          totalBytesFreed += file.size;
          successfulFileIds.push(file._id);
        }
      }
    });

    await Promise.all(batchPromises); // Wait for the batch of 10 to finish before starting the next
  }

  // 🚀 PHASE 3: MONGODB BULK OPERATIONS (No database hammering!)
  if (successfulFileIds.length > 0) {
    // 1. Stop billing for all deleted files simultaneously
    await StorageUsage.updateMany(
      { file: { $in: successfulFileIds }, effectiveTo: null },
      { effectiveTo: new Date() }
    );

    // 2. Free up the user's storage quota in ONE atomic math calculation
    const updatedUser = await User.findByIdAndUpdate(userId, {
      $inc: { usedStorage: -totalBytesFreed }
    }, { new: true });

    // Safety fallback
    if (updatedUser && updatedUser.usedStorage < 0) {
      await User.findByIdAndUpdate(userId, { usedStorage: 0 });
    }

    // 3. Delete all file records simultaneously
    await File.deleteMany({ _id: { $in: successfulFileIds } });
  }

  // 4. Delete all folder records simultaneously
  await Folder.deleteMany({ _id: { $in: folderIdsToDelete } });
};
exports.permanentDeleteFolder = async (req, res) => {
  try {
    // ✅ Call the new bulk engine
    await permanentDeleteFolderFlattened(req.params.id, req.user._id);
    res.json({ success: true });
  } catch (err) {
    console.error("Folder permanent delete error:", err);
    res.status(500).json({ error: "Permanent folder delete failed" });
  }
};