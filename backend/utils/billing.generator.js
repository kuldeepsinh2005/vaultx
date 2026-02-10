// backend/utils/billing.generator.js
const Billing = require("../models/Billing.model");
const User = require("../models/User.model");
const { calculateUsageForPeriod } = require("./billingCalculator");
const { PRICE_PER_MB_DAY } = require("../config/billing.config");

function getPeriodBounds(period) {
  const [y, m] = period.split("-").map(Number);
  return {
    start: new Date(y, m - 1, 1),
    end: new Date(y, m, 0, 23, 59, 59, 999),
  };
}

async function generateMonthlyBill(userId, period) {
  const existing = await Billing.findOne({ user: userId, period });
  if (existing) return existing;

  const user = await User.findById(userId);
  const { start, end } = getPeriodBounds(period);

  const mbDays = await calculateUsageForPeriod(userId, start, end);
  const daysInMonth = new Date(
    end.getFullYear(),
    end.getMonth() + 1,
    0
  ).getDate();

  const avgMB = Number((mbDays / daysInMonth).toFixed(2));

  const amount = Number((mbDays * PRICE_PER_MB_DAY).toFixed(2));

  return Billing.create({
    user: userId,
    period,
    plan: user.plan,
    storageUsed: user.usedStorage,
    mbDays,
    averageStorageMB: avgMB,
    amount,
    status: amount === 0 ? "PAID" : "UNPAID",
  });
}

module.exports = { generateMonthlyBill };
