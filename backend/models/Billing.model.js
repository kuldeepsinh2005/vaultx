// backend/models/Billing.model.js
const mongoose = require("mongoose");
const BillingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    period: { type: String, required: true, index: true }, // YYYY-MM

    plan: { type: String, required: true },

    // 🔴 keep for backward compatibility
    storageUsed: { type: Number, required: true }, // bytes (snapshot)

    // ✅ ADD THESE
    mbDays: { type: Number, required: true },      // MB-days for the period
    averageStorageMB: { type: Number, required: true },

    amount: { type: Number, required: true },      // INR

    status: { type: String, enum: ["PAID", "UNPAID"], default: "UNPAID" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);
BillingSchema.index({ user: 1, period: 1 }, { unique: true });
module.exports = mongoose.model("Billing", BillingSchema);