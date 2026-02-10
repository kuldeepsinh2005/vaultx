// backend/middleware/billing.middleware.js
const { hasAnyUnpaidBill } = require("../utils/billing.status");

exports.enforceBillingClear = async (req, res, next) => {
  if (await hasAnyUnpaidBill(req.user._id)) {
    return res.status(403).json({
      code: "BILLING_UNPAID",
      message: "Unpaid bill exists. Please clear dues.",
    });
  }
  next();
};
