const { verifyAadhaar } = require('./aadhaarVerifier');
const { verifyLandOwnership } = require('./landVerifier');
const { verifyBankAccount } = require('./bankVerifier');
const { verifyCasteCertificate } = require('./casteVerifier');
const { verifyIncomeCertificate } = require('./incomeVerifier');
const { verifyEducationCertificate } = require('./educationVerifier');
const { verifyFamilyEligibilityDocument } = require('./familyEligibilityVerifier');

/**
 * Single source of truth mapping a Scheme's requiredDocuments[].type
 * (stored in MongoDB) to the function that verifies it. Adding a new
 * document type anywhere in the app means adding one line here plus
 * one verifier file — nothing else needs to change.
 */
const VERIFIER_REGISTRY = {
  aadhaar: verifyAadhaar,
  land_ownership: verifyLandOwnership,
  bank_account: verifyBankAccount,
  caste_certificate: verifyCasteCertificate,
  income_certificate: verifyIncomeCertificate,
  education_certificate: verifyEducationCertificate,
  family_eligibility_document: verifyFamilyEligibilityDocument,
};

function getVerifierForType(type) {
  return VERIFIER_REGISTRY[type] || null;
}

module.exports = { VERIFIER_REGISTRY, getVerifierForType };