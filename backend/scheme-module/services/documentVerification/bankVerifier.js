const { verifyRequiredDocument } = require('../documentEngine');

const BANK_INDICATORS = [
  ['bank', 'bank account', 'passbook', 'cancelled cheque', 'cancelled cheque'],
  ['account number', 'a/c no', 'account no'],
  ['ifsc'],
  ['branch'],
];

async function verifyBankAccount(filePath) {
  return verifyRequiredDocument(filePath, {
    indicatorGroups: BANK_INDICATORS,
    minGroupsMatched: 2,
    nameLabels: ['account holder name', 'account holder', 'name', 'a/c holder'],
    nameExcludeLabels: ['branch manager', 'authorised signatory', 'bank manager'],
    wrongTypeMessage: 'The uploaded document does not appear to be a valid Bank Account document.',
    extraExtract: async (text) => {
      const ifscMatch = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
      const acctMatch = text.match(/(?:a\/c\s*no\.?|account\s*no\.?)[:\s]*([0-9]{6,18})/i);
      return {
        ifsc: ifscMatch ? ifscMatch[1] : null,
        accountNumberFound: Boolean(acctMatch),
      };
    },
  });
}

module.exports = { verifyBankAccount };