// backend/models/StorageUsage.model.js
const mongoose = require("mongoose");

const StorageUsageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: true,
    },

    size: {
      type: Number, // bytes
      required: true,
    },

    effectiveFrom: {
      type: Date,
      required: true,
    },

    effectiveTo: {
      type: Date,
      default: null, // null means still stored
    },

    lastBilledAt: {
      type: Date,
      default: Date.now
    },
    isBilled: {
        type: Boolean,
        default: false
    },
    billingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Billing',
        default: null
    }

  },
  { timestamps: true }
);

module.exports = mongoose.model("StorageUsage", StorageUsageSchema);
