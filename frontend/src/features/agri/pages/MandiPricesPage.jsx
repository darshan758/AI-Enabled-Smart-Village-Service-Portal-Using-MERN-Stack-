// src/features/agri/pages/MandiPricesPage.jsx

import React, { useState } from 'react';
import api from '../../../utils/api';
import { KARNATAKA_DISTRICTS } from '../../../utils/districts';

// A practical, commonly-traded subset — not exhaustive. The government
// dataset covers far more, but a long dropdown isn't more useful here.
const COMMON_COMMODITIES = [
  'Rice', 'Wheat', 'Maize', 'Ragi (Finger Millet)', 'Jowar (Sorghum)',
  'Tur (Arhar Dal)', 'Bengal Gram (Gram)', 'Green Gram (Moong)',
  'Groundnut', 'Soyabean', 'Sunflower', 'Cotton', 'Sugarcane',
  'Onion', 'Potato', 'Tomato', 'Brinjal', 'Chilli', 'Turmeric',
  'Coconut', 'Arecanut', 'Coffee', 'Banana', 'Mango',
];

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

export default function MandiPricesPage() {
  const [district, setDistrict] = useState('');
  const [commodity, setCommodity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [records, setRecords] = useState(null); // null = "haven't searched yet"
  const [stateTotal, setStateTotal] = useState(0); // raw govt total for the whole state, before our filtering

  const handleSearch = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setRecords(null);

    try {
      const params = new URLSearchParams({ state: 'Karnataka' });
      if (district) params.append('district', district);
      if (commodity) params.append('commodity', commodity);

      const { data } = await api.get(`/agri/prices?${params}`);
      setRecords(data.records || []);
      setStateTotal(data.total || 0);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Could not reach the market price service right now. Please try again shortly.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4, color: '#0f172a' }}>
          Check today's mandi prices
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
          Live data from India's official Agmarknet market price system — updated daily by the Ministry of Agriculture.
        </p>

        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls}>
            <option value="">All Karnataka districts</option>
            {KARNATAKA_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select value={commodity} onChange={(e) => setCommodity(e.target.value)} className={inputCls}>
            <option value="">All commodities</option>
            {COMMON_COMMODITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#15803d', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Checking…' : 'Check Prices'}
          </button>
        </form>
      </div>

      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: 16 }}>
          {error}
        </p>
      )}

      {records && records.length === 0 && !error && stateTotal === 0 && (
        <p style={{ color: '#b45309', fontSize: '0.875rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
          The government has not published any Karnataka mandi prices yet at this moment — this dataset updates
          gradually through the day as individual markets report in. Please try again in a little while.
        </p>
      )}

      {records && records.length === 0 && !error && stateTotal > 0 && (
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          {stateTotal} Karnataka price record(s) are available right now, but none matched that specific district/commodity.
          Try a different district or commodity, or check "All."
        </p>
      )}

      {records && records.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {['Market', 'District (as reported)', 'Commodity', 'Variety', 'Min Price', 'Max Price', 'Modal Price', 'Date'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px' }}>{r.market}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.8rem' }}>{r.district}</td>
                  <td style={{ padding: '10px 12px' }}>{r.commodity}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.variety}</td>
                  <td style={{ padding: '10px 12px' }}>₹{r.min_price}</td>
                  <td style={{ padding: '10px 12px' }}>₹{r.max_price}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>₹{r.modal_price}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.arrival_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 16 }}>
        Source: Government of India, Ministry of Agriculture &amp; Farmers Welfare — Agmarknet (data.gov.in), Open Government License India.
        Prices are per quintal, in Rupees, as reported by mandi officials.
      </p>
    </div>
  );
}