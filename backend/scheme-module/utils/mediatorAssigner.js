// backend/utils/mediatorAssigner.js
//
// Given a complaint's category + district (+ optional taluk), find the
// real-world mediator (department contact) who should handle it.
//
// Match priority:
//   1. Same category + same district + same taluk   (most specific)
//   2. Same category + same district, taluk not set  (covers whole district)
// If several mediators tie at the same priority level, pick the one with
// the fewest currently-active assignments, so work doesn't pile onto one
// person just because they were added to the directory first.
//
// This is a standalone lookup — it never throws. If nothing matches, it
// returns null and the caller falls back to assignedAdmin, same pattern
// as autoEscalate.js / autoPriority.js.

const Mediator = require('../../models/Mediator');

async function assignMediator({ category, district, taluk }) {
  try {
    if (!category || !district) return null;

    // Priority 1: exact taluk match
    if (taluk) {
      const talukMatch = await Mediator.find({
        isActive: true,
        categories: category,
        district,
        taluk,
      }).sort({ activeAssignments: 1 });

      if (talukMatch.length > 0) return talukMatch[0];
    }

    // Priority 2: district-wide mediator (taluk not set on the mediator)
    const districtMatch = await Mediator.find({
      isActive: true,
      categories: category,
      district,
      taluk: null,
    }).sort({ activeAssignments: 1 });

    if (districtMatch.length > 0) return districtMatch[0];

    return null;
  } catch (err) {
    console.error('[MediatorAssigner] Error:', err.message);
    return null;
  }
}

module.exports = assignMediator;