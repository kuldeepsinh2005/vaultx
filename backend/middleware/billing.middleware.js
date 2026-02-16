// backend/middleware/billing.middleware.js
const { hasAnyUnpaidBill } = require("../utils/billing.status");
const Billing = require("../models/Billing.model.js");
exports.enforceBillingClear = async (req, res, next) => {
 const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const unpaid = await Billing.findOne({
    user: req.user._id,
    status: "UNPAID",
    period: { $lt: currentPeriod }, // only past months
  });

  if (unpaid) {
    return res.status(403).json({
      code: "BILLING_UNPAID",
      message: "Previous unpaid bill exists. Please clear dues.",
    });
  }

  next();
};
