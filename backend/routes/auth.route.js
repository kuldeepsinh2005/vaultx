// backend/routes/auth.route.js
// const express = require('express');
// const router = express.Router();
// const {asyncHandler} = require('../utils/asyncHandler');
// const {registerUser, loginUser, logoutUser, loginWithRefreshToken,getCurrentUser} = require('../controllers/auth.contorller');  

// @route   POST /api/users/refresh
// @desc    Login with refresh token
// @access  Public

// const { verifyJWT } = require('../middleware/auth.middleware');

// router.post('/register', asyncHandler(registerUser));
// router.post('/login', asyncHandler(loginUser));
// router.post('/logout', verifyJWT, asyncHandler(logoutUser));

// router.get('/me', verifyJWT, asyncHandler(getCurrentUser));
// router.post('/refresh', asyncHandler(loginWithRefreshToken));

// module.exports = router;

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/asyncHandler');
const { verifyJWT } = require('../middleware/auth.middleware');

const {
  requestEmailVerification,
  verifyEmailAndRegister,
  loginUser,
  logoutUser,
  getCurrentUser
} = require('../controllers/auth.controller');

// Registration step 1: request code
router.post('/register', asyncHandler(requestEmailVerification));

// Registration step 2: verify code
router.post('/verify-email', asyncHandler(verifyEmailAndRegister));

// Login
router.post('/login', asyncHandler(loginUser));

// Logout
router.post('/logout', verifyJWT, asyncHandler(logoutUser));

// Current user
router.get('/me', verifyJWT, asyncHandler(getCurrentUser));

module.exports = router;
