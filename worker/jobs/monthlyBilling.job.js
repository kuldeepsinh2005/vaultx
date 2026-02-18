// worker/jobs/monthlyBilling.job.js
require("dotenv").config();
const cron = require("node-cron");
const mongoose = require("mongoose");
const StorageUsage = require("../models/StorageUsage.model");
const Billing = require("../models/Billing.model");
const User = require("../models/User.model");
const CurrentUsage = require("../models/CurrentUsage.model"); 
const { getDynamicMinThreshold } = require("../utils/billingCalculator");

// ✅ Import config instead of hardcoding
const { PRICE_PER_MB_HOUR } = require("../config/billing.config");

// Runs at 00:00 on the 1st day of every month
// cron.schedule("0 0 1 * *", async () => {
cron.schedule("*/1 * * * *", async () => {
  if (mongoose.connection.readyState !== 1) {
    console.log("⏳ Mongo not ready, skipping billing cycle");
    return;
  }

  try {
    console.log("💰 Monthly billing cycle started");
    const users = await User.find({});

    for (const user of users) {
      await processUserBilling(user);
    }

    console.log("✅ Monthly billing cycle complete");
  } catch (err) {
    console.error("❌ Monthly billing failed", err);
  }
});

async function processUserBilling(user) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = new Date();
    const userId = user._id;
    const period = now.toISOString().slice(0, 7); // YYYY-MM

    // 1. Fetch unbilled usage from files (The "Loose" usage)
    const usageRecords = await StorageUsage.find({ 
      user: userId, 
      isBilled: false 
    }).session(session);

    // 2. Fetch "Accumulated" usage from Dashboard cache (The "Vampire" usage)
    const currentUsageDoc = await CurrentUsage.findOne({ 
      user: userId, 
      period 
    }).session(session);

    // If absolutely no usage anywhere, skip
    if (usageRecords.length === 0 && (!currentUsageDoc || currentUsageDoc.mbHoursAccumulated === 0)) {
      await session.abortTransaction();
      return;
    }

    // 3. Combine Metrics
    let totalMBHours = 0;

    // A) Add usage from the files
    for (const record of usageRecords) {
      const startTime = record.lastBilledAt || record.effectiveFrom;
      const endTime = record.effectiveTo || now;
      const hours = (endTime - startTime) / (1000 * 60 * 60);
      const sizeMB = record.size / (1024 * 1024);
      if (hours > 0) totalMBHours += sizeMB * hours;
    }

    // B) Add usage from the Dashboard cache ✅
    if (currentUsageDoc) {
      totalMBHours += currentUsageDoc.mbHoursAccumulated;
    }

    // ✅ Use the imported constant from config
    const totalAmount = totalMBHours * PRICE_PER_MB_HOUR;

    // 4. Threshold Constraint (e.g., ₹45)
    const minThreshold = await getDynamicMinThreshold();
    if (totalAmount < minThreshold) {
      console.log(`[Billing] User ${userId} below threshold (₹${totalAmount.toFixed(2)}). Carrying forward.`);
      await session.abortTransaction();
      return;
    }

    // 5. Calculate Stats
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const mbDays = totalMBHours / 24;
    const averageStorageMB = mbDays / daysInMonth;

    // 6. Create Bill
    const [newBill] = await Billing.create([{
      user: userId,
      amount: Number(totalAmount.toFixed(2)),
      period,
      status: 'UNPAID',
      plan: user.plan || "FREE",
      storageUsed: user.usedStorage || 0,
      mbDays: Number(mbDays.toFixed(4)),
      averageStorageMB: Number(averageStorageMB.toFixed(4))
    }], { session });

    // 7. Update Usage Records
    for (const record of usageRecords) {
      const updateData = { lastBilledAt: now, billingId: newBill._id };
      if (record.effectiveTo !== null) {
        updateData.isBilled = true;
      }
      await StorageUsage.updateOne({ _id: record._id }, { $set: updateData }, { session });
    }

    // 8. CRITICAL: Clear the Dashboard Cache so "Current Bill" resets to 0 ✅
    if (currentUsageDoc) {
      await CurrentUsage.deleteOne({ _id: currentUsageDoc._id }).session(session);
    }

    await session.commitTransaction();
    console.log(`✅ Bill generated for ${user.username}: ₹${totalAmount.toFixed(2)}`);

  } catch (error) {
    await session.abortTransaction();
    console.error(`❌ Billing error for user ${user._id}:`, error.message);
  } finally {
    session.endSession();
  }
}