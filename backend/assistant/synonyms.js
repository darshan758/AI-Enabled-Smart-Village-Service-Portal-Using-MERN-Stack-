// Small domain thesaurus: words people use -> words the FAQ uses.
// Appended to the query before matching (query expansion). English + romanized
// Kannada + a few Kannada words. Keep it general, not tied to one question.
const GROUPS = [
  ['pay', 'paying', 'cost', 'fee', 'charge', 'charges', 'free', 'money'],
  ['picture', 'pic', 'image', 'photo', 'photograph', 'photos'],
  ['complain', 'complaint', 'issue', 'problem', 'report', 'raise', 'grievance', 'doora', 'tondare', 'ದೂರು'],
  ['contact', 'help', 'support', 'customer', 'care', 'helpline', 'phone', 'number', 'assistance'],
  ['rain', 'rainfall', 'forecast', 'weather', 'storm', 'climate', 'mausam', 'male', 'ಮಳೆ', 'ಹವಾಮಾನ'],
  ['upload', 'attach', 'submit', 'send', 'add'],
  ['voice', 'speak', 'speaking', 'say', 'record', 'audio', 'microphone', 'mic', 'ಧ್ವನಿ', 'ಮಾತನಾಡಿ'],
  ['scheme', 'schemes', 'yojane', 'yojana', 'benefit', 'benefits', 'subsidy', 'ಯೋಜನೆ'],
  ['password', 'pasword', 'passcode', 'pwd', 'forgot', 'forget', 'remember', 'reset'],
  ['register', 'signup', 'sign', 'create', 'account', 'join'],
  ['crop', 'crops', 'beleyuva', 'bele', 'ಬೆಳೆ', 'grow', 'sow', 'sowing', 'plant'],
  ['fertilizer', 'fertiliser', 'gobbara', 'urea', 'npk', 'manure', 'ಗೊಬ್ಬರ'],
  ['document', 'documents', 'papers', 'certificate', 'certificates', 'dakhale', 'dakhalegalu', 'ದಾಖಲೆ'],
  ['safe', 'secure', 'security', 'privacy', 'private', 'sigure', 'ಸುರಕ್ಷಿತ'],
  ['late', 'delay', 'delayed', 'tadavu', 'pending', 'unsolved', 'ತಡ'],
  ['sell', 'selling', 'market', 'mandi', 'marata', 'ಮಾರು'],
  ['status', 'track', 'progress'],
  ['rate', 'rates', 'price', 'prices', 'bele', 'dara', 'ದರ', 'ಬೆಲೆ'],
  ['call', 'phone', 'contact', 'reach', 'officer', 'office'],
  ['sms', 'text', 'message', 'messages'],
  ['compulsory', 'mandatory', 'required', 'must', 'need', 'necessary'],
  ['days', 'time', 'long', 'duration'],
  ['attended', 'ignored', 'action', 'response', 'responded', 'nobody', 'nothing'],
  ['keep', 'store', 'stored', 'save', 'saved', 'copy', 'retain', 'delete'],
  ['highest', 'best', 'maximum', 'top', 'good', 'better'],
  ['sure', 'guarantee', 'surely', 'certain', 'approved', 'approval', 'definitely'],
  ['location', 'gps', 'place', 'map', 'address', 'pin'],
  ['change', 'update', 'updated', 'refresh', 'frequently', 'daily'],
  ['panchayat', 'authority', 'authorities', 'government', 'officials', 'department'],
  ['fix', 'repair', 'solve', 'resolve', 'resolved', 'complete', 'completed', 'done'],
];
const map = new Map();
GROUPS.forEach((g) => g.forEach((w) => { map.set(w, g); }));
function expand(query) {
  const words = String(query || '').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || [];
  const extra = new Set();
  words.forEach((w) => { const g = map.get(w); if (g) g.forEach((x) => { if (!words.includes(x)) extra.add(x); }); });
  // synonyms are added at lower influence by appending only up to 8 words
  return query + ' ' + [...extra].slice(0, 8).join(' ');
}
module.exports = { expand };