// update-stripe.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

async function updateStripeWebhook() {
  try {
    // 1. Get Current Public IP
    const { data: ip } = await axios.get('http://checkip.amazonaws.com');
    const newWebhookUrl = `http://${ip.trim()}/api/billing/webhook`;
    console.log(`🚀 New Target Webhook URL: ${newWebhookUrl}`);

    // 2. Find your existing Webhook Endpoint in Stripe
    const endpoints = await stripe.webhookEndpoints.list();
    const targetEndpoint = endpoints.data.find(e => e.url.includes('/api/billing/webhook'));

    if (targetEndpoint) {
      // 3. Update the existing one
      await stripe.webhookEndpoints.update(targetEndpoint.id, {
        url: newWebhookUrl,
      });
      console.log(`✅ Stripe Webhook updated for ID: ${targetEndpoint.id}`);
    } else {
      // 4. Create one if it doesn't exist
      const created = await stripe.webhookEndpoints.create({
        url: newWebhookUrl,
        enabled_events: [
          'checkout.session.completed',
          'invoice.paid',
          'invoice.payment_failed'
        ],
      });
      console.log(`✨ Created new Stripe Webhook: ${created.id}`);
    }
  } catch (err) {
    console.error("❌ Stripe Update Failed:", err.message);
  }
}

updateStripeWebhook();