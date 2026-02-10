// backend/controllers/billing.controller.js
const Billing = require("../models/Billing.model");
const { generateMonthlyBill } = require("../utils/billing.generator");
const { getOutstandingBalance } = require("../utils/billing.status");
const { calculateUsageBreakdown } = require("../utils/billingCalculator");
const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// 🔹 Usage + current bill summary
exports.getUsage = async (req, res) => {
  const bill = await generateMonthlyBill(
    req.user._id,
    currentPeriod()
  );
  const outstanding = await getOutstandingBalance(req.user._id);

  res.json({
    plan: req.user.plan,
    usedStorage: req.user.usedStorage,
    maxStorage: req.user.maxStorage,
    billing: {
      period: bill.period,
      amount: bill.amount,
      status: bill.status,
      outstanding,
    },
  });
};

// 🔹 Billing history
exports.getHistory = async (req, res) => {
  const bills = await Billing.find({ user: req.user._id })
    .sort({ period: -1 });

  res.json({ bills });
};

// 🔹 Explicit current bill endpoint (optional)
exports.getCurrentBill = async (req, res) => {
  const bill = await generateMonthlyBill(req.user._id, currentPeriod());
  const outstanding = await getOutstandingBalance(req.user._id);
  res.json({ bill, outstanding });
};

exports.getUsageBreakdown = async (req, res) => {
  const period = req.query.period; // YYYY-MM
  if (!period) {
    return res.status(400).json({ message: "Period is required" });
  }

  const [y, m] = period.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  const breakdown = await calculateUsageBreakdown(
    req.user._id,
    start,
    end
  );

  res.json({ breakdown });
};
