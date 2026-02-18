// backend/utils/folderHelper.js
const Folder = require("../models/Folder.model");

async function ensureFolderPath(userId, parts, baseFolder = null) {
  let parent = baseFolder;

  for (const name of parts) {
    let folder = await Folder.findOne({
      owner: userId,
      name,
      parent
    });

    if (!folder) {
      folder = await Folder.create({
        owner: userId,
        name,
        parent
      });
    }

    parent = folder._id;
  }

  return parent;
}


module.exports = { ensureFolderPath };
