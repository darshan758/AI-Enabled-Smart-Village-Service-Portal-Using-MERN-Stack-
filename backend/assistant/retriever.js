// assistant/retriever.js — fuzzy retrieval over the FAQ knowledge base.
// TF-IDF weighted word + bigram + character n-gram features, cosine similarity.
// Character n-grams make it tolerant to spelling mistakes, Kannada word endings
// and romanized Kannada. Pure Node, no model download, no external service.
const { features } = require('../ai/tokenize');
const { FAQ } = require('./knowledge');
const { expand } = require('./synonyms');

const CHAR_W = Number(process.env.ASSISTANT_CHAR_WEIGHT) || 0.6;

function docText(e) {
  return [e.question, e.question, e.keywords ? e.keywords.join(' ') : '', e.questionKn || '', e.answer.slice(0, 200)].join(' ');
}

function build(entries) {
  const docs = entries.map((e) => new Set(features(docText(e))));
  const df = new Map();
  docs.forEach((s) => s.forEach((f) => df.set(f, (df.get(f) || 0) + 1)));
  const N = docs.length;
  const idf = (f) => Math.log((1 + N) / (1 + (df.get(f) || 0))) + 1;
  const vec = (set) => {
    const v = new Map(); let n = 0;
    set.forEach((f) => { if (df.has(f)) { const w = idf(f) * (f.startsWith('c:') ? CHAR_W : 1); v.set(f, w); n += w * w; } });
    n = Math.sqrt(n) || 1; v.forEach((w, f) => v.set(f, w / n)); return v;
  };
  return { entries, vecs: docs.map(vec), vec };
}

let index = null;
const getIndex = () => (index = index || build(FAQ));

// Returns entries ranked by similarity: [{entry, score}]
function search(query, limit = 5) {
  const ix = getIndex();
  const q = ix.vec(new Set(features(expand(query))));
  if (q.size === 0) return [];
  const scored = ix.vecs.map((d, i) => {
    let s = 0; q.forEach((w, f) => { const x = d.get(f); if (x) s += w * x; });
    return { entry: ix.entries[i], score: s };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

module.exports = { search };