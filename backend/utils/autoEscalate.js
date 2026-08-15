// backend/utils/autoEscalate.js
//
// Auto-escalation: if a complaint sits in "Pending" for longer than
// ESCALATION_DAYS (default 3), bump its priority one level and notify
// the relevant district admin(s) + all superadmins.
//
// This is a standalone background job — it never touches any existing
// request/response flow, so it can't break normal complaint handling.
// Any error here is caught and logged, never thrown up to crash the server.

const Complaint    = require('../models/Complaint');
const User         = require('../models/User');
const Notification = require('../models/Notification');

const PRIORITY_LADDER = ['Low', 'Medium', 'High', 'Critical'];

const nextPriority = (current) => {
  const idx = PRIORITY_LADDER.indexOf(current);
  if (idx === -1 || idx === PRIORITY_LADDER.length - 1) return current; // already Critical / unknown
  return PRIORITY_LADDER[idx + 1];
};

async function runAutoEscalation() {
  try {
    const days = parseInt(process.env.ESCALATION_DAYS, 10) || 3;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stale = await Complaint.find({
      status:    'Pending',
      escalated: false,
      createdAt: { $lte: threshold },
    });

    if (stale.length === 0) return;

    // Cache admins per district so we don't re-query for every complaint
    const districtAdminCache = {};
    const superadmins = await User.find({ role: 'superadmin' }).select('_id');

    for (const complaint of stale) {
      const oldPriority = complaint.priority;
      complaint.priority   = nextPriority(complaint.priority);
      complaint.escalated  = true;
      complaint.escalatedAt = new Date();
      await complaint.save();

      // Find district admin(s) to notify (cached per district)
      let districtAdmins = [];
      if (complaint.district) {
        if (!districtAdminCache[complaint.district]) {
          districtAdminCache[complaint.district] = await User.find({
            role: 'admin',
            district: complaint.district,
          }).select('_id');
        }
        districtAdmins = districtAdminCache[complaint.district];
      }

      const recipients = [...districtAdmins, ...superadmins];

      const message =
        `Complaint "${complaint.title}" (${complaint.trackingId}) has been Pending for over ${days} day(s). ` +
        `Priority auto-escalated from ${oldPriority} to ${complaint.priority}.`;

      await Promise.all(
        recipients.map((r) =>
          Notification.create({
            recipient: r._id,
            type:      'system',
            title:     '⏫ Complaint Auto-Escalated',
            message,
            complaint: complaint._id,
          })
        )
      );
    }

    console.log(`[AutoEscalate] Escalated ${stale.length} stale complaint(s).`);
  } catch (err) {
    // Never let this crash the server — just log and move on
    console.error('[AutoEscalate] Error:', err.message);
  }
}

module.exports = runAutoEscalation;