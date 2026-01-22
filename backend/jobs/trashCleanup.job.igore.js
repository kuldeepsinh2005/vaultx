// const cron = require("node-cron");
// const File = require("../models/File.model");
// const Folder = require("../models/Folder.model");
// const { getStorageProvider } = require("../storage");

// const EXPIRY_MS = 90 * 1000; // 🔥 1.5 minutes (TESTING)

// // Recursive permanent delete for folder
// const deleteFolderForever = async (folderId, owner) => {
//   // delete files inside folder
//   const files = await File.find({ folder: folderId, owner });
//   const storage = getStorageProvider();

//   for (const file of files) {
//     await storage.delete(file.storagePath);
//     await file.deleteOne();
//   }

//   // delete subfolders
//   const subFolders = await Folder.find({ parent: folderId, owner });
//   for (const sub of subFolders) {
//     await deleteFolderForever(sub._id, owner);
//   }

//   // delete folder itself
//   await Folder.deleteOne({ _id: folderId, owner });
// };

// // Run every 30 seconds (fast for testing)
// cron.schedule("*/30 * * * * *", async () => {
//   try {
//     const expiryTime = new Date(Date.now() - EXPIRY_MS);

//     console.log("🧹 Running trash cleanup job...");

//     /* -------- FILES -------- */
//     const expiredFiles = await File.find({
//       isDeleted: true,
//       deletedAt: { $lte: expiryTime },
//     });

//     const storage = getStorageProvider();

//     for (const file of expiredFiles) {
//       await storage.delete(file.storagePath);
//       await file.deleteOne();
//       console.log(`🗑️ Auto-deleted file: ${file.originalName}`);
//     }

//     /* -------- FOLDERS -------- */
//     const expiredFolders = await Folder.find({
//       isDeleted: true,
//       deletedAt: { $lte: expiryTime },
//     });

//     for (const folder of expiredFolders) {
//       await deleteFolderForever(folder._id, folder.owner);
//       console.log(`🗑️ Auto-deleted folder: ${folder.name}`);
//     }

//   } catch (err) {
//     console.error("❌ Trash cleanup failed", err);
//   }
// });
