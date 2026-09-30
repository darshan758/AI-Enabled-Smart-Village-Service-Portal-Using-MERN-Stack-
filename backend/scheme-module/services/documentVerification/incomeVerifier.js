const { verifyRequiredDocument } = require('../documentEngine');
const { normalizeIncomeValue } = require('../../utils/normalize');

const INCOME_CERT_INDICATORS = [
  ['income certificate', 'ಆದಾಯ ಮತ್ತು ಜಾತಿ', 'ಆದಾಯ ಪ್ರಮಾಣ'],
  ['annual income', 'total annual income', 'family income', 'ವಾರ್ಷಿಕ ಆದಾಯ'],
  ['tehsildar', 'revenue officer', 'competent authority', 'issuing authority', 'ತಹಸೀಲ್ದಾರ', 'nadakacheri'],
];

/**
 * extractIncomeValue()
 * Looks for a labeled income figure first ("Annual Income: Rs. X"),
 * then falls back to the largest plausible rupee figure in the text.
 */
function extractIncomeValue(text) {
  // Kannada Nadakacheri format: "...ವಾರ್ಷಿಕ ಆದಾಯ ರೂ. 40000/-( ರೂ. ... ಮಾತ್ರ.)". The same text also
  // quotes the 8-lakh creamy-layer LIMIT ("ರೂ. 8.00 ಲಕ್ಷ"), which must not be mistaken
  // for the income, so we only take a figure written in the certified form "ರೂ. N/-".
  // OCR sometimes drops the dash, so accept "40000/-", "40000/(" or "40000/".
  const kn = text.match(/ರೂ\.?\s*(\d[\d,]*)\s*\//);
  if (kn) {
    const value = normalizeIncomeValue(kn[1]);
    if (value !== null) return { value, source: 'kannada-certified-amount' };
  }

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
    validityCheck: 'always', // an income certificate always has an issue date / validity period
    wrongTypeMessage: 'The uploaded document does not appear to be a valid Income Certificate.',
  });

  if (!baseResult.verified) return baseResult;

  const { value, source } = extractIncomeValue(baseResult.rawText);

  return {
    ...baseResult,
    extraFields: {
      ...(baseResult.extraFields || {}), // includes validity dates
      annualIncome: value, // number or null
      incomeExtractionSource: source,
    },
    incomeExtractionFailed: value === null,
  };
}

module.exports = { verifyIncomeCertificate, extractIncomeValue };