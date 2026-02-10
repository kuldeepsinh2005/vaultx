// backend/utils/billingCalculator.js
const StorageUsage = require("../models/StorageUsage.model");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

async function calculateUsageForPeriod(userId, start, end) {
  const usages = await StorageUsage.find({
    user: userId,
    effectiveFrom: { $lte: end },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }],
  }).lean();

  let totalMBDays = 0;

  for (const u of usages) {
    const from = new Date(Math.max(u.effectiveFrom, start));
    const to = u.effectiveTo
      ? new Date(Math.min(u.effectiveTo, end))
      : end;

    if (to <= from) continue;

    const days = Math.ceil((to - from) / MS_PER_DAY);
    const sizeMB = u.size / (1024 * 1024);

    totalMBDays += sizeMB * days;
  }

  return Number(totalMBDays.toFixed(2));
}

async function calculateUsageBreakdown(userId, start, end) {
  const usages = await StorageUsage.find({
    user: userId,
    effectiveFrom: { $lte: end },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }],
  }).populate("file", "originalName size");

  const breakdown = [];
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  for (const u of usages) {
    const from = new Date(Math.max(u.effectiveFrom, start));
    const to = u.effectiveTo
      ? new Date(Math.min(u.effectiveTo, end))
      : end;

    if (to <= from) continue;

    const days = Math.ceil((to - from) / MS_PER_DAY);
    const sizeMB = u.size / (1024 * 1024);
    const mbDays = Number((sizeMB * days).toFixed(2));

    breakdown.push({
      fileName: u.file?.originalName || "Deleted file",
      sizeMB: Number(sizeMB.toFixed(2)),
      daysStored: days,
      mbDays,
    });
  }

  return breakdown;
}

module.exports = {
  calculateUsageForPeriod,
  calculateUsageBreakdown,
};


