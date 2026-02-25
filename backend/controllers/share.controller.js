const User = require("../models/User.model");
const File = require("../models/File.model");
const SharedFile = require("../models/SharedFile.model");
const SharedFolder = require("../models/SharedFolder.model"); // ✅ Import
const Folder = require("../models/Folder.model"); 
const { getStorageProvider } = require("../storage");
// 1. Get a target user's public key by their email
exports.getUserPublicKey = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot share a file with yourself" });
    }

    res.json({ 
      userId: user._id, 
      username: user.username, 
      publicKey: user.publicKey 
    });
  } catch (err) {
    console.error("Fetch public key error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

// 2. Save the shared record with the newly wrapped key
exports.shareFile = async (req, res) => {
  try {
    const { fileId, sharedWithUserId, wrappedKeyForUser } = req.body;

    // Verify the file exists and belongs to the user making the request
    const file = await File.findOne({ _id: fileId, owner: req.user._id, isDeleted: false });
    if (!file) {
      return res.status(404).json({ error: "File not found or unauthorized" });
    }

    // Create the share record
    await SharedFile.create({
      file: fileId,
      owner: req.user._id,
      sharedWith: sharedWithUserId,
      wrappedKey: wrappedKeyForUser
    });

    res.json({ success: true, message: "File shared securely!" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "File is already shared with this user" });
    }
    console.error("Share file error:", err);
    res.status(500).json({ error: "Failed to share file" });
  }
};

// 3. Get all files shared with the logged-in user
exports.getSharedWithMe = async (req, res) => {
  try {
    const { sharedBy } = req.query; 
    const query = { sharedWith: req.user._id };
    if (sharedBy) query.owner = sharedBy;

    // A. Fetch ALL Shared Folders
    const sharedFolders = await SharedFolder.find(query)
      .populate({
         path: "folder",
         match: { isDeleted: false },
         select: "name parent owner"
      })
      .populate("owner", "username email")
      .lean();

    // B. Fetch ALL Shared Files
    const sharedFiles = await SharedFile.find(query)
      .populate({
        path: "file",
        match: { isDeleted: false },
        select: "originalName mimeType size iv createdAt folder" // ✅ Need folder ID to check parent
      })
      .populate("owner", "username email")
      .lean();

    // Clean up nulls (deleted items)
    const validFolders = sharedFolders.filter(r => r.folder);
    const validFiles = sharedFiles.filter(r => r.file);

    // ✅ CREATE A LOOKUP SET OF ALL SHARED FOLDER IDs
    const sharedFolderIds = new Set(validFolders.map(f => f.folder._id.toString()));

    // ==========================================
    // 🐛 THE BUG FIX: Deep Ancestor Lookup
    // ==========================================
    // Fetch all folders owned by the people sharing with us to build a quick lookup map
    const ownerIds = [...new Set(validFiles.map(f => f.owner._id.toString()))];
    const allOwnerFolders = await Folder.find({ owner: { $in: ownerIds }, isDeleted: false }).lean();
    
    // Map folderId -> parentId
    const folderParentMap = new Map(allOwnerFolders.map(f => [f._id.toString(), f.parent?.toString()]));

    // Helper function: Climbs the tree to see if ANY parent is in the sharedFolderIds set
    const isDescendantOfShared = (folderId) => {
      let current = folderId;
      while (current) {
        if (sharedFolderIds.has(current)) return true;
        current = folderParentMap.get(current); // Go up one level
      }
      return false;
    };

    // ✅ FILTER 1: Hide Subfolders
    const rootFolders = validFolders.filter(f => {
      const parentId = f.folder.parent?.toString();
      return !parentId || !sharedFolderIds.has(parentId);
    });

    // ✅ FILTER 2: Hide Files inside Shared Folders (Now checks deep ancestry)
    const rootFiles = validFiles.filter(f => {
      const parentFolderId = f.file.folder?.toString();
      if (!parentFolderId) return true; // File is at the absolute root of their vault
      return !isDescendantOfShared(parentFolderId); // Hide if it lives inside ANY shared folder tree
    });

    res.json({ 
      sharedFiles: rootFiles, 
      sharedFolders: rootFolders 
    });
  } catch (err) {
    console.error("Get shared error:", err);
    res.status(500).json({ error: "Failed to fetch shared items" });
  }
};
// 4. Generate an AWS S3 download link for a shared file
exports.getSharedFileDownloadUrl = async (req, res) => {
  try {
    const fileId = req.params.id;
    
    // 1. Verify this file is actively shared with the logged-in user
    const sharedRecord = await SharedFile.findOne({
      file: fileId,
      sharedWith: req.user._id
    }).populate("file");

    // Block access if the share was revoked, or if the owner permanently deleted the file
    if (!sharedRecord || !sharedRecord.file || sharedRecord.file.isDeleted) {
      return res.status(404).json({ error: "File not found or access revoked" });
    }

    // 2. Ask AWS S3 for a temporary download ticket
    const storage = getStorageProvider();
    const url = await storage.getDownloadUrl(sharedRecord.file.storagePath);

    res.json({ url });
  } catch (err) {
    console.error("Shared download error:", err);
    res.status(500).json({ error: "Failed to generate download link" });
  }
};

// 5. Share multiple files at once (for Folder Sharing)
exports.shareFolderBulk = async (req, res) => {
  try {
    const { fileItems, folderItems, sharedWithUserId } = req.body; 

    // 1. Bulk Write Shared Files
    if (fileItems && fileItems.length > 0) {
      const fileOps = fileItems.map(item => ({
        updateOne: {
          filter: { file: item.fileId, sharedWith: sharedWithUserId },
          update: {
            $set: {
              owner: req.user._id,
              wrappedKey: item.wrappedKey,
              permission: "VIEW"
            }
          },
          upsert: true
        }
      }));
      await SharedFile.bulkWrite(fileOps);
    }

    // 2. Bulk Write Shared Folders (✅ NEW)
    if (folderItems && folderItems.length > 0) {
      const folderOps = folderItems.map(folderId => ({
        updateOne: {
          filter: { folder: folderId, sharedWith: sharedWithUserId },
          update: {
            $set: {
              owner: req.user._id,
              permission: "VIEW"
            }
          },
          upsert: true
        }
      }));
      await SharedFolder.bulkWrite(folderOps);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Bulk share error:", err);
    res.status(500).json({ error: "Failed to share folder contents" });
  }
};
// 4. Get contents of a specific shared folder (Drill Down)
exports.getSharedFolderContents = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { ownerId } = req.query; 
    const userId = req.user._id;

    if (!ownerId) {
      return res.status(400).json({ error: "Missing ownerId parameter" });
    }

    // ==========================================
    // 1. SECURITY CHECK: Ensure user has access
    // ==========================================
    let hasAccess = false;
    
    // Check if this specific folder is shared
    const directShare = await SharedFolder.findOne({ folder: folderId, sharedWith: userId });
    if (directShare) hasAccess = true;

    // If not direct, check if any PARENT is shared
    if (!hasAccess) {
      let current = await Folder.findById(folderId);
      while(current && current.parent) {
         const parentShare = await SharedFolder.findOne({ folder: current.parent, sharedWith: userId });
         if (parentShare) {
            hasAccess = true;
            break;
         }
         current = await Folder.findById(current.parent);
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this folder." });
    }

    // Fetch the owner details to format the response
    const User = require("../models/User.model");
    const folderOwner = await User.findById(ownerId).select("username email").lean();

    // ==========================================
    // 2. FETCH SUBFOLDERS (The Fix!)
    // ==========================================
    // ✅ Instead of looking for SharedFolder records, we pull the ACTUAL folder tree!
    const rawFolders = await Folder.find({ 
      parent: folderId, 
      owner: ownerId, 
      isDeleted: false 
    }).select("name parent owner").lean();

    // Format to match the frontend expectations: { folder: {...}, owner: {...} }
    const validFolders = rawFolders.map(f => ({
      _id: f._id, // Use folder ID as the pseudo share ID for React keys
      folder: f,
      owner: folderOwner
    }));

    // ==========================================
    // 3. FETCH FILES & CHECK FOR KEYS
    // ==========================================
    const allFilesInFolder = await File.find({ 
      folder: folderId, 
      owner: ownerId, 
      isDeleted: false 
    }).select("originalName mimeType size iv createdAt").lean();

    // Find which files User B actually has a key for
    const userShares = await SharedFile.find({ 
      sharedWith: userId,
      file: { $in: allFilesInFolder.map(f => f._id) }
    }).lean();

    const shareMap = {};
    userShares.forEach(s => shareMap[s.file.toString()] = s.wrappedKey);

    // Flag files without a key as "Locked"
    const processedFiles = allFilesInFolder.map(file => {
      const wrappedKey = shareMap[file._id.toString()];
      return {
        _id: file._id, // Add an ID at the root of the record
        file: file,
        wrappedKey: wrappedKey || null,
        isLocked: !wrappedKey 
      };
    });

    res.json({ 
      folders: validFolders, 
      files: processedFiles 
    });

  } catch (err) {
    console.error("Browse shared folder error:", err);
    res.status(500).json({ error: "Failed to browse folder" });
  }
};
// Get list of users who have access to a specific file/folder
exports.getAccessList = async (req, res) => {
  try {
    const { itemId, type } = req.query; // type = 'file' or 'folder'
    
    let shares;
    if (type === 'folder') {
      shares = await SharedFolder.find({ folder: itemId }).populate('sharedWith', 'username email');
    } else {
      shares = await SharedFile.find({ file: itemId }).populate('sharedWith', 'username email');
    }

    res.json({ users: shares.map(s => ({ ...s.sharedWith.toObject(), shareId: s._id })) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch access list" });
  }
};

// Revoke access
exports.revokeAccess = async (req, res) => {
  try {
    const { shareId, type } = req.body;

    if (type === 'folder') {
      // 1. Find the share record to get the Folder ID and User ID
      const share = await SharedFolder.findById(shareId);
      if (!share) return res.status(404).json({ error: "Share not found" });

      const folderId = share.folder;
      const targetUserId = share.sharedWith;

      // 2. Delete the main Folder Share
      await SharedFolder.findByIdAndDelete(shareId);

      // 3. Find ALL subfolders recursively (BFS)
      const folderIds = [folderId];
      let queue = [folderId];
      
      while (queue.length > 0) {
        const children = await Folder.find({ parent: { $in: queue } }, '_id').lean();
        const childIds = children.map(c => c._id);
        if (childIds.length > 0) {
          folderIds.push(...childIds);
          queue = childIds;
        } else {
          queue = [];
        }
      }

      // 4. Find ALL files inside this entire folder tree
      const files = await File.find({ folder: { $in: folderIds } }, '_id').lean();
      const fileIds = files.map(f => f._id);

      // 5. WIPE ACCESS: Delete all file shares for this user in this tree
      if (fileIds.length > 0) {
        await SharedFile.deleteMany({ 
          file: { $in: fileIds }, 
          sharedWith: targetUserId 
        });
      }

      // 6. WIPE ACCESS: Delete any subfolder shares for this user
      if (folderIds.length > 1) {
        await SharedFolder.deleteMany({ 
          folder: { $in: folderIds }, 
          sharedWith: targetUserId 
        });
      }

    } else {
      // Single file revoke is simple
      await SharedFile.findByIdAndDelete(shareId);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("Revoke failed:", err);
    res.status(500).json({ error: "Revoke failed" });
  }
};

// 8. Find newly uploaded files in a shared folder tree that need key syncing
// 8. Find newly uploaded files/folders that need key syncing
exports.getPendingSync = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { type } = req.query; // 'file' or 'folder'
    const ownerId = req.user._id;

    let startingFolderId;
    let targetFiles = [];

    // ==========================================
    // 1. DETERMINE TARGETS BASED ON TYPE
    // ==========================================
    if (type === 'file') {
      const file = await File.findOne({ _id: itemId, owner: ownerId, isDeleted: false })
        .select("originalName wrappedKey folder").lean();
      
      if (!file) return res.json({ pendingSyncs: [] });
      
      startingFolderId = file.folder;
      targetFiles = [file]; // We only care about syncing this one file
    } else {
      startingFolderId = itemId;
      
      // It's a folder, do the deep BFS scan to find ALL files inside
      const folderIds = [itemId];
      let queue = [itemId];
      while (queue.length > 0) {
        const children = await Folder.find({ parent: { $in: queue }, owner: ownerId, isDeleted: false }, '_id').lean();
        const childIds = children.map(c => c._id);
        if (childIds.length > 0) {
          folderIds.push(...childIds);
          queue = childIds;
        } else {
          queue = [];
        }
      }
      targetFiles = await File.find({ folder: { $in: folderIds }, owner: ownerId, isDeleted: false })
        .select("originalName wrappedKey").lean();
    }

    if (targetFiles.length === 0) return res.json({ pendingSyncs: [] });

    // ==========================================
    // 2. TRAVERSE UP: Find who has access via Inheritance
    // ==========================================
    let currentId = startingFolderId;
    const lineageIds = [];
    while (currentId) {
      lineageIds.push(currentId);
      const f = await Folder.findById(currentId).lean();
      currentId = f ? f.parent : null;
    }

    // Find shares in the lineage
    const sharesInLineage = await SharedFolder.find({ 
      folder: { $in: lineageIds }, 
      owner: ownerId 
    }).populate('sharedWith', 'username publicKey');

    const targetUsersMap = new Map();
    sharesInLineage.forEach(share => {
      if (share.sharedWith) targetUsersMap.set(share.sharedWith._id.toString(), share.sharedWith);
    });
    
    // Also include people explicitly shared directly on the FILE (if it's a file sync)
    if (type === 'file') {
       const directFileShares = await SharedFile.find({ file: itemId, owner: ownerId })
         .populate('sharedWith', 'username publicKey');
       directFileShares.forEach(share => {
         if (share.sharedWith) targetUsersMap.set(share.sharedWith._id.toString(), share.sharedWith);
       });
    }

    const targetUsers = Array.from(targetUsersMap.values());
    if (targetUsers.length === 0) return res.json({ pendingSyncs: [] });

    // ==========================================
    // 3. CALCULATE MISSING KEYS
    // ==========================================
    const pendingSyncs = [];

    for (const user of targetUsers) {
      const existingShares = await SharedFile.find({
        sharedWith: user._id,
        file: { $in: targetFiles.map(f => f._id) }
      }).select("file").lean();

      const existingFileIds = new Set(existingShares.map(s => s.file.toString()));

      // Filter out files the user already has
      const pendingFiles = targetFiles.filter(f => !existingFileIds.has(f._id.toString()));

      if (pendingFiles.length > 0) {
        pendingSyncs.push({
          user: { _id: user._id, username: user.username, publicKey: user.publicKey },
          files: pendingFiles
        });
      }
    }

    res.json({ pendingSyncs });
  } catch (err) {
    console.error("Sync fetch error:", err);
    res.status(500).json({ error: "Failed to fetch sync data" });
  }
};

// 9. Get recursive contents of a shared folder for Zipping
exports.getSharedFolderContentsRecursive = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { ownerId } = req.query;
    const userId = req.user._id;

    if (!ownerId) {
      return res.status(400).json({ error: "Missing ownerId parameter" });
    }

    // 1. Verify user has some level of access to this folder tree (security check)
    let hasAccess = false;
    const directShare = await SharedFolder.findOne({ folder: folderId, sharedWith: userId });
    if (directShare) hasAccess = true;

    if (!hasAccess) {
      let current = await Folder.findById(folderId);
      while (current && current.parent) {
         const parentShare = await SharedFolder.findOne({ folder: current.parent, sharedWith: userId });
         if (parentShare) {
            hasAccess = true;
            break;
         }
         current = await Folder.findById(current.parent);
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this folder." });
    }

    const rootFolder = await Folder.findById(folderId).lean();

    // 2. BFS to get all subfolders AND build their relative paths for the Zip file
    const allFolderIds = [folderId];
    let queue = [folderId];
    
    // Track paths. e.g., folderPaths["abc123id"] = "Subfolder/DeepFolder/"
    const folderPaths = { [folderId.toString()]: "" }; 

    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = await Folder.find({ parent: currentId, owner: ownerId, isDeleted: false }).lean();
      
      for (const child of children) {
        const childIdStr = child._id.toString();
        allFolderIds.push(child._id);
        queue.push(child._id);
        // Build path by appending this folder's name to its parent's path
        folderPaths[childIdStr] = folderPaths[currentId.toString()] + child.name + "/";
      }
    }

    // 3. Fetch all files in this entire tree
    const files = await File.find({ 
      folder: { $in: allFolderIds }, 
      owner: ownerId, 
      isDeleted: false 
    }).lean();

    // 4. Find which of these files the user ACTUALLY has keys for
    const sharedFiles = await SharedFile.find({ 
      sharedWith: userId, 
      file: { $in: files.map(f => f._id) } 
    }).lean();

    const shareMap = {};
    sharedFiles.forEach(s => shareMap[s.file.toString()] = s.wrappedKey);

    // 5. Construct the final downloadable list
    const downloadableFiles = [];
    for (const file of files) {
       const wrappedKey = shareMap[file._id.toString()];
       if (wrappedKey) { // ONLY include files they have the key for
          downloadableFiles.push({
             _id: file._id,
             originalName: file.originalName,
             mimeType: file.mimeType,
             iv: file.iv,
             wrappedKey: wrappedKey,
             zipPath: folderPaths[file.folder.toString()] + file.originalName
          });
       }
    }

    res.json({ 
      success: true, 
      files: downloadableFiles, 
      folderName: rootFolder.name 
    });

  } catch (err) {
    console.error("Shared recursive fetch error:", err);
    res.status(500).json({ error: "Failed to fetch folder contents for download" });
  }
};