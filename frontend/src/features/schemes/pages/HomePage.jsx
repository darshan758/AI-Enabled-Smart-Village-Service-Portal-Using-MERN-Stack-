import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div>
      <div className="sch-card">
        <h2>Check your eligibility for government welfare schemes</h2>
        <p className="sch-muted">
          Browse available schemes, fill in your details, upload your supporting documents, and get an
          instant, document-verified eligibility result.
        </p>
        <Link className="sch-btn" to="/schemes/list">
          Browse Schemes
        </Link>
      </div>

      <div className="sch-scheme-grid">
        <div className="sch-card">
          <h3>1. Choose a scheme</h3>
          <p className="sch-muted">PM-KISAN, SC Post-Matric Scholarship, or Ayushman Bharat PM-JAY.</p>
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
    </div>
  );
}