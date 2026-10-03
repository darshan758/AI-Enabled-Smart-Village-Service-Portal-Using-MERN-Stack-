// Trains the complaint classifier (pure Node, no Python) and writes:
//   models/complaint_model.json   (loaded by complaintClassifier.js)
//   data/complaints_dataset.csv   (generated training data)
//   reports/metrics.json + reports/evaluation.md (numbers for the project report)
// Run:  node ai/train.js
const fs = require('fs');
const path = require('path');
const { features } = require('./tokenize');
const PHRASES = require('./data/phrases');
const REAL = require('./data/realisticTest');

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const CATEGORIES = Object.keys(PHRASES);

// ---------- deterministic RNG ----------
let seed = 20261003;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- augmentation parts ----------
const PREFIX = {
  en: ['', '', 'Hello, ', 'Sir, ', 'Complaint: ', 'Please help. ', 'Respected officer, '],
  kn: ['', '', 'ಸರ್, ', 'ದಯವಿಟ್ಟು ಗಮನಿಸಿ, '],
  rm: ['', '', 'sir, ', 'dayavittu gamanisi, '],
};
const PLACE = {
  en: ['', 'near the bus stand', 'in our ward', 'near the school', 'near the temple', 'in the main market', 'behind the panchayat office', 'in my village'],
  kn: ['', 'ಬಸ್ ನಿಲ್ದಾಣ ಹತ್ತಿರ', 'ನಮ್ಮ ಊರಿನಲ್ಲಿ', 'ಶಾಲೆ ಹತ್ತಿರ', 'ದೇವಸ್ಥಾನ ಹತ್ತಿರ'],
  rm: ['', 'bus nildana hattira', 'nam oorinalli', 'shale hattira', 'devasthana hattira'],
};
// [text, priority delta]
const MOD = {
  en: [['', 0], ['', 0], ['', 0], ['since two days', 0], ['please fix soon', 0], ['minor issue, not urgent', -1],
       ['since more than a month', 1], ['children use this way to school', 1], ['two bikes have already fallen here', 1],
       ['it is getting worse every day', 1], ['there was an accident yesterday', 1], ['sparks and smoke are coming', 2],
       ['someone may die, very dangerous', 2], ['there is a fire', 2]],
  kn: [['', 0], ['', 0], ['ಎರಡು ದಿನದಿಂದ', 0], ['ಒಂದು ತಿಂಗಳಿಂದ', 1], ['ಮಕ್ಕಳು ಶಾಲೆಗೆ ಹೋಗುವ ದಾರಿ', 1], ['ಅಪಘಾತ ಆಗಿದೆ', 1], ['ಬೆಂಕಿ ಬಿದ್ದಿದೆ', 2], ['ಅಪಾಯ ತುಂಬಾ ಇದೆ', 2]],
  rm: [['', 0], ['', 0], ['eradu dinadinda', 0], ['ond tingalinda', 1], ['makkalu shalege hogo daari', 1], ['apaghata aagide', 1], ['benki bidide', 2], ['apaya tumba ide', 2]],
};
function typo(s) {
  if (s.length < 12 || rnd() > 0.12) return s;
  const i = 3 + Math.floor(rnd() * (s.length - 5));
  return s.slice(0, i) + s.slice(i + 1);
}

// ---------- build dataset ----------
const rows = [];
let gid = 0;
for (const cat of CATEGORIES) {
  for (const lang of ['en', 'kn', 'rm']) {
    for (const [text, base] of PHRASES[cat][lang]) {
      gid += 1;
      const variants = new Set();
      for (let k = 0; k < 14; k++) {
        const [mt, delta] = pick(MOD[lang]);
        const parts = [pick(PREFIX[lang]) + text, pick(PLACE[lang]), mt].filter(Boolean);
        const s = lang === 'en' ? typo(parts.join(' ')) : parts.join(' ');
        const pr = Math.max(0, Math.min(3, base + delta));
        variants.add(JSON.stringify([s, cat, PRIORITIES[pr], gid, lang]));
      }
      variants.forEach((v) => rows.push(JSON.parse(v)));
    }
  }
}
fs.writeFileSync(path.join(__dirname, 'data', 'complaints_dataset.csv'),
  'text,category,priority,group,lang\n' + rows.map((r) => `"${r[0].replace(/"/g, '""')}",${r[1]},${r[2]},${r[3]},${r[4]}`).join('\n'));

// ---------- grouped split: whole phrases are held out (no leakage) ----------
const groupsByCat = {};
rows.forEach((r) => { (groupsByCat[r[1]] = groupsByCat[r[1]] || new Set()).add(r[3]); });
const testGroups = new Set();
for (const cat of CATEGORIES) shuffle([...groupsByCat[cat]]).slice(0, Math.max(3, Math.round(groupsByCat[cat].size * 0.2))).forEach((g) => testGroups.add(g));
const train = rows.filter((r) => !testGroups.has(r[3]));
const test = rows.filter((r) => testGroups.has(r[3]));

// ---------- softmax regression ----------
function buildVocab(samples, minDf = 2, maxFeat = 12000) {
  const df = new Map();
  samples.forEach((r) => features(r[0]).forEach((f) => df.set(f, (df.get(f) || 0) + 1)));
  const list = [...df.entries()].filter(([, c]) => c >= minDf).sort((a, b) => b[1] - a[1]).slice(0, maxFeat);
  const idf = {}; const index = {};
  list.forEach(([f, c], i) => { index[f] = i; idf[f] = Math.log((1 + samples.length) / (1 + c)) + 1; });
  return { index, idf, size: list.length, names: list.map((x) => x[0]) };
}
function vectorize(text, vocab) {
  const idx = []; const val = []; let norm = 0;
  features(text).forEach((f) => { const i = vocab.index[f]; if (i !== undefined) { const v = vocab.idf[f]; idx.push(i); val.push(v); norm += v * v; } });
  norm = Math.sqrt(norm) || 1;
  return { idx, val: val.map((v) => v / norm) };
}
function softmax(z) { const m = Math.max(...z); const e = z.map((v) => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); }

function trainModel(samples, labels, classes, { epochs = 40, lr = 1.5, l2 = 1e-5 } = {}) {
  const vocab = buildVocab(samples);
  const X = samples.map((r) => vectorize(r[0], vocab));
  const y = samples.map((r, i) => classes.indexOf(labels(r, i)));
  const K = classes.length; const D = vocab.size;
  const W = classes.map(() => new Float64Array(D)); const b = new Float64Array(K);
  const order = X.map((_, i) => i);
  for (let ep = 0; ep < epochs; ep++) {
    shuffle(order);
    const rate = lr / (1 + 0.1 * ep);
    for (const n of order) {
      const x = X[n];
      const z = new Array(K).fill(0).map((_, k) => { let s = b[k]; for (let t = 0; t < x.idx.length; t++) s += W[k][x.idx[t]] * x.val[t]; return s; });
      const p = softmax(z);
      for (let k = 0; k < K; k++) {
        const g = p[k] - (k === y[n] ? 1 : 0);
        b[k] -= rate * g;
        for (let t = 0; t < x.idx.length; t++) { const j = x.idx[t]; W[k][j] -= rate * (g * x.val[t] + l2 * W[k][j]); }
      }
    }
  }
  return { classes, vocab, W, b };
}
function predictProba(model, text) {
  const x = vectorize(text, model.vocab);
  return softmax(model.classes.map((_, k) => { let s = model.b[k]; for (let t = 0; t < x.idx.length; t++) s += model.W[k][x.idx[t]] * x.val[t]; return s; }));
}
const argmax = (a) => a.indexOf(Math.max(...a));

// ---------- metrics ----------
function metrics(trueIdx, predIdx, classes) {
  const K = classes.length; const cm = classes.map(() => new Array(K).fill(0));
  trueIdx.forEach((t, i) => { cm[t][predIdx[i]] += 1; });
  const per = classes.map((c, k) => {
    const tp = cm[k][k]; const fp = cm.reduce((s, r, i) => s + (i === k ? 0 : r[k]), 0); const fn = cm[k].reduce((s, v, j) => s + (j === k ? 0 : v), 0);
    const p = tp + fp ? tp / (tp + fp) : 0; const r = tp + fn ? tp / (tp + fn) : 0;
    return { class: c, precision: +p.toFixed(3), recall: +r.toFixed(3), f1: +(p + r ? (2 * p * r) / (p + r) : 0).toFixed(3), support: tp + fn };
  });
  const acc = trueIdx.filter((t, i) => t === predIdx[i]).length / trueIdx.length;
  return { accuracy: +acc.toFixed(3), macroF1: +(per.reduce((s, c) => s + c.f1, 0) / K).toFixed(3), perClass: per, confusion: cm };
}

// ---------- 1) category + priority on grouped hold-out ----------
const catModel = trainModel(train, (r) => r[1], CATEGORIES);
const priModel = trainModel(train, (r) => r[2], PRIORITIES);
const evalSet = (set, getText, getCat, getPri) => {
  const cT = set.map((r) => CATEGORIES.indexOf(getCat(r))); const cP = set.map((r) => argmax(predictProba(catModel, getText(r))));
  const pT = set.map((r) => PRIORITIES.indexOf(getPri(r))); const pP = set.map((r) => argmax(predictProba(priModel, getText(r))));
  return { category: metrics(cT, cP, CATEGORIES), priority: metrics(pT, pP, PRIORITIES), predPri: pP, trueCat: set.map(getCat) };
};
const heldOut = evalSet(test, (r) => r[0], (r) => r[1], (r) => r[2]);
const real = evalSet(REAL, (r) => r[0], (r) => r[1], (r) => r[2]);

// ---------- 2) baseline: the existing keyword rules (utils/autoPriority.js) ----------
let detectPriority = null;
try { detectPriority = require('../utils/autoPriority'); } catch (e) { /* baseline skipped */ }
function ruleBaseline(set, getText, getCat, getPri) {
  if (!detectPriority) return null;
  const pT = set.map((r) => PRIORITIES.indexOf(getPri(r)));
  const pP = set.map((r) => PRIORITIES.indexOf(detectPriority({ title: getText(r), description: '', category: getCat(r) })));
  return metrics(pT, pP, PRIORITIES);
}
const ruleHeld = ruleBaseline(test, (r) => r[0], (r) => r[1], (r) => r[2]);
const ruleReal = ruleBaseline(REAL, (r) => r[0], (r) => r[1], (r) => r[2]);

// ---------- 3) final model: retrain on ALL rows, save ----------
const finalCat = trainModel(rows, (r) => r[1], CATEGORIES);
const finalPri = trainModel(rows, (r) => r[2], PRIORITIES);
const pack = (m) => ({
  classes: m.classes, features: m.vocab.names, idf: m.vocab.names.map((f) => +m.vocab.idf[f].toFixed(4)),
  weights: m.W.map((w) => Array.from(w, (v) => +v.toFixed(4))), bias: Array.from(m.b, (v) => +v.toFixed(4)),
});
const out = {
  version: 1, trainedAt: new Date().toISOString(), algorithm: 'Softmax (multinomial logistic) regression on TF-IDF word + character n-gram features',
  trainingRows: rows.length, trainingPhrases: gid, category: pack(finalCat), priority: pack(finalPri),
};
fs.writeFileSync(path.join(__dirname, 'models', 'complaint_model.json'), JSON.stringify(out));

// ---------- reports ----------
const report = {
  dataset: { rows: rows.length, phrases: gid, trainRows: train.length, testRows: test.length, realisticTestRows: REAL.length, languages: ['English', 'Kannada script', 'Romanized Kannada'] },
  heldOut: { category: heldOut.category, priority: heldOut.priority, ruleBasedPriority: ruleHeld },
  realistic: { category: real.category, priority: real.priority, ruleBasedPriority: ruleReal },
};
const within1 = (set, getPri, preds) => +(set.filter((r, i) => Math.abs(PRIORITIES.indexOf(getPri(r)) - preds[i]) <= 1).length / set.length).toFixed(3);
const confStats = (set, getText, getCat, th) => { let n = 0, ok = 0; set.forEach((r) => { const p = predictProba(catModel, getText(r)); const k = argmax(p); if (p[k] >= th) { n++; if (CATEGORIES[k] === getCat(r)) ok++; } }); return { threshold: th, coverage: +(n / set.length).toFixed(3), accuracy: n ? +(ok / n).toFixed(3) : null }; };
report.heldOut.priorityWithinOneLevel = within1(test, (r) => r[2], heldOut.predPri);
report.realistic.priorityWithinOneLevel = within1(REAL, (r) => r[2], real.predPri);
report.heldOut.categoryWhenConfident = [0.5, 0.6, 0.7].map((t) => confStats(test, (r) => r[0], (r) => r[1], t));
report.realistic.categoryWhenConfident = [0.5, 0.6, 0.7].map((t) => confStats(REAL, (r) => r[0], (r) => r[1], t));
fs.writeFileSync(path.join(__dirname, 'reports', 'metrics.json'), JSON.stringify(report, null, 2));
const cmTable = (m, classes) => '| true \\ pred | ' + classes.join(' | ') + ' |\n|---|' + classes.map(() => '---').join('|') + '|\n' + m.confusion.map((r, i) => `| **${classes[i]}** | ${r.join(' | ')} |`).join('\n');
const perTable = (m) => '| Class | Precision | Recall | F1 | Support |\n|---|---|---|---|---|\n' + m.perClass.map((c) => `| ${c.class} | ${c.precision} | ${c.recall} | ${c.f1} | ${c.support} |`).join('\n');
const md = `# Complaint classifier – evaluation

Model: ${out.algorithm}.
Dataset: ${rows.length} labeled complaints generated from ${gid} team-written phrases (English, Kannada script, romanized Kannada) with wording / location / urgency variations.
Split: **whole phrases are held out** (${train.length} train rows / ${test.length} test rows) so the model is tested on sentences it has never seen.
A second **free-form test set of ${REAL.length} hand-written complaints** (different wording) is also used.

## A. Category – held-out phrases
Accuracy **${heldOut.category.accuracy}**, macro-F1 **${heldOut.category.macroF1}**

${perTable(heldOut.category)}

${cmTable(heldOut.category, CATEGORIES)}

## B. Category – free-form hand-written test (${REAL.length} complaints)
Accuracy **${real.category.accuracy}**, macro-F1 **${real.category.macroF1}**

${cmTable(real.category, CATEGORIES)}

## C. Priority – ML model vs existing keyword rules
| Test set | ML accuracy | ML macro-F1 | Rule-based accuracy | Rule-based macro-F1 |
|---|---|---|---|---|
| Held-out phrases | ${heldOut.priority.accuracy} | ${heldOut.priority.macroF1} | ${ruleHeld ? ruleHeld.accuracy : 'n/a'} | ${ruleHeld ? ruleHeld.macroF1 : 'n/a'} |
| Free-form (${REAL.length}) | ${real.priority.accuracy} | ${real.priority.macroF1} | ${ruleReal ? ruleReal.accuracy : 'n/a'} | ${ruleReal ? ruleReal.macroF1 : 'n/a'} |

Priority within one level (e.g. predicting High instead of Critical counts): held-out **${report.heldOut.priorityWithinOneLevel}**, free-form **${report.realistic.priorityWithinOneLevel}**.

Category accuracy only when the model is confident (what the user sees as a suggestion):

| Confidence ≥ | Held-out coverage | Held-out accuracy | Free-form coverage | Free-form accuracy |
|---|---|---|---|---|
${report.heldOut.categoryWhenConfident.map((c, i) => `| ${c.threshold} | ${c.coverage} | ${c.accuracy} | ${report.realistic.categoryWhenConfident[i].coverage} | ${report.realistic.categoryWhenConfident[i].accuracy} |`).join('\n')}

Priority – held-out per class:

${perTable(heldOut.priority)}

${cmTable(heldOut.priority, PRIORITIES)}

## Honest notes
* Training data is team-written/synthetic, not real citizen complaints; accuracy on real data will be lower until real complaints are added.
* Priority labels are the team's judgement. The live system keeps the keyword rules as a safety net (final priority = the higher of ML and rules).
`;
fs.writeFileSync(path.join(__dirname, 'reports', 'evaluation.md'), md);

console.log('rows', rows.length, 'train', train.length, 'test', test.length, 'vocab cat/pri', finalCat.vocab.size, finalPri.vocab.size);
console.log('HELD-OUT  category acc', heldOut.category.accuracy, 'F1', heldOut.category.macroF1, '| priority acc', heldOut.priority.accuracy, 'F1', heldOut.priority.macroF1, '| rules priority acc', ruleHeld && ruleHeld.accuracy);
console.log('REALISTIC category acc', real.category.accuracy, 'F1', real.category.macroF1, '| priority acc', real.priority.accuracy, 'F1', real.priority.macroF1, '| rules priority acc', ruleReal && ruleReal.accuracy);
console.log('model size KB', (fs.statSync(path.join(__dirname, 'models', 'complaint_model.json')).size / 1024).toFixed(0));