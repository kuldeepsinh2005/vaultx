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
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

  },
  { timestamps: true }
);

FolderSchema.index({ deletedAt: 1 });

module.exports = mongoose.model("Folder", FolderSchema);
