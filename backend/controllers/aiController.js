const { predict, combinePriority } = require('../ai/complaintClassifier');
const detectPriority = require('../utils/autoPriority');

/**
 * POST /api/complaints/ai-suggest   (logged-in citizen)
 * Body: { title, description, category? }
 * Returns a SUGGESTION only — nothing is saved and the citizen stays in control.
 * The existing keyword rules are always computed too, and priority never goes
 * below what the rules say (safety floor).
 */
exports.suggest = async (req, res) => {
  try {
    const { title = '', description = '', category = '' } = req.body || {};
    const text = `${title}. ${description}`.trim();
    const ai = predict(text);
    if (!ai.available || ai.tooShort) return res.json({ success: true, available: !!ai.available, tooShort: !!ai.tooShort });

    const catForRules = category || ai.category.label;
    const rule = detectPriority({ title, description, category: catForRules });
    const merged = combinePriority(ai.priority.label, ai.priority.confidence, rule);

    res.json({
      success: true,
      available: true,
      category: ai.category,
      priority: { model: ai.priority.label, modelConfidence: ai.priority.confidence, rules: rule, suggested: merged.final, source: merged.source },
      reasons: ai.reasons,
      model: ai.model,
      note: 'AI suggestion only. You can accept or change it.',
    });
  } catch (err) {
    console.error('[AI] suggest error:', err.message);
    res.json({ success: true, available: false });
  }
};