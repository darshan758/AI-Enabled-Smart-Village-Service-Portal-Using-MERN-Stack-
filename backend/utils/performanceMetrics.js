// backend/utils/performanceMetrics.js
//
// Department performance + response-time metrics, computed from data that is
// already stored on every complaint (createdAt, departmentAssignedAt,
// statusHistory, resolvedAt, rating). Nothing new has to be tracked.
//
//   response time   = clock start -> first move to 'In Progress' (or 'Resolved')
//   resolution time = clock start -> resolved
//   clock start     = departmentAssignedAt, falling back to createdAt
//   SLA breach      = resolution (or, if still open, age) longer than the SLA
//                     hours for the complaint's priority

const Complaint = require('../models/Complaint');
const User = require('../models/User');

const HOUR = 3600 * 1000;

// Hours allowed per priority. Override with env SLA_HOURS_CRITICAL etc.
const SLA_HOURS = {
  Critical: Number(process.env.SLA_HOURS_CRITICAL) || 24,
  High: Number(process.env.SLA_HOURS_HIGH) || 48,
  Medium: Number(process.env.SLA_HOURS_MEDIUM) || 72,
  Low: Number(process.env.SLA_HOURS_LOW) || 120,
};
const slaHoursFor = (priority) => SLA_HOURS[priority] || SLA_HOURS.Medium;

const clockStart = (c) => new Date(c.departmentAssignedAt || c.createdAt).getTime();

function firstResponseAt(c) {
  const hit = (c.statusHistory || [])
    .filter((h) => h.status === 'In Progress' || h.status === 'Resolved')
    .map((h) => new Date(h.changedAt).getTime())
    .sort((a, b) => a - b)[0];
  return hit || null;
}

function resolvedAtOf(c) {
  if (c.status !== 'Resolved') return null;
  if (c.resolvedAt) return new Date(c.resolvedAt).getTime();
  const h = (c.statusHistory || []).filter((x) => x.status === 'Resolved').map((x) => new Date(x.changedAt).getTime());
  return h.length ? Math.max(...h) : null;
}

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const round1 = (n) => (n === null ? null : Math.round(n * 10) / 10);

async function departmentPerformance(match = {}) {
  const now = Date.now();
  const complaints = await Complaint.find({
    ...match,
    source: { $ne: 'agent' },
    assignedDepartment: { $ne: null },
    status: { $ne: 'Rejected' },
  })
    .select('assignedDepartment priority status createdAt departmentAssignedAt resolvedAt statusHistory rating')
    .limit(20000)
    .lean();

  const byDept = new Map();
  for (const c of complaints) {
    const key = String(c.assignedDepartment);
    if (!byDept.has(key)) byDept.set(key, { total: 0, open: 0, resolved: 0, breached: 0, resp: [], res: [], ratings: [] });
    const d = byDept.get(key);
    const start = clockStart(c);
    const slaMs = slaHoursFor(c.priority) * HOUR;
    d.total += 1;

    const responded = firstResponseAt(c);
    if (responded && responded >= start) d.resp.push((responded - start) / HOUR);

    if (c.status === 'Resolved') {
      d.resolved += 1;
      const done = resolvedAtOf(c);
      if (done && done >= start) {
        d.res.push((done - start) / HOUR);
        if (done - start > slaMs) d.breached += 1;
      }
      if (c.rating) d.ratings.push(c.rating);
    } else {
      d.open += 1;
      if (now - start > slaMs) d.breached += 1;
    }
  }

  const users = await User.find({ _id: { $in: [...byDept.keys()] } }).select('name departmentCategory district').lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const rows = [...byDept.entries()].map(([id, d]) => {
    const u = userById.get(id) || {};
    return {
      departmentId: id,
      name: u.name || 'Unknown department',
      category: u.departmentCategory || null,
      district: u.district || null,
      total: d.total,
      open: d.open,
      resolved: d.resolved,
      resolutionRate: d.total ? Math.round((d.resolved / d.total) * 100) : 0,
      avgResponseHours: round1(avg(d.resp)),
      avgResolutionHours: round1(avg(d.res)),
      slaBreaches: d.breached,
      onTimeRate: d.total ? Math.round(((d.total - d.breached) / d.total) * 100) : 100,
      avgRating: d.ratings.length ? round1(avg(d.ratings)) : null,
    };
  });
  rows.sort((a, b) => b.slaBreaches - a.slaBreaches || b.open - a.open);

  const all = [...byDept.values()];
  const summary = {
    departments: rows.length,
    total: all.reduce((s, d) => s + d.total, 0),
    resolved: all.reduce((s, d) => s + d.resolved, 0),
    slaBreaches: all.reduce((s, d) => s + d.breached, 0),
    avgResponseHours: round1(avg(all.flatMap((d) => d.resp))),
    avgResolutionHours: round1(avg(all.flatMap((d) => d.res))),
  };

  return { rows, summary, slaHours: SLA_HOURS };
}

module.exports = { departmentPerformance, slaHoursFor, SLA_HOURS, HOUR, clockStart };