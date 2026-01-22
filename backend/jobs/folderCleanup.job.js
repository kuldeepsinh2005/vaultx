// backend/jobs/folderCleanup.job.js
// const cron = require("node-cron");
// const Folder = require("../models/Folder.model");
// const File = require("../models/File.model");
// const { getStorageProvider } = require("../storage");

// const DELETE_AFTER_MS = process.env.NODE_ENV === "production"
//     ? 30 * 24 * 60 * 60 * 1000
//     : 90 * 1000;

// const BATCH_SIZE = 50;

// let cleanupRunning = false;

// cron.schedule("*/5 * * * *", async () => {
//   if (cleanupRunning) return;
//   cleanupRunning = true;

//   try {
//     const expiredFolders = await Folder.find({
//       isDeleted: true,
//       deletedAt: { $lte: new Date(Date.now() - DELETE_AFTER_MS) }
//     })
//     .limit(BATCH_SIZE)
//     .select("_id owner");

//     for (const folder of expiredFolders) {
//       await deleteFolderForever(folder._id, folder.owner);
//     }
//   } finally {
//     cleanupRunning = false;
//   }
// });

// async function deleteFolderForever(rootFolderId) {
//   const storage = getStorageProvider();
//   const stack = [rootFolderId];

//   while (stack.length) {
//     const folderId = stack.pop();

//     const children = await Folder.find({ parent: folderId }).select("_id");
//     children.forEach(c => stack.push(c._id));

//     const files = await File.find({ folder: folderId });
//     await Promise.all(
//       files.map(f =>
//         storage.delete(f.storagePath)
//           .then(() => File.deleteOne({ _id: f._id }))
//       )
//     );

//     await Folder.deleteOne({ _id: folderId });
//   }
// }
