import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { STATUS_COLORS, PRIORITY_COLORS, CATEGORY_ICONS, formatDateTime } from '../utils/helpers';
import { Search, ArrowLeft, Hash, Clock, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ComplaintTracking() {
  const { user } = useAuth();
  const [trackingId, setTrackingId] = useState('');
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return toast.error('Please enter a tracking ID');
    setLoading(true);
    setSearched(false);
    try {
      const { data } = await api.get(`/complaints/track/${trackingId.trim().toUpperCase()}`);
      setComplaint(data.complaint);
      setSearched(true);
    } catch (err) {
      setComplaint(null);
      setSearched(true);
      if (err.response?.status === 404) toast.error('No complaint found with this tracking ID');
      else toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const statusSteps = ['Pending', 'In Progress', 'Resolved'];
  const statusIndex = complaint ? statusSteps.indexOf(complaint.status) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-green-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-xl mx-auto pt-12 pb-20">
        {/* Back */}
        <Link
          to={
            user
              ? user.role === 'superadmin'
                ? '/superadmin/dashboard'
                : user.role === 'admin'
                ? '/admin/dashboard'
                : '/dashboard'
              : '/'
          }
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 mb-8"
        >
          <ArrowLeft size={15} /> {user ? 'Back to Dashboard' : 'Back to Home'}
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl text-2xl shadow-lg mb-3">
            🔍
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Track Your Complaint</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your tracking ID to check the status</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              placeholder="e.g. SV-ABC123-XY12"
              className="input-field pl-9 uppercase font-mono"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 flex-shrink-0">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={15} />}
            Track
          </button>
        </form>

        {/* Result */}
        {searched && !complaint && (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">❌</div>
            <p className="font-semibold text-gray-700 dark:text-gray-300">No complaint found</p>
            <p className="text-sm text-gray-400 mt-1">Check the tracking ID and try again</p>
          </div>
        )}

        {complaint && (
          <div className="card p-6 space-y-5 animate-fade-in">
            {/* Title & status */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">{complaint.title}</h2>
                <div className="flex items-center gap-1 mt-1">
                  <Hash size={11} className="text-gray-400" />
                  <span className="text-xs font-mono text-gray-400">{complaint.trackingId}</span>
                </div>
              </div>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[complaint.status]}`}>
                {complaint.status}
              </span>
            </div>

            {/* Progress bar */}
            {complaint.status !== 'Rejected' && (
              <div>
                <div className="flex justify-between mb-2">
                  {statusSteps.map((s, i) => (
                    <span key={s} className={`text-xs font-medium ${i <= statusIndex ? 'text-primary-600' : 'text-gray-400'}`}>{s}</span>
                  ))}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${statusIndex < 0 ? 0 : (statusIndex / (statusSteps.length - 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Category</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">{CATEGORY_ICONS[complaint.category]} {complaint.category}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Priority</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[complaint.priority]}`}>{complaint.priority}</span>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Submitted</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{formatDateTime(complaint.createdAt)}</p>
              </div>
              {complaint.locationName && (
                <div>
                  <p className="text-gray-400 text-xs">Location</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"><MapPin size={11} />{complaint.locationName}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-gray-400 text-xs mb-1">Description</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{complaint.description}</p>
            </div>

            {complaint.adminNote && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                <span className="font-semibold">Admin Note: </span>{complaint.adminNote}
              </div>
            )}

            {/* Status history */}
            {complaint.statusHistory?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Status History</p>
                <div className="space-y-2">
                  {complaint.statusHistory.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <Clock size={11} className="text-gray-400 flex-shrink-0" />
                      <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[h.status]}`}>{h.status}</span>
                      <span className="text-gray-400">{formatDateTime(h.changedAt)}</span>
                      {h.note && <span className="text-gray-500">— {h.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}