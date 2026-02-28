// worker/jobs/trashCleanup.job.js
require("dotenv").config();
const cron = require("node-cron");
const mongoose = require("mongoose");
const Folder = require("../models/Folder.model");
const File = require("../models/File.model");
const SharedFile = require("../models/SharedFile.model");     // ✅ IMPORTED
const SharedFolder = require("../models/SharedFolder.model"); // ✅ IMPORTED
const { getStorageProvider } = require("../storage");
const User = require("../models/User.model");
const StorageUsage = require("../models/StorageUsage.model");

const TRASH_TTL_MS  = 10 * 1000; // 10 seconds for testing (Change to 30 days in prod)
const BATCH_SIZE = 10;

cron.schedule("*/10 * * * * *", async () => { 
  if (mongoose.connection.readyState !== 1) {
    console.log("⏳ Mongo not ready, skipping cleanup");
    return;
  }

  try {
    console.log("🧹 Trash cleanup started");
    const threshold = new Date(Date.now() - TRASH_TTL_MS);
    const storage = getStorageProvider();
    
    /* 1. PROCESS EXPIRED FILES */
    const expiredFiles = await File.find({
      isDeleted: true,
      deletedAt: { $lte: threshold }
    })
    .sort({ deletedAt: 1 })
    .limit(BATCH_SIZE);

    for (const file of expiredFiles) {
      try {
        console.log(`Deleting file from storage: ${file.storagePath}`);

        // 1️⃣ Delete from storage WITH ROBUST ERROR HANDLING
        try {
          await storage.delete(file.storagePath);
        } catch (storageErr) {
          if (storageErr.code !== "ENOENT" && storageErr.code !== "NoSuchKey" && storageErr.name !== "NotFound") {
            throw storageErr; // Real error, abort DB cleanup for this specific file
          }
          console.warn(`[Worker] File ${file._id} already missing from storage. Proceeding with DB cleanup.`);
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

        if (updatedUser && updatedUser.usedStorage < 0) {
          await User.findByIdAndUpdate(file.owner, { usedStorage: 0 });
        }

        // 4️⃣ Delete DB record
        await File.deleteOne({ _id: file._id });
        
        // 5️⃣ WIPE ORPHANED SHARES (✅ FIX)
        await SharedFile.deleteMany({ file: file._id });

      } catch (err) {
        console.error(`[Worker] Cleanup failed for file ${file._id}:`, err.message);
        // ❌ Loop continues to next file even if this one fails
      }
    }

    /* 2. PROCESS EXPIRED FOLDERS */
    const expiredFolders = await Folder.find({
      isDeleted: true,
      deletedAt: { $lte: threshold }
    }).limit(BATCH_SIZE);

    for (const folder of expiredFolders) {
      await deleteFolderForever(folder._id, folder.owner);
    }

    console.log("✅ Trash cleanup cycle complete");
  } catch (err) {
    console.error("❌ Trash cleanup failed", err);
  }
});

// ✅ NEW: The Enterprise Bulk Processing Engine for Background Workers
async function deleteFolderForever(folderId, ownerId) {
  const storage = getStorageProvider();

  // 🚀 PHASE 1: FLATTEN THE FOLDER TREE
  const folderIdsToDelete = [folderId];
  let queue = [folderId];

  while (queue.length > 0) {
    const children = await Folder.find({ 
      parent: { $in: queue }, 
      owner: ownerId, 
      isDeleted: true 
    }, '_id').lean();
    
    const childIds = children.map(c => c._id);
    if (childIds.length > 0) {
      folderIdsToDelete.push(...childIds);
    }
    queue = childIds;
  }

  // Find ALL files inside ALL of these folders
  const filesToDelete = await File.find({
    folder: { $in: folderIdsToDelete },
    owner: ownerId,
    isDeleted: true,
  }).lean();

  let totalBytesFreed = 0;
  const successfulFileIds = [];

  // 🚀 PHASE 2: BATCH S3 DELETIONS (Fast & Safe)
  const S3_BATCH_SIZE = 10; 
  for (let i = 0; i < filesToDelete.length; i += S3_BATCH_SIZE) {
    const batch = filesToDelete.slice(i, i + S3_BATCH_SIZE);
    
    const batchPromises = batch.map(async (file) => {
      try {
        await storage.delete(file.storagePath);
        totalBytesFreed += file.size;
        successfulFileIds.push(file._id);
      } catch (storageErr) {
        if (storageErr.code !== "ENOENT" && storageErr.code !== "NoSuchKey" && storageErr.name !== "NotFound") {
          console.error(`[Worker Storage] Hard fail deleting ${file.storagePath}:`, storageErr.message);
        } else {
          totalBytesFreed += file.size;
          successfulFileIds.push(file._id);
        }
      }
    });

    await Promise.all(batchPromises); 
  }

  // 🚀 PHASE 3: MONGODB BULK OPERATIONS
  if (successfulFileIds.length > 0) {
    // 1. Stop billing
    await StorageUsage.updateMany(
      { file: { $in: successfulFileIds }, effectiveTo: null },
      { effectiveTo: new Date() }
    );

    // 2. Free quota safely
    const updatedUser = await User.findByIdAndUpdate(ownerId, {
      $inc: { usedStorage: -totalBytesFreed }
    }, { new: true });

    if (updatedUser && updatedUser.usedStorage < 0) {
      await User.findByIdAndUpdate(ownerId, { usedStorage: 0 });
    }

    // 3. Delete DB records
    await File.deleteMany({ _id: { $in: successfulFileIds } });
    
    // 4. WIPE ORPHANED FILE SHARES (✅ FIX)
    await SharedFile.deleteMany({ file: { $in: successfulFileIds } });
  }

  // 5. Delete folder records
  await Folder.deleteMany({ _id: { $in: folderIdsToDelete } });
  
  // 6. WIPE ORPHANED FOLDER SHARES (✅ FIX)
  await SharedFolder.deleteMany({ folder: { $in: folderIdsToDelete } });
}