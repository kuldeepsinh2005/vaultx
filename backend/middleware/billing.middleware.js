const Billing = require("../models/Billing.model");
const { ensureCurrentBill } = require("../utils/billing.service");

/**
 * Blocks uploads if:
 * 1. Bill is unpaid
 * 2. Storage quota exceeded
 */
exports.enforceUploadAllowed = async (req, res, next) => {
  const user = req.user;

  // Ensure current month's bill exists
  const bill = await ensureCurrentBill(user);

  // 1️⃣ Block if unpaid bill
  if (bill.status === "UNPAID") {
    return res.status(403).json({
      message: "Billing overdue. Please pay your bill to upload files.",
      code: "BILLING_UNPAID",
    });
  }

  // 2️⃣ Block if quota exceeded (extra safety)
  if (user.usedStorage >= user.maxStorage) {
    return res.status(403).json({
      message: "Storage limit exceeded.",
      code: "STORAGE_LIMIT_EXCEEDED",
    });
  }

  next();
};

/**
 * Blocks downloads if bill is unpaid
 */
exports.enforceDownloadAllowed = async (req, res, next) => {
  const user = req.user;

  const bill = await ensureCurrentBill(user);

  if (bill.status === "UNPAID") {
    return res.status(403).json({
      message: "Billing overdue. Please pay your bill to download files.",
      code: "BILLING_UNPAID",
    });
  }

  next();
};
