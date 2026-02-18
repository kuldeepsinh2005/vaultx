// backend/utils/billing.status.js
const Billing = require("../models/Billing.model");

async function hasAnyUnpaidBill(userId) {
  return (await Billing.countDocuments({
    user: userId,
    status: "UNPAID",
  })) > 0;
}

async function getOutstandingBalance(userId) {
  const bills = await Billing.find({ user: userId, status: "UNPAID" });
  return bills.reduce((sum, b) => sum + b.amount, 0);
}

module.exports = { hasAnyUnpaidBill, getOutstandingBalance };
