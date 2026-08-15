import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ComplaintCard from '../components/ComplaintCard';
import StatsCard from '../components/StatsCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { CATEGORIES, STATUS_LIST } from '../utils/helpers';

import {
  FilePlus,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
} from 'lucide-react';

import toast from 'react-hot-toast';

export default function UserDashboard() {
  const { user } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const [darkMode, setDarkMode] = useState(false);

  const [filters, setFilters] = useState({
    status: '',
    category: '',
    search: '',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const [stats, setStats] = useState({
    total: 0,
    Pending: 0,
    'In Progress': 0,
    Resolved: 0,
  });

  // Toggle Dark Mode
  const toggleDark = () => {
    setDarkMode((d) => {
      document.documentElement.classList.toggle('dark', !d);
      return !d;
    });
  };

  // Fetch Complaints
  const fetchComplaints = useCallback(
    async (page = 1) => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page,
          limit: 9,
        });

        if (filters.status) {
          params.append('status', filters.status);
        }

        if (filters.category) {
          params.append('category', filters.category);
        }

        if (filters.search) {
          params.append('search', filters.search);
        }

        const { data } = await api.get(
          `/complaints/my?${params}`
        );

        setComplaints(data.complaints);

        setPagination({
          page: data.page,
          pages: data.pages,
          total: data.total,
        });

        if (data.stats) setStats(data.stats);

      } catch (error) {
        toast.error('Failed to load complaints');
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    fetchComplaints(1);
  }, [fetchComplaints]);

  // Complaint Stats (independent of active search/filter)
  const counts = {
    total: stats.total,
    pending: stats.Pending,
    inProgress: stats['In Progress'],
    resolved: stats.Resolved,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      <Navbar
        darkMode={darkMode}
        toggleDark={toggleDark}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary-600 to-green-500 rounded-2xl p-6 mb-8 text-white shadow-lg">

          <h2 className="text-2xl font-bold">
            Welcome back, {user?.name}! 👋
          </h2>

          <p className="text-primary-100 mt-1 text-sm">
            {user?.village
              ? `${user.village} — `
              : ''}
            Track and manage your civic issue reports.
          </p>

          {/* Report Button */}
          <Link
            to="/report"
            className="inline-flex items-center gap-2 mt-5 bg-white text-primary-700 font-semibold px-4 py-2 rounded-xl text-sm hover:bg-primary-50 transition-colors"
          >
            <FilePlus size={16} />
            Report New Issue
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">

          <StatsCard
            label="Total Reports"
            value={counts.total}
            icon={FileText}
            color="primary"
          />

          <StatsCard
            label="Pending"
            value={counts.pending}
            icon={Clock}
            color="yellow"
          />

          <StatsCard
            label="In Progress"
            value={counts.inProgress}
            icon={Filter}
            color="blue"
          />

          <StatsCard
            label="Resolved"
            value={counts.resolved}
            icon={CheckCircle}
            color="green"
          />
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6 flex flex-wrap gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">

            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              placeholder="Search by title or tracking ID…"
              value={filters.search}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  search: e.target.value,
                })
              }
              className="input-field pl-9 text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({
                ...filters,
                status: e.target.value,
              })
            }
            className="input-field text-sm min-w-[130px] flex-shrink-0"
          >
            <option value="">
              All Status
            </option>

            {STATUS_LIST.map((s) => (
              <option key={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters({
                ...filters,
                category: e.target.value,
              })
            }
            className="input-field text-sm min-w-[160px] flex-shrink-0"
          >
            <option value="">
              All Categories
            </option>

            {CATEGORIES.map((c) => (
              <option key={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Clear Button */}
          {(filters.status ||
            filters.category ||
            filters.search) && (
            <button
              onClick={() =>
                setFilters({
                  status: '',
                  category: '',
                  search: '',
                })
              }
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <XCircle size={14} />
              Clear
            </button>
          )}
        </div>

        {/* Complaints Section */}
        {loading ? (

          <div className="flex justify-center py-20">
            <LoadingSpinner
              size="lg"
              text="Loading complaints…"
            />
          </div>

        ) : complaints.length === 0 ? (

          <div className="text-center py-20">

            <div className="text-6xl mb-4">
              📋
            </div>

            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              No complaints found
            </h3>

            <p className="text-gray-400 text-sm mt-1">
              {filters.search ||
              filters.status ||
              filters.category
                ? 'Try clearing your filters'
                : 'You have not reported any issues yet'}
            </p>

            {!filters.search &&
              !filters.status &&
              !filters.category && (
                <Link
                  to="/report"
                  className="inline-flex items-center gap-2 mt-4 btn-primary text-sm"
                >
                  <FilePlus size={14} />
                  Report Your First Issue
                </Link>
              )}
          </div>

        ) : (

          <>
            {/* Complaint Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {complaints.map((c) => (
                <ComplaintCard
                  key={c._id}
                  complaint={c}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-center gap-2 mt-8">

                {Array.from(
                  { length: pagination.pages },
                  (_, i) => i + 1
                ).map((p) => (

                  <button
                    key={p}
                    onClick={() =>
                      fetchComplaints(p)
                    }
                    className={`w-9 h-9 rounded-lg text-sm font-medium ${
                      pagination.page === p
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}