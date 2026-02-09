// backend/models/File.model.js
const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },

    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },

    storagePath: {
      type: String,
      required: true,
    },

    storageProvider: {
      type: String,
      required: true,
    },

    wrappedKey: {
      type: String,
      required: true,
    },
    iv: {
      type: String,
      required: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

FileSchema.index(
  { deletedAt: 1 },
  { expireAfterSeconds: 30  } 
);
FileSchema.index({ owner: 1, isDeleted: 1 });


// 60 * 60 * 24 * 30
module.exports = mongoose.model("File", FileSchema);
