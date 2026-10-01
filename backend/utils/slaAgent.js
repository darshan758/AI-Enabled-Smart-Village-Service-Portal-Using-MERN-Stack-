// backend/utils/slaAgent.js
//
// SLA monitoring agent. It watches every open complaint that is routed to a
// department and, when one has been open longer than its SLA
// (see utils/performanceMetrics.js), it AUTOMATICALLY FILES an escalation
// complaint (source: 'agent') addressed to the district admin, marks the
// original complaint as escalated (so it is never filed twice), notifies the
// admin(s) and the department, and pushes a live event to the admin map.
//
// It is deliberately rule-based (no external AI service, no API key, fully
// auditable). Every filed complaint states exactly why it was raised.
//
// Runs: automatically every AGENT_SLA_INTERVAL_MIN minutes (server.js), and on
// demand from the admin dashboard (POST /api/admin/agent/run, supports dryRun).
// Disable with AGENT_SLA_ENABLED=false.

const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { slaHoursFor, SLA_HOURS, HOUR, clockStart } = require('./performanceMetrics');
const { emitComplaintEvent } = require('./liveEvents');

const MAX_PER_RUN = Number(process.env.AGENT_SLA_MAX_PER_RUN) || 20;

async function runSlaAgent({ dryRun = false, districtFilter = {}, limit = MAX_PER_RUN } = {}) {
  const now = Date.now();
  const minSlaMs = Math.min(...Object.values(SLA_HOURS)) * HOUR;

  const candidates = await Complaint.find({
    ...districtFilter,
    status: { $in: ['Pending', 'In Progress'] },
    assignedDepartment: { $ne: null },
    source: { $ne: 'agent' },
    agentEscalatedAt: null,
    createdAt: { $lte: new Date(now - minSlaMs) },
  })
    .populate('assignedDepartment', 'name departmentCategory')
    .sort({ createdAt: 1 })
    .limit(500);

  const breaches = candidates
    .map((c) => {
      const ageMs = now - clockStart(c);
      const slaHours = slaHoursFor(c.priority);
      return { c, ageHours: Math.floor(ageMs / HOUR), slaHours, overdue: ageMs > slaHours * HOUR };
    })
    .filter((b) => b.overdue);

  const result = {
    dryRun,
    checked: candidates.length,
    breachesFound: breaches.length,
    filed: [],
    skipped: [],
  };

  const superadmins = await User.find({ role: 'superadmin' }).select('_id');
  const adminCache = {};

  for (const { c, ageHours, slaHours } of breaches.slice(0, limit)) {
    const deptName = (c.assignedDepartment && c.assignedDepartment.name) || 'the assigned department';
    const summary = {
      originalTrackingId: c.trackingId,
      title: c.title,
      department: deptName,
      ageHours,
      slaHours,
      priority: c.priority,
    };

    if (dryRun) {
      result.filed.push({ ...summary, dryRun: true });
      continue;
    }

    try {
      // Who files it: the district admin, else a superadmin.
      const key = c.district || '_none';
      if (!(key in adminCache)) {
        adminCache[key] = c.district ? await User.find({ role: 'admin', district: c.district }).select('_id') : [];
      }
      const districtAdmins = adminCache[key];
      const filer = districtAdmins[0] || superadmins[0];
      if (!filer) {
        result.skipped.push({ ...summary, reason: 'No admin or superadmin exists to file the escalation.' });
        continue;
      }

      const description =
        `Filed automatically by the SLA monitoring agent. ` +
        `Complaint ${c.trackingId} ("${c.title}") is assigned to ${deptName} and has been open for ${ageHours}h, ` +
        `which exceeds the ${slaHours}h limit for ${c.priority}-priority complaints. ` +
        `Current status: ${c.status}. Location: ${c.locationName || c.village || c.district || 'not recorded'}. ` +
        `Please review and intervene (reassign, contact the department, or add workers).`;

      const escalation = await Complaint.create({
        user: filer._id,
        title: `SLA breach: ${c.title}`.slice(0, 100),
        description: description.slice(0, 1000),
        category: c.category,
        priority: 'Critical',
        status: 'Pending',
        source: 'agent',
        relatedComplaint: c._id,
        district: c.district || null,
        village: c.village || null,
        latitude: c.latitude,
        longitude: c.longitude,
        locationName: c.locationName || null,
        geoTagged: Boolean(c.geoTagged),
        assignedAdmin: districtAdmins[0] ? districtAdmins[0]._id : null,
        statusHistory: [{ status: 'Pending', changedBy: filer._id, note: 'Filed automatically by the SLA agent' }],
      });

      await Complaint.updateOne({ _id: c._id }, { $set: { agentEscalatedAt: new Date() } });

      const recipients = [...districtAdmins, ...superadmins].map((u) => u._id);
      const notes = recipients.map((id) => ({
        recipient: id,
        type: 'system',
        title: 'SLA breach escalated by agent',
        message: `${c.trackingId} has been open ${ageHours}h (limit ${slaHours}h) with ${deptName}. Escalation ${escalation.trackingId} was filed automatically.`,
        complaint: escalation._id,
      }));
      if (c.assignedDepartment && c.assignedDepartment._id) {
        notes.push({
          recipient: c.assignedDepartment._id,
          type: 'system',
          title: 'Complaint overdue — escalated to admin',
          message: `${c.trackingId} ("${c.title}") exceeded its ${slaHours}h SLA and was escalated to the district admin.`,
          complaint: c._id,
        });
      }
      if (notes.length) await Notification.insertMany(notes);

      emitComplaintEvent('sla_escalation', c);
      result.filed.push({ ...summary, escalationTrackingId: escalation.trackingId, escalationId: String(escalation._id) });
    } catch (err) {
      console.error('[SLA agent] failed for', c.trackingId, err.message);
      result.skipped.push({ ...summary, reason: err.message });
    }
  }

  if (result.breachesFound > limit) {
    result.note = `${result.breachesFound - limit} more breaches will be handled on the next run (limit ${limit} per run).`;
  }
  return result;
}

// Background wrapper: never throws.
async function runSlaAgentSafe() {
  try {
    const r = await runSlaAgent();
    if (r.filed.length || r.skipped.length) {
      console.log(`[SLA agent] breaches=${r.breachesFound} filed=${r.filed.length} skipped=${r.skipped.length}`);
    }
  } catch (err) {
    console.error('[SLA agent] run failed:', err.message);
  }
}

module.exports = { runSlaAgent, runSlaAgentSafe };