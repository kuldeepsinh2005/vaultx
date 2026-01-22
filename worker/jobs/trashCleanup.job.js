// worker/jobs/trashCleanup.job.js
const cron = require("node-cron");
const mongoose = require("mongoose");
const Folder = require("../models/Folder.model");
const File = require("../models/File.model");
const { getStorageProvider } = require("../../backend/storage");

const DELETE_AFTER_MS = 90 * 1000;
const BATCH_SIZE = 10;

cron.schedule("*/1 * * * *", async () => {
  if (mongoose.connection.readyState !== 1) {
    console.log("⏳ Mongo not ready, skipping cleanup");
    return;
  }

  try {
    console.log("🧹 Trash cleanup started");
    const threshold = new Date(Date.now() - DELETE_AFTER_MS);
    const storage = getStorageProvider();

    /* 1. PROCESS EXPIRED FILES */
    const expiredFiles = await File.find({
      isDeleted: true,
      deletedAt: { $lte: threshold }
    }).limit(BATCH_SIZE);

    for (const file of expiredFiles) {
      try {
        console.log(`Attempting to delete file: ${file.storagePath}`); 
        await storage.delete(file.storagePath);
        await file.deleteOne();
      } catch (err) {
        // ENOENT means "Error NO ENTitity" (file already gone from disk)
        if (err.code === 'ENOENT') {
          console.warn(`File already missing from disk, removing DB record: ${file._id}`);
          await file.deleteOne();
        } else {
          console.error(`Physical file delete failed for ${file._id}:`, err.message);
        }
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

  // Clean up files in this folder
  const files = await File.find({ folder: folderId, owner: ownerId });
  for (const file of files) {
    try {
      await storage.delete(file.storagePath);
      await file.deleteOne();
    } catch (err) {
      if (err.code === 'ENOENT') await file.deleteOne();
      else console.error(`Error deleting file ${file._id} in folder cleanup:`, err.message);
    }
  }

  // Recurse into subfolders
  const children = await Folder.find({ parent: folderId, owner: ownerId });
  for (const child of children) {
    await deleteFolderForever(child._id, ownerId);
  }

  // Delete the folder itself
  await Folder.deleteOne({ _id: folderId, owner: ownerId });
}