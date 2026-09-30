const { verifyRequiredDocument, matchesKeyword } = require('../documentEngine');
const { extractKannadaApplicantName } = require('../../utils/kannada');

const CASTE_CERT_INDICATORS = [
  ['caste certificate', 'community certificate', 'ಜಾತಿ ಪ್ರಮಾಣ', 'ಜಾತಿ ಪ್ರಮಾಣಪತ್ರ'],
  ['belongs to', 'caste', 'ಜಾತಿ', 'ಪ್ರವರ್ಗ'],
  ['tehsildar', 'revenue officer', 'competent authority', 'issuing authority', 'ತಹಸೀಲ್ದಾರ', 'nadakacheri'],
];

// Known caste-category keywords we can confidently classify. Deliberately
// explicit: an unrelated caste (e.g. "Arya Vysya") must NOT pass SC eligibility
// just because a caste certificate exists. Kannada terms cover Nadakacheri
// certificates: ಪರಿಶಿಷ್ಟ ಜಾತಿ = Scheduled Caste, ಪರಿಶಿಷ್ಟ ಪಂಗಡ = Scheduled Tribe,
// ಹಿಂದುಳಿದ ವರ್ಗ / ಪ್ರವರ್ಗ = Backward Classes / Category (OBC).
const CASTE_CATEGORY_KEYWORDS = {
  SC: ['scheduled caste', '(sc)', 'sc caste', 'sc/st', 'ಪರಿಶಿಷ್ಟ ಜಾತಿ'],
  ST: ['scheduled tribe', '(st)', 'st caste', 'ಪರಿಶಿಷ್ಟ ಪಂಗಡ'],
  OBC: [
    'other backward class', 'backward class', 'obc', 'category-i', 'category i', 'category-2a', 'category 2a',
    'category-2b', 'category-3a', 'category-3b', 'ಹಿಂದುಳಿದ ವರ್ಗ', 'ಪ್ರವರ್ಗ',
  ],
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
  for (const [category, keywords] of Object.entries(CASTE_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (matchesKeyword(text, kw)) {
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

  const applicantName =
    extractKannadaApplicantName(baseResult.rawText) || extractApplicantNameFromCasteCert(baseResult.rawText);
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