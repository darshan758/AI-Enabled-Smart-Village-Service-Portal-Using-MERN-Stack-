import React, { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

/**
 * AI suggestion box for the complaint form.
 * Reads the title + description, asks the backend classifier, and SUGGESTS a
 * category and priority. Nothing is changed unless the citizen presses a button.
 * If the AI service is unavailable the box simply does not appear, so the
 * normal form keeps working exactly as before.
 */
export default function AiSuggestion({ title, description, category, priority, onUseCategory, onUsePriority }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    clearTimeout(timer.current);
    const text = `${title || ''} ${description || ''}`.trim();
    if (text.length < 8) { setS(null); return undefined; }
    timer.current = setTimeout(async () => {
      const id = ++seq.current;
      setBusy(true);
      try {
        const { data } = await api.post('/complaints/ai-suggest', { title, description, category });
        if (id === seq.current) setS(data && data.available && data.category ? data : null);
      } catch {
        if (id === seq.current) setS(null);
      } finally {
        if (id === seq.current) setBusy(false);
      }
    }, 900);
    return () => clearTimeout(timer.current);
  }, [title, description, category]);

  if (!s) return busy ? <p className="text-xs text-gray-400">AI is reading your complaint…</p> : null;

  const pct = (n) => `${Math.round(n * 100)}%`;
  const catSame = category === s.category.label;
  const priSame = priority === s.priority.suggested;

  return (
    <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 10, padding: 12, fontSize: '0.85rem' }}>
      <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>🤖 AI suggestion</div>

      {s.category.confident ? (
        <div style={{ marginBottom: 6 }}>
          Category: <strong>{s.category.label}</strong> ({pct(s.category.confidence)} sure)
          {s.reasons && s.reasons.length > 0 && (
            <span style={{ color: '#64748b' }}> — based on: {s.reasons.join(', ')}</span>
          )}
          {' '}
          {catSame ? <span style={{ color: '#15803d' }}>✓ selected</span> : (
            <button type="button" onClick={() => onUseCategory(s.category.label)}
              style={{ marginLeft: 6, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }}>
              Use this category
            </button>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 6, color: '#64748b' }}>
          Not sure about the category yet (best guess: {s.category.label}, {pct(s.category.confidence)}). Please choose it yourself or add more detail.
        </div>
      )}

      <div>
        Priority: <strong>{s.priority.suggested}</strong>
        <span style={{ color: '#64748b' }}> (AI says {s.priority.model}, keyword rules say {s.priority.rules}; we never go below the rules)</span>
        {' '}
        {priSame ? <span style={{ color: '#15803d' }}>✓ selected</span> : (
          <button type="button" onClick={() => onUsePriority(s.priority.suggested)}
            style={{ marginLeft: 6, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }}>
            Use this priority
          </button>
        )}
      </div>
      <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 6 }}>
        Suggestion only — you decide. Model trained on {s.model && s.model.trainingRows} sample complaints (English + Kannada).
      </div>
    </div>
  );
}