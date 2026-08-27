// src/features/agri/AgriLayout.jsx
//
// Own lightweight header, same reasoning as SchemeLayout.jsx — this is an
// independent feature and shouldn't carry the complaint app's Navbar,
// notifications, or Dashboard/Report/Map/Track links.

import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';

export default function AgriLayout() {
  return (
    <div className="min-h-screen bg-white">
      <div style={{ borderBottom: '1px solid #e2e8f0' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            maxWidth: 960,
            margin: '0 auto',
          }}
        >
          <Link to="/agri" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
            <TrendingUp size={20} color="#15803d" />
            <h1 style={{ fontSize: '1.25rem', margin: 0, color: '#0f172a' }}>Market Price Checker</h1>
          </Link>

          <Link to="/" className="flex items-center gap-1.5" style={{ textDecoration: 'none', color: '#64748b', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} /> Back to Smart Village Portal
          </Link>
        </header>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 64px' }}>
        <Outlet />
      </div>
    </div>
  );
}