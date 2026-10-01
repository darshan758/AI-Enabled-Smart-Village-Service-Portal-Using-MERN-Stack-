const { hasKannada, transliterateKannada } = require('./kannada');

/**
 * normalizeDocumentName()
 *
 * Normalizes a name string so that OCR/spacing/punctuation/case
 * differences don't cause false mismatches.
 *
 * "M Shankarlingeshwara"  -> "m shankarlingeshwara"
 * "M. SHANKARLINGESHWARA" -> "m shankarlingeshwara"
 * "  M   Shankarlingeshwara  " -> "m shankarlingeshwara"
 */
function normalizeDocumentName(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let s = raw;

  // Common OCR confusions worth normalizing before matching.
  s = s
    .replace(/[0]/g, 'o') // OCR sometimes reads O as 0 in names (rare but cheap to guard)
    .replace(/[1]/g, 'l');

  s = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[.,'`"_\-]/g, ' ') // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();

  return s;
}

/**
 * normalizeIncomeValue()
 * Converts OCR'd income strings into a plain number (in rupees).
 * Handles: "Rs. 15000", "Rs 15,000", "₹15,000", "15000",
 * "1,50,000" (Indian digit grouping), "2,50,000".
 * Returns null if no confident numeric value could be extracted.
 */
function normalizeIncomeValue(raw) {
  if (!raw) return null;
  if (typeof raw === 'number') return raw;

  const cleaned = String(raw)
    .replace(/rs\.?/gi, '')
    .replace(/inr/gi, '')
    .replace(/₹/g, '')
    .replace(/,/g, '')
    .replace(/\/-/g, '')
    .trim();

  const match = cleaned.match(/\d+(\.\d+)?/);
  if (!match) return null;

  const value = parseFloat(match[0]);
  if (Number.isNaN(value)) return null;

  return Math.round(value);
}

/**
 * levenshtein() - classic edit distance, used to power a
 * tolerant-but-bounded name similarity check.
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * similarityScore() - normalized similarity in [0, 1], 1 = identical.
 */
function similarityScore(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance / maxLen;
}

/**
 * documentNamesMatch()
 *
 * 1. Normalize both names.
 * 2. Exact match -> true immediately.
 * 3. Token-set comparison: if every token of the shorter name
 *    appears (allowing minor edit distance) in the longer name,
 *    treat as a match (handles missing middle names/initials).
 * 4. Otherwise fall back to whole-string similarity against a
 *    configurable, deliberately non-permissive threshold.
 *
 * Returns { match: boolean, score: number, reason: string }
 */
function toComparable(name) {
  // Kannada-script names are transliterated so they can be compared with English ones.
  const romanized = hasKannada(name) ? transliterateKannada(name) : name;
  return normalizeDocumentName(romanized).replace(/\bw/g, 'v');
}

// Trailing schwa: "ramesha" ~ "ramesh", "kumara" ~ "kumar"
const stripSchwa = (t) => (t.length > 3 && t.endsWith('a') ? t.slice(0, -1) : t);

function tokenMatches(tShort, tLong) {
  if (similarityScore(stripSchwa(tShort), stripSchwa(tLong)) >= 0.85) return true;
  // An initial ("M") matches a name/letter-name starting with or spelling it ("Mahesh", "em").
  if (tShort.length === 1 && (tLong.startsWith(tShort) || (tLong.length <= 2 && tLong.includes(tShort)))) return true;
  if (tLong.length === 1 && (tShort.startsWith(tLong) || (tShort.length <= 2 && tShort.includes(tLong)))) return true;
  return false;
}

function documentNamesMatch(nameA, nameB, threshold = 0.82) {
  const a = toComparable(nameA);
  const b = toComparable(nameB);

  if (!a || !b) {
    return { match: false, score: 0, reason: 'One or both names are empty.' };
  }

  if (a === b) {
    return { match: true, score: 1, reason: 'Exact match after normalization.' };
  }

  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = b.split(' ').filter(Boolean);
  const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];

  if (shorter.length > 0) {
    const allTokensFound = shorter.every((tokShort) =>
      longer.some((tokLong) => tokenMatches(tokShort, tokLong))
    );
    if (allTokensFound) {
      return { match: true, score: 0.95, reason: 'All name tokens found (token-level match).' };
    }
  }

  const score = similarityScore(a, b);
  if (score >= threshold) {
    return { match: true, score, reason: `Whole-name similarity ${score.toFixed(2)} >= threshold ${threshold}.` };
  }

  return {
    match: false,
    score,
    reason: `Names appear to belong to different people (similarity ${score.toFixed(2)} < threshold ${threshold}).`,
  };
}

/**
 * nameFoundInText()
 * Robust fallback when a name could not be *extracted* from a document
 * (multi-column layouts, Kannada text, garbled OCR): instead of asking
 * "what is the name on this document?", ask "does the name the applicant
 * typed appear anywhere in the document's text?". Kannada words in the text
 * are transliterated to Latin first, so "Darshan" is found in "ದರ್ಶನ್".
 * Every full (2+ letter) token of the typed name must be found; initials
 * are ignored, but at least one full token is required.
 */
function textTokens(rawText) {
  const tokens = new Set();
  const text = rawText || '';
  (text.toLowerCase().match(/[a-z]{2,}/g) || []).forEach((t) => tokens.add(t));
  (text.match(/[\u0C80-\u0CFF\u200c\u200d]+/g) || []).forEach((w) => {
    const t = transliterateKannada(w).toLowerCase().replace(/[^a-z]/g, '');
    if (t.length >= 2) tokens.add(t);
  });
  return [...tokens];
}

// Markers that introduce a RELATIVE's name (parent / spouse / guardian), in English and
// Kannada: "S/O", "D/O", "W/O", "C/O", "father", "mother", "husband", "ಬಿನ್", "ತಂದೆ", "ತಾಯಿ"...
// Everything from the marker onwards on that line names someone ELSE, so it must never be
// used to decide that the document belongs to the applicant.
const RELATION_MARKER_RE = new RegExp(
  [
    '\\b[sdwc]\\s*\\/\\s*o\\b',
    '\\b(?:son|daughter|wife|husband)\\s+of\\b',
    '\\b(?:father|mother|husband|wife|spouse|guardian)\\b',
    'ಬಿನ್', 'ತಂದೆ', 'ತಾಯಿ', 'ಪತಿ', 'ಪತ್ನಿ', 'ಗಂಡ', 'ಹೆಂಡತಿ', 'ಮಗ', 'ಪುತ್ರ',
  ].join('|'),
  'i'
);

/**
 * stripRelativeParts()
 * Returns the document's lines with every relative's name cut off. A line such as
 * "560001 KUMAR DARSHAN M ಬಿನ್ MANJUNATH" keeps only the applicant's part before the
 * marker; "D/O: Bhagirathi" or "Father's Name: X" are dropped entirely.
 */
function stripRelativeParts(rawText) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.search(RELATION_MARKER_RE);
      return (idx >= 0 ? line.slice(0, idx) : line).trim();
    })
    .filter(Boolean);
}

/**
 * nameFoundInText()  — FALLBACK ONLY, for when no name could be read from a document.
 * Safety rules (this is what stops one person's document passing as another's):
 *  - text after a relation marker (S/O, D/O, W/O, father, mother, ಬಿನ್, ತಂದೆ...) is ignored;
 *  - ALL typed name tokens must appear close together (same line, or two adjacent lines),
 *    not scattered across the page.
 */
function nameFoundInText(typedName, rawText) {
  const typedTokens = toComparable(typedName || '').split(' ').filter((t) => t.length >= 2);
  if (typedTokens.length === 0) return { found: false, missing: [] };

  const lines = stripRelativeParts(rawText);
  const windows = lines.map((l, i) => (i + 1 < lines.length ? `${l} ${lines[i + 1]}` : l));

  let bestMissing = typedTokens;
  for (const windowText of windows) {
    const tokens = textTokens(windowText);
    const isFound = (tok) =>
      tokens.some(
        (t) =>
          t === tok ||
          (tok.length >= 4 && t.length >= 4 && similarityScore(stripSchwa(tok), stripSchwa(t)) >= 0.85)
      );
    const missing = typedTokens.filter((t) => !isFound(t));
    if (missing.length === 0) return { found: true, missing: [] };
    if (missing.length < bestMissing.length) bestMissing = missing;
  }
  return { found: false, missing: bestMissing };
}

module.exports = {
  nameFoundInText,
  stripRelativeParts,
  normalizeDocumentName,
  normalizeIncomeValue,
  similarityScore,
  levenshtein,
  documentNamesMatch,
};