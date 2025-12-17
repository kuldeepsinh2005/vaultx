// backend/controllers/auth.controller.js

const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail'); // nodemailer helper
const ErrorResponse = require('../utils/errorResponse');

// Generate tokens
// // Generate both tokens and save refresh token in DB
const generateAccessAndRefreshTokens = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorResponse('User not found while generating tokens', 404);
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};



// Step 1: Request email verification
exports.requestEmailVerification = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

    console.log("1");
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ error: 'Username or Email exists' });
    console.log("2");
    const code = crypto.randomInt(100000, 999999).toString();

    const tempUser = new User({
      username,
      email,
      password,
      emailVerificationCode: code,
      emailVerificationExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    await tempUser.save();

    await sendEmail({
      to: email,
      subject: 'Verify your email',
      text: `Your verification code is: ${code}`,
    });
    console.log("3");
    res.status(200).json({ success: true, message: 'Verification code sent to email' });
  } catch (err) {
    next(err);
  }
};

// Step 2: Verify email & complete registration
exports.verifyEmailAndRegister = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email, emailVerificationCode: code });
    if (!user) return res.status(400).json({ error: 'Invalid code' });

    if (user.emailVerificationExpires < Date.now()) {
      return res.status(400).json({ error: 'Code expired' });
    }

    user.verified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user);

    res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 24*60*60*1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 10*24*60*60*1000 });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
};



// @desc Login user
// @route POST /api/auth/login
// @access Public
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // console.log("Request body:", req.body);


    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }



    const user = await User.findOne({ email }).select('+password');
    // console.log("Found user:", user);
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      user: loggedInUser
    });
  } catch (err) {
    next(err);
  }
};

// @desc Logout user
// @route POST /api/auth/logout
// @access Private
exports.logoutUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } }, { new: true });

    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };

    res.clearCookie('accessToken', options);
    res.clearCookie('refreshToken', options);

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc Get current user
// @route GET /api/auth/me
// @access Private
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshToken');
    // console.log("Current user:", user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};



exports.loginWithRefreshToken = async (req, res, next) => {
  try {
    // Read refresh token from cookies instead of body
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = require('jsonwebtoken').verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id || decoded._id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const accessToken = user.generateAccessToken();
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    console.log("login using tokens");

    res.status(200).json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
      }
    });
  } catch (err) {
    next(err);
  }
};