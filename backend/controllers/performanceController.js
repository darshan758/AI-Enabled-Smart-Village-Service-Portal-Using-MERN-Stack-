// backend/controllers/performanceController.js
//   GET  /api/admin/performance        department performance (district-scoped)
//   GET  /api/admin/agent/actions      complaints the SLA agent has filed
//   POST /api/admin/agent/run          run the agent now ({ dryRun: true } to preview)
//   GET  /api/department/performance   the department's own metrics

const Complaint = require('../models/Complaint');
const { departmentPerformance } = require('../utils/performanceMetrics');
const { runSlaAgent } = require('../utils/slaAgent');

exports.adminPerformance = async (req, res) => {
  try {
    const data = await departmentPerformance({ ...(req.districtFilter || {}) });
    res.json({ success: true, ...data, agentEnabled: process.env.AGENT_SLA_ENABLED !== 'false' });
  } catch (err) {
    console.error('Performance error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute performance' });
  }
};

exports.departmentOwnPerformance = async (req, res) => {
  try {
    const data = await departmentPerformance({ assignedDepartment: req.user._id });
    res.json({ success: true, ...data, mine: data.rows[0] || null });
  } catch (err) {
    console.error('Performance error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute performance' });
  }
};

exports.agentActions = async (req, res) => {
  try {
    const complaints = await Complaint.find({ source: 'agent', ...(req.districtFilter || {}) })
      .select('trackingId title description status priority district createdAt relatedComplaint')
      .populate('relatedComplaint', 'trackingId title assignedDepartment')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, actions: complaints });
  } catch (err) {
    console.error('Agent actions error:', err);
    res.status(500).json({ success: false, message: 'Failed to load agent actions' });
  }
};

exports.runAgent = async (req, res) => {
  try {
    const dryRun = Boolean(req.body && req.body.dryRun);
    const result = await runSlaAgent({ dryRun, districtFilter: { ...(req.districtFilter || {}) } });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Agent run error:', err);
    res.status(500).json({ success: false, message: 'Agent run failed' });
  }
};