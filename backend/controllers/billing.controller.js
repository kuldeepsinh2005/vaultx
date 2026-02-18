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

    if (!bill || bill.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: "Bill not found" });
    }

    // ✅ CLEANUP: We don't need Math.max here anymore. 
    // The background worker already filtered out bills below the threshold.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { 
            name: `VaultX Storage - ${bill.period}`,
            description: "Secure Cloud Storage Usage"
          },
          unit_amount: Math.round(bill.amount * 100), // Actual amount from DB in paise
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

    // ✅ SIMPLIFIED: No need for minCharge or adjustment logic here.
    // The bill object in the database is already the final, correct amount.
    const invoiceData = {
      "images": { "logo": "" },
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
        "country": "India"
      },
      "information": {
        "number": bill._id.toString().slice(-8),
        "date": bill.paidAt ? new Date(bill.paidAt).toLocaleDateString() : new Date().toLocaleDateString(),
        "due-date": "PAID"
      },
      "products": [
        {
          "quantity": 1,
          "description": `VaultX Encrypted Storage Service - ${bill.period}`,
          "tax-rate": 0,
          "price": bill.amount 
        }
      ],
      "bottom-notice": "Thank you for choosing VaultX. Your data security is our priority.",
      "settings": { "currency": "INR" }
    };

    const result = await easyinvoice.createInvoice(invoiceData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=VaultX_Invoice_${bill.period}.pdf`);
    return res.send(Buffer.from(result.pdf, 'base64'));

  } catch (err) {
    console.error("Invoice error:", err);
    res.status(500).json({ error: "Invoice generation failed" });
  }
};