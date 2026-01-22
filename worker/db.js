// worker/db.js
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on("connected", () => {
  console.log("🧵 Worker connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Worker DB error:", err);
});
