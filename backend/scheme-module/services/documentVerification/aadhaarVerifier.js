const { verifyRequiredDocument } = require('../documentEngine');

// Multiple spelling/OCR variants — do not rely on one spelling.
const AADHAAR_INDICATORS = [
  ['aadhaar', 'aadhar', 'aadhaar card', 'adhaar'],
  ['uidai', 'unique identification authority'],
  ['unique identification'],
  ['vid', 'virtual id'],
  ['aadhaar number', 'aadhar number'],
];

async function verifyAadhaar(filePath) {
  return verifyRequiredDocument(filePath, {
    indicatorGroups: AADHAAR_INDICATORS,
    minGroupsMatched: 1,
    nameLabels: ['name', 'applicant name'],
    nameExcludeLabels: ["father's name", 'father name', 'guardian name', 'issuing authority'],
    wrongTypeMessage: 'The uploaded document does not appear to be a valid Aadhaar Card.',
    extraExtract: async (text) => {
      const numberMatch = text.match(/\b(\d{4}\s?\d{4}\s?\d{4})\b/);
      return {
        aadhaarNumberFound: Boolean(numberMatch),
      };
    },
  });
}

module.exports = { verifyAadhaar };