// ai/complaintClassifier.js — live inference for the trained complaint model.
// Pure Node, no extra packages. If the model file is missing or anything fails,
// predict() returns { available:false } and the portal keeps using its keyword
// rules, so this can never break complaint submission.
const fs = require('fs');
const path = require('path');
const { features } = require('./tokenize');

const MODEL_PATH = path.join(__dirname, 'models', 'complaint_model.json');
const CATEGORY_CONFIDENT = Number(process.env.AI_CATEGORY_CONFIDENCE) || 0.6;
const PRIORITY_MIN_CONFIDENCE = Number(process.env.AI_PRIORITY_CONFIDENCE) || 0.45;
const STOP = new Set(['the','of','a','an','is','are','in','on','at','to','and','our','my','near','since','for','with','has','have','it','this','that','from','by','be','there','been','was','were','please','sir']);
const RANK = { Low: 0, Medium: 1, High: 2, Critical: 3 };

let cache = null;
function load() {
  if (cache) return cache;
  const raw = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  const prep = (m) => {
    const index = new Map(m.features.map((f, i) => [f, i]));
    return { ...m, index };
  };
  cache = { meta: { trainedAt: raw.trainedAt, algorithm: raw.algorithm, trainingRows: raw.trainingRows }, category: prep(raw.category), priority: prep(raw.priority) };
  return cache;
}

function vectorize(text, m) {
  const items = []; let norm = 0;
  features(text).forEach((f) => { const i = m.index.get(f); if (i !== undefined) { const v = m.idf[i]; items.push([i, v, f]); norm += v * v; } });
  norm = Math.sqrt(norm) || 1;
  return items.map(([i, v, f]) => [i, v / norm, f]);
}
function run(m, text) {
  const x = vectorize(text, m);
  const z = m.classes.map((_, k) => x.reduce((s, [i, v]) => s + m.weights[k][i] * v, m.bias[k]));
  const mx = Math.max(...z); const e = z.map((v) => Math.exp(v - mx)); const sum = e.reduce((a, b) => a + b, 0);
  const p = e.map((v) => v / sum);
  return { x, p };
}
const sorted = (m, p) => m.classes.map((label, k) => ({ label, confidence: +p[k].toFixed(3) })).sort((a, b) => b.confidence - a.confidence);

function predict(text) {
  try {
    const t = String(text || '').trim();
    if (t.length < 4) return { available: true, tooShort: true };
    const model = load();
    const c = run(model.category, t);
    const catTop = sorted(model.category, c.p);
    const k = model.category.classes.indexOf(catTop[0].label);
    // Which words pushed the prediction (word features only, readable for users)
    const reasons = c.x.filter(([, , f]) => f.startsWith('w:'))
      .map(([i, v, f]) => ({ word: f.slice(2), score: model.category.weights[k][i] * v }))
      .filter((r) => r.score > 0 && !STOP.has(r.word) && r.word.length > 1).sort((a, b) => b.score - a.score).slice(0, 4).map((r) => r.word);
    const pr = run(model.priority, t);
    const priTop = sorted(model.priority, pr.p);
    return {
      available: true,
      category: { label: catTop[0].label, confidence: catTop[0].confidence, confident: catTop[0].confidence >= CATEGORY_CONFIDENT, top3: catTop.slice(0, 3) },
      priority: { label: priTop[0].label, confidence: priTop[0].confidence, all: priTop },
      reasons,
      model: model.meta,
    };
  } catch (err) {
    console.error('[AI] complaint classifier unavailable:', err.message);
    return { available: false };
  }
}

// Hybrid safety rule: never go BELOW the existing keyword rules.
function combinePriority(modelPriority, modelConfidence, rulePriority) {
  if (!modelPriority || modelConfidence < PRIORITY_MIN_CONFIDENCE) return { final: rulePriority, source: 'rules' };
  if ((RANK[modelPriority] ?? -1) > (RANK[rulePriority] ?? -1)) return { final: modelPriority, source: 'model' };
  return { final: rulePriority, source: modelPriority === rulePriority ? 'model+rules agree' : 'rules (safety floor)' };
}

module.exports = { predict, combinePriority, CATEGORY_CONFIDENT };