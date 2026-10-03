import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FIELD_CONFIG } from '../utils/formFields';

// Scheme recommendation: the citizen enters a few details (all optional) and
// gets the schemes ranked by how well the profile matches each scheme's rules.
// It is a PRE-CHECK only; the document-verified check is on the apply page.

const FIT_STYLE = {
  likely:   { label: 'Likely eligible',   bg: '#dcfce7', color: '#166534' },
  possible: { label: 'Possibly eligible', bg: '#fef9c3', color: '#854d0e' },
  open:     { label: 'Open to all — documents decide', bg: '#dbeafe', color: '#1e40af' },
  unlikely: { label: 'Not a match',       bg: '#fee2e2', color: '#991b1b' },
};
const ICON = { match: '✓', mismatch: '✗', unknown: '?' };
const ICON_COLOR = { match: '#166534', mismatch: '#b91c1c', unknown: '#a16207' };

const EMPTY = {
  age: '', gender: '', occupation: '', caste: '', education: '',
  landOwnership: '', academicPercentage: '', annualIncome: '',
};

const FIELDS = ['age', 'gender', 'occupation', 'caste', 'education', 'landOwnership', 'academicPercentage', 'annualIncome'];
const CONFIG = {
  ...FIELD_CONFIG,
  annualIncome: { label: 'Approximate Annual Family Income (₹)', type: 'number' },
};

export default function RecommendPage() {
  const [profile, setProfile] = useState(EMPTY);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setData(null);
    try {
      const body = {};
      FIELDS.forEach((k) => { if (profile[k] !== '') body[k] = profile[k]; });
      const res = await api.post('/schemes/recommend', body);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not get recommendations right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const results = data?.results || [];
  const good = results.filter((r) => r.fit !== 'unlikely');
  const bad = results.filter((r) => r.fit === 'unlikely');

  return (
    <div>
      <div className="sch-card">
        <h2>Which schemes suit me? / ನನಗೆ ಯಾವ ಯೋಜನೆ ಸೂಕ್ತ?</h2>
        <p className="sch-muted">
          Enter whatever details you know — every field is optional. We compare them with each scheme's
          rules and rank the schemes. This is a quick pre-check; final eligibility is decided only after
          your documents are verified.
        </p>
        <form onSubmit={submit}>
          <div className="sch-scheme-grid">
            {FIELDS.map((k) => {
              const c = CONFIG[k];
              return (
                <div className="sch-form-group" key={k}>
                  <label htmlFor={`rec-${k}`}>{c.label}</label>
                  {c.type === 'select' ? (
                    <select id={`rec-${k}`} value={profile[k]} onChange={(e) => set(k, e.target.value)}>
                      <option value="">— not sure / skip —</option>
                      {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input id={`rec-${k}`} type="number" min="0" value={profile[k]} onChange={(e) => set(k, e.target.value)} />
                  )}
                </div>
              );
            })}
          </div>
          <button className="sch-btn" type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Find suitable schemes'}
          </button>
          {' '}
          <button className="sch-btn-secondary sch-btn" type="button" onClick={() => { setProfile(EMPTY); setData(null); }}>
            Reset
          </button>
        </form>
        {error && <p className="sch-error-text">{error}</p>}
      </div>

      {data && (
        <>
          <p className="sch-muted" style={{ margin: '4px 4px 12px' }}>{data.note}</p>
          {good.map((r) => <ResultCard key={r.slug} r={r} />)}
          {bad.length > 0 && (
            <div style={{ margin: '12px 0' }}>
              <button className="sch-btn-secondary sch-btn" type="button" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Hide' : 'Show'} schemes that do not match ({bad.length})
              </button>
            </div>
          )}
          {showAll && bad.map((r) => <ResultCard key={r.slug} r={r} />)}
        </>
      )}
    </div>
  );
}

function ResultCard({ r }) {
  const st = FIT_STYLE[r.fit] || FIT_STYLE.open;
  return (
    <div className="sch-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>{r.name}</h3>
        <span style={{ background: st.bg, color: st.color, padding: '3px 12px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700 }}>
          {st.label}{r.matchScore !== null ? ` · ${r.matchScore}% match` : ''}
        </span>
      </div>
      <p className="sch-muted" style={{ margin: '6px 0' }}>{r.summary}</p>
      {r.benefits && <p style={{ margin: '4px 0', fontSize: '0.9rem' }}><strong>Benefit:</strong> {r.benefits}</p>}

      {r.criteria.length > 0 && (
        <ul className="sch-reason-list" style={{ listStyle: 'none', paddingLeft: 0, marginTop: 8 }}>
          {r.criteria.map((c) => (
            <li key={c.key}>
              <span style={{ color: ICON_COLOR[c.status], fontWeight: 700, marginRight: 6 }}>{ICON[c.status]}</span>
              <strong>{c.rule}.</strong> <span className="sch-muted">{c.detail}</span>
            </li>
          ))}
        </ul>
      )}

      {r.requiredDocuments.length > 0 && r.fit !== 'unlikely' && (
        <p className="sch-muted" style={{ fontSize: '0.85rem' }}>
          Documents needed: {r.requiredDocuments.join(', ')}
        </p>
      )}
      {r.assumptionsNote && r.fit !== 'unlikely' && (
        <p className="sch-muted" style={{ fontSize: '0.78rem' }}>Note: {r.assumptionsNote}</p>
      )}
      {r.fit !== 'unlikely' && (
        <Link className="sch-btn" to={`/schemes/${r.slug}/apply`}>Check eligibility with documents</Link>
      )}
    </div>
  );
}