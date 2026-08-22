const { verifyRequiredDocument } = require('../documentEngine');

const LAND_INDICATORS = [
  ['land record', 'record of rights', 'ror', 'pahani', '7/12', 'khasra', 'khatauni'],
  ['owner', 'ownership', 'land owner'],
  ['survey number', 'survey no', 'plot number', 'plot no'],
  ['revenue department', 'tehsildar', 'land revenue'],
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