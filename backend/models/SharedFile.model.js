const mongoose = require("mongoose");

const SharedFileSchema = new mongoose.Schema(
  {
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
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
    // This is the AES key wrapped specifically with the 'sharedWith' user's Public Key
    wrappedKey: {
      type: String,
      required: true,
    },
    permission: {
      type: String,
      enum: ["VIEW", "EDIT"], // In case you want to add collaborative editing later
      default: "VIEW"
    }
  },
  { timestamps: true }
);

// Prevent sharing the same file with the same user multiple times
SharedFileSchema.index({ file: 1, sharedWith: 1 }, { unique: true });

module.exports = mongoose.model("SharedFile", SharedFileSchema);