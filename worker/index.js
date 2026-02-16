// worker/index.js
require("dotenv").config();
const mongoose = require("mongoose");

async function init() {
  try {
    // 1. Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🧵 Worker connected to MongoDB");

    // 2. Start the job ONLY after connection is successful
    require("./jobs/trashCleanup.job");
    require("./jobs/monthlyBilling.job");
    console.log("🚀 VaultX worker started");
  } catch (err) {
    console.error("❌ Worker failed to connect to DB:", err);
    process.exit(1);
  }
}

init();