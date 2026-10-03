import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSchemes } from '../services/api';

export default function HomePage() {
  // Scheme names are loaded from the database, so newly seeded schemes
  // appear here automatically (nothing hardcoded).
  const [schemes, setSchemes] = useState([]);

  useEffect(() => {
    fetchSchemes()
      .then((list) => setSchemes(Array.isArray(list) ? list : []))
      .catch(() => setSchemes([]));
  }, []);

  return (
    <div>
      <div className="sch-card">
        <h2>Check your eligibility for government welfare schemes</h2>
        <p className="sch-muted">
          Browse available schemes, fill in your details, upload your supporting documents, and get an
          instant, document-verified eligibility result.
        </p>
        <Link className="sch-btn" to="/schemes/list">
          Browse Schemes{schemes.length ? ` (${schemes.length})` : ''}
        </Link>{' '}
        <Link className="sch-btn sch-btn-secondary" to="/schemes/recommend">
          Which schemes suit me?
        </Link>
      </div>

      <div className="sch-scheme-grid">
        <div className="sch-card">
          <h3>1. Choose a scheme</h3>
          <p className="sch-muted">
            {schemes.length
              ? `${schemes.length} schemes available, including ${schemes
                  .slice(0, 3)
                  .map((s) => s.name)
                  .join(', ')} and more.`
              : 'Browse the list of available government schemes.'}
          </p>
        </div>
        <div className="sch-card">
          <h3>2. Fill your details</h3>
          <p className="sch-muted">The form adjusts automatically to what each scheme actually requires.</p>
        </div>
        <div className="sch-card">
          <h3>3. Upload documents</h3>
          <p className="sch-muted">Documents are verified automatically with OCR — no manual review needed.</p>
        </div>
      </div>

      {schemes.length > 0 && (
        <div className="sch-card" style={{ marginTop: 16 }}>
          <h3>All available schemes</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {schemes.map((s) => (
              <Link key={s._id} className="sch-tag" to={`/schemes/${s.slug}`} style={{ textDecoration: 'none' }}>
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}