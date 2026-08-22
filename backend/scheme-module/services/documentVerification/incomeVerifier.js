const { verifyRequiredDocument } = require('../documentEngine');
const { normalizeIncomeValue } = require('../../utils/normalize');

const INCOME_CERT_INDICATORS = [
  ['income certificate'],
  ['annual income', 'total annual income', 'family income'],
  ['tehsildar', 'revenue officer', 'competent authority', 'issuing authority'],
];

/**
 * extractIncomeValue()
 * Looks for a labeled income figure first ("Annual Income: Rs. X"),
 * then falls back to the largest plausible rupee figure in the text.
 */
function extractIncomeValue(text) {
  const labeledMatch = text.match(
    /(?:annual\s+income|total\s+annual\s+income|family\s+income|income)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)/i
  );
  if (labeledMatch) {
    const value = normalizeIncomeValue(labeledMatch[1]);
    if (value !== null) return { value, source: 'labeled' };
  }

  // Fallback: collect all rupee-looking numbers and take the largest
  // plausible one (income certs sometimes state the figure once,
  // in words, and again in numerals further down).
  const allMatches = [...text.matchAll(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/gi)];
  const values = allMatches
    .map((m) => normalizeIncomeValue(m[1]))
    .filter((v) => v !== null && v > 0);

  if (values.length > 0) {
    return { value: Math.max(...values), source: 'fallback-max' };
  }

  return { value: null, source: 'none' };
}

async function verifyIncomeCertificate(filePath) {
  const baseResult = await verifyRequiredDocument(filePath, {
    indicatorGroups: INCOME_CERT_INDICATORS,
    minGroupsMatched: 2,
    nameLabels: ['name', 'applicant name', "s/o", 'name of applicant'],
    nameExcludeLabels: ['officer', 'tehsildar', 'authority'],
    wrongTypeMessage: 'The uploaded document does not appear to be a valid Income Certificate.',
  });

  if (!baseResult.verified) return baseResult;

  const { value, source } = extractIncomeValue(baseResult.rawText);

  return {
    ...baseResult,
    extraFields: {
      annualIncome: value, // number or null
      incomeExtractionSource: source,
    },
    incomeExtractionFailed: value === null,
  };
}

module.exports = { verifyIncomeCertificate, extractIncomeValue };