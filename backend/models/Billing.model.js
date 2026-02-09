const mongoose = require("mongoose");

const BillingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    period: {
      type: String, // YYYY-MM
      required: true,
      index: true,
    },

    plan: {
      type: String,
      required: true,
    },

    storageUsed: {
      type: Number, // bytes
      required: true,
    },

    amount: {
      type: Number, // INR
      required: true,
    },

    status: {
      type: String,
      enum: ["PAID", "UNPAID"],
      default: "UNPAID",
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// one bill per user per month
BillingSchema.index({ user: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("Billing", BillingSchema);
