// backend/models/File.model.js
const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
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

  storagePath: {
    type: String,
    required: true,
  },

  encryptedKey: {
    type: String, // base64
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model("File", FileSchema);
