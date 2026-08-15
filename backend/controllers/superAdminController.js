/**
 * superAdminController.js — Smart Village
 *
 * District-based hierarchy (no villages):
 *  - Super Admin: creates/manages District Admin accounts, views state-wide analytics.
 *    Does NOT resolve complaints.
 *  - District Admin: one per district (assigned via `district` field on User),
 *    sees/manages only their district's complaints (enforced by districtScoped middleware).
 */

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const KARNATAKA_DISTRICTS = require('../utils/districts');

// ── @desc    State-wide analytics ────────────────────────────────────────────
// ── @route   GET /api/superadmin/analytics ──────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const [totalComplaints, totalAdmins, totalUsers] = await Promise.all([
      Complaint.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'user' }),
    ]);

    const districtStats = await Complaint.aggregate([
      { $match: { district: { $ne: null, $ne: '' } } },
      { $group: { _id: '$district', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const categoryStats = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const statusStats = await Complaint.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      stats: {
        totalComplaints,
        totalAdmins,
        totalUsers,
        totalDistricts: KARNATAKA_DISTRICTS.length,
        districtsCovered: districtStats.length,
      },
      districtStats,
      categoryStats,
      statusStats,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── @desc    Fixed district list (for dropdowns) ────────────────────────────
// ── @route   GET /api/superadmin/districts ──────────────────────────────────
const listDistricts = async (req, res) => {
  res.json({ success: true, districts: KARNATAKA_DISTRICTS });
};

// ── @desc    List all district admins ────────────────────────────────────────
// ── @route   GET /api/superadmin/admins ──────────────────────────────────────
const listAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).sort({ district: 1, createdAt: -1 });
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── @desc    Create a district admin ─────────────────────────────────────────
// ── @route   POST /api/superadmin/admins ─────────────────────────────────────
const createAdmin = async (req, res) => {
  try {
    const { name, email, password, mobile, phone, district } = req.body;
    const mobileNumber = mobile || phone;

    if (!name || !email || !password || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and mobile are required',
      });
    }

    if (!district || !KARNATAKA_DISTRICTS.includes(district)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid district for this admin',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const count = await User.countDocuments({ role: 'admin' });
    const userId = `SV2026-ADMIN-${count + 1}`;

    const admin = await User.create({
      userId,
      name,
      email,
      password,
      mobile: mobileNumber,
      district,
      role: 'admin',
    });

    res.status(201).json({
      success: true,
      message: `District admin created for ${district}`,
      admin: {
        _id: admin._id,
        userId: admin.userId,
        name: admin.name,
        email: admin.email,
        mobile: admin.mobile,
        district: admin.district,
        role: admin.role,
        createdAt: admin.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── @desc    Delete a district admin ─────────────────────────────────────────
// ── @route   DELETE /api/superadmin/admins/:id ────────────────────────────────
const deleteAdmin = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);

    if (!target || target.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    await target.deleteOne();

    res.json({ success: true, message: 'Admin deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAnalytics,
  listDistricts,
  listAdmins,
  createAdmin,
  deleteAdmin,
};