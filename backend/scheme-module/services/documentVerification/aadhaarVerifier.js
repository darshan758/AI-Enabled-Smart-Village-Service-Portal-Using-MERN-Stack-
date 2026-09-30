const { verifyRequiredDocument } = require('../documentEngine');

// Multiple spelling/OCR variants — do not rely on one spelling.
// Two independent signals are required, so a random document that merely
// contains a stray word can no longer pass as an Aadhaar card:
//   1) the word "Aadhaar" (any common spelling / Kannada spelling), AND
//   2) UIDAI / "Unique Identification" wording, a VID, or a 12-digit number.
const AADHAAR_INDICATORS = [
  ['aadhaar', 'aadhar', 'adhaar', 'ಆಧಾರ್', 'ಅಧಾರ್'],
  [
    'uidai',
    'unique identification',
    'virtual id',
    'vid',
    'enrolment no',
    'enrollment no',
    /\b\d{4}\s\d{4}\s\d{4}\b/,
  ],
];

async function verifyAadhaar(filePath) {
  return verifyRequiredDocument(filePath, {
    indicatorGroups: AADHAAR_INDICATORS,
    minGroupsMatched: 2,
    nameLabels: ['name', 'applicant name'],
    nameUnlabeledAboveDob: true,
    nameSparseFallback: true,
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