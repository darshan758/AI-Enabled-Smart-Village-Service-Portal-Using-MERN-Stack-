const { verifyRequiredDocument } = require('../documentEngine');

// English + Kannada (Karnataka RTC / Pahani is bilingual or Kannada-only).
const LAND_INDICATORS = [
  [
    'land record', 'record of rights', 'rtc', 'ror', 'pahani', '7/12', 'khasra', 'khatauni', 'bhoomi',
    'ಪಹಣಿ', 'ಆರ್‌ಟಿಸಿ', 'ಆರ್.ಟಿ.ಸಿ', 'ಹಕ್ಕುಗಳ ದಾಖಲೆ', 'ಭೂಮಿ',
  ],
  ['owner', 'ownership', 'land owner', 'khatedar', 'cultivator', 'ಮಾಲೀಕ', 'ಖಾತೆದಾರ', 'ಸಾಗುವಳಿದಾರ'],
  ['survey number', 'survey no', 'plot number', 'plot no', 'ಸರ್ವೆ ನಂ', 'ಸರ್ವೆ ನಂಬರ್', 'ಸ.ನಂ', 'ಸರ್ವೆ'],
  ['revenue department', 'tehsildar', 'land revenue', 'ಕಂದಾಯ', 'ತಹಸೀಲ್ದಾರ'],
];

async function verifyLandOwnership(filePath) {
  return verifyRequiredDocument(filePath, {
    indicatorGroups: LAND_INDICATORS,
    minGroupsMatched: 2, // stricter — land records vary a lot, avoid false positives
    nameLabels: ['owner name', 'owner', "land owner's name", 'name of owner', 'name'],
    nameExcludeLabels: ["father's name", 'witness', 'tehsildar', 'officer'],
    wrongTypeMessage: 'The uploaded document does not appear to be a valid Land Ownership Record.',
  });
}

module.exports = { verifyLandOwnership };