const CurrentUsage = require("../models/CurrentUsage.model");
const Billing = require("../models/Billing.model");
const StorageUsage = require("../models/StorageUsage.model");
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

async function finalizePreviousMonth() {
  const period = getPreviousMonthPeriod();
  const { end } = getPeriodBounds(period);

  const usages = await CurrentUsage.find({ period });

  for (const usage of usages) {
    const existingBill = await Billing.findOne({
      user: usage.user,
      period,
    });

    if (existingBill) continue; // prevent duplicate invoices

    // 🔥 Before finalizing, capture remaining hours until month end
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
          file.lastBilledAt = new Date();
          await file.save();
        }
      }
    }

    const amount = Number(
      (usage.mbHoursAccumulated * PRICE_PER_MB_HOUR).toFixed(2)
    );

    await Billing.create({
      user: usage.user,
      period,
      plan: "FREE", // optional: fetch from user if needed
      storageUsed: 0,
      mbDays: 0,
      averageStorageMB: 0,
      amount,
      status: amount === 0 ? "PAID" : "UNPAID",
      paidAt: null,
    });

    // 🔥 Reset for next month
    await CurrentUsage.deleteOne({ _id: usage._id });
  }
}

module.exports = { finalizePreviousMonth };
