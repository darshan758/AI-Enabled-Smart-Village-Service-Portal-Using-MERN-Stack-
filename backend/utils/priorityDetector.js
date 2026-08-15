// backend/utils/priorityDetector.js  ← NEW FILE
/**
 * Auto-assigns complaint priority based on category + keywords in title/description.
 *
 * Priority matrix:
 *  Critical  — live wire, electrocution, fire, flood, collapse, emergency
 *  High      — Electricity Problem, broken street light (darkness), burst pipe (major)
 *  Medium    — Water Leakage, Drainage Problem, Road Damage
 *  Low       — Garbage Issue, Street Light Damage (non-urgent)
 */

const CRITICAL_KEYWORDS = [
  'live wire', 'electrocution', 'electric shock', 'fire', 'flood',
  'collapse', 'emergency', 'fallen pole', 'explosion', 'accident',
  'major leak', 'burst main', 'sewage overflow', 'road collapse',
];

const HIGH_KEYWORDS = [
  'no power', 'power cut', 'power failure', 'blackout', 'no electricity',
  'broken wire', 'exposed wire', 'dangerous', 'hazard', 'unsafe',
  'street light out', 'darkness', 'no light', 'sewage',
  'blocked drain', 'overflowing', 'pothole', 'large pothole',
  'deep pothole', 'water supply stopped', 'no water',
];

const CATEGORY_BASE_PRIORITY = {
  'Electricity Problem': 'High',
  'Street Light Damage': 'Low',
  'Road Damage':         'Medium',
  'Water Leakage':       'Medium',
  'Garbage Issue':       'Low',
  'Drainage Problem':    'Medium',
  Others:                'Low',
};

/**
 * @param {string} category
 * @param {string} title
 * @param {string} description
 * @returns {'Low'|'Medium'|'High'|'Critical'}
 */
const detectPriority = (category, title = '', description = '') => {
  const text = `${title} ${description}`.toLowerCase();

  // Check critical keywords first
  for (const kw of CRITICAL_KEYWORDS) {
    if (text.includes(kw)) return 'Critical';
  }

  // Check high keywords
  for (const kw of HIGH_KEYWORDS) {
    if (text.includes(kw)) return 'High';
  }

  // Fall back to category-based default
  return CATEGORY_BASE_PRIORITY[category] || 'Medium';
};

module.exports = detectPriority;