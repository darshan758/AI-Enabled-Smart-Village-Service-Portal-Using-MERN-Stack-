// assistant/assistantController.js — Village Assistant API (public, read-only).
const Complaint = require('../models/Complaint');
const { FAQ } = require('./knowledge');
const { search } = require('./retriever');

const ANSWER_TH = Number(process.env.ASSISTANT_ANSWER_THRESHOLD) || 0.2;
const SUGGEST_TH = Number(process.env.ASSISTANT_SUGGEST_THRESHOLD) || 0.1;
const TRACK_RE = /\bSV-[A-Z0-9][A-Z0-9-]{5,}\b/i;
const KN_RE = /[\u0C80-\u0CFF]/;
const GREET_RE = /^(hi|hii+|hello|hey|namaste|namaskara|namaskar|good (morning|afternoon|evening)|ನಮಸ್ಕಾರ|ಹಲೋ)\b/i;
const THANKS_RE = /\b(thanks|thank you|thankyou|dhanyavad|dhanyavadagalu)\b|ಧನ್ಯವಾದ/i;

const STAGE_TEXT = {
  NotAssigned: 'waiting to be assigned to a field worker',
  Assigned: 'assigned to a field worker',
  Accepted: 'accepted by the field worker',
  LocationConfirmed: 'the worker has reached the location',
  Working: 'work is in progress',
  ProofSubmitted: 'work done; waiting for department verification',
  Verified: 'work verified by the department',
};
const byId = new Map(FAQ.map((e) => [e.id, e]));
const pickAnswer = (e, kn) => (kn && e.answerKn ? e.answerKn : e.answer);
const brief = (e) => ({ id: e.id, question: e.question });

// ── tiny in-memory rate limiter (per IP) ───────────────────────────────────
const hits = new Map();
exports.rateLimit = (req, res, next) => {
  const ip = req.ip || 'x'; const now = Date.now(); const win = 60 * 1000; const max = Number(process.env.ASSISTANT_RATE_PER_MIN) || 40;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  if (arr.length >= max) return res.status(429).json({ success: false, message: 'Too many questions. Please wait a minute and try again.' });
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  next();
};

async function complaintStatus(id) {
  const c = await Complaint.findOne({ trackingId: id.toUpperCase() })
    .select('trackingId title category priority status workerStage district createdAt updatedAt resolvedAt statusHistory reopenCount')
    .lean();
  return c;
}
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');

exports.ask = async (req, res) => {
  try {
    const { message = '', faqId } = req.body || {};
    const text = String(message).trim().slice(0, 300);
    const kn = KN_RE.test(text);

    // 1) a suggestion chip was tapped
    if (faqId) {
      const e = byId.get(String(faqId));
      if (!e) return res.json({ success: true, type: 'fallback', answer: 'Sorry, I could not find that question.' });
      return res.json({ success: true, type: 'faq', answer: pickAnswer(e, kn), matched: brief(e), confidence: 1, links: e.links || [] });
    }
    if (!text) return res.status(400).json({ success: false, message: 'Please type a question.' });

    // 2) live complaint status from a tracking ID
    const m = text.match(TRACK_RE);
    if (m) {
      const c = await complaintStatus(m[0]);
      if (!c) return res.json({ success: true, type: 'complaint_status', found: false, answer: `I could not find a complaint with ID ${m[0].toUpperCase()}. Please check the ID (it looks like SV-...).`, links: [{ label: 'Track Complaint page', to: '/track' }] });
      const last = (c.statusHistory || []).slice(-1)[0];
      const lines = [
        `Complaint ${c.trackingId}`,
        `Issue: ${c.title} (${c.category})`,
        `Status: ${c.status}${c.reopenCount ? ` (reopened ${c.reopenCount}×)` : ''}`,
        `Priority: ${c.priority}`,
        `Progress: ${STAGE_TEXT[c.workerStage] || '-'}`,
        `Filed: ${fmt(c.createdAt)} · Last update: ${fmt(c.updatedAt)}`,
      ];
      if (last && last.note) lines.push(`Latest note: ${String(last.note).slice(0, 140)}`);
      if (c.resolvedAt) lines.push(`Resolved on: ${fmt(c.resolvedAt)}`);
      return res.json({ success: true, type: 'complaint_status', found: true, answer: lines.join('\n'), links: [{ label: 'Open full tracking page', to: '/track' }] });
    }

    // 3) small talk
    if (GREET_RE.test(text) && text.split(/\s+/).length <= 4) return res.json({ success: true, type: 'smalltalk', answer: kn ? 'ನಮಸ್ಕಾರ! ದೂರು, ಸರ್ಕಾರಿ ಯೋಜನೆ ಅಥವಾ ಕೃಷಿ ಬೆಲೆಗಳ ಬಗ್ಗೆ ಕೇಳಿ.' : 'Hello! Ask me about complaints, government schemes or crop prices. You can also type a complaint ID (SV-...) to see its status.' });
    if (THANKS_RE.test(text) && text.split(/\s+/).length <= 5) return res.json({ success: true, type: 'smalltalk', answer: kn ? 'ಸ್ವಾಗತ! ಇನ್ನೇನಾದರೂ ಕೇಳಿ.' : 'You are welcome! Ask me anything else about the portal.' });

    // 4) retrieval over the knowledge base
    const r = search(text, 4);
    const top = r[0];
    if (top && top.score >= ANSWER_TH) {
      const related = r.slice(1).filter((x) => x.score >= SUGGEST_TH + 0.04).slice(0, 2).map((x) => brief(x.entry));
      return res.json({ success: true, type: 'faq', answer: pickAnswer(top.entry, kn), matched: brief(top.entry), confidence: +top.score.toFixed(2), links: top.entry.links || [], suggestions: related });
    }
    const sug = r.filter((x) => x.score >= SUGGEST_TH).slice(0, 3);
    if (sug.length) return res.json({ success: true, type: 'suggestions', answer: kn ? 'ಖಚಿತವಾಗಿ ಹೇಳಲಾಗುತ್ತಿಲ್ಲ. ಇವುಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ನೀವು ಕೇಳಿದ್ದೇ?' : 'I am not fully sure what you mean. Is it one of these?', suggestions: sug.map((x) => brief(x.entry)) });
    return res.json({ success: true, type: 'fallback', answer: kn ? 'ಕ್ಷಮಿಸಿ, ಈ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರ ನನ್ನ ಬಳಿ ಇಲ್ಲ. ದೂರು, ಯೋಜನೆ ಅಥವಾ ಕೃಷಿ ಬೆಲೆಗಳ ಬಗ್ಗೆ ಕೇಳಿ.' : 'Sorry, I can only help with this portal: civic complaints, government schemes and farm prices. Try rephrasing, or pick a topic.' });
  } catch (err) {
    console.error('[assistant]', err.message);
    res.status(500).json({ success: false, message: 'Assistant is not available right now.' });
  }
};