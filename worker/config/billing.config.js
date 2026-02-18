// backend/config/billing.config.js
module.exports = {
  PRICE_PER_MB_HOUR: 0.01,
  STRIPE_MIN_THRESHOLD_USD: 0.50,
  // Using a free, no-auth-required API for student project
  EXCHANGE_RATE_API: "https://open.er-api.com/v6/latest/USD"
};