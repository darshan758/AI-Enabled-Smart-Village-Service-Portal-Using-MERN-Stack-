// backend/utils/departmentAssigner.js
//
// Picks the Department account (User with role 'department') that should
// own a newly created complaint, based on category + district. This is
// the NEW logged-in tier: District Admin -> Department -> Worker.
//
// It is deliberately separate from utils/mediatorAssigner.js (which picks
// a non-login SMS contact for the "call the department directly" flow).
// A complaint can have both an assignedMediator and an assignedDepartment
// at the same time — they serve different purposes and neither depends
// on the other.
//
// If more than one active department account covers the same
// category+district (shouldn't normally happen, but not blocked), the
// one with the fewest currently-open complaints is picked, same
// least-busy strategy used for mediators and workers elsewhere.

const User = require('../models/User');
const Complaint = require('../models/Complaint');

const OPEN_STATUSES = ['Pending', 'In Progress'];

/**
 * assignDepartment({ category, district })
 * @returns {Promise<Object|null>} the department User document, or null
 *   if no matching department account exists yet for this category in
 *   this district (the complaint then just stays with assignedAdmin).
 */
const assignDepartment = async ({ category, district }) => {
  if (!category || !district) return null;

  const candidates = await User.find({
    role: 'department',
    district,
    departmentCategory: category,
    isActive: true,
  }).select('_id name district departmentCategory');

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const counts = await Complaint.aggregate([
    {
      $match: {
        assignedDepartment: { $in: candidates.map((c) => c._id) },
        status: { $in: OPEN_STATUSES },
      },
    },
    { $group: { _id: '$assignedDepartment', count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

  candidates.sort(
    (a, b) => (countMap[String(a._id)] || 0) - (countMap[String(b._id)] || 0)
  );

  return candidates[0];
};

module.exports = assignDepartment;