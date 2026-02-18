const StorageUsage = require("../models/StorageUsage.model");
const CurrentUsage = require("../models/CurrentUsage.model");

const MS_PER_HOUR = 1000 * 60 * 60;

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

async function accumulateLiveUsage(userId) {
  const now = new Date();
  const period = getCurrentPeriod();

  // Get or create CurrentUsage record
  let usage = await CurrentUsage.findOne({ user: userId, period });

  if (!usage) {
    usage = await CurrentUsage.create({
      user: userId,
      period,
      mbHoursAccumulated: 0,
    });
  }

  // Get active files (not deleted)
  const activeFiles = await StorageUsage.find({
    user: userId,
    effectiveTo: null,
  });

  for (const file of activeFiles) {
    const lastBilled = file.lastBilledAt || file.effectiveFrom;

    const hours = (now - lastBilled) / MS_PER_HOUR;

    if (hours <= 0) continue;

    const sizeMB = file.size / (1024 * 1024);
    const mbHours = sizeMB * hours;

    usage.mbHoursAccumulated += mbHours;

    file.lastBilledAt = now;
    await file.save();
  }

  await usage.save();

  return usage;
}

module.exports = { accumulateLiveUsage };
