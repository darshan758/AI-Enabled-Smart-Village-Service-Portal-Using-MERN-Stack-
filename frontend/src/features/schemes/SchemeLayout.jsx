// src/features/schemes/SchemeLayout.jsx
//
// Own lightweight header for the Scheme Eligibility Checker — deliberately
// does NOT reuse the main app's Navbar. That navbar pulls in complaint
// notifications, Dashboard/Report/Map/Track links, etc., which don't
// belong to this feature and were confusing to show here. This keeps
// the two features visually and functionally separate, with just a
// simple link back to the main portal.

import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft, FileCheck2 } from 'lucide-react';
import './scheme-styles.css';

export default function SchemeLayout() {
  return (
    <div className="sch-root min-h-screen bg-white">
      <div className="sch-app-header-bar">
        <header className="sch-app-header">
          <Link to="/schemes" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
            <FileCheck2 size={20} color="#1d4ed8" />
            <h1>Scheme Eligibility Checker</h1>
          </Link>

          <Link to="/" className="flex items-center gap-1.5" style={{ textDecoration: 'none', color: '#64748b', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} /> Back to Smart Village Portal
          </Link>
        </header>
      </div>

      <div className="sch-app-shell">
        <Outlet />
      </div>
    </div>
  );
}