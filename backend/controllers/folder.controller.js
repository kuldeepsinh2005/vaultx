// backend/controllers/folder.controller.js
const Folder = require("../models/Folder.model");
const File = require("../models/File.model");

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

exports.deleteFolder = async (req, res) => {
  try {
    const folderId = req.params.id;

    const hasSubfolders = await Folder.exists({
      owner: req.user._id,
      parent: folderId,
    });

    const hasFiles = await File.exists({
      owner: req.user._id,
      folder: folderId,
    });

    if (hasSubfolders || hasFiles) {
      return res.status(400).json({
        error: "Folder is not empty",
      });
    }

    await Folder.deleteOne({
      _id: folderId,
      owner: req.user._id,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
};

// PATCH /api/folders/:id/move
// PATCH /api/folders/:id/move
exports.moveFolder = async (req, res) => {
  try {
    const { parent } = req.body;
    const folderId = req.params.id;

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
  const folders = await Folder.find({ owner: req.user._id }).lean();
  res.json({ folders });
};