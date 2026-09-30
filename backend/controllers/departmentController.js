/**
 * departmentController.js — Smart Village
 *
 * Everything a logged-in Department account (User.role === 'department')
 * can do. A Department represents one real department (e.g. "Electricity
 * Department") covering ONE complaint category within ONE district — it
 * sits between the District Admin and its own Worker accounts:
 *
 *   Citizen -> District Admin (oversight) -> Department -> Worker
 *
 * Every query below is scoped to `assignedDepartment: req.user.id` (for
 * complaints) or `workerDepartmentId: req.user.id` (for workers it
 * created), so a department can never see or act on another
 * department's complaints or workers — mirrors the same ownership
 * pattern workerController.js already uses for individual workers.
 */

const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const sendSMS = require('../utils/smsService');

// ── @desc    Department dashboard stats ─────────────────────────────────────
// ── @route   GET /api/department/stats ──────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    const scope = { assignedDepartment: req.user.id };

    const [total, pending, inProgress, resolved, rejected, workerCount] = await Promise.all([
      Complaint.countDocuments(scope),
      Complaint.countDocuments({ ...scope, status: 'Pending' }),
      Complaint.countDocuments({ ...scope, status: 'In Progress' }),
      Complaint.countDocuments({ ...scope, status: 'Resolved' }),
      Complaint.countDocuments({ ...scope, status: 'Rejected' }),
      User.countDocuments({ role: 'worker', workerDepartmentId: req.user.id }),
    ]);

    const unassigned = await Complaint.countDocuments({
      ...scope,
      $or: [{ assignedWorkers: { $exists: false } }, { assignedWorkers: { $size: 0 } }],
    });

    const priorityStats = await Complaint.aggregate([
      { $match: scope },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    const recentComplaints = await Complaint.find(scope)
      .sort({ priority: -1, createdAt: -1 })
      .limit(5)
      .populate('user', 'name district')
      .populate('assignedWorkers.worker', 'name');

    res.json({
      success: true,
      stats: { total, pending, inProgress, resolved, rejected, workerCount, unassigned },
      priorityStats,
      recentComplaints,
    });
  } catch (error) {
    next(error);
  }
};

// ── @desc    List complaints owned by this department ───────────────────────
// ── @route   GET /api/department/complaints ──────────────────────────────────
const getComplaints = async (req, res, next) => {
  try {
    const {
      status, priority, search,
      page = 1, limit = 15,
      sortBy = 'priority', order = 'desc',
    } = req.query;

    const query = { assignedDepartment: req.user.id };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { trackingId: { $regex: search, $options: 'i' } },
      ];
    }

    const sort = { [sortBy]: order === 'asc' ? 1 : -1 };
    const total = await Complaint.countDocuments(query);
    const complaints = await Complaint.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'name mobile district')
      .populate('assignedWorkers.worker', 'name mobile workerIsAvailable');

    res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / limit), complaints });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Create a worker account under this department ─────────────────
// ── @route   POST /api/department/workers ────────────────────────────────────
const createWorker = async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;

    if (!name || !password || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Name, password and mobile are required',
      });
    }

    const mobileExists = await User.findOne({ mobile });
    if (mobileExists) {
      return res.status(400).json({ success: false, message: 'A user with this mobile number already exists' });
    }

    if (email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'A user with this email already exists' });
      }
    }

    const worker = await User.create({
      name,
      // Only set email if one was actually given — leaving it out
      // entirely (rather than an empty string) is what the schema's
      // sparse unique index expects, so multiple emailless workers
      // don't collide with each other.
      ...(email ? { email } : {}),
      password,
      mobile,
      district: req.user.district,
      role: 'worker',
      workerDepartment: req.user.departmentCategory,
      workerDepartmentId: req.user.id,
      workerCategories: [req.user.departmentCategory],
      workerIsAvailable: true,
    });

    res.status(201).json({
      success: true,
      message: `Worker account created for ${name}`,
      worker: {
        _id: worker._id,
        userId: worker.userId,
        name: worker.name,
        email: worker.email || null,
        mobile: worker.mobile,
        district: worker.district,
        workerDepartment: worker.workerDepartment,
        activeAssignments: 0,
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    // Safety net for a race condition between the check above and the
    // insert (two requests at almost the same instant) — same duplicate
    // key error Mongo throws, turned into a message instead of a 500.
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `A user with this ${field} already exists`,
      });
    }
    console.error('Create worker error:', error);
    res.status(500).json({ success: false, message: 'Failed to create worker' });
  }
};

// ── @desc    List this department's own workers ─────────────────────────────
// ── @route   GET /api/department/workers ─────────────────────────────────────
const getWorkers = async (req, res, next) => {
  try {
    const workers = await User.find({ role: 'worker', workerDepartmentId: req.user.id })
      .select('name mobile district workerIsAvailable createdAt')
      .lean();

    const openStages = ['Assigned', 'Accepted', 'LocationConfirmed', 'Working', 'ProofSubmitted'];
    const counts = await Complaint.aggregate([
      { $match: { assignedDepartment: new mongoose.Types.ObjectId(req.user.id) } },
      { $unwind: '$assignedWorkers' },
      { $match: { 'assignedWorkers.worker': { $in: workers.map((w) => w._id) }, 'assignedWorkers.stage': { $in: openStages } } },
      { $group: { _id: '$assignedWorkers.worker', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

    const workersWithLoad = workers
      .map((w) => ({ ...w, activeAssignments: countMap[String(w._id)] || 0 }))
      .sort((a, b) => a.activeAssignments - b.activeAssignments);

    res.json({ success: true, workers: workersWithLoad });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Toggle a worker's own active/on-duty status (department-level) ─
// ── @route   PUT /api/department/workers/:id/toggle ──────────────────────────
const toggleWorker = async (req, res, next) => {
  try {
    const worker = await User.findOne({
      _id: req.params.id,
      role: 'worker',
      workerDepartmentId: req.user.id,
    });
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

    worker.isActive = !worker.isActive;
    await worker.save();
    res.json({ success: true, message: `Worker ${worker.isActive ? 'activated' : 'deactivated'}`, worker });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Add one of this department's workers to a complaint's team ────
// ── @route   POST /api/department/complaints/:id/assign-worker ──────────────
// Deliberately additive — a big job (a major road cave-in, a large area
// waterlogging) genuinely needs more than one person. Call this once per
// worker you want on the job; each keeps their own progress/proof.
const assignWorker = async (req, res, next) => {
  try {
    const { workerId } = req.body;
    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const [complaint, worker] = await Promise.all([
      Complaint.findOne({ _id: req.params.id, assignedDepartment: req.user.id }),
      User.findOne({ _id: workerId, role: 'worker', workerDepartmentId: req.user.id }),
    ]);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found in your department' });
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found in your department' });

    const alreadyOnTeam = complaint.assignedWorkers.some(
      (w) => String(w.worker) === String(worker._id)
    );
    if (alreadyOnTeam) {
      return res.status(400).json({ success: false, message: `${worker.name} is already on this job` });
    }

    complaint.assignedWorkers.push({
      worker: worker._id,
      isLead: complaint.assignedWorkers.length === 0, // first person added leads the job
      stage: 'Assigned',
      assignedAt: new Date(),
    });
    complaint.workerEscalated = false;
    complaint.workerEscalatedAt = null;
    complaint.syncWorkerRollup();
    await complaint.save();
    await complaint.populate('user', 'name email district phone userId');
    await complaint.populate('assignedWorkers.worker', 'name mobile workerDepartment');

    if (worker.mobile) {
      const teamSize = complaint.assignedWorkers.length;
      const smsBody =
        `SmartVillage: New job assigned — ${complaint.trackingId}\n` +
        `${complaint.category}: ${complaint.title}\n` +
        `Location: ${complaint.locationName || complaint.village || complaint.taluk || complaint.district || 'See app'}\n` +
        (teamSize > 1 ? `You're on a team of ${teamSize} for this job.\n` : '') +
        `Open the worker app to view details and accept.`;
      await sendSMS(worker.mobile, smsBody).catch(console.error);
    }

    res.json({
      success: true,
      message: `${worker.name} added to the job (${complaint.assignedWorkers.length} on team now)`,
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Remove a worker from a complaint's team ────────────────────────
// ── @route   DELETE /api/department/complaints/:id/workers/:workerId ───────
// Only allowed before that worker has submitted proof — once they've
// done work and uploaded evidence, removing them would just lose it.
const removeWorkerFromComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findOne({ _id: req.params.id, assignedDepartment: req.user.id });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found in your department' });

    const entry = complaint.assignedWorkers.find((w) => String(w.worker) === String(req.params.workerId));
    if (!entry) return res.status(404).json({ success: false, message: 'That worker is not on this job' });
    if (entry.proof?.submittedAt) {
      return res.status(400).json({
        success: false,
        message: 'This worker already submitted proof — remove not allowed, since that would discard their evidence',
      });
    }

    complaint.assignedWorkers = complaint.assignedWorkers.filter(
      (w) => String(w.worker) !== String(req.params.workerId)
    );
    // If the removed member was the lead and others remain, promote the next one.
    if (complaint.assignedWorkers.length > 0 && !complaint.assignedWorkers.some((w) => w.isLead)) {
      complaint.assignedWorkers[0].isLead = true;
    }
    complaint.syncWorkerRollup();
    await complaint.save();

    res.json({ success: true, message: 'Worker removed from job', complaint });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Verify (or reject) the WHOLE team's submitted proof ───────────
// ── @route   POST /api/department/complaints/:id/verify-work ───────────────
// With a team job, this only becomes available once EVERY member has
// submitted their own proof — the job isn't "review-ready" until
// everyone assigned to it is actually done.
const verifyWork = async (req, res, next) => {
  try {
    const { approved, note } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ success: false, message: '"approved" (true/false) is required' });
    }

    const complaint = await Complaint.findOne({ _id: req.params.id, assignedDepartment: req.user.id })
      .populate('user', 'mobile name')
      .populate('assignedWorkers.worker', 'name mobile workerDepartment');
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found in your department' });

    if (complaint.assignedWorkers.length === 0) {
      return res.status(400).json({ success: false, message: 'No workers are assigned to this job yet' });
    }
    const notYetSubmitted = complaint.assignedWorkers.filter((w) => w.stage !== 'ProofSubmitted');
    if (notYetSubmitted.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Not ready to review yet — still waiting on: ${notYetSubmitted.map((w) => w.worker?.name || 'a worker').join(', ')}`,
      });
    }

    complaint.supervisorVerification = {
      verifiedBy: req.user.id,
      approved,
      note: note || null,
      verifiedAt: new Date(),
    };

    if (approved) {
      complaint.assignedWorkers.forEach((w) => { w.stage = 'Verified'; });
      complaint.status = 'Resolved';
      complaint.resolvedAt = new Date();
      complaint.citizenConfirmation = { confirmed: null, respondedAt: null, note: null };
      complaint.statusHistory.push({
        status: 'Resolved',
        changedBy: req.user.id,
        note: note || 'Verified worker completion',
      });

      if (complaint.user?.mobile) {
        await sendSMS(
          complaint.user.mobile,
          `SmartVillage: Your complaint ${complaint.trackingId} "${complaint.title}" has been RESOLVED and verified. Please confirm in the app.`
        ).catch(console.error);
      }
    } else {
      // Sent back to the WHOLE team — everyone's proof is cleared and
      // they go back to "Working". The rejection note explains why.
      complaint.assignedWorkers.forEach((w) => {
        w.stage = 'Working';
        w.proof.beforePhoto = null;
        w.proof.afterPhoto = null;
        w.proof.submittedAt = null;
      });
      complaint.proofReviewReminded = false;
      complaint.workerEscalated = false;
      complaint.workerEscalatedAt = null;
    }

    complaint.syncWorkerRollup();
    await complaint.save();
    res.json({ success: true, message: approved ? 'Work verified and resolved' : 'Sent back to the team', complaint });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getComplaints,
  createWorker,
  getWorkers,
  toggleWorker,
  assignWorker,
  removeWorkerFromComplaint,
  verifyWork,
};