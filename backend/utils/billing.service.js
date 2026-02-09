const Billing = require("../models/Billing.model");
const plans = require("./plans");

const getCurrentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const ensureCurrentBill = async (user) => {
  const period = getCurrentPeriod();

  let bill = await Billing.findOne({ user: user._id, period });
  if (bill) return bill;

  const plan = plans[user.plan];

  bill = await Billing.create({
    user: user._id,
    period,
    plan: user.plan,
    storageUsed: user.usedStorage,
    amount: plan.price,
    status: plan.price === 0 ? "PAID" : "UNPAID",
  });

  return bill;
};

module.exports = { ensureCurrentBill };
