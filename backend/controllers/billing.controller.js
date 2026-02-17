// backend/controllers/billing.controller.js
const Billing = require("../models/Billing.model");
const { generateMonthlyBill } = require("../utils/billing.generator");
const { getOutstandingBalance } = require("../utils/billing.status");
const { calculateUsageBreakdown } = require("../utils/billingCalculator");
const { accumulateLiveUsage } = require("../utils/liveUsageAccumulator");
const CurrentUsage = require("../models/CurrentUsage.model");
const { PRICE_PER_MB_HOUR } = require("../config/billing.config");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const easyinvoice = require('easyinvoice');
const { getDynamicMinThreshold } = require("../utils/billingCalculator");

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// 🔹 Usage + current bill summary
exports.getUsage = async (req, res) => {
  const period = currentPeriod();

  // 🔥 accumulate new usage before returning
  const usageData = await accumulateLiveUsage(req.user._id);

  const amount = Number(
    (usageData.mbHoursAccumulated * PRICE_PER_MB_HOUR).toFixed(2)
  );

  const outstanding = await getOutstandingBalance(req.user._id);

  res.json({
    plan: req.user.plan,
    usedStorage: req.user.usedStorage,
    maxStorage: req.user.maxStorage,
    billing: {
      period,
      mbHours: usageData.mbHoursAccumulated.toFixed(4),
      amount,
      status: "PENDING",
      outstanding,
    },
  });
};


// 🔹 Billing history
exports.getHistory = async (req, res) => {
  const bills = await Billing.find({ user: req.user._id })
    .sort({ period: -1 });

  res.json({ bills });
};

// 🔹 Explicit current bill endpoint (optional)
exports.getCurrentBill = async (req, res) => {
  const bill = await generateMonthlyBill(req.user._id, currentPeriod());
  const outstanding = await getOutstandingBalance(req.user._id);
  res.json({ bill, outstanding });
};

exports.getUsageBreakdown = async (req, res) => {
  const period = req.query.period; // YYYY-MM
  if (!period) {
    return res.status(400).json({ message: "Period is required" });
  }

  const [y, m] = period.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  const breakdown = await calculateUsageBreakdown(
    req.user._id,
    start,
    end
  );

  res.json({ breakdown });
};

exports.createCheckoutSession = async (req, res) => {
  try {
    const { billId } = req.body;
    const bill = await Billing.findById(billId);

    // 1. Ensure the bill exists and belongs to the user
    if (!bill || bill.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: "Bill not found" });
    }

    // 2. APPLY MINIMUM FLOOR (₹45 is ~0.54 USD)
    // This solves the "must convert to at least 50 cents" error
    const minCharge = await getDynamicMinThreshold();
    const finalAmount = Math.max(bill.amount, MIN_CHARGE_INR);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'inr', // Keep INR to avoid complex export reporting
          product_data: { name: `VaultX Storage - ${bill.period}` },
          unit_amount: Math.round(finalAmount * 100), // Convert to paise
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      metadata: { billId: bill._id.toString() },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🆕 Function to handle the Webhook (called directly from server.js)
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await Billing.findByIdAndUpdate(session.metadata.billId, { 
      status: 'PAID',
      paidAt: new Date() 
    });
  }

  res.json({ received: true });
};


exports.downloadInvoice = async (req, res) => {
  try {
    const bill = await Billing.findById(req.params.id).populate('user');

    if (!bill || bill.user._id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const minCharge = await getDynamicMinThreshold();
    const actualUsage = bill.amount;
    const needsAdjustment = actualUsage < minCharge;
    const adjustmentAmount = needsAdjustment ? (minCharge - actualUsage) : 0;
    // 1. Data Safety Check: Ensure no values are undefined/null
    const invoiceData = {
      "images": {
        "logo": "" // Use an empty string if no logo URL is available
      },
      "sender": {
        "company": "VaultX Corp",
        "address": "Secure Cloud Lane",
        "zip": "12345",
        "city": "CyberSpace",
        "country": "India"
      },
      "client": {
        "company": bill.user.username || "VaultX User",
        "address": bill.user.email || "",
        "zip": bill.period || "",
        "city": "User ID: " + bill.user._id.toString().slice(-6),
        "country": "India" // easyinvoice often requires 'country' for both
      },
      "information": {
        "number": bill._id.toString().slice(-8),
        "date": bill.paidAt ? new Date(bill.paidAt).toLocaleDateString() : new Date().toLocaleDateString(),
        "due-date": "PAID"
      },
      "products": [
        {
          "quantity": Number((bill.mbHoursAccumulated || 0).toFixed(2)),
          "description": `Encrypted Storage Usage (${bill.period})`,
          "tax-rate": 0,
          "price": Number(actualUsage.toFixed(2))
        },
        ...(needsAdjustment ? [{
          "quantity": 1,
          "description": "Minimum Transaction Adjustment Fee",
          "tax-rate": 0,
          "price": Number(adjustmentAmount.toFixed(2))
        }] : [])
      ],
      "bottom-notice": needsAdjustment 
        ? "A minimum transaction adjustment was applied to meet payment gateway requirements."
        : "Standard usage billing applied.",
      "settings": { "currency": "INR" }
    };

    // 2. Create the invoice
    const result = await easyinvoice.createInvoice(invoiceData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=VaultX_Invoice_${bill.period}.pdf`);
    return res.send(Buffer.from(result.pdf, 'base64'));

  } catch (err) {
    res.status(500).json({ error: "Invoice generation failed" });
  }
};