/**
 * mediatorController.js — Smart Village
 *
 * CRUD for Mediators: the real department contacts (electrical, water,
 * roads, garbage, drainage...) that complaints get auto-routed to.
 * District-scoped the same way adminController's complaint queries are —
 * a district admin only sees/manages mediators in their own district;
 * superadmin sees all.
 */

const Mediator = require('../models/Mediator');
const { CATEGORIES } = require('../models/Complaint');

// ── @desc    List mediators (district-scoped for district admins) ──────────
// ── @route   GET /api/admin/mediators ───────────────────────────────────────
const getMediators = async (req, res, next) => {
  try {
    const scopeFilter = req.districtFilter || {};
    const mediators = await Mediator.find(scopeFilter).sort({ district: 1, department: 1 });
    res.json({ success: true, mediators, availableCategories: CATEGORIES });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Add a new mediator ─────────────────────────────────────────────
// ── @route   POST /api/admin/mediators ──────────────────────────────────────
const createMediator = async (req, res) => {
  try {
    const { name, phone, department, categories, district, taluk } = req.body;

    // District admins can only add mediators inside their own district.
    if (req.user.role === 'admin' && req.user.district && district !== req.user.district) {
      return res.status(403).json({
        success: false,
        message: `You can only add mediators for ${req.user.district}`,
      });
    }

    const mediator = await Mediator.create({
      name,
      phone,
      department,
      categories,
      district,
      taluk: taluk || null,
    });

    res.status(201).json({ success: true, message: 'Mediator added', mediator });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Create mediator error:', error);
    res.status(500).json({ success: false, message: 'Failed to add mediator' });
  }
};

// ── @desc    Update a mediator (contact details, categories, active flag) ──
// ── @route   PUT /api/admin/mediators/:id ───────────────────────────────────
const updateMediator = async (req, res) => {
  try {
    const mediator = await Mediator.findById(req.params.id);
    if (!mediator) {
      return res.status(404).json({ success: false, message: 'Mediator not found' });
    }

    if (req.user.role === 'admin' && req.user.district && mediator.district !== req.user.district) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, phone, department, categories, district, taluk, isActive } = req.body;

    if (name !== undefined) mediator.name = name;
    if (phone !== undefined) mediator.phone = phone;
    if (department !== undefined) mediator.department = department;
    if (categories !== undefined) mediator.categories = categories;
    if (district !== undefined) mediator.district = district;
    if (taluk !== undefined) mediator.taluk = taluk || null;
    if (isActive !== undefined) mediator.isActive = isActive;

    await mediator.save();
    res.json({ success: true, message: 'Mediator updated', mediator });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Update mediator error:', error);
    res.status(500).json({ success: false, message: 'Failed to update mediator' });
  }
};

// ── @desc    Remove a mediator ──────────────────────────────────────────────
// ── @route   DELETE /api/admin/mediators/:id ────────────────────────────────
const deleteMediator = async (req, res) => {
  try {
    const mediator = await Mediator.findById(req.params.id);
    if (!mediator) {
      return res.status(404).json({ success: false, message: 'Mediator not found' });
    }

    if (req.user.role === 'admin' && req.user.district && mediator.district !== req.user.district) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await mediator.deleteOne();
    res.json({ success: true, message: 'Mediator removed' });
  } catch (error) {
    console.error('Delete mediator error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove mediator' });
  }
};

module.exports = {
  getMediators,
  createMediator,
  updateMediator,
  deleteMediator,
};