// backend/utils/commodityMatch.js
//
// Maps the farmer-friendly dropdown labels to the REAL commodity names used
// in the live Agmarknet data (e.g. "Tur (Arhar Dal)" -> "Red gram/Arhar/Tur(whole)",
// "Ragi (Finger Millet)" -> "Ragi(Finger Millet)"). A plain "contains" search
// on a shortened name was wrong: "tur" also matched "Turmeric", "potato" also
// matched "Sweet Potato", and exact-equality lookups missed "Ragi(Finger Millet)".

const ALIASES = {
  'tur (arhar dal)':     'red gram/arhar/tur\\(whole\\)',
  'bengal gram (gram)':  'bengal gram\\(gram\\)\\(whole\\)',
  'green gram (moong)':  'green gram\\(moong\\)\\(whole\\)',
  'rice':                '^rice',
  'potato':              '^potato',
  'sunflower':           '^sunflower',
  'groundnut':           '^ground\\s?nut$',
  'chilli':              'chilli|chillies',
  'coconut':             '^coconut',
  'banana':              '^banana',
  'maize':               '^maize',
  'paddy':               '^paddy',
  'black gram':          '^black gram\\(urd beans\\)',
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function bareName(commodity) {
  return (commodity || '').replace(/\s*\(.*?\)\s*/g, '').trim();
}

/** Returns a case-insensitive RegExp matching real dataset names for a UI label, or null. */
function commodityRegex(commodity) {
  if (!commodity) return null;
  const key = commodity.trim().toLowerCase();
  if (ALIASES[key]) return new RegExp(ALIASES[key], 'i');
  const bare = bareName(commodity).toLowerCase();
  if (ALIASES[bare]) return new RegExp(ALIASES[bare], 'i');
  // default: match at the start of the name ("Ragi" -> "Ragi(Finger Millet)"), not anywhere inside it
  return new RegExp('^' + escapeRe(bare), 'i');
}

module.exports = { commodityRegex, bareName };