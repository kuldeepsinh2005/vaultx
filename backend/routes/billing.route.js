// backend/routes/billing.route.js
const router = require("express").Router();
const { verifyJWT } = require("../middleware/auth.middleware");
const {
  getUsage,
  getHistory,
  getCurrentBill,
  getUsageBreakdown
} = require("../controllers/billing.controller");

router.get("/usage", verifyJWT, getUsage);
router.get("/history", verifyJWT, getHistory);
router.get("/current", verifyJWT, getCurrentBill);
router.get("/breakdown", verifyJWT, getUsageBreakdown);

module.exports = router;
