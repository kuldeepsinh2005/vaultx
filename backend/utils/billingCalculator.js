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

const axios = require('axios');
const { STRIPE_MIN_THRESHOLD_USD, EXCHANGE_RATE_API } = require("../config/billing.config");

let cachedRate = 84.0; // Fallback rate
let lastFetched = 0;

const getLiveRate = async () => {
  const currentTime = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  // Refresh rate if older than 24 hours
  if (currentTime - lastFetched > oneDay) {
    try {
      const response = await axios.get(EXCHANGE_RATE_API);
      if (response.data && response.data.rates && response.data.rates.INR) {
        cachedRate = response.data.rates.INR;
        lastFetched = currentTime;
        console.log(`💱 Live Rate Updated: 1 USD = ${cachedRate} INR`);
      }
    } catch (err) {
      console.error("❌ Failed to fetch live rate, using fallback:", cachedRate);
    }
  }
  return cachedRate;
};

const getDynamicMinThreshold = async () => {
  const rate = await getLiveRate();
  const buffer = 1.05; // 5% buffer for safety
  return Math.ceil(STRIPE_MIN_THRESHOLD_USD * rate * buffer);
};

module.exports = {
  calculateUsageForPeriod,
  calculateUsageBreakdown,
  getDynamicMinThreshold
};


