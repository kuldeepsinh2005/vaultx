// backend/routes/debug.route.js
const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middleware/auth.middleware");
const { calculateUsageForPeriod } = require("../utils/billingCalculator");
router.get("/billing-test", verifyJWT, async (req, res) => {
  const start = new Date("2026-02-01");
  const end = new Date("2026-02-29");

  const data = await calculateUsageForPeriod(req.user._id, start, end);
  res.json(data);
});

module.exports = router;    