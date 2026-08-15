import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, User, MapPin, ChevronRight, FileText, CheckCircle, Clock } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex flex-col">

      {/* ── Header ── */}
      <header className="py-5 px-6 flex items-center justify-between border-b border-white/60 backdrop-blur-sm bg-white/40 dark:bg-gray-900/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-xl shadow">🌾</div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white leading-tight text-lg">Smart Village</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Civic Issue Reporting System</p>
          </div>
        </div>
        <Link to="/track" className="text-sm text-primary-600 font-medium hover:underline flex items-center gap-1">
          Track Complaint <ChevronRight size={14} />
        </Link>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-12 max-w-2xl">
          <span className="inline-block text-sm font-semibold text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-4 py-1.5 rounded-full mb-4">
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 leading-tight">
            Report Civic Issues<br />
            <span className="text-primary-600">Get Them Resolved</span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Submit complaints about roads, water, lights, drainage & more.
            Track status in real-time. Empower your village.
          </p>
        </div>

        {/* ── Login Cards ── */}
        <div className="grid sm:grid-cols-2 gap-6 w-full max-w-2xl mb-12">

          {/* User Card */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-50/60 to-transparent dark:from-primary-900/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-2xl flex items-center justify-center mb-5 text-primary-600">
                <User size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Citizen Login</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                Report local civic issues, track complaints and view resolution status.
              </p>
              <div className="space-y-2 mb-7">
                {['Submit complaints', 'Upload photos & location', 'Track status in real-time'].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle size={14} className="text-primary-500 flex-shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <Link to="/login" className="btn-primary text-center text-sm">
                  Login as Citizen →
                </Link>
                <Link to="/register" className="btn-secondary text-center text-sm">
                  New? Register here
                </Link>
              </div>
            </div>
          </div>

          {/* Admin Card */}
          <div className="group relative bg-gray-900 dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-700 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-16 h-16 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl flex items-center justify-center mb-5 text-indigo-400">
                <Shield size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Admin Portal</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Panchayat officials manage, update and resolve citizen complaints.
              </p>
              <div className="space-y-2 mb-7">
                {['Village-wise dashboard', 'Update complaint status', 'Manage users & reports'].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle size={14} className="text-indigo-400 flex-shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <Link
                to="/admin/login"
                className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-5 rounded-xl transition-all duration-200 shadow hover:shadow-indigo-500/25 text-sm"
              >
                Admin Login →
              </Link>
            </div>
          </div>
        </div>

        
      </main>

      <footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
        Smart Village Platform · Powered by Digital India Initiative
      </footer>
    </div>
  );
}
