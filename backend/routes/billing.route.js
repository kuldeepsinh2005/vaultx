const router = require("express").Router();
const { verifyJWT } = require("../middleware/auth.middleware");
const {
  getUsage,
  getHistory,
} = require("../controllers/billing.controller");

router.get("/usage", verifyJWT, getUsage);
router.get("/history", verifyJWT, getHistory);

module.exports = router;
