// worker/jobs/trashCleanup.job.js
require("dotenv").config();
const cron = require("node-cron");
const mongoose = require("mongoose");
const Folder = require("../models/Folder.model");
const File = require("../models/File.model");
const { getStorageProvider } = require("../storage");
const User = require("../models/User.model");
const StorageUsage = require("../models/StorageUsage.model");

const TRASH_TTL_MS  = 10 * 1000; // 10 seconds for testing (Change to 30 days in prod)
const BATCH_SIZE = 10;

cron.schedule("*/1 * * * *", async () => {
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

async function deleteFolderForever(folderId, ownerId) {
  const storage = getStorageProvider();

  // 1️⃣ Delete files in this folder
  const files = await File.find({
    folder: folderId,
    owner: ownerId,
    isDeleted: true,
  });

  for (const file of files) {
    try {
      // 1. Storage Delete
      try {
        await storage.delete(file.storagePath);
      } catch (storageErr) {
        if (storageErr.code !== "ENOENT" && storageErr.code !== "NoSuchKey" && storageErr.name !== "NotFound") {
          throw storageErr;
        }
      }

      // 2. Stop billing
      await StorageUsage.findOneAndUpdate(
        { file: file._id, effectiveTo: null },
        { effectiveTo: new Date() }
      );

      // 3. Free quota safely
      const updatedUser = await User.findByIdAndUpdate(ownerId, {
        $inc: { usedStorage: -file.size },
      }, { new: true });

      if (updatedUser && updatedUser.usedStorage < 0) {
        await User.findByIdAndUpdate(ownerId, { usedStorage: 0 });
      }

      // 4. Delete DB record
      await File.deleteOne({ _id: file._id });

    } catch (err) {
      console.error(`[Worker] Failed to process file ${file._id} in folder deletion:`, err.message);
    }
  }

  // 2️⃣ Recurse into deleted subfolders
  const children = await Folder.find({
    parent: folderId,
    owner: ownerId,
    isDeleted: true,
  });

  for (const child of children) {
    await deleteFolderForever(child._id, ownerId);
  }

  // 3️⃣ Delete folder metadata
  await Folder.deleteOne({
    _id: folderId,
    owner: ownerId,
    isDeleted: true,
  });
}