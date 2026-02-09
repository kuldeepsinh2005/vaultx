// worker/jobs/trashCleanup.job.js
require("dotenv").config();
const cron = require("node-cron");
const mongoose = require("mongoose");
const Folder = require("../models/Folder.model");
const File = require("../models/File.model");
const { getStorageProvider } = require("../storage");

const TRASH_TTL_MS  = 10 * 1000;
const BATCH_SIZE = 10;

cron.schedule("*/1 * * * *", async () => {
  if (mongoose.connection.readyState !== 1) {
    console.log("⏳ Mongo not ready, skipping cleanup");
    return;
  }

  try {
    console.log("🧹 Trash cleanup started");
    const threshold = new Date(Date.now() - TRASH_TTL_MS );
    const storage = getStorageProvider();
    console.log("🧪 Storage provider in worker:", storage.constructor.name);

    /* 1. PROCESS EXPIRED FILES */
    const expiredFiles = await File.find({
      isDeleted: true,
      deletedAt: { $lte: threshold }
    })
    .sort({ deletedAt: 1 })
    .limit(BATCH_SIZE);


    for (const file of expiredFiles) {
      try {
        console.log(`Attempting to delete file: ${file.storagePath}`); 
        await storage.delete(file.storagePath);
        await file.deleteOne();
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`Storage delete failed for ${file._id}:`, err.message);
        }
        await file.deleteOne(); // DB cleanup regardless
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

  // 1️⃣ Delete files in this folder (trash only)
  const files = await File.find({
    folder: folderId,
    owner: ownerId,
    isDeleted: true,
  });

  for (const file of files) {
    try {
      await storage.delete(file.storagePath);
    }catch (err) {
      if (err.code !== "ENOENT") {
        console.error(`Storage delete failed for ${file._id}:`, err.message);
      }
      await file.deleteOne(); // always clean DB
    } finally {
      await file.deleteOne();
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

  // 3️⃣ Delete the folder itself (trash only)
  await Folder.deleteOne({
    _id: folderId,
    owner: ownerId,
    isDeleted: true,
  });
}
