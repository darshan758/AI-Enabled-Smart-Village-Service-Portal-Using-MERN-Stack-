/**
 * authController.js — Smart Village
 * FINAL CLEAN VERSION
 */

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Village = require('../models/Village');
const sendSMS = require('../utils/smsService');

// ─────────────────────────────────────────────────────────────
// Generate JWT Token
// ─────────────────────────────────────────────────────────────
const generateToken = (id, role) =>
  jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    }
  );

// ─────────────────────────────────────────────────────────────
// Generate Smart User ID
// ─────────────────────────────────────────────────────────────
const generateUserId = async (role = 'user') => {
  const prefix =
    role === 'superadmin'
      ? 'SV2026-SUPER'
      : role === 'admin'
      ? 'SV2026-ADMIN'
      : 'SV2026-USER';

  const base = role === 'user' ? 1001 : 1;

  const count = await User.countDocuments({ role });

  const generatedId = `${prefix}-${base + count}`;

  const exists = await User.findOne({ userId: generatedId });

  if (exists) {
    return `${prefix}-${base + count}-${Date.now()
      .toString(36)
      .toUpperCase()}`;
  }

  return generatedId;
};

// ─────────────────────────────────────────────────────────────
// User Response Payload
// ─────────────────────────────────────────────────────────────
const userPayload = (user) => ({
  _id: user._id,
  userId: user.userId,
  name: user.name,
  email: user.email,
  mobile: user.mobile,

  state: user.state,
  district: user.district,
  taluk: user.taluk,
  village: user.village,
  villageId: user.villageId,

  panchayat: user.panchayat,
  wardNumber: user.wardNumber,

  role: user.role,

  adminVillage: user.adminVillage,
  adminVillageId: user.adminVillageId,
});

// ─────────────────────────────────────────────────────────────
// Register User
// ─────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      name,
      email,
      password,
      mobile,
      phone,
      state,
      district,
      taluk,
      village,
      villageId,
      panchayat,
      wardNumber,
    } = req.body;

    // Support both 'mobile' and 'phone' field names from clients
    const mobileNumber = mobile || phone;

    // Email is optional — normalize blank string to undefined so it
    // doesn't collide with other users' missing emails (sparse unique index)
    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : undefined;

    // Check existing user (only if an email was actually provided)
    if (cleanEmail) {
      const existingUser = await User.findOne({ email: cleanEmail });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered',
        });
      }
    }

    // Resolve village name from villageId
    let resolvedVillage = village;

    if (villageId && !village) {
      const v = await Village.findById(villageId).select('name');

      if (v) {
        resolvedVillage = v.name;
      }
    }

    // Generate Smart ID
    const userId = await generateUserId('user');

    // Create user
    const user = await User.create({
      userId,
      name,
      email: cleanEmail,
      password,
      mobile: mobileNumber,

      state,
      district,
      taluk,

      village: resolvedVillage,
      villageId: villageId || undefined,

      panchayat,
      wardNumber,
    });

    // Generate token
    const token = generateToken(user._id, user.role);

    // Send SMS
    if (user.mobile) {
      try {
        await sendSMS(
          user.mobile,
          `Welcome to Smart Village, ${user.name}! Your Citizen ID is ${user.userId}.`
        );
      } catch (smsError) {
        console.log('SMS failed:', smsError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: userPayload(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/mobile/Citizen ID and password',
      });
    }

    // Find user by email, userId (Citizen ID), or mobile number
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { userId: identifier },
        { mobile: identifier },
      ],
    })
      .select('+password')
      .populate('villageId');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Compare password
    let isMatch = false;

    // If model has comparePassword method
    if (typeof user.comparePassword === 'function') {
      isMatch = await user.comparePassword(password);
    } else {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check active account
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated',
      });
    }

    // Generate JWT
    const token = generateToken(user._id, user.role);

    // Send response
    res.json({
      success: true,
      message: 'Login successful',
      token,

      // IMPORTANT FOR ROLE-BASED REDIRECT
      user: userPayload(user),
    });
  } catch (error) {
    console.error('Login Error:', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Get Current User
// ─────────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('villageId');

    res.json({
      success: true,
      user: userPayload(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Update Profile
// ─────────────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      state,
      district,
      taluk,
      village,
      villageId,
      panchayat,
      wardNumber,
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        phone,

        state,
        district,
        taluk,

        village,
        villageId,

        panchayat,
        wardNumber,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userPayload(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Change Password
// ─────────────────────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id)
      .select('+password');

    let isMatch = false;

    if (typeof user.comparePassword === 'function') {
      isMatch = await user.comparePassword(currentPassword);
    } else {
      isMatch = await bcrypt.compare(
        currentPassword,
        user.password
      );
    }

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = newPassword;

    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────
module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
};