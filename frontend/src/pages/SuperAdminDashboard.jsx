/**
 * SuperAdminDashboard.jsx — Smart Village
 *
 * Super admin view: state-wide analytics, district coverage, and
 * district-admin account management. No villages/taluks — districts only.
 */

import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Globe, Users, MapPin, Plus, Trash2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { KARNATAKA_DISTRICTS } from '../utils/districts';

const TABS = [
  { id: 'analytics', label: 'Analytics', icon: Globe },
  { id: 'districts', label: 'Districts', icon: MapPin },
  { id: 'admins',    label: 'Admins',    icon: Users },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function SuperAdminDashboard() {
  const [tab,       setTab]       = useState('analytics');
  const [analytics, setAnalytics] = useState(null);
  const [admins,    setAdmins]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [darkMode,  setDarkMode]  = useState(false);

  // Create district admin form
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminForm,    setAdminForm]    = useState({ name: '', email: '', password: '', mobile: '', district: '' });

  const toggleDark = () => {
    setDarkMode((d) => { document.documentElement.classList.toggle('dark', !d); return !d; });
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [aRes, adRes] = await Promise.all([
        api.get('/superadmin/analytics'),
        api.get('/superadmin/admins'),
      ]);
      setAnalytics(aRes.data);
      setAdmins(adRes.data.admins);
    } catch (err) {
      toast.error('Failed to load super admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleAddAdmin = async () => {
    if (!adminForm.name || !adminForm.email || !adminForm.password || !adminForm.mobile) {
      return toast.error('Name, email, password and mobile are required');
    }
    if (!adminForm.district) {
      return toast.error('Please select the district this admin will manage');
    }
    try {
      await api.post('/superadmin/admins', adminForm);
      toast.success('District admin created!');
      setShowAddAdmin(false);
      setAdminForm({ name: '', email: '', password: '', mobile: '', district: '' });
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create admin');
    }
  };

  const handleDeleteAdmin = async (id, name) => {
    if (!window.confirm(`Delete admin ${name}?`)) return;
    try {
      await api.delete(`/superadmin/admins/${id}`);
      toast.success('Admin deleted');
      loadAll();
    } catch {
      toast.error('Failed to delete admin');
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

  // District name -> assigned admin (if any)
  const adminByDistrict = {};
  admins.forEach((a) => { if (a.district) adminByDistrict[a.district] = a; });

  // District name -> complaint count (from analytics)
  const countByDistrict = {};
  (analytics?.districtStats || []).forEach((d) => { countByDistrict[d._id] = d.count; });

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50'}`}>
      <Navbar darkMode={darkMode} toggleDark={toggleDark} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="text-purple-600" size={24} />
            Super Admin Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            State-wide oversight · district admin management ·
            {' '}{analytics?.stats?.districtsCovered ?? 0} of {analytics?.stats?.totalDistricts ?? KARNATAKA_DISTRICTS.length} districts have complaints logged
          </p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                tab === id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Analytics Tab ── */}
        {tab === 'analytics' && analytics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                ['Total Complaints', analytics.stats.totalComplaints],
                ['District Admins', analytics.stats.totalAdmins],
                ['Registered Citizens', analytics.stats.totalUsers],
                ['Districts Covered', `${analytics.stats.districtsCovered}/${analytics.stats.totalDistricts}`],
              ].map(([label, value]) => (
                <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* District-wise bar chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Complaints by District</h3>
                {analytics.districtStats?.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analytics.districtStats.map((d) => ({ name: d._id, count: d.count }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count">
                        {analytics.districtStats.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-8">No district data yet</p>
                )}
              </div>

              {/* Category breakdown */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Complaints by Category</h3>
                {analytics.categoryStats?.length ? (
                  <ul className="space-y-2">
                    {analytics.categoryStats.slice(0, 7).map((c, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="flex-1 text-gray-700 dark:text-gray-300">{c._id}</span>
                        <span className="font-semibold text-gray-800 dark:text-white">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Districts Tab ── */}
        {tab === 'districts' && (
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white mb-4">
              Karnataka Districts ({KARNATAKA_DISTRICTS.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {KARNATAKA_DISTRICTS.map((d) => {
                const admin = adminByDistrict[d];
                const count = countByDistrict[d] || 0;
                return (
                  <div key={d} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-1">
                        <MapPin size={14} className="text-purple-500" /> {d}
                      </h3>
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                        {count} complaint{count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="mt-3">
                      {admin ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                          <UserCheck size={12} /> {admin.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-500 px-2 py-1 rounded-full">
                          No admin assigned yet
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Admins Tab ── */}
        {tab === 'admins' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-800 dark:text-white">District Admin Accounts ({admins.length})</h2>
              <button onClick={() => setShowAddAdmin(!showAddAdmin)}
                className="flex items-center gap-1 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 transition">
                <Plus size={14} /> Create District Admin
              </button>
            </div>

            {/* Create Admin Form */}
            {showAddAdmin && (
              <div className="bg-purple-50 dark:bg-gray-800 border border-purple-200 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                <input className={inputCls} placeholder="Name" value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
                <input className={inputCls} placeholder="Email" type="email" value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
                <input className={inputCls} placeholder="Password" type="password" value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
                <input className={inputCls} placeholder="Mobile (10 digits)" value={adminForm.mobile}
                  onChange={(e) => setAdminForm({ ...adminForm, mobile: e.target.value })} />
                <select className={inputCls} value={adminForm.district}
                  onChange={(e) => setAdminForm({ ...adminForm, district: e.target.value })}>
                  <option value="">Assign district *</option>
                  {KARNATAKA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="flex gap-2 items-end">
                  <button onClick={handleAddAdmin} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">Create</button>
                  <button onClick={() => setShowAddAdmin(false)} className="border px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Name', 'Email', 'Mobile', 'District', 'Created', 'Action'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {admins.map((a) => (
                    <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{a.name}</td>
                      <td className="px-4 py-3 text-gray-500">{a.email}</td>
                      <td className="px-4 py-3 text-gray-500">{a.mobile || '—'}</td>
                      <td className="px-4 py-3">
                        {a.district ? (
                          <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">{a.district}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">— unassigned —</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(a.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteAdmin(a._id, a.name)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {admins.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-gray-400 py-10">No district admins created yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}