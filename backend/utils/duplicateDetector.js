/**
 * duplicateDetector.js — Smart Village
 *
 * Smart duplicate detection: checks title similarity + category + location radius + district.
 * Returns { isDuplicate, duplicateOf, score } — never blocks submission, only warns.
 */

const Complaint = require('../models/Complaint');

/**
 * Simple Levenshtein-based similarity ratio (0–1).
 */
function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;

  const longer  = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLen = longer.length;
  if (longerLen === 0) return 1;

  // Levenshtein distance
  const costs = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter[i - 1] !== longer[j - 1]) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  return (longerLen - costs[longerLen]) / longerLen;
}

/**
 * Haversine distance in km between two lat/lng pairs.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * checkDuplicate({ title, category, latitude, longitude, district })
 * Searches recent open complaints (last 30 days) for likely duplicates.
 *
 * Proximity + text-similarity, with text similarity as a MANDATORY gate —
 * being nearby and same category is never enough on its own (two different
 * potholes on the same road, both filed under "Road Damage", shouldn't
 * collide just because they're 200m apart).
 *
 *   If BOTH complaints have GPS coordinates:
 *     - more than 3 km apart → never a duplicate, skipped entirely
 *     - title similarity < 0.45 → never a duplicate, skipped entirely (hard gate)
 *     - otherwise, score:
 *         distance:  < 0.3 km → +3   < 1 km → +2   < 3 km → +1
 *         title sim: ≥ 0.85 → +3    ≥ 0.65 → +2    ≥ 0.45 → +1
 *         same category → +1
 *     - duplicate if score ≥ 5
 *
 *   If GPS is missing on either side (fallback, less reliable):
 *     - requires a near-identical title (≥ 0.85 similarity) AND same category
 *
 * @returns { isDuplicate: bool, duplicateOf: ObjectId|null, score: number, matchedComplaint: Object|null }
 */
const checkDuplicate = async ({ title, category, latitude, longitude, district }) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Narrow the search pool by district (efficiency only — not a similarity signal)
    const query = {
      status:    { $nin: ['Resolved', 'Rejected'] },
      createdAt: { $gte: thirtyDaysAgo },
    };
    if (district) query.district = district;

    const recent = await Complaint.find(query).select(
      'title category latitude longitude district'
    );

    const hasCoords = latitude != null && longitude != null;

    let bestScore = 0;
    let bestMatch = null;

    for (const c of recent) {
      const candidateHasCoords = c.latitude != null && c.longitude != null;
      const bothHaveCoords = hasCoords && candidateHasCoords;

      const sim = titleSimilarity(title, c.title);
      const sameCategory = !!(category && c.category === category);

      let score = 0;
      let qualifies;

      if (bothHaveCoords) {
        const dist = haversineKm(latitude, longitude, c.latitude, c.longitude);

        // More than 3km apart — physically a different location, never a duplicate
        if (dist > 3) continue;

        // Hard gate: titles must show at least *some* real resemblance.
        // Proximity + category alone (e.g. two different potholes on the same
        // road) must never be enough by themselves.
        if (sim < 0.45) continue;

        if (dist < 0.3)      score += 3;
        else if (dist < 1)   score += 2;
        else                 score += 1;

        if (sim >= 0.85)      score += 3;
        else if (sim >= 0.65) score += 2;
        else                  score += 1; // sim is already ≥ 0.45 here

        if (sameCategory) score += 1;

        qualifies = score >= 5;
      } else {
        // No GPS to confirm proximity — only flag near-identical titles in the same category
        qualifies = sim >= 0.85 && sameCategory;
        score = qualifies ? 5 : 0;
      }

      if (qualifies && score > bestScore) {
        bestScore = score;
        bestMatch = c;
      }
    }

    const isDuplicate = !!bestMatch;
    return {
      isDuplicate,
      duplicateOf:      isDuplicate ? bestMatch._id : null,
      score:            bestScore,
      matchedComplaint: isDuplicate ? { _id: bestMatch._id, title: bestMatch.title } : null,
    };
  } catch (err) {
    console.error('[DuplicateDetector] Error:', err.message);
    // Never block submission on detector failure
    return { isDuplicate: false, duplicateOf: null, score: 0, matchedComplaint: null };
  }
};

module.exports = checkDuplicate;