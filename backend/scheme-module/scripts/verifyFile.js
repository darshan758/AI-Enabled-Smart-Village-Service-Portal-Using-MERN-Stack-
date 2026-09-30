/**
 * Debug helper — run ONE document through the same verifier the app uses and
 * print exactly what the backend "sees". Send me this output if a document is
 * rejected and you don't know why.
 *
 *   node scheme-module/scripts/verifyFile.js <path-to-file> <documentType> ["Name typed in form"]
 *
 * documentType: aadhaar | land_ownership | bank_account | caste_certificate |
 *               income_certificate | education_certificate | family_eligibility_document
 */
process.env.OCR_WARMUP = 'true';
const { getVerifierForType } = require('../services/documentVerification/registry');
const { nameFoundInText, documentNamesMatch } = require('../utils/normalize');

(async () => {
  const [file, type, typedName] = process.argv.slice(2);
  if (!file || !type) {
    console.log('Usage: node scheme-module/scripts/verifyFile.js <file> <documentType> ["Typed Name"]');
    process.exit(1);
  }
  const verifier = getVerifierForType(type);
  if (!verifier) { console.log('Unknown documentType:', type); process.exit(1); }

  const t = Date.now();
  const r = await verifier(file);
  console.log('\n===== RESULT =====');
  console.log('verified      :', r.verified);
  console.log('message       :', r.message);
  console.log('read via      :', r.source);
  console.log('extractedName :', JSON.stringify(r.extractedName));
  console.log('extraFields   :', JSON.stringify(r.extraFields));
  if (typedName) {
    console.log('\n--- name check against typed name:', JSON.stringify(typedName));
    if (r.extractedName) console.log('extracted-name match:', documentNamesMatch(typedName, r.extractedName).match);
    console.log('found in text       :', nameFoundInText(typedName, r.rawText).found);
  }
  console.log('\ntime:', Date.now() - t, 'ms');
  console.log('\n===== FIRST 1500 CHARS OF TEXT THE BACKEND READ =====\n' + (r.rawText || '').slice(0, 1500));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });