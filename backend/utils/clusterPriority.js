// backend/utils/clusterPriority.js
//
// "Clustering" priority boost — separate from (and applied AFTER)
// utils/autoPriority.js's keyword/category scoring. If several
// complaints of the SAME category are already open in the SAME
// district within a recent window (e.g. many "Road Damage" reports in
// one district this week), that's a strong real-world signal this is a
// bigger, more urgent problem than any single report suggests — so we
// bump the priority one level.
//
// This mirrors the "if a lot of Road Damage complaints are coming from
// the same city, prioritize it" requirement. Kept as an additive,
// separate step (like autoEscalate.js already does for time-based
// escalation) so it can't interfere with the keyword-based scoring.

const Complaint = require('../models/Complaint');

const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 };
const RANK_TO_PRIORITY = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };

// Tunable knobs — how many open reports of the same category in the same
// district, within how many days, before we treat it as a cluster.
const CLUSTER_WINDOW_DAYS = 7;
const CLUSTER_THRESHOLD = 3;

/**
 * applyClusterBoost({ priority, category, district })
 * Counts existing OPEN complaints (Pending/In Progress) of the same
 * category in the same district created within the last
 * CLUSTER_WINDOW_DAYS days. If that count already meets
 * CLUSTER_THRESHOLD, bump `priority` one level (capped at Critical).
 *
 * @returns {Promise<{ priority: string, boosted: boolean, clusterCount: number }>}
 */
const applyClusterBoost = async ({ priority, category, district }) => {
  if (!category || !district) {
    return { priority, boosted: false, clusterCount: 0 };
  }

  const since = new Date();
  since.setDate(since.getDate() - CLUSTER_WINDOW_DAYS);

  const clusterCount = await Complaint.countDocuments({
    category,
    district,
    status: { $in: ['Pending', 'In Progress'] },
    createdAt: { $gte: since },
  });

  // This complaint itself hasn't been saved yet at the point this runs,
  // so clusterCount already reflects "how many others are open" — if
  // that alone meets the threshold, the new one boosts too.
  if (clusterCount < CLUSTER_THRESHOLD) {
    return { priority, boosted: false, clusterCount };
  }

  const currentRank = PRIORITY_RANK[priority] || PRIORITY_RANK.Medium;
  const boostedRank = Math.min(currentRank + 1, PRIORITY_RANK.Critical);
  const boostedPriority = RANK_TO_PRIORITY[boostedRank];

  return {
    priority: boostedPriority,
    boosted: boostedPriority !== priority,
    clusterCount,
  };
};

module.exports = applyClusterBoost;