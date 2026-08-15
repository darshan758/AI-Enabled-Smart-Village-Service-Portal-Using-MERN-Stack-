import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, LogIn, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.identifier || !form.password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      const user = await login(form.identifier, form.password);
      if (!['admin', 'superadmin'].includes(user.role)) {
        // Not an admin — clear the session immediately so the person
        // isn't left silently authenticated (and auto-redirected) as a citizen.
        logout();
        toast.error('Access denied. You are not authorized to access the admin portal.');
        return;
      }
      toast.success(`Welcome, ${user.name}!`);
      navigate(user.role === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-900/30 via-gray-900 to-gray-900 pointer-events-none" />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors">
          <ArrowLeft size={15} /> Back to Home
        </Link>

        {/* Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-3xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mb-4">
              <Shield size={32} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
            <p className="text-gray-500 text-sm mt-1">Smart Village Management System</p>
          </div>

          {/* Info badge */}
          <div className="mb-6 p-3 bg-indigo-900/30 border border-indigo-700/40 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
            <Shield size={13} className="flex-shrink-0" />
            Restricted access. Authorized personnel only.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Admin Email or Admin ID
              </label>
              <input
                name="identifier"
                type="text"
                value={form.identifier}
                onChange={handleChange}
                placeholder="admin@village.com or SV2026-ADMIN-001"
                className="w-full px-4 py-2.5 border border-gray-600 rounded-xl bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-600 rounded-xl bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-5 rounded-xl transition-all duration-200 shadow hover:shadow-indigo-500/30 mt-2"
            >
              {loading
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <LogIn size={16} />}
              {loading ? 'Verifying…' : 'Access Admin Panel'}
            </button>
          </form>

          
        </div>

        <p className="text-center text-sm text-gray-600 mt-5">
          Not an admin?{' '}
          <Link to="/login" className="text-primary-500 hover:text-primary-400 font-medium">
            Citizen Login →
          </Link>
        </p>
      </div>
    </div>
  );
}