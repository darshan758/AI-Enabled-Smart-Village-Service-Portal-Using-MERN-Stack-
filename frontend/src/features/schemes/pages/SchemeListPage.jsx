import React, { useEffect, useState } from 'react';
import { fetchSchemes } from '../services/api';
import SchemeCard from '../components/SchemeCard';

export default function SchemeListPage() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSchemes()
      .then(setSchemes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
      <h2>Available Schemes</h2>
      <div className="sch-scheme-grid">
        {schemes.map((scheme) => (
          <SchemeCard key={scheme._id} scheme={scheme} />
        ))}
      </div>
    </div>
  );
}