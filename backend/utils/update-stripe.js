// update-stripe.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const { SSMClient, PutParameterCommand } = require("@aws-sdk/client-ssm");
async function updateStripeWebhook() {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const ssm = new SSMClient({ region: process.env.AWS_REGION || "us-east-1" });

  try {
    const { data: ip } = await axios.get('http://checkip.amazonaws.com');
    const newUrl = `http://${ip.trim()}/api/billing/webhook`;

    const endpoints = await stripe.webhookEndpoints.list();
    let endpoint = endpoints.data.find(e => e.url.includes('/api/billing/webhook'));

    if (endpoint) {
      endpoint = await stripe.webhookEndpoints.update(endpoint.id, { url: newUrl });
    } else {
      endpoint = await stripe.webhookEndpoints.create({
        url: newUrl,
        enabled_events: ['checkout.session.completed'],
      });
    }

    // 🔥 THE MISSING LINK: Update AWS SSM with the NEW secret
    const secret = endpoint.secret; 
    await ssm.send(new PutParameterCommand({
      Name: "/vaultx/prod/STRIPE_WEBHOOK_SECRET",
      Value: secret,
      Type: "String",
      Overwrite: true
    }));

    console.log(`✅ SSM Updated with secret: ${secret.slice(0, 10)}...`);
  } catch (err) { console.error(err); }
}

updateStripeWebhook();