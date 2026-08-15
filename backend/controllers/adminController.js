/**
 * adminController.js — Smart Village
 *
 * District-based admin scoping:
 *  1. getAllComplaints / getDashboardStats / getAllUsers respect req.districtFilter
 *     (from districtScoped middleware). District admins only see their district's data.
 *  2. assignComplaint: assign a complaint to a specific admin.
 */

const Complaint    = require('../models/Complaint');
const User         = require('../models/User');
const Notification = require('../models/Notification');
const sendSMS      = require('../utils/smsService');
const XLSX         = require('xlsx');

// ── @desc    Admin dashboard stats ──────────────────────────────────────────
// ── @route   GET /api/admin/stats ───────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    // District-scoped admins see only their district
    const scopeFilter = req.districtFilter || {};

    const [total, pending, inProgress, resolved, rejected] = await Promise.all([
      Complaint.countDocuments(scopeFilter),
      Complaint.countDocuments({ ...scopeFilter, status: 'Pending' }),
      Complaint.countDocuments({ ...scopeFilter, status: 'In Progress' }),
      Complaint.countDocuments({ ...scopeFilter, status: 'Resolved' }),
      Complaint.countDocuments({ ...scopeFilter, status: 'Rejected' }),
    ]);

    const categoryStats = await Complaint.aggregate([
      { $match: scopeFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyTrend = await Complaint.aggregate([
      { $match: { ...scopeFilter, createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const priorityStats = await Complaint.aggregate([
      { $match: scopeFilter },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    const districtStats = await Complaint.aggregate([
      { $match: { ...scopeFilter, district: { $ne: null, $ne: '' } } },
      { $group: { _id: '$district', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 31 },
    ]);

    const totalUsers       = await User.countDocuments({ role: 'user', ...scopeFilter });
    const recentComplaints = await Complaint.find(scopeFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name district phone');

    res.json({
      success: true,
      stats: { total, pending, inProgress, resolved, rejected, totalUsers },
      categoryStats,
      monthlyTrend,
      priorityStats,
      districtStats,
      recentComplaints,
    });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Get all complaints ──────────────────────────────────────────────
// ── @route   GET /api/admin/complaints ──────────────────────────────────────
const getAllComplaints = async (req, res, next) => {
  try {
    const {
      status, category, priority,
      district,
      search,
      page   = 1,
      limit  = 15,
      sortBy = 'createdAt',
      order  = 'desc',
    } = req.query;

    // Start with district scope (empty for super admin / unscoped admin)
    const query = { ...(req.districtFilter || {}) };
    if (status)   query.status   = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (district) query.district = district; // superadmin can still narrow by district
    if (search) {
      query.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { trackingId:  { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const sort  = { [sortBy]: order === 'asc' ? 1 : -1 };
    const total = await Complaint.countDocuments(query);
    const complaints = await Complaint.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'name email district phone userId');

    res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / limit), complaints });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Update complaint status ────────────────────────────────────────
// ── @route   PUT /api/admin/complaints/:id/status ───────────────────────────
const updateComplaintStatus = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    // District-scoped admin may only update complaints in their own district
    if (
      req.user.role === 'admin' &&
      req.user.district &&
      complaint.district &&
      complaint.district !== req.user.district
    ) {
      return res.status(403).json({ success: false, message: 'Access denied for this district\'s complaint' });
    }

    complaint.status = status;
    if (adminNote)            complaint.adminNote  = adminNote;
    if (status === 'Resolved') complaint.resolvedAt = new Date();

    complaint.statusHistory.push({
      status,
      changedBy: req.user.id,
      note:      adminNote || `Status updated to ${status}`,
    });

    await complaint.save();

    // In-app notification
    await Notification.create({
      recipient: complaint.user,
      type:      'status_update',
      title:     'Complaint Status Updated',
      message:   `Your complaint "${complaint.title}" (${complaint.trackingId}) status changed to "${status}".${adminNote ? ` Note: ${adminNote}` : ''}`,
      complaint: complaint._id,
    });

    // SMS to complaint owner (bank-style transactional alert)
    const owner = await User.findById(complaint.user).select('mobile name');
    if (owner?.mobile) {
      let smsBody;

      switch (status) {
        case 'Resolved':
          smsBody = `SmartVillage: Your complaint ${complaint.trackingId} "${complaint.title}" has been RESOLVED. Thank you for reporting.${adminNote ? ` Note: ${adminNote}` : ''}`;
          break;
        case 'Rejected':
          smsBody = `SmartVillage: Your complaint ${complaint.trackingId} "${complaint.title}" was REJECTED.${adminNote ? ` Reason: ${adminNote}` : ' Contact your district office for details.'}`;
          break;
        case 'In Progress':
          smsBody = `SmartVillage: Your complaint ${complaint.trackingId} "${complaint.title}" is now IN PROGRESS.${adminNote ? ` Note: ${adminNote}` : ''}`;
          break;
        default:
          smsBody = `SmartVillage: Your complaint ${complaint.trackingId} "${complaint.title}" status updated to ${status.toUpperCase()}.${adminNote ? ` Note: ${adminNote}` : ''}`;
      }

      await sendSMS(owner.mobile, smsBody);
    }

    const io = req.app.get('io');
    if (io) io.emit('status_update', { complaintId: complaint._id, status, userId: complaint.user });

    await complaint.populate('user', 'name email district');
    res.json({ success: true, message: 'Status updated successfully', complaint });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Assign complaint to admin ──────────────────────────────────────
// ── @route   PUT /api/admin/complaints/:id/assign ───────────────────────────
const assignComplaint = async (req, res, next) => {
  try {
    const { adminId } = req.body;
    const [complaint, admin] = await Promise.all([
      Complaint.findById(req.params.id),
      User.findOne({ _id: adminId, role: 'admin' }),
    ]);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    if (!admin)     return res.status(404).json({ success: false, message: 'Admin not found' });

    complaint.assignedAdmin = adminId;
    await complaint.save();
    res.json({ success: true, message: `Complaint assigned to ${admin.name}` });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Delete complaint ────────────────────────────────────────────────
const deleteComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    res.json({ success: true, message: 'Complaint deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Upload a "proof of resolution" photo ───────────────────────────
// ── @route   POST /api/admin/complaints/:id/resolution-photo ────────────────
// New, standalone endpoint — does not touch the existing status-update flow.
const uploadResolutionPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo uploaded' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    if (
      req.user.role === 'admin' &&
      req.user.district &&
      complaint.district &&
      complaint.district !== req.user.district
    ) {
      return res.status(403).json({ success: false, message: 'Access denied for this district\'s complaint' });
    }

    complaint.resolutionPhoto = `/uploads/${req.file.filename}`;
    await complaint.save();

    res.json({ success: true, message: 'Resolution photo uploaded', resolutionPhoto: complaint.resolutionPhoto });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Get all users (district-scoped) ─────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 15 } = req.query;
    const query = { role: 'user', ...(req.districtFilter || {}) };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];

    const total = await User.countDocuments(query);
    const users = await User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ success: true, total, users });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Toggle user active status ──────────────────────────────────────
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, user });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Permanently delete a user account ────────────────────────────
// ── @route   DELETE /api/admin/users/:id ────────────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role !== 'user') {
      return res.status(403).json({ success: false, message: 'Only citizen accounts can be deleted from here' });
    }

    // District-scoped admin may only delete users in their own district
    if (
      req.user.role === 'admin' &&
      req.user.district &&
      user.district &&
      user.district !== req.user.district
    ) {
      return res.status(403).json({ success: false, message: 'Access denied for this district\'s user' });
    }

    await user.deleteOne();
    res.json({ success: true, message: 'User deleted permanently' });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Export complaints as a real Excel (.xlsx) file ─────────────────
// ── @route   GET /api/admin/complaints/export ────────────────────────────────
const exportComplaintsCSV = async (req, res, next) => {
  try {
    const { status, category, priority, district, search } = req.query;

    const query = { ...(req.districtFilter || {}) };
    if (status)   query.status   = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (district) query.district = district;
    if (search) {
      query.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { trackingId:  { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name mobile district');

    const rows = complaints.map((c) => ({
      'Tracking ID':    c.trackingId,
      'Title':          c.title,
      'Category':       c.category,
      'Priority':       c.priority,
      'Status':         c.status,
      'District':       c.district || '',
      'Citizen Name':   c.user?.name || '',
      'Citizen Mobile': c.user?.mobile || '',
      'Latitude':       c.latitude ?? '',
      'Longitude':      c.longitude ?? '',
      'Rating':         c.rating ?? '',
      'Created At':     c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN') : '',
      'Resolved At':    c.resolvedAt ? new Date(c.resolvedAt).toLocaleString('en-IN') : '',
    }));

    // Build a real .xlsx workbook (not plain text) — this is what actually
    // guarantees it opens in Excel, since .csv is just text and can be
    // associated with any editor on the user's machine.
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Reasonable column widths so it's readable without manual resizing
    worksheet['!cols'] = [
      { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 12 },
      { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
      { wch: 8 },  { wch: 20 }, { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Complaints');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `complaints-export-${Date.now()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAllComplaints,
  updateComplaintStatus,
  assignComplaint,
  deleteComplaint,
  getAllUsers,
  toggleUserStatus,
  deleteUser,
  uploadResolutionPhoto,
  exportComplaintsCSV,
};