// backend/utils/liveEvents.js
//
// Real-time complaint events for the admin / department live maps.
// Events go ONLY to the rooms that are allowed to see a complaint:
//   admins_all          superadmins + admins without a district
//   admins_<district>   the district admin(s) of the complaint's district
//   dept_<userId>       the department account the complaint is routed to
// (Rooms are joined server-side from a verified JWT — see socket/socketHandler.js.)

const { getIO } = require('../socket/socketHandler');

// Lightweight shape used by the map (no citizen contact details).
function toMapPoint(c) {
  const o = typeof c.toObject === 'function' ? c.toObject() : c;
  return {
    _id: String(o._id),
    trackingId: o.trackingId,
    title: o.title,
    category: o.category,
    status: o.status,
    priority: o.priority,
    latitude: o.latitude,
    longitude: o.longitude,
    locationName: o.locationName || null,
    village: o.village || null,
    district: o.district || null,
    createdAt: o.createdAt,
    hasVoice: Boolean(o.voiceNote && o.voiceNote.file),
    image: o.image || null,
    isDuplicate: Boolean(o.isDuplicate),
    assignedDepartment: o.assignedDepartment ? String(o.assignedDepartment._id || o.assignedDepartment) : null,
  };
}

function emitComplaintEvent(event, complaint) {
  try {
    const io = getIO();
    const point = toMapPoint(complaint);
    io.to('admins_all').emit(event, point);
    if (point.district) io.to(`admins_${point.district}`).emit(event, point);
    if (point.assignedDepartment) io.to(`dept_${point.assignedDepartment}`).emit(event, point);
  } catch (e) {
    // sockets not initialised (e.g. scripts/tests) — never break the request
  }
}

module.exports = { toMapPoint, emitComplaintEvent };