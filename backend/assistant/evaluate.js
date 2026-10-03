// node assistant/evaluate.js  -> prints results and writes assistant/evaluation.md
const fs = require('fs');
const path = require('path');
const { search } = require('./retriever');
const base = require('./faqBase.json');
const ANSWER_TH = Number(process.env.ASSISTANT_ANSWER_THRESHOLD) || 0.2;

// The ORIGINAL Hub-widget matcher (every query word must appear in question+answer+keywords)
function oldMatch(query) {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/);
  return base.filter((e) => { const h = [e.question, e.answer, ...(e.keywords || [])].join(' ').toLowerCase(); return terms.every((t) => h.includes(t)); }).slice(0, 5).map((e) => e.id);
}
const sets = [['A. Development queries (used while tuning)', './evalSet'], ['B. Fresh queries (also used for tuning later)', './freshSet'], ['C. FINAL held-out queries (evaluated once, never tuned)', './finalSet']];
const baseIds = new Set(base.map((e) => e.id));
let md = `# Village Assistant – retrieval evaluation\n\nMethod: TF-IDF cosine retrieval over word, bigram and character n-gram features, plus a small synonym thesaurus; answer threshold ${ANSWER_TH}.\nKnowledge base: ${base.length} original + new entries. Queries mix English, Kannada script and romanized Kannada and include off-topic questions.\n\n`;
const lines = [];
for (const [title, file] of sets) {
  const set = require(file);
  let n = 0, top1 = 0, top3 = 0, answered = 0, answeredOk = 0, oos = 0, oosAnswered = 0;
  let oldN = 0, oldFound = 0, oldAny = 0, newTop3OnBase = 0;
  for (const [q, exp] of set) {
    const r = search(q, 3);
    if (!exp) { oos++; if (r[0] && r[0].score >= ANSWER_TH) oosAnswered++; continue; }
    n++;
    const ids = r.map((x) => x.entry.id);
    const ok1 = exp.includes(ids[0]); if (ok1) top1++; if (ids.some((i) => exp.includes(i))) top3++;
    if (r[0].score >= ANSWER_TH) { answered++; if (ok1) answeredOk++; }
    const baseExp = exp.filter((i) => baseIds.has(i));
    if (baseExp.length) { oldN++; const o = oldMatch(q); if (o.length) oldAny++; if (o.some((i) => baseExp.includes(i))) oldFound++; if (ids.some((i) => baseExp.includes(i))) newTop3OnBase++; }
  }
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
  lines.push({ title, n, top1: pct(top1, n), top3: pct(top3, n), cov: pct(answered, n), acc: pct(answeredOk, answered), oos: `${oosAnswered}/${oos}`, oldN, old: pct(oldFound, oldN), oldAny: pct(oldAny, oldN), newb: pct(newTop3OnBase, oldN) });
}
md += '| Query set | In-scope queries | Top-1 correct | Top-3 contains answer | Answered (≥ threshold) | Accuracy when answered | Off-topic wrongly answered |\n|---|---|---|---|---|---|---|\n';
lines.forEach((l) => { md += `| ${l.title} | ${l.n} | ${l.top1} | ${l.top3} | ${l.cov} | ${l.acc} | ${l.oos} |\n`; });
md += '\n## Compared with the original keyword chatbot\nOnly queries whose correct answer is one of the original 19 FAQs (the old bot knew nothing else).\n\n| Query set | Such queries | Old: returns the right FAQ | Old: returns anything | New: right FAQ in top 3 |\n|---|---|---|---|---|\n';
lines.forEach((l) => { md += `| ${l.title} | ${l.oldN} | ${l.old} | ${l.oldAny} | ${l.newb} |\n`; });
md += '\n## Honest notes\n* Set C is the fair estimate; A and B were used while building the synonym list and thresholds, so they are optimistic.\n* This is lexical (keyword + character-n-gram) retrieval, not neural semantic search; it can miss paraphrases that share no words with the FAQ.\n* An off-topic question that shares vocabulary with the portal (e.g. "weather on mars") can still match a weather FAQ; the answer shows its confidence so users can judge.\n* The same system also does live complaint-status lookup and page shortcuts, which the old widget could not.\n';
fs.writeFileSync(path.join(__dirname, 'evaluation.md'), md);
console.log(md);