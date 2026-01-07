// backend/models/User.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
  username: { type: String, trim: true, required: true, unique: true, index: true },
  email: { type: String, trim: true, lowercase: true, required: true, unique: true, index: true },
  password: { type: String, required: true },
  profileImage: { type: String, default: '' },
  refreshToken: { type: String, default: null },
  
  // --- Email verification fields ---
  verified: { type: Boolean, default: false },
  emailVerificationCode: { type: String },
  emailVerificationExpires: { type: Date, index: { expireAfterSeconds: 0 } },// 10 minutes expiry
  publicKey: {
    type: String, // Base64
  },
  encryptedPrivateKey: {
    type: Object, // stores JSON backup object
    required: false,
  },



}, {
  timestamps: true
});

// Remove sensitive fields when converting to JSON
UserSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.emailVerificationCode;
    delete ret.emailVerificationExpires;
    delete ret.__v;
    return ret;
  }
});

// Hash password before save (only if modified)
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// Instance method: compare raw password with hashed
UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Instance method: generate access token
UserSchema.methods.generateAccessToken = function () {
  const payload = { _id: this._id, username: this.username };
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '1d' });
};

// Instance method: generate refresh token
UserSchema.methods.generateRefreshToken = function () {
  const payload = { _id: this._id };
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '10d' });
};

module.exports = mongoose.model('User', UserSchema);
