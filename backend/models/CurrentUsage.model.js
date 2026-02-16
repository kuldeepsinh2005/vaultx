const mongoose = require("mongoose");

const CurrentUsageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    period: {
      type: String,
      required: true,
      index: true, // YYYY-MM
    },

    mbHoursAccumulated: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

CurrentUsageSchema.index({ user: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("CurrentUsage", CurrentUsageSchema);
