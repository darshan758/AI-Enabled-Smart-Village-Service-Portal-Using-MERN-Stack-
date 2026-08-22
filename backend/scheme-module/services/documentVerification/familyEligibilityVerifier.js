const { verifyRequiredDocument } = require('../documentEngine');

/**
 * Ayushman Bharat PM-JAY's real eligibility rule is SECC-2011
 * deprivation-criteria based, not a simple income cutoff — and this
 * project has no access to the live SECC database. Per the master
 * prompt's instruction not to invent official rules, this verifier
 * treats "family eligibility document" as a CONFIGURABLE document
 * type (e.g. a ration card / SECC extract / income certificate the
 * institution decides to require) rather than asserting a specific
 * income threshold as fact. See README "Assumptions" section.
 */
const FAMILY_DOC_INDICATORS = [
  ['ration card', 'secc', 'socio economic caste census', 'bpl card', 'family id', 'income certificate'],
  ['family', 'household', 'members'],
];

async function verifyFamilyEligibilityDocument(filePath) {
  return verifyRequiredDocument(filePath, {
    indicatorGroups: FAMILY_DOC_INDICATORS,
    minGroupsMatched: 1,
    nameLabels: ['head of family', 'name', 'applicant name'],
    nameExcludeLabels: ['issuing authority', 'officer'],
    wrongTypeMessage:
      'The uploaded document does not appear to be a valid family/income eligibility document.',
  });
}

module.exports = { verifyFamilyEligibilityDocument };