import React, { useEffect, useMemo, useState } from 'react';
import { fetchSchemes } from '../services/api';
import SchemeCard from '../components/SchemeCard';

export default function SchemeListPage() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    fetchSchemes()
      .then(setSchemes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(schemes.map((s) => s.category).filter(Boolean)))],
    [schemes]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schemes.filter(
      (s) =>
        (category === 'All' || s.category === category) &&
        (!q || `${s.name} ${s.description} ${s.category} ${s.state}`.toLowerCase().includes(q))
    );
  }, [schemes, query, category]);

  if (loading) return <p className="sch-muted">Loading schemes…</p>;
  if (error) return <p className="sch-error-text">{error}</p>;
  if (schemes.length === 0) {
    return (
      <p className="sch-muted">
        No schemes found. Have you run <code>npm run seed</code> in the backend?
      </p>
    );
  }

  return (
    <div>
      <h2>Available Schemes ({visible.length}{visible.length !== schemes.length ? ` of ${schemes.length}` : ''})</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 14px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schemes (e.g. farmer, pension, women)…"
          style={{ flex: '1 1 240px', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'All' ? 'All categories' : c}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="sch-muted">No schemes match your search.</p>
      ) : (
        <div className="sch-scheme-grid">
          {visible.map((scheme) => (
            <SchemeCard key={scheme._id} scheme={scheme} />
          ))}
        </div>
      )}
    </div>
  );
}