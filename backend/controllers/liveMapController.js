// backend/controllers/liveMapController.js
//
// Map data for the admin and department live maps.
//   GET /api/admin/map/complaints       (district-scoped for district admins)
//   GET /api/department/map/complaints  (only the department's own complaints)
// Returns lightweight points (no citizen phone/email). Complaints with no GPS
// are counted in `unlocated` instead of being silently dropped.

const Complaint = require('../models/Complaint');
const { toMapPoint } = require('../utils/liveEvents');

const MAX_POINTS = 2000;

async function respondWithMap(req, res, baseScope) {
  try {
    const scope = { ...baseScope, source: { $ne: 'agent' } };
    const { status, category, priority } = req.query;
    if (status) scope.status = status;
    if (category) scope.category = category;
    if (priority) scope.priority = priority;

    const [located, unlocated] = await Promise.all([
      Complaint.find({ ...scope, latitude: { $ne: null }, longitude: { $ne: null } })
        .select('trackingId title category status priority latitude longitude locationName village district createdAt voiceNote.file image isDuplicate assignedDepartment')
        .sort({ createdAt: -1 })
        .limit(MAX_POINTS)
        .lean(),
      Complaint.countDocuments({ ...scope, $or: [{ latitude: null }, { longitude: null }] }),
    ]);

    res.json({
      success: true,
      complaints: located.map(toMapPoint),
      unlocated,
      truncated: located.length >= MAX_POINTS,
    });
  } catch (err) {
    console.error('Live map error:', err);
    res.status(500).json({ success: false, message: 'Failed to load map data' });
  }
}

exports.adminMap = (req, res) => respondWithMap(req, res, { ...(req.districtFilter || {}) });
exports.departmentMap = (req, res) => respondWithMap(req, res, { assignedDepartment: req.user._id });