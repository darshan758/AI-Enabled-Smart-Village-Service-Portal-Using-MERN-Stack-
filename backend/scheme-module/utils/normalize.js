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
function documentNamesMatch(nameA, nameB, threshold = 0.82) {
  const a = normalizeDocumentName(nameA);
  const b = normalizeDocumentName(nameB);

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
      longer.some((tokLong) => similarityScore(tokShort, tokLong) >= 0.85)
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

module.exports = {
  normalizeDocumentName,
  normalizeIncomeValue,
  similarityScore,
  levenshtein,
  documentNamesMatch,
};