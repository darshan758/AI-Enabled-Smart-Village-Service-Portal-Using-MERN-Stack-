import React from 'react';
import { Link } from 'react-router-dom';

export default function SchemeCard({ scheme }) {
  return (
    <div className="sch-card sch-scheme-card">
      <span className="sch-tag">{scheme.category}</span>
      <span className="sch-tag">{scheme.state}</span>
      <h3>{scheme.name}</h3>
      <p>{scheme.description}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <Link className="sch-btn" to={`/schemes/${scheme.slug}`}>
          Check Eligibility
        </Link>
        {scheme.applicationLink && (
          <a className="sch-btn sch-btn-secondary" href={scheme.applicationLink} target="_blank" rel="noreferrer">
            Official Site
          </a>
        )}
      </div>
    </div>
  );
}