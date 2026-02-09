const Billing = require("../models/Billing.model");
const { ensureCurrentBill } = require("../utils/billing.service");

exports.getUsage = async (req, res) => {
  const user = req.user;
  const bill = await ensureCurrentBill(user);

  res.json({
    plan: user.plan,
    usedStorage: user.usedStorage,
    maxStorage: user.maxStorage,
    billing: {
      period: bill.period,
      amount: bill.amount,
      status: bill.status,
    },
  });
};

exports.getHistory = async (req, res) => {
  const bills = await Billing.find({ user: req.user._id })
    .sort({ period: -1 });

  res.json({ bills });
};
