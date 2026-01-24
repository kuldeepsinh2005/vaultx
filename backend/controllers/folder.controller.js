// backend/controllers/folder.controller.js
const Folder = require("../models/Folder.model");
const File = require("../models/File.model");
const { getStorageProvider } = require("../storage");
const archiver = require("archiver");

// POST /api/folders
exports.createFolder = async (req, res) => {
  try {
    const { name, parent } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Folder name required" });
    }

    if (req.params.id === parent) {
        return res.status(400).json({ error: "Invalid folder move" });
    }


    const folder = await Folder.create({
      owner: req.user._id,
      name,
      parent: parent || null,
    });

    res.status(201).json({ success: true, folder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create folder" });
  }
};

// GET /api/folders?parent=<id|null>
exports.getFolders = async (req, res) => {
  try {
    const parent = req.query.parent || null;

    const folders = await Folder.find({
      owner: req.user._id,
      parent,
      isDeleted: false
    }).sort({ name: 1 });

    res.status(200).json({ success: true, folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch folders" });
  }
};

// PATCH /api/folders/:id
exports.renameFolder = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "New folder name required" });
    }

    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { name },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    res.json({ success: true, folder });
  } catch (err) {
    res.status(500).json({ error: "Rename failed" });
  }
};

// exports.deleteFolder = async (req, res) => {
//   try {
//     const folderId = req.params.id;

//     const hasSubfolders = await Folder.exists({
//       owner: req.user._id,
//       parent: folderId,
//     });

//     const hasFiles = await File.exists({
//       owner: req.user._id,
//       folder: folderId,
//     });

//     if (hasSubfolders || hasFiles) {
//       return res.status(400).json({
//         error: "Folder is not empty",
//       });
//     }

//     await Folder.deleteOne({
//       _id: folderId,
//       owner: req.user._id,
//     });

//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: "Delete failed" });
//   }
// };

// PATCH /api/folders/:id/move
// PATCH /api/folders/:id/move
exports.moveFolder = async (req, res) => {
  try {
    const { parent } = req.body;
    const folderId = req.params.id;

    // ✅ NEW: Prevent moving into deleted / invalid folder
    const target = parent
      ? await Folder.findOne({
          _id: parent,
          owner: req.user._id,
          isDeleted: false,
        })
      : null;

    if (parent && !target) {
      return res.status(400).json({ error: "Invalid target folder" });
    }

    // Prevent self-parenting
    if (folderId === parent) {
      return res.status(400).json({ error: "Cannot move folder into itself" });
    }

    // Prevent moving into its own subtree
    let current = parent;
    while (current) {
      if (current.toString() === folderId.toString()) {
        return res
          .status(400)
          .json({ error: "Cannot move folder into its own subfolder" });
      }

      const p = await Folder.findById(current).select("parent");
      current = p?.parent;
    }

    await Folder.findOneAndUpdate(
      { _id: folderId, owner: req.user._id },
      { parent: parent || null }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Move failed" });
  }
};


exports.getFolderTree = async (req, res) => {
  const folders = await Folder.find({
    owner: req.user._id,
    isDeleted: false
  }).lean();

  res.json({ folders });
};


// const deleteFolderRecursive = async (folderId, userId) => {
//   // 1. Get all subfolders
//   const subFolders = await Folder.find({ parent: folderId, owner: userId });

//   for (const sub of subFolders) {
//     await deleteFolderRecursive(sub._id, userId);
//   }

//   // 2. Delete all files in this folder
//   const files = await File.find({ folder: folderId, owner: userId });
//   const storage = getStorageProvider();

//   for (const file of files) {
//     await storage.delete(file.storagePath);
//     await file.deleteOne();
//   }

//   // 3. Delete folder itself
//   await Folder.deleteOne({ _id: folderId, owner: userId });
// };

// exports.deleteFolder = async (req, res) => {
//   try {
//     await deleteFolderRecursive(req.params.id, req.user._id);
//     res.json({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Folder delete failed" });
//   }
// };

  const addFolderToZip = async (archive, folderId, userId, basePath = "") => {
    const folder = await Folder.findById(folderId);
    const folderPath = basePath + folder.name + "/";

    // Add files in this folder
    const files = await File.find({ folder: folderId, owner: userId });
    const storage = getStorageProvider();

    for (const file of files) {
      const stream = await storage.getStream(file.storagePath);
      archive.append(stream, {
        name: folderPath + file.originalName,
      });
    }

    // Recurse into subfolders
    const subFolders = await Folder.find({ parent: folderId, owner: userId });
    for (const sub of subFolders) {
      await addFolderToZip(archive, sub._id, userId, folderPath);
    }
  };

  exports.downloadFolder = async (req, res) => {
    try {
      const folder = await Folder.findOne({
        _id: req.params.id,
        owner: req.user._id,
      });

      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${folder.name}.zip"`
      );
      res.setHeader("Content-Type", "application/zip");

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.pipe(res);

      await addFolderToZip(archive, folder._id, req.user._id);

      archive.finalize();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Folder download failed" });
    }
  };

  // Soft delete folder (move to trash)
const softDeleteFolder = async (folderId, userId, user) => {
  const storage = getStorageProvider();

  // 1️⃣ Get all files in this folder
  const files = await File.find({
    folder: folderId,
    owner: userId,
    isDeleted: false,
  });

  let totalFreedSize = 0;

  for (const file of files) {
    // Delete from storage (S3 or local)
    await storage.delete(file.storagePath);

    totalFreedSize += file.size;

    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();
  }

  // 2️⃣ Update user's usedStorage ONCE
  if (totalFreedSize > 0) {
    await user.updateOne({
      $inc: { usedStorage: -totalFreedSize },
    });
  }

  // 3️⃣ Recurse into subfolders
  const children = await Folder.find({
    parent: folderId,
    owner: userId,
    isDeleted: false,
  });

  for (const child of children) {
    await softDeleteFolder(child._id, userId, user);
  }

  // 4️⃣ Soft delete folder itself
  await Folder.findOneAndUpdate(
    { _id: folderId, owner: userId },
    { isDeleted: true, deletedAt: new Date() }
  );
};




exports.deleteFolder = async (req, res) => {
  try {
    await softDeleteFolder(req.params.id, req.user._id, req.user);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Folder delete failed" });
  }
};


// GET /api/folders/:id/count
exports.getFolderCount = async (req, res) => {
  try {
    const folderId = req.params.id;

    const files = await File.countDocuments({
      folder: folderId,
      owner: req.user._id,
      isDeleted: false,
    });

    const folders = await Folder.countDocuments({
      parent: folderId,
      owner: req.user._id,
      isDeleted: false,
    });

    res.json({ files, folders });
  } catch (err) {
    res.status(500).json({ error: "Failed to get folder count" });
  }
};


// backend/controllers/folder.controller.js
exports.getFolderContentsRecursive = async (req, res) => {
  try {
    const userId = req.user._id;
    const rootFolderId = req.params.id;

    // Helper to recursively find all files
    const allFiles = [];
    const collect = async (folderId, pathPrefix = "") => {
      // Get files in current level
      const files = await File.find({ folder: folderId, owner: userId, isDeleted: false });
      files.forEach(f => {
        allFiles.push({
          ...f.toObject(),
          zipPath: pathPrefix + f.originalName
        });
      });

      // Get subfolders
      const subfolders = await Folder.find({ parent: folderId, owner: userId, isDeleted: false });
      for (const sub of subfolders) {
        await collect(sub._id, pathPrefix + sub.name + "/");
      }
    };

    const rootFolder = await Folder.findById(rootFolderId);
    await collect(rootFolderId, ""); // Start recursion

    res.json({ success: true, files: allFiles, folderName: rootFolder.name });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recursive contents" });
  }
};