// src/features/agri/pages/AdvisoryPage.jsx
//
// Frontend for the 4 rule-based advisory endpoints that already existed
// on the backend with no UI yet: crop recommendation, fertilizer (NPK)
// recommendation, price trend + harvest advice, and suggested market.
// Deliberately styled to match MandiPricesPage.jsx exactly (same inline
// style approach, same input classes) rather than introducing a new
// pattern into this feature folder.

import React, { useState } from 'react';
import api from '../../../utils/api';
import { KARNATAKA_DISTRICTS } from '../../../utils/districts';

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

// Backend values (Kharif/Rabi/Zaid) stay unchanged; only the labels are
// shown in the farmer's own terms: rainy / winter / summer season.
const SEASONS = [
  { value: 'Kharif', label: 'Rainy season / ಮುಂಗಾರು (Jun–Sep)' },
  { value: 'Rabi',   label: 'Winter season / ಹಿಂಗಾರು (Oct–Jan)' },
  { value: 'Zaid',   label: 'Summer season / ಬೇಸಿಗೆ (Feb–May)' },
];
const SOIL_TYPES = [
  { value: 'Red Soil',           label: 'Red soil / ಕೆಂಪು ಮಣ್ಣು' },
  { value: 'Black Soil (Regur)', label: 'Black soil / ಕಪ್ಪು ಮಣ್ಣು (ಎರೆ ಮಣ್ಣು)' },
  { value: 'Laterite Soil',      label: 'Laterite soil / ಜಂಬಿಟ್ಟಿಗೆ ಮಣ್ಣು' },
  { value: 'Alluvial Soil',      label: 'Alluvial soil / ಮೆಕ್ಕಲು ಮಣ್ಣು' },
  { value: 'Sandy Loam',         label: 'Sandy loam / ಮರಳು ಮಿಶ್ರಿತ ಗೋಡು ಮಣ್ಣು' },
];
const NPK_LEVELS = [
  { value: 'Low',     label: 'Low / ಕಡಿಮೆ' },
  { value: 'Medium',  label: 'Medium / ಮಧ್ಯಮ' },
  { value: 'High',    label: 'High / ಹೆಚ್ಚು' },
  { value: 'Unknown', label: "I don't know / ಗೊತ್ತಿಲ್ಲ" },
];
const FERTILIZER_CROPS = [
  'Paddy (Rice)', 'Ragi (Finger Millet)', 'Maize', 'Cotton', 'Sugarcane',
  'Groundnut', 'Wheat', 'Bengal Gram (Chana)', 'Sunflower', 'Vegetables',
];
const COMMON_COMMODITIES = [
  'Rice', 'Wheat', 'Maize', 'Ragi (Finger Millet)', 'Jowar (Sorghum)',
  'Tur (Arhar Dal)', 'Bengal Gram (Gram)', 'Green Gram (Moong)',
  'Groundnut', 'Soyabean', 'Sunflower', 'Cotton', 'Sugarcane',
  'Onion', 'Potato', 'Tomato', 'Brinjal', 'Chilli', 'Turmeric',
];

const TABS = [
  { id: 'crop', label: 'Crop Recommendation' },
  { id: 'fertilizer', label: 'Fertilizer (NPK)' },
  { id: 'trend', label: 'Price Trend & Harvest Advice' },
  { id: 'market', label: 'Suggested Market' },
  { id: 'weather', label: 'Weather Alerts' },
];

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 20 };
const cardTitle = { fontSize: '1rem', fontWeight: 700, marginBottom: 4, color: '#0f172a' };
const cardSub = { fontSize: '0.85rem', color: '#64748b', marginBottom: 16 };
const btn = {
  background: '#15803d', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 16px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
};
const resultBox = { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, fontSize: '0.875rem' };
const errorBox = { color: '#dc2626', fontSize: '0.875rem', marginTop: 12 };
const disclaimer = { fontSize: '0.75rem', color: '#94a3b8', marginTop: 10 };

export default function AdvisoryPage() {
  const [tab, setTab] = useState('crop');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
              border: tab === t.id ? '1px solid #15803d' : '1px solid #e2e8f0',
              background: tab === t.id ? '#f0fdf4' : '#fff',
              color: tab === t.id ? '#15803d' : '#475569',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'crop' && <CropRecommendationTab />}
      {tab === 'fertilizer' && <FertilizerTab />}
      {tab === 'trend' && <PriceTrendTab />}
      {tab === 'market' && <SuggestedMarketTab />}
      {tab === 'weather' && <WeatherAlertsTab />}
    </div>
  );
}

// ── Crop Recommendation ──────────────────────────────────────────────────
function CropRecommendationTab() {
  const [season, setSeason] = useState('');
  const [soilType, setSoilType] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const params = new URLSearchParams({ season, soilType });
      const { data } = await api.get(`/agri/crop-recommendation?${params}`);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not get a recommendation right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={cardTitle}>Which crops suit this season and soil?</h2>
      <p style={cardSub}>General agronomic guidance — not a substitute for local extension advice.</p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select required value={season} onChange={(e) => setSeason(e.target.value)} className={inputCls}>
          <option value="">Season…</option>
          {SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select required value={soilType} onChange={(e) => setSoilType(e.target.value)} className={inputCls}>
          <option value="">Soil type…</option>
          {SOIL_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Checking…' : 'Get Recommendation'}
        </button>
      </form>

      {error && <p style={errorBox}>{error}</p>}

      {result?.success && (
        <div style={{ ...resultBox, marginTop: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>
            Recommended crops for {(SEASONS.find((x) => x.value === result.season) || {}).label || result.season}, {(SOIL_TYPES.find((x) => x.value === result.soilType) || {}).label || result.soilType}:
          </p>
          <ul style={{ margin: '0 0 8px 18px' }}>
            {result.recommendedCrops.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <p style={disclaimer}>{result.note}</p>
        </div>
      )}
    </div>
  );
}

// ── Fertilizer (NPK) Recommendation ─────────────────────────────────────
function FertilizerTab() {
  const [crop, setCrop] = useState('');
  const [n, setN] = useState('');
  const [p, setP] = useState('');
  const [k, setK] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setResult(null);
    if ([n, p, k].includes('Unknown')) {
      setError('We cannot suggest a fertilizer dose without your soil test. Get a free Soil Health Card from your nearest Krishi Vigyan Kendra / Raitha Samparka Kendra, then enter the N, P, K values here. / ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ ಇಲ್ಲದೆ ಗೊಬ್ಬರದ ಪ್ರಮಾಣ ಹೇಳಲು ಸಾಧ್ಯವಿಲ್ಲ. ಹತ್ತಿರದ ರೈತ ಸಂಪರ್ಕ ಕೇಂದ್ರ / ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರದಲ್ಲಿ ಉಚಿತ ಮಣ್ಣು ಆರೋಗ್ಯ ಕಾರ್ಡ್ ಪಡೆಯಿರಿ.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/agri/fertilizer-recommendation', {
        crop, nitrogenLevel: n, phosphorusLevel: p, potassiumLevel: k,
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not get a recommendation right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={cardTitle}>Fertilizer dose based on your soil test</h2>
      <p style={cardSub}>
        Enter the N/P/K levels from your Soil Health Card (ಮಣ್ಣು ಆರೋಗ್ಯ ಕಾರ್ಡ್) — Low, Medium or High.
        The dose is a simple rule: full crop dose for Low, half for Medium, small maintenance dose for High. If you have no soil test, we will not guess. A certified soil health card or Krishi Vigyan Kendra recommendation should be preferred when available.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select required value={crop} onChange={(e) => setCrop(e.target.value)} className={inputCls} style={{ gridColumn: '1 / -1' }}>
          <option value="">Crop…</option>
          {FERTILIZER_CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select required value={n} onChange={(e) => setN(e.target.value)} className={inputCls}>
          <option value="">Nitrogen (N) level…</option>
          {NPK_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select required value={p} onChange={(e) => setP(e.target.value)} className={inputCls}>
          <option value="">Phosphorus (P) level…</option>
          {NPK_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select required value={k} onChange={(e) => setK(e.target.value)} className={inputCls}>
          <option value="">Potassium (K) level…</option>
          {NPK_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Calculating…' : 'Get Fertilizer Dose'}
        </button>
      </form>

      {error && <p style={errorBox}>{error}</p>}

      {result?.success && (
        <div style={{ ...resultBox, marginTop: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Recommended dose for {result.crop} (per acre):</p>
          <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
            <span><strong>N:</strong> {result.recommendedDoseKgPerAcre.N} kg</span>
            <span><strong>P:</strong> {result.recommendedDoseKgPerAcre.P} kg</span>
            <span><strong>K:</strong> {result.recommendedDoseKgPerAcre.K} kg</span>
          </div>
          {result.breakdown?.length > 0 && (
            <details style={{ marginBottom: 10 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How was this calculated? / ಹೇಗೆ ಲೆಕ್ಕ ಹಾಕಲಾಯಿತು?</summary>
              <ul style={{ margin: '6px 0 0 18px' }}>
                {result.breakdown.map((b) => <li key={b.nutrient}><strong>{b.nutrient}:</strong> {b.formula}</li>)}
              </ul>
            </details>
          )}
          {result.advice?.length > 0 && (
            <ul style={{ margin: '0 0 8px 18px' }}>
              {result.advice.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
          <p style={disclaimer}>{result.note}</p>
        </div>
      )}
    </div>
  );
}

// ── Price Trend & Harvest Advice ────────────────────────────────────────
function PriceTrendTab() {
  const [district, setDistrict] = useState('');
  const [commodity, setCommodity] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const params = new URLSearchParams({ district, commodity });
      const { data } = await api.get(`/agri/harvest-advice?${params}`);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not get advice right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={cardTitle}>Should I sell now or wait?</h2>
      <p style={cardSub}>
        Based on price movement we've actually observed for this crop in this district over the last few days —
        a heuristic, not a forecast or a guarantee.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select required value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls}>
          <option value="">District…</option>
          {KARNATAKA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select required value={commodity} onChange={(e) => setCommodity(e.target.value)} className={inputCls}>
          <option value="">Commodity…</option>
          {COMMON_COMMODITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Checking…' : 'Get Advice'}
        </button>
      </form>

      {error && <p style={errorBox}>{error}</p>}

      {result && !result.available && (
        <p style={{ ...disclaimer, marginTop: 12, fontSize: '0.85rem', color: '#b45309' }}>
          {result.message}
        </p>
      )}

      {result?.available && (
        <div style={{ ...resultBox, marginTop: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 6, textTransform: 'capitalize' }}>
            Trend: {result.direction} ({result.changePercent >= 0 ? '+' : ''}{result.changePercent}% over {result.dayCount} days)
          </p>
          <p style={{ marginBottom: 8 }}>{result.message}</p>
          <p style={disclaimer}>{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

// ── Suggested Market ─────────────────────────────────────────────────────
function SuggestedMarketTab() {
  const [fromDistrict, setFromDistrict] = useState('');
  const [commodity, setCommodity] = useState('');
  const [quintals, setQuintals] = useState('1');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const params = new URLSearchParams({ fromDistrict, commodity, quintals: quintals || '1', state: 'Karnataka' });
      const { data } = await api.get(`/agri/suggested-market?${params}`);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not suggest markets right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={cardTitle}>Which nearby market pays best, after transport?</h2>
      <p style={cardSub}>
        Compares real government-published prices across markets — transport cost is an estimate, always confirm
        actual cost before deciding.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <select required value={fromDistrict} onChange={(e) => setFromDistrict(e.target.value)} className={inputCls}>
          <option value="">Your district…</option>
          {KARNATAKA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select required value={commodity} onChange={(e) => setCommodity(e.target.value)} className={inputCls}>
          <option value="">Commodity…</option>
          {COMMON_COMMODITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="number" min="1" placeholder="Quintals" value={quintals}
          onChange={(e) => setQuintals(e.target.value)} className={inputCls}
        />
        <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Comparing…' : 'Suggest Markets'}
        </button>
      </form>

      {error && <p style={errorBox}>{error}</p>}

      {result?.options?.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {['Market', 'District', 'Avg. Price/Quintal', 'Distance', 'Est. Transport', 'Net After Transport'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.options.map((o, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9', background: i === 0 ? '#f0fdf4' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontWeight: i === 0 ? 700 : 400 }}>{o.market} {i === 0 && '🏆'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{o.district}</td>
                  <td style={{ padding: '10px 12px' }}>₹{o.avgModalPricePerQuintal}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{o.distanceKm != null ? `${o.distanceKm} km` : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{o.estimatedTransportCost != null ? `₹${o.estimatedTransportCost}` : '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>₹{o.netPricePerQuintalAfterTransport}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...disclaimer, padding: '0 12px 12px' }}>{result.disclaimer}</p>
        </div>
      )}

      {result && result.options?.length === 0 && (
        <p style={{ ...disclaimer, marginTop: 12, fontSize: '0.85rem' }}>
          No current price records found for that commodity to compare markets against.
        </p>
      )}
    </div>
  );
}

// ── Weather Alerts ───────────────────────────────────────────────────────
// Calls GET /api/agri/weather-alerts (rule-based alerts over the 5-day
// OpenWeatherMap forecast). Failures (no API key, offline, unknown district)
// are shown as a plain message and never break the other tabs.
const SEVERITY_STYLE = {
  high:   { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', label: 'High' },
  medium: { bg: '#fffbeb', border: '#fde68a', color: '#b45309', label: 'Medium' },
  low:    { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', label: 'Low' },
};

function WeatherAlertsTab() {
  const [district, setDistrict] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const params = new URLSearchParams({ district });
      const { data } = await api.get(`/agri/weather-alerts?${params}`);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Weather service is not reachable right now. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={cardTitle}>Weather alerts for farming / ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ</h2>
      <p style={cardSub}>
        Rule-based alerts from the 5-day forecast (rain, heat, cold, wind). Each alert shows the values that triggered it.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select required value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls}>
          <option value="">District…</option>
          {KARNATAKA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Checking…' : 'Get Weather Alerts'}
        </button>
      </form>

      {error && <p style={errorBox}>{error}</p>}

      {result?.success && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>
            Forecast for <strong>{result.city || result.district}</strong>
            {result.stale ? ' (showing last saved forecast — live service was unreachable)' : ''}
          </p>
          {(result.alerts || []).map((a, i) => {
            const st = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.low;
            return (
              <div key={i} style={{
                background: st.bg, border: `1px solid ${st.border}`, borderRadius: 10,
                padding: 14, marginBottom: 10, fontSize: '0.875rem',
              }}>
                <span style={{ color: st.color, fontWeight: 700, marginRight: 8 }}>
                  {st.label}
                </span>
                {a.message}
              </div>
            );
          })}
        </div>
      )}

      <p style={disclaimer}>Source: OpenWeatherMap forecast. Alerts are advisory only.</p>
    </div>
  );
}