const mongoose = require("mongoose");

const SharedFolderSchema = new mongoose.Schema(
  {
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // We don't need a wrappedKey here because Folder names are not encrypted 
    // in your current Folder.model (they are plain text). 
    // If you encrypt folder names later, add wrappedKey here.
    permission: {
      type: String,
      enum: ["VIEW", "EDIT"],
      default: "VIEW"
    }
  },
  { timestamps: true }
);

// Prevent sharing the same folder with the same user multiple times
SharedFolderSchema.index({ folder: 1, sharedWith: 1 }, { unique: true });

module.exports = mongoose.model("SharedFolder", SharedFolderSchema);