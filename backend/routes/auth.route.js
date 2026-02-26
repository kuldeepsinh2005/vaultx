// backend/routes/auth.route.js
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/asyncHandler');
const { verifyJWT } = require('../middleware/auth.middleware');

const {
  requestEmailVerification,
  verifyEmailAndRegister,
  loginUser,
  logoutUser,
  getCurrentUser,
  loginWithRefreshToken,
  getRecoveryKey,
  resetPasswordWithRecovery
} = require('../controllers/auth.controller');

// Registration step 1: request code
router.post('/register', asyncHandler(requestEmailVerification));

// Registration step 2: verify code
router.post('/verify-email', asyncHandler(verifyEmailAndRegister));

// Login
router.post('/login', asyncHandler(loginUser));

// Login with refresh token
router.post('/refresh', asyncHandler(loginWithRefreshToken));
// Logout
router.post('/logout',verifyJWT, asyncHandler(logoutUser));
// Current user
router.get('/me', verifyJWT, asyncHandler(getCurrentUser));
router.post('/recovery-key', asyncHandler(getRecoveryKey));
router.post('/reset-password', asyncHandler(resetPasswordWithRecovery));

module.exports = router;
