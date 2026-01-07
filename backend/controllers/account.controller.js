// backend/controllers/account.controller.js
const User = require("../models/User.model");
const bcrypt = require("bcryptjs");

// Change username
exports.changeUsername = async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username required" });
  }

  const exists = await User.findOne({ username });
  if (exists) {
    return res.status(409).json({ error: "Username already taken" });
  }

  await User.findByIdAndUpdate(req.user._id, { username });

  res.status(200).json({ success: true });
};

// Change password (AUTH ONLY – no crypto here)
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  user.password = newPassword; // will be hashed by pre-save hook
  await user.save();

  res.status(200).json({ success: true });
};
