import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import MapComponent from '../components/MapComponent';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../utils/api';
import { CATEGORIES, STATUS_LIST, CATEGORY_ICONS, STATUS_COLORS } from '../utils/helpers';
import { MapPin, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ComplaintMap() {
  const [complaints, setComplaints] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [filters, setFilters] = useState({ status: '', category: '' });

  const toggleDark = () => {
    setDarkMode((d) => { document.documentElement.classList.toggle('dark', !d); return !d; });
  };

  useEffect(() => {
    api.get('/complaints/locations')
      .then(({ data }) => { setComplaints(data.complaints); setFiltered(data.complaints); })
      .catch(() => toast.error('Failed to load map data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = complaints;
    if (filters.status)   result = result.filter((c) => c.status === filters.status);
    if (filters.category) result = result.filter((c) => c.category === filters.category);
    setFiltered(result);
  }, [filters, complaints]);

  const legend = [
    { label: 'Pending',     color: '#f59e0b' },
    { label: 'In Progress', color: '#3b82f6' },
    { label: 'Resolved',    color: '#22c55e' },
    { label: 'Rejected',    color: '#ef4444' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar darkMode={darkMode} toggleDark={toggleDark} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin size={24} className="text-primary-600" /> Issue Map
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Showing {filtered.length} of {complaints.length} complaints with location data
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input-field text-sm min-w-[130px]"
            >
              <option value="">All Status</option>
              {STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="input-field text-sm min-w-[160px]"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            {(filters.status || filters.category) && (
              <button onClick={() => setFilters({ status: '', category: '' })} className="btn-secondary text-sm">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="card p-3 mb-4 flex flex-wrap gap-4">
          {legend.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>

        {/* Complaint list — shown above the map so it's immediately visible */}
        {!loading && filtered.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Complaints with location data ({filtered.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((c) => (
                <div key={c._id} className="card p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-800 dark:text-white line-clamp-1">{c.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                  </div>
                  <p className="text-xs text-gray-500">{CATEGORY_ICONS[c.category]} {c.category}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPin size={10} /> {c.latitude?.toFixed(4)}, {c.longitude?.toFixed(4)}
                    {c.locationName && ` — ${c.locationName}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🗺️</div>
            <p className="text-gray-500">No complaints with location data match your filters</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24"><LoadingSpinner size="lg" text="Loading map data…" /></div>
        ) : (
          <div className="card p-2">
            <MapComponent complaints={filtered} height="580px" />
          </div>
        )}
      </main>
    </div>
  );
}
