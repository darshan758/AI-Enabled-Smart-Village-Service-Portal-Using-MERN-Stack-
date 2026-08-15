// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─────────────────────────────────────────────────────────────
// Protect Route Middleware
// ─────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // No token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. No token provided.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id).select('-password');

    if (!user || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account deactivated.',
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

// ─────────────────────────────────────────────────────────────
// Generic Role Authorization
// Usage: authorize('admin', 'superadmin')
// ─────────────────────────────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    next();
  };
};

// ─────────────────────────────────────────────────────────────
// Admin + Superadmin Access
// ─────────────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (
    req.user &&
    ['admin', 'superadmin'].includes(req.user.role)
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied. Admins only.',
  });
};

// ─────────────────────────────────────────────────────────────
// Super Admin Only
// ─────────────────────────────────────────────────────────────
const superAdminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Super admin access required.',
  });
};

// ─────────────────────────────────────────────────────────────
// District Scoped Middleware
// ─────────────────────────────────────────────────────────────
// Superadmin → access all districts
// Admin without an assigned district → access all (safety fallback)
// Admin with an assigned district → restricted to that district only
// ─────────────────────────────────────────────────────────────
const districtScoped = (req, res, next) => {
  if (
    req.user.role === 'superadmin' ||
    !req.user.district
  ) {
    req.districtFilter = {};
  } else {
    req.districtFilter = {
      district: req.user.district,
    };
  }

  next();
};

module.exports = {
  protect,
  authorize,
  adminOnly,
  superAdminOnly,
  districtScoped,
};