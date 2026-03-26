// backend/utils/update-stripe.js
const axios = require('axios');
const { SSMClient, PutParameterCommand } = require("@aws-sdk/client-ssm");

async function updateStripeWebhook() {
  // Use the key from the environment
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const ssm = new SSMClient({ region: process.env.AWS_REGION || "us-east-1" });

  try {
    const { data: ip } = await axios.get('http://checkip.amazonaws.com');
    // NOTE: Added :5000 here. If you use Nginx, remove the :5000
    const newUrl = `http://${ip.trim()}:5000/api/billing/webhook`;

    console.log(`🔍 Checking existing endpoints for ${newUrl}...`);
    const endpoints = await stripe.webhookEndpoints.list();

    // Delete any old endpoints pointing to our webhook path
    for (const old of endpoints.data) {
      if (old.url.includes('/api/billing/webhook')) {
        await stripe.webhookEndpoints.del(old.id);
        console.log(`🗑️ Deleted old endpoint: ${old.id}`);
      }
    }

    // Create FRESH endpoint to get the secret
    const endpoint = await stripe.webhookEndpoints.create({
      url: newUrl,
      enabled_events: ['checkout.session.completed'],
    });

    const secret = endpoint.secret;

    // Update AWS SSM
    await ssm.send(new PutParameterCommand({
      Name: "/vaultx/prod/STRIPE_WEBHOOK_SECRET",
      Value: secret,
      Type: "String",
      Overwrite: true
    }));

    console.log(`✅ Stripe URL set to: ${newUrl}`);
    console.log(`✅ SSM Updated with secret: ${secret.slice(0, 10)}...`);
  } catch (err) {
    console.error("❌ Stripe Update Failed:", err.message);
    process.exit(1);
  }
}

updateStripeWebhook();