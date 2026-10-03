// Shared text -> feature extraction (used by training AND by the live classifier).
// Works for English, Kannada script and romanized Kannada:
//   - lower-case, keep letters + combining marks (so Kannada words stay intact)
//   - word unigrams and bigrams
//   - character 3/4-grams inside each word (handles spelling variants,
//     Kannada suffixes and small typos)
function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFC').replace(/[\u200c\u200d]/g, '');
}
function words(text) {
  return normalize(text).match(/[\p{L}\p{M}\p{N}]+/gu) || [];
}
function features(text) {
  const ws = words(text);
  const f = new Set();
  ws.forEach((w, i) => {
    f.add('w:' + w);
    if (i > 0) f.add('b:' + ws[i - 1] + '_' + w);
    if (w.length >= 3) {
      const p = '<' + w + '>';
      for (const n of [3, 4]) for (let k = 0; k + n <= p.length; k++) f.add('c:' + p.slice(k, k + n));
    }
  });
  return [...f];
}
module.exports = { features, words, normalize };