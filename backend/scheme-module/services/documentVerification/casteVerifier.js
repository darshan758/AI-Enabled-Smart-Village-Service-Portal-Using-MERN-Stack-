const { verifyRequiredDocument } = require('../documentEngine');

const CASTE_CERT_INDICATORS = [
  ['caste certificate', 'community certificate'],
  ['belongs to', 'caste'],
  ['tehsildar', 'revenue officer', 'competent authority', 'issuing authority'],
];

// Known caste-category keywords we can confidently classify.
// This list is intentionally explicit rather than "anything after
// 'belongs to the caste'" being auto-accepted — see rule in section 17
// of the spec: an unrelated caste (e.g. "Arya Vysya") must NOT pass
// SC eligibility just because a caste certificate exists.
const CASTE_CATEGORY_KEYWORDS = {
  SC: ['scheduled caste', ' sc ', '(sc)', 'sc caste'],
  ST: ['scheduled tribe', ' st ', '(st)', 'st caste'],
  OBC: ['other backward class', 'obc', 'backward class'],
  GENERAL: ['general category', 'general caste'],
};

/**
 * extractApplicantNameFromCasteCert()
 *
 * Caste certificates typically read like:
 * "This is to certify that Sri/Smt <NAME> S/O <FATHER NAME> ...
 *  belongs to <CASTE> caste."
 *
 * The applicant's name is the one immediately BEFORE "S/O"/"D/O"/"W/O",
 * NOT the name after it (that's the father/husband), and not the
 * issuing officer's name (usually appears near "Tehsildar"/signature).
 */
function extractApplicantNameFromCasteCert(text) {
  // Prefer explicit "certify that <NAME> S/O ..." pattern.
  const certifyMatch = text.match(
    /certify\s+that\s+(?:sri\.?|smt\.?|kum\.?)?\s*([a-zA-Z.\s]{2,60}?)\s+(?:s\/o|d\/o|w\/o)/i
  );
  if (certifyMatch && certifyMatch[1]) {
    return cleanup(certifyMatch[1]);
  }

  // Fallback: any "<NAME> S/O ..." occurrence, first one found,
  // as long as it isn't on a line mentioning "officer" or "tehsildar".
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (/officer|tehsildar|authority|signature/i.test(line)) continue;
    const m = line.match(/([a-zA-Z.\s]{2,60}?)\s+(?:s\/o|d\/o|w\/o)/i);
    if (m && m[1]) return cleanup(m[1]);
  }

  return null;
}

function cleanup(raw) {
  return raw.replace(/^(sri\.?|smt\.?|kum\.?)\s*/i, '').replace(/\s+/g, ' ').trim();
}

/**
 * extractCasteCategory()
 * Returns one of 'SC' | 'ST' | 'OBC' | 'GENERAL' | null (unrecognized),
 * plus the raw matched phrase for transparency/debugging.
 */
function extractCasteCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CASTE_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return { category, matchedKeyword: kw };
      }
    }
  }

  // Fall back: try to capture whatever caste name follows "belongs to
  // the caste" / "belongs to" so it can at least be shown to the user,
  // even though we can't classify it into SC/ST/OBC/GENERAL.
  const belongsMatch = text.match(/belongs\s+to\s+(?:the\s+caste\s+)?([a-zA-Z\s]{2,40})\s+caste/i);
  if (belongsMatch) {
    return { category: null, matchedKeyword: null, rawCasteText: belongsMatch[1].trim() };
  }

  return { category: null, matchedKeyword: null, rawCasteText: null };
}

async function verifyCasteCertificate(filePath) {
  const baseResult = await verifyRequiredDocument(filePath, {
    indicatorGroups: CASTE_CERT_INDICATORS,
    minGroupsMatched: 2,
    nameLabels: [], // we use the specialized extractor below instead
    wrongTypeMessage: 'The uploaded document does not appear to be a valid Caste Certificate.',
  });

  if (!baseResult.verified) return baseResult;

  const applicantName = extractApplicantNameFromCasteCert(baseResult.rawText);
  const casteInfo = extractCasteCategory(baseResult.rawText);

  return {
    ...baseResult,
    extractedName: applicantName,
    normalizedName: applicantName ? applicantName.toLowerCase().trim() : null,
    extraFields: {
      casteCategory: casteInfo.category, // 'SC' | 'ST' | 'OBC' | 'GENERAL' | null
      matchedKeyword: casteInfo.matchedKeyword,
      rawCasteText: casteInfo.rawCasteText || null,
    },
  };
}

module.exports = { verifyCasteCertificate, extractApplicantNameFromCasteCert, extractCasteCategory };