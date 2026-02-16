require("dotenv").config();
const cron = require("node-cron");
const mongoose = require("mongoose");

const CurrentUsage = require("../models/CurrentUsage.model");
const Billing = require("../models/Billing.model");
const StorageUsage = require("../models/StorageUsage.model");
const User = require("../models/User.model");
const { PRICE_PER_MB_HOUR } = require("../config/billing.config");

const MS_PER_HOUR = 1000 * 60 * 60;

function getPreviousMonthPeriod() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getPeriodBounds(period) {
  const [y, m] = period.split("-").map(Number);
  return {
    start: new Date(y, m - 1, 1),
    end: new Date(y, m, 0, 23, 59, 59, 999),
  };
}

// 🔥 For testing use every minute
// cron.schedule("*/1 * * * *", async () => {
// 🔥 For production use:
cron.schedule("0 0 1 * *", async () => {

  console.log("📅 Month-end billing job started");

  if (mongoose.connection.readyState !== 1) {
    console.log("❌ DB not connected");
    return;
  }

  const period = getPreviousMonthPeriod();
  // for testing, we can just use the current period to see immediate results
  // const now = new Date();
  // const period = `${now.getFullYear()}-${String(
  //   now.getMonth() + 1
  // ).padStart(2, "0")}`;
  

  const { end } = getPeriodBounds(period);

  const usages = await CurrentUsage.find({ period });

  for (const usage of usages) {

    const existingBill = await Billing.findOne({
      user: usage.user,
      period,
    });

    if (existingBill) continue;

    // 🔥 Capture remaining hours until month end
    const activeFiles = await StorageUsage.find({
      user: usage.user,
      effectiveTo: null,
    });

    for (const file of activeFiles) {
      const lastBilled = file.lastBilledAt || file.effectiveFrom;

      if (lastBilled < end) {
        const hours = (end - lastBilled) / MS_PER_HOUR;

        if (hours > 0) {
          const sizeMB = file.size / (1024 * 1024);
          const mbHours = sizeMB * hours;

          usage.mbHoursAccumulated += mbHours;
          file.lastBilledAt = end;
          await file.save();
        }
      }
    }

    const amount = Number(
      (usage.mbHoursAccumulated * PRICE_PER_MB_HOUR).toFixed(2)
    );

    const user = await User.findById(usage.user);

    await Billing.create({
      user: usage.user,
      period,
      plan: user.plan,
      storageUsed: user.usedStorage,
      mbDays: 0,              // legacy field
      averageStorageMB: 0,    // legacy field
      amount,
      status: amount === 0 ? "PAID" : "UNPAID",
      paidAt: null,
    });

    // 🔥 Remove live usage after finalizing
    await CurrentUsage.deleteOne({ _id: usage._id });

    console.log(`✅ Invoice finalized for ${user.username} (${period})`);
  }

  console.log("🏁 Month-end billing completed");
});
