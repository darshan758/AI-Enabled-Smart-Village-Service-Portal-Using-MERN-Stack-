import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchScheme } from '../services/api';

export default function SchemeDetailPage() {
  const { idOrSlug } = useParams();
  const [scheme, setScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchScheme(idOrSlug)
      .then(setScheme)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [idOrSlug]);

  if (loading) return <p className="sch-muted">Loading…</p>;
  if (error) return <p className="sch-error-text">{error}</p>;
  if (!scheme) return null;

  return (
    <div>
      <div className="sch-card">
        <span className="sch-tag">{scheme.category}</span>
        <span className="sch-tag">{scheme.state}</span>
        <h2>{scheme.name}</h2>
        <p>{scheme.description}</p>

        {scheme.benefits && (
          <>
            <h4>Benefits</h4>
            <p className="sch-muted">{scheme.benefits}</p>
          </>
        )}

        <h4>Required Documents</h4>
        <ul>
          {scheme.requiredDocuments.map((doc) => (
            <li key={doc.type}>{doc.label}</li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Link className="sch-btn" to={`/schemes/${scheme.slug}/apply`}>
            Start Eligibility Check
          </Link>
          {scheme.applicationLink && (
            <a className="sch-btn sch-btn-secondary" href={scheme.applicationLink} target="_blank" rel="noreferrer">
              Official Application Site
            </a>
          )}
        </div>
      </div>
    </div>
  );
}