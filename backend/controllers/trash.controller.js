// backend/controllers/trash.controller.js
const File = require("../models/File.model");
const Folder = require("../models/Folder.model");



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


// Permanent delete
exports.permanentDeleteFile = async (req, res) => {
  await File.deleteOne({ _id: req.params.id, owner: req.user._id });
  res.json({ success: true });
};

const permanentDeleteFolderRecursive = async (folderId, userId) => {
  // 1. Delete all files inside this folder
  const files = await File.find({ folder: folderId, owner: userId });
  for (const file of files) {
    await File.deleteOne({ _id: file._id });
  }

  // 2. Find all subfolders
  const children = await Folder.find({ parent: folderId, owner: userId });

  // 3. Recursively delete subfolders
  for (const child of children) {
    await permanentDeleteFolderRecursive(child._id, userId);
  }

  // 4. Finally delete this folder
  await Folder.deleteOne({ _id: folderId, owner: userId });
};

exports.permanentDeleteFolder = async (req, res) => {
  try {
    await permanentDeleteFolderRecursive(req.params.id, req.user._id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Permanent folder delete failed" });
  }
};