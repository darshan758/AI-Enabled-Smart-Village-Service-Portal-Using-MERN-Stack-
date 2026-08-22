const { verifyRequiredDocument } = require('../documentEngine');

const EDUCATION_CERT_INDICATORS = [
  ['certificate', 'marksheet', 'mark sheet', 'transcript', 'diploma certificate', 'degree certificate'],
  ['board', 'university', 'institute', 'college', 'school'],
];

// Canonical education levels this project recognizes, and the OCR/real-world
// phrasings that justifiably map to each. Only add a mapping here when the
// justification is logical/unambiguous — do not guess.
const EDUCATION_LEVEL_MAP = [
  { level: 'Class 11', patterns: ['class 11', '11th', 'class xi', 'higher secondary first year'] },
  { level: 'Class 12', patterns: ['class 12', '12th', 'class xii', 'higher secondary', 'intermediate'] },
  {
    level: 'Diploma',
    patterns: ['diploma', 'polytechnic'],
  },
  {
    level: 'Undergraduate',
    patterns: [
      'b.tech', 'btech', 'b.e', 'be ', 'bachelor', "bachelor's", 'b.sc', 'bsc',
      'b.a', 'ba ', 'b.com', 'bcom', 'undergraduate', 'ug degree',
    ],
  },
  {
    level: 'Postgraduate',
    patterns: [
      'm.tech', 'mtech', 'm.e', 'master', "master's", 'm.sc', 'msc',
      'm.a', 'ma ', 'm.com', 'mcom', 'postgraduate', 'pg degree', 'mba',
    ],
  },
];

/**
 * extractEducationLevel()
 * Returns the canonical level string (matching the scheme's
 * educationEligibility values) or null if nothing confidently matched.
 * Checks more-specific/longer patterns implicitly by scanning all
 * levels and preferring the one with the longest matched pattern.
 */
function extractEducationLevel(text) {
  const lower = text.toLowerCase();
  let best = null;
  let bestPatternLength = 0;

  for (const { level, patterns } of EDUCATION_LEVEL_MAP) {
    for (const pattern of patterns) {
      if (lower.includes(pattern) && pattern.length > bestPatternLength) {
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