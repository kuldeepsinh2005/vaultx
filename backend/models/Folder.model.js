// backend/models/Folder.model.js
const mongoose = require("mongoose");

const FolderSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null, // root
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Folder", FolderSchema);
