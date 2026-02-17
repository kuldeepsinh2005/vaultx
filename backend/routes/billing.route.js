// backend/routes/billing.route.js
const router = require("express").Router();
const { verifyJWT } = require("../middleware/auth.middleware");
const {
  getUsage,
  getHistory,
  getCurrentBill,
  getUsageBreakdown,
  createCheckoutSession,
  downloadInvoice
} = require("../controllers/billing.controller");

router.get("/usage", verifyJWT, getUsage);
router.get("/history", verifyJWT, getHistory);
router.get("/current", verifyJWT, getCurrentBill);
router.get("/breakdown", verifyJWT, getUsageBreakdown);
router.post("/create-checkout-session", verifyJWT, createCheckoutSession);
router.get("/invoice/:id", verifyJWT, downloadInvoice);

module.exports = router;
