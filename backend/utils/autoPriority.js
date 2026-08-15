/**
 * autoPriority.js — Smart Village
 * NEW FILE
 *
 * AI-like keyword-based priority assignment.
 * Returns 'Low' | 'Medium' | 'High' | 'Critical'
 *
 * Priority matrix:
 *   Critical → fire, electrocution, death, flood, collapse, gas leak
 *   High     → electric wire, live wire, power outage, sewage overflow, pothole, road cave-in
 *   Medium   → water leakage, water supply, drainage, garbage overflow, street light
 *   Low      → paint, signage, minor cleaning, general request
 *
 * Category also contributes a baseline:
 *   Electricity Problem  → High
 *   Water Leakage        → Medium
 *   Garbage Issue        → Low
 *   Road Damage          → Medium
 *   Drainage Problem     → Medium
 *   Street Light Damage  → Low
 */

const CRITICAL_KEYWORDS = [
  'fire', 'electrocution', 'electric shock', 'death', 'dead body',
  'flood', 'collapse', 'fallen', 'gas leak', 'explosion', 'accident',
  'building collapse', 'bridge damage', 'emergency',
];

const HIGH_KEYWORDS = [
  'live wire', 'electric wire', 'power outage', 'no electricity',
  'sewage overflow', 'sewage', 'pothole', 'road cave', 'road broken',
  'water contamination', 'no water supply', 'blocked drain', 'overflow',
  'transformer', 'broken pipe', 'burst pipe', 'major', 'urgent',
];

const MEDIUM_KEYWORDS = [
  'water leakage', 'leaking', 'drainage', 'water supply', 'street light',
  'garbage', 'waste', 'road damage', 'damaged road', 'signal',
  'manhole', 'open manhole',
];

const CATEGORY_BASELINE = {
  'Electricity Problem': 'High',
  'Water Leakage':       'Medium',
  'Garbage Issue':       'Low',
  'Road Damage':         'Medium',
  'Drainage Problem':    'Medium',
  'Street Light Damage': 'Low',
  'Others':              'Medium',
};

const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 };

function higherPriority(a, b) {
  return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b;
}

/**
 * detectPriority({ title, description, category })
 * @returns {string} 'Low' | 'Medium' | 'High' | 'Critical'
 */
const detectPriority = ({ title = '', description = '', category = '' }) => {
  const text = `${title} ${description}`.toLowerCase();

  // Check critical keywords first
  if (CRITICAL_KEYWORDS.some((kw) => text.includes(kw))) return 'Critical';

  // Check high keywords
  let priority = 'Low';
  if (HIGH_KEYWORDS.some((kw) => text.includes(kw))) {
    priority = higherPriority(priority, 'High');
  }
  if (MEDIUM_KEYWORDS.some((kw) => text.includes(kw))) {
    priority = higherPriority(priority, 'Medium');
  }

  // Merge with category baseline
  const categoryBaseline = CATEGORY_BASELINE[category] || 'Medium';
  priority = higherPriority(priority, categoryBaseline);

  return priority;
};

module.exports = detectPriority;