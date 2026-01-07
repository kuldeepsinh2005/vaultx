// backend/controllers/key.controller.js
const User = require("../models/User.model");

exports.savePublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({ error: "Public key required" });
    }

    await User.findByIdAndUpdate(req.user._id, { publicKey });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save public key" });
  }
};
exports.restoreEncryptedPrivateKey = async (req, res) => {
  try {
    const { encryptedPrivateKey } = req.body;

    if (!encryptedPrivateKey) {
      return res.status(400).json({
        success: false,
        error: "Missing encrypted private key",
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      encryptedPrivateKey,
    });

    res.status(200).json({
      success: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Failed to restore encrypted private key",
    });
  }
};
