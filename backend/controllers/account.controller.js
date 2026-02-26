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
// Change password & Sync Encrypted Key (ATOMIC OPERATION)
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, encryptedPrivateKey } = req.body;

    if (!oldPassword || !newPassword || !encryptedPrivateKey) {
      return res.status(400).json({ error: "Missing required security fields" });
    }

    const user = await User.findById(req.user._id).select("+password");

    // 1. Verify old password
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Incorrect old password" });
    }

    // 2. Update BOTH password and key simultaneously 
    user.password = newPassword; 
    user.encryptedPrivateKey = encryptedPrivateKey; 
    
    await user.save(); // The pre-save hook will hash the new password

    res.status(200).json({ success: true, message: "Security credentials updated" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ error: "Failed to update security credentials" });
  }
};

// @desc Update recovery encrypted key (Regenerate Recovery Code)
// @access Private
exports.updateRecoveryKey = async (req, res) => {
  try {
    const { recoveryEncryptedKey } = req.body;

    if (!recoveryEncryptedKey) {
      return res.status(400).json({ error: "Missing new recovery key" });
    }

    await User.findByIdAndUpdate(req.user._id, { recoveryEncryptedKey });

    res.status(200).json({ success: true, message: "Recovery code updated successfully" });
  } catch (err) {
    console.error("Update recovery key error:", err);
    res.status(500).json({ error: "Failed to update recovery key" });
  }
};