// Minimal Kannada -> Latin transliteration, used ONLY to compare a person's
// name written in Kannada (e.g. on a Nadakacheri certificate) with the same
// name written in English (e.g. on an Aadhaar card). It is intentionally
// simple and lossy; the name matcher is tolerant of small differences.

const CONSONANTS = {
  'ಕ':'k','ಖ':'kh','ಗ':'g','ಘ':'gh','ಙ':'n','ಚ':'ch','ಛ':'chh','ಜ':'j','ಝ':'jh','ಞ':'n',
  'ಟ':'t','ಠ':'th','ಡ':'d','ಢ':'dh','ಣ':'n','ತ':'t','ಥ':'th','ದ':'d','ಧ':'dh','ನ':'n',
  'ಪ':'p','ಫ':'ph','ಬ':'b','ಭ':'bh','ಮ':'m','ಯ':'y','ರ':'r','ಱ':'r','ಲ':'l','ವ':'v',
  'ಶ':'sh','ಷ':'sh','ಸ':'s','ಹ':'h','ಳ':'l','ೞ':'l',
};
const VOWELS = {
  'ಅ':'a','ಆ':'a','ಇ':'i','ಈ':'i','ಉ':'u','ಊ':'u','ಋ':'ru','ಎ':'e','ಏ':'e','ಐ':'ai','ಒ':'o','ಓ':'o','ಔ':'au',
};
const SIGNS = { 'ಾ':'a','ಿ':'i','ೀ':'i','ು':'u','ೂ':'u','ೃ':'ru','ೆ':'e','ೇ':'e','ೈ':'ai','ೊ':'o','ೋ':'o','ೌ':'au' };
const VIRAMA = '\u0CCD';

const KANNADA_RE = /[\u0C80-\u0CFF]/;
const hasKannada = (s) => KANNADA_RE.test(s || '');

function transliterateKannada(input) {
  const str = (input || '').replace(/[\u200c\u200d]/g, '');
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (CONSONANTS[ch]) {
      const next = str[i + 1];
      if (next === VIRAMA) { out += CONSONANTS[ch]; i += 1; }
      else if (SIGNS[next]) { out += CONSONANTS[ch] + SIGNS[next]; i += 1; }
      else out += CONSONANTS[ch] + 'a';
    } else if (VOWELS[ch]) out += VOWELS[ch];
    else if (ch === 'ಂ') out += 'm';
    else if (ch === 'ಃ') out += 'h';
    else if (ch === VIRAMA || SIGNS[ch]) continue;
    else out += ch; // spaces, dots, latin letters pass through
  }
  return out;
}

// Applicant name on Karnataka certificates appears as
// "<pincode> <NAME> ಬಿನ್ <father name> (ತಂದೆಯ ಹೆಸರು)" ("bin" = son of).
function extractKannadaApplicantName(text) {
  if (!text) return null;
  const flat = text.replace(/\s+/g, ' ');
  const idx = flat.search(/\sಬಿನ್\s|\sಬಿನ್‌\s|\s(?:ಮಗ|ಮಗಳು|ಪುತ್ರ|ಪುತ್ರಿ)\s/);
  if (idx < 0) return null;
  let before = flat.slice(Math.max(0, idx - 60), idx);
  const pin = [...before.matchAll(/\d{6}/g)].pop();
  if (pin) before = before.slice(pin.index + 6);
  before = before.split(/[,;()]/).pop();
  const cleaned = before.replace(/[^\u0C80-\u0CFFa-zA-Z.\s\u200c\u200d]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length >= 3 ? cleaned : null;
}

module.exports = { hasKannada, transliterateKannada, extractKannadaApplicantName };