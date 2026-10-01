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
const { getIO }    = require('../socket/socketHandler');
const { CATEGORIES } = require('../models/Complaint');

// ── @desc    Admin dashboard stats ──────────────────────────────────────────
// ── @route   GET /api/admin/stats ───────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    // District-scoped admins see only their district
    const scopeFilter = req.districtFilter || {};
    // Complaint queries exclude complaints filed automatically by the SLA agent, so they
    // never inflate totals/charts. (scopeFilter itself is still used for the User count.)
    const cScope = { ...scopeFilter, source: { $ne: 'agent' } };

    const [total, pending, inProgress, resolved, rejected] = await Promise.all([
      Complaint.countDocuments(cScope),
      Complaint.countDocuments({ ...cScope, status: 'Pending' }),
      Complaint.countDocuments({ ...cScope, status: 'In Progress' }),
      Complaint.countDocuments({ ...cScope, status: 'Resolved' }),
      Complaint.countDocuments({ ...cScope, status: 'Rejected' }),
    ]);

    const categoryStats = await Complaint.aggregate([
      { $match: cScope },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyTrend = await Complaint.aggregate([
      { $match: { ...cScope, createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const priorityStats = await Complaint.aggregate([
      { $match: cScope },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    const districtStats = await Complaint.aggregate([
      { $match: { ...cScope, district: { $ne: null, $ne: '' } } },
      { $group: { _id: '$district', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 31 },
    ]);

    const totalUsers       = await User.countDocuments({ role: 'user', ...scopeFilter });
    const recentComplaints = await Complaint.find(cScope)
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
      .populate('user', 'name email district phone userId')
      .populate('assignedWorkers.worker', 'name mobile workerDepartment')
      .populate('assignedDepartment', 'name departmentCategory');

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

    try {
      const io = getIO();
      io.emit('status_update', { complaintId: complaint._id, status, userId: complaint.user });
    } catch (ioErr) {
      // Socket not initialized (e.g. during tests) — status update still saved fine.
    }

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

// ── @desc    One-click create a standard department for every complaint ────
// ── category not yet covered in this district ───────────────────────────────
// ── @route   POST /api/admin/departments/bulk-create-standard ──────────────
// Solves "I don't know what departments each district needs" — every
// district needs the SAME set of departments, one per complaint category
// (Electricity, Road Damage, Water Leakage, etc.), so this creates them
// all in one click with auto-generated login credentials, which are
// returned ONCE in the response for the admin to copy and hand out
// (the password can't be recovered afterwards — same as any account).
const bulkCreateStandardDepartments = async (req, res, next) => {
  try {
    const district = req.user.role === 'admin' ? req.user.district : req.body.district;
    if (!district) {
      return res.status(400).json({ success: false, message: 'District is required' });
    }

    // "Others" is a catch-all category, not a real department — skip it.
    const standardCategories = CATEGORIES.filter((c) => c !== 'Others');

    const existing = await User.find({
      role: 'department',
      district,
      departmentCategory: { $in: standardCategories },
      isActive: true,
    }).select('departmentCategory');
    const alreadyCovered = new Set(existing.map((d) => d.departmentCategory));

    const toCreate = standardCategories.filter((c) => !alreadyCovered.has(c));
    if (toCreate.length === 0) {
      return res.json({
        success: true,
        message: 'Every standard department already exists for this district.',
        created: [],
      });
    }

    const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
    const districtSlug = slugify(district);
    const randomPassword = () => Math.random().toString(36).slice(-6) + Math.floor(10 + Math.random() * 89);

    // Placeholder mobile numbers, since `mobile` is required + unique on
    // User and we don't have a real number for a department that was
    // just auto-created. Uses a reserved-looking 70xxxxxxxx range so
    // these are obviously not real numbers, and checks the DB so two
    // bulk-created accounts (or a retry) never collide.
    const generateUniqueMobile = async () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidate = '70' + String(Math.floor(10000000 + Math.random() * 89999999));
        if (!(await User.findOne({ mobile: candidate }))) return candidate;
      }
      throw new Error('Could not generate a unique placeholder mobile number');
    };

    const created = [];
    for (const category of toCreate) {
      const email = `${slugify(category)}.${districtSlug}@smartvillage.local`;
      // Extremely unlikely, but guard against a stale/duplicate email anyway.
      if (await User.findOne({ email })) continue;

      const password = randomPassword();
      const mobile = await generateUniqueMobile();
      const dept = await User.create({
        name: `${category} Department`,
        email,
        password,
        mobile, // placeholder — a real department can update this later;
        // this just gets a working, unique login started.
        district,
        role: 'department',
        departmentCategory: category,
      });

      created.push({
        name: dept.name,
        departmentCategory: dept.departmentCategory,
        email: dept.email,
        password, // plaintext, shown ONCE — never retrievable again after this
        mobile: dept.mobile, // placeholder number, safe to change later
      });
    }

    res.status(201).json({
      success: true,
      message: `Created ${created.length} department account(s). Save these credentials now — the passwords won't be shown again.`,
      created,
    });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Manually (re)assign a complaint to a department ───────────────
// ── @route   PUT /api/admin/complaints/:id/assign-department ───────────────
// Covers cases the automatic category+district routing can't: no matching
// department existed yet when the complaint came in, or the auto-pick
// was wrong. This is Admin's ONLY lever over worker assignment now —
// picking WHICH department owns it. Actually assigning a worker to it
// is exclusively that department's job from here.
const assignDepartmentToComplaint = async (req, res, next) => {
  try {
    const { departmentId } = req.body;
    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'departmentId is required' });
    }

    const [complaint, department] = await Promise.all([
      Complaint.findById(req.params.id),
      User.findOne({ _id: departmentId, role: 'department', isActive: true }),
    ]);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    if (
      req.user.role === 'admin' &&
      req.user.district &&
      complaint.district !== req.user.district
    ) {
      return res.status(403).json({ success: false, message: 'Access denied for this district' });
    }
    if (department.district !== complaint.district) {
      return res.status(400).json({
        success: false,
        message: `${department.name} is in ${department.district}, not ${complaint.district}`,
      });
    }

    complaint.assignedDepartment = department._id;
    complaint.departmentAssignedAt = new Date();
    await complaint.save();
    await complaint.populate('assignedDepartment', 'name departmentCategory');

    await Notification.create({
      recipient: department._id,
      type: 'new_complaint',
      title: 'Complaint Assigned to Your Department',
      message: `Assigned by district admin: "${complaint.title}"`,
      complaint: complaint._id,
    });

    res.json({ success: true, message: `Assigned to ${department.name}`, complaint });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Create a Department account in the Admin's own district ───────
// ── @route   POST /api/admin/departments ────────────────────────────────────
// A Department account logs in, sees only complaints of its one category
// within this district, creates its own Worker accounts, and assigns/
// verifies their work. This is the layer between District Admin and Worker.
const createDepartment = async (req, res) => {
  try {
    const { name, email, password, mobile, departmentCategory } = req.body;

    if (!name || !email || !password || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and mobile are required',
      });
    }

    if (!departmentCategory || !CATEGORIES.includes(departmentCategory)) {
      return res.status(400).json({
        success: false,
        message: `departmentCategory must be one of: ${CATEGORIES.join(', ')}`,
      });
    }

    // A district Admin can only create departments for their own
    // district — a superadmin must be explicit about which district.
    const district = req.user.role === 'admin' ? req.user.district : req.body.district;
    if (!district) {
      return res.status(400).json({ success: false, message: 'District is required' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const existingDept = await User.findOne({
      role: 'department',
      district,
      departmentCategory,
      isActive: true,
    });
    if (existingDept) {
      return res.status(400).json({
        success: false,
        message: `An active "${departmentCategory}" department already exists for ${district} (${existingDept.name}). Deactivate it first if you want to replace it.`,
      });
    }

    const department = await User.create({
      name,
      email,
      password,
      mobile,
      district,
      role: 'department',
      departmentCategory,
    });

    res.status(201).json({
      success: true,
      message: `${departmentCategory} department created for ${district}`,
      department: {
        _id: department._id,
        userId: department.userId,
        name: department.name,
        email: department.email,
        mobile: department.mobile,
        district: department.district,
        departmentCategory: department.departmentCategory,
        isActive: department.isActive,
        createdAt: department.createdAt,
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Create department error:', error);
    res.status(500).json({ success: false, message: 'Failed to create department' });
  }
};

// ── @desc    List department accounts (district-scoped) ────────────────────
// ── @route   GET /api/admin/departments ─────────────────────────────────────
const getDepartments = async (req, res, next) => {
  try {
    const query = { role: 'department', ...(req.districtFilter || {}) };
    const departments = await User.find(query)
      .select('name email mobile district departmentCategory isActive userId createdAt')
      .sort({ departmentCategory: 1 })
      .lean();

    // Attach live complaint + worker counts so the Admin can see load
    // per department at a glance.
    const openStatuses = ['Pending', 'In Progress'];
    const deptIds = departments.map((d) => d._id);

    const [complaintCounts, workerCounts] = await Promise.all([
      Complaint.aggregate([
        { $match: { assignedDepartment: { $in: deptIds }, status: { $in: openStatuses } } },
        { $group: { _id: '$assignedDepartment', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { role: 'worker', workerDepartmentId: { $in: deptIds } } },
        { $group: { _id: '$workerDepartmentId', count: { $sum: 1 } } },
      ]),
    ]);

    const complaintMap = Object.fromEntries(complaintCounts.map((c) => [String(c._id), c.count]));
    const workerMap = Object.fromEntries(workerCounts.map((c) => [String(c._id), c.count]));

    const withCounts = departments.map((d) => ({
      ...d,
      openComplaints: complaintMap[String(d._id)] || 0,
      workerCount: workerMap[String(d._id)] || 0,
    }));

    res.json({ success: true, departments: withCounts });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Toggle department active status ────────────────────────────────
// ── @route   PUT /api/admin/departments/:id/toggle ───────────────────────────
const toggleDepartmentStatus = async (req, res, next) => {
  try {
    const department = await User.findOne({ _id: req.params.id, role: 'department' });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    if (
      req.user.role === 'admin' &&
      req.user.district &&
      department.district !== req.user.district
    ) {
      return res.status(403).json({ success: false, message: 'Access denied for this district' });
    }

    department.isActive = !department.isActive;
    await department.save();
    res.json({
      success: true,
      message: `Department ${department.isActive ? 'activated' : 'deactivated'}`,
      department,
    });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Delete a department account ─────────────────────────────────────
// ── @route   DELETE /api/admin/departments/:id ────────────────────────────────
const deleteDepartment = async (req, res, next) => {
  try {
    const department = await User.findOne({ _id: req.params.id, role: 'department' });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    if (
      req.user.role === 'admin' &&
      req.user.district &&
      department.district !== req.user.district
    ) {
      return res.status(403).json({ success: false, message: 'Access denied for this district' });
    }

    const workerCount = await User.countDocuments({ role: 'worker', workerDepartmentId: department._id });
    if (workerCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this department still has ${workerCount} worker account(s). Deactivate it instead, or remove its workers first.`,
      });
    }

    await department.deleteOne();
    res.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Create a worker account in the Supervisor's own district ──────
// ── @route   POST /api/admin/workers ────────────────────────────────────────
const createWorker = async (req, res) => {
  try {
    const { name, email, password, mobile, workerDepartment, workerCategories } = req.body;

    if (!name || !email || !password || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and mobile are required',
      });
    }

    if (!Array.isArray(workerCategories) || workerCategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one category this worker will handle',
      });
    }

    // A district Admin can only create workers for their own district —
    // a superadmin (no fixed district) must be explicit about which
    // district the worker belongs to.
    const district = req.user.role === 'admin' ? req.user.district : req.body.district;
    if (!district) {
      return res.status(400).json({ success: false, message: 'District is required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const worker = await User.create({
      name,
      email,
      password,
      mobile,
      district,
      role: 'worker',
      workerDepartment: workerDepartment || null,
      workerCategories,
      workerIsAvailable: true,
    });

    res.status(201).json({
      success: true,
      message: `Worker account created for ${name}`,
      worker: {
        _id: worker._id,
        userId: worker.userId,
        name: worker.name,
        email: worker.email,
        mobile: worker.mobile,
        district: worker.district,
        workerDepartment: worker.workerDepartment,
        workerCategories: worker.workerCategories,
        activeAssignments: 0,
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Create worker error:', error);
    res.status(500).json({ success: false, message: 'Failed to create worker' });
  }
};

// ── @desc    List workers a Supervisor can assign (district-scoped) ────────
// ── @route   GET /api/admin/workers?category=Electricity%20Problem ─────────
const getWorkers = async (req, res, next) => {
  try {
    const { category } = req.query;
    const query = {
      role: 'worker',
      ...(req.districtFilter || {}),
    };
    if (category) query.workerCategories = category;

    const workers = await User.find(query)
      .select('name mobile district taluk workerDepartment workerCategories workerIsAvailable')
      .lean();

    // Attach each worker's current open-assignment count so the
    // Supervisor can see workload before picking someone — same idea
    // as Mediator.activeAssignments, computed live instead of stored,
    // since workers change status often (Accepted/Working/etc.).
    const openStages = ['Assigned', 'Accepted', 'LocationConfirmed', 'Working', 'ProofSubmitted'];
    const counts = await Complaint.aggregate([
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

// ── @desc    Supervisor assigns a field worker to a complaint ──────────────
// ── @route   POST /api/admin/complaints/:id/assign-worker ──────────────────
const assignWorker = async (req, res, next) => {
  try {
    const { workerId } = req.body;
    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const [complaint, worker] = await Promise.all([
      Complaint.findById(req.params.id),
      User.findOne({ _id: workerId, role: 'worker' }),
    ]);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    if (!worker)    return res.status(404).json({ success: false, message: 'Worker not found' });

    if (
      req.user.role === 'admin' &&
      req.user.district &&
      complaint.district &&
      complaint.district !== req.user.district
    ) {
      return res.status(403).json({ success: false, message: 'Access denied for this district\'s complaint' });
    }

    complaint.assignedWorker = worker._id;
    complaint.workerStage = 'Assigned';
    complaint.workerAssignedAt = new Date();
    complaint.workerEscalated = false;
    complaint.workerEscalatedAt = null;
    await complaint.save();
    await complaint.populate('user', 'name email district phone userId');
    await complaint.populate('assignedWorker', 'name mobile workerDepartment');

    // Notify the worker directly — mirrors the Mediator notification
    // pattern, same sendSMS() call, just a different recipient/purpose.
    if (worker.mobile) {
      const smsBody =
        `SmartVillage: New job assigned — ${complaint.trackingId}\n` +
        `${complaint.category}: ${complaint.title}\n` +
        `Location: ${complaint.locationName || complaint.village || complaint.taluk || complaint.district || 'See app'}\n` +
        `Open the worker app to view details and accept.`;
      await sendSMS(worker.mobile, smsBody).catch(console.error);
    }

    res.json({
      success: true,
      message: `Complaint assigned to ${worker.name}`,
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Supervisor verifies (or rejects) a worker's submitted proof ───
// ── @route   POST /api/admin/complaints/:id/verify-work ────────────────────
const verifyWork = async (req, res, next) => {
  try {
    const { approved, note } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ success: false, message: '"approved" (true/false) is required' });
    }

    const complaint = await Complaint.findById(req.params.id)
      .populate('user', 'mobile name')
      .populate('assignedWorkers.worker', 'name mobile workerDepartment');
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

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

    if (
      req.user.role === 'admin' &&
      req.user.district &&
      complaint.district &&
      complaint.district !== req.user.district
    ) {
      return res.status(403).json({ success: false, message: 'Access denied for this district\'s complaint' });
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
      // Reset so the citizen gets asked again — matters if this
      // complaint was reopened before and is now being re-resolved.
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
      // Rejected — send it back to the WHOLE team to redo, don't touch
      // citizen-facing status (still "In Progress").
      complaint.assignedWorkers.forEach((w) => {
        w.stage = 'Working';
        w.proof.beforePhoto = null;
        w.proof.afterPhoto = null;
        w.proof.submittedAt = null;
      });
      complaint.proofReviewReminded = false;
      // Give the team a fresh SLA clock for the rework, and let
      // worker-side escalation fire again if the redo also drags on.
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
  createDepartment,
  bulkCreateStandardDepartments,
  assignDepartmentToComplaint,
  getDepartments,
  toggleDepartmentStatus,
  deleteDepartment,
  getDashboardStats,
  getAllComplaints,
  updateComplaintStatus,
  assignComplaint,
  createWorker,
  getWorkers,
  assignWorker,
  verifyWork,
  deleteComplaint,
  getAllUsers,
  toggleUserStatus,
  deleteUser,
  uploadResolutionPhoto,
  exportComplaintsCSV,
};