const { verifyRequiredDocument, matchesKeyword } = require('../documentEngine');

const EDUCATION_CERT_INDICATORS = [
  [
    'certificate', 'marksheet', 'mark sheet', 'marks card', 'statement of marks', 'transcript',
    'sslc', 'puc', 'pre-university', 'ಅಂಕಪಟ್ಟಿ', 'ಪ್ರಮಾಣ ಪತ್ರ',
  ],
  ['board', 'university', 'institute', 'college', 'school', 'ಮಂಡಳಿ', 'ವಿಶ್ವವಿದ್ಯಾಲಯ', 'ಕಾಲೇಜು', 'ಶಾಲೆ'],
];

// Canonical education levels and the real-world phrasings that map to each.
// Matching is on WORD BOUNDARIES (see matchesKeyword) — the old substring
// matching fired on ordinary words ("to be ", "ba ", "ma "). Only add a
// mapping when it is unambiguous. Karnataka: PUC = Pre-University Course
// (I PUC = Class 11, II PUC = Class 12).
const EDUCATION_LEVEL_MAP = [
  { level: 'Class 11', patterns: ['class 11', '11th', 'class xi', 'i puc', '1st puc', 'first puc', 'first year puc', 'higher secondary first year'] },
  { level: 'Class 12', patterns: ['class 12', '12th', 'class xii', 'ii puc', '2nd puc', 'second puc', 'second year puc', 'pre-university', 'pre university', 'higher secondary', 'intermediate'] },
  { level: 'Diploma', patterns: ['diploma', 'polytechnic'] },
  {
    level: 'Undergraduate',
    patterns: ['b.tech', 'btech', 'b.e', 'bachelor', "bachelor's", 'b.sc', 'bsc', 'b.a', 'b.com', 'bcom', 'undergraduate', 'ug degree'],
  },
  {
    level: 'Postgraduate',
    patterns: ['m.tech', 'mtech', 'm.e', 'master', "master's", 'm.sc', 'msc', 'm.a', 'm.com', 'mcom', 'postgraduate', 'pg degree', 'mba'],
  },
];

/**
 * extractEducationLevel()
 * Returns the canonical level (matching the scheme's educationEligibility
 * values) or null. Prefers the level whose matched pattern is longest.
 */
function extractEducationLevel(text) {
  let best = null;
  let bestPatternLength = 0;

  for (const { level, patterns } of EDUCATION_LEVEL_MAP) {
    for (const pattern of patterns) {
      if (pattern.length > bestPatternLength && matchesKeyword(text, pattern)) {
        best = level;
        bestPatternLength = pattern.length;
      }
    }
  }

  return best;
}

async function verifyEducationCertificate(filePath) {
  const baseResult = await verifyRequiredDocument(filePath, {
    indicatorGroups: EDUCATION_CERT_INDICATORS,
    minGroupsMatched: 2,
    nameLabels: ['name', 'name of student', 'student name', 'candidate name'],
    nameExcludeLabels: ['principal', 'registrar', 'controller of examinations'],
    wrongTypeMessage: 'The uploaded document does not appear to be a valid Education Certificate.',
  });

  if (!baseResult.verified) return baseResult;

  const level = extractEducationLevel(baseResult.rawText);

  // Try to pick up a percentage/CGPA if present — used only if the
  // scheme configures minAcademicPercentage.
  const pctMatch = baseResult.rawText.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  const percentage = pctMatch ? parseFloat(pctMatch[1]) : null;

  return {
    ...baseResult,
    extraFields: {
      educationLevel: level, // canonical string or null
      percentage,
    },
  };
}

module.exports = { verifyEducationCertificate, extractEducationLevel };