import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import Navbar from '../components/Navbar';
import StatsCard from '../components/StatsCard';
import LoadingSpinner from '../components/LoadingSpinner';
import LiveComplaintMap from '../components/LiveComplaintMap';
import PerformancePanel from '../components/PerformancePanel';
import VoicePlayer from '../components/VoicePlayer';

import api from '../utils/api';

import {
  CATEGORIES,
  STATUS_LIST,
  PRIORITY_LIST,
  CATEGORY_COLORS,
  timeAgo,
} from '../utils/helpers';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import {
  Users,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Trash2,
  BarChart2,
  MapPin,
  Gauge,
  Camera,
  Download,
  Printer,
  UserCog,
  ImageIcon,
  Building2,
} from 'lucide-react';

import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';


// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'complaints', label: 'Complaints', icon: FileText },
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'map', label: 'Live Map', icon: MapPin },
  { id: 'performance', label: 'Performance', icon: Gauge },
];


// ─────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  Pending: 'bg-yellow-100 text-yellow-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  Resolved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
};


// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {

  const { user } = useAuth();

  const [tab, setTab] = useState('overview');

  const [stats, setStats] = useState(null);

  const [complaints, setComplaints] = useState([]);

  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [darkMode, setDarkMode] = useState(false);

  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
    district: '',
    search: '',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const [selectedComplaint, setSelectedComplaint] = useState(null);

  const [statusForm, setStatusForm] = useState({
    status: '',
    adminNote: '',
  });

  // FIXED
  const [updating, setUpdating] = useState(null);

  // ── Worker proof verification (Admin keeps oversight ability to verify/
  // reject a worker's submitted proof, same as a Department can — but
  // Admin no longer creates worker accounts or assigns them to complaints;
  // that's exclusively the owning Department's job now.) ──────────────────
  // The complaint currently open in the "review worker proof" modal.
  const [reviewComplaint, setReviewComplaint] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');

  const openVerifyModal = (complaint) => {
    setVerifyNote('');
    setReviewComplaint(complaint);
  };

  const handleVerifyWork = async (approved) => {
    if (!reviewComplaint) return;
    setVerifying(true);
    try {
      const { data } = await api.post(
        `/admin/complaints/${reviewComplaint._id}/verify-work`,
        { approved, note: verifyNote.trim() || undefined }
      );
      setComplaints((prev) =>
        prev.map((c) => (c._id === reviewComplaint._id ? data.complaint : c))
      );
      toast.success(
        approved ? 'Work verified — complaint resolved' : 'Sent back to worker'
      );
      setReviewComplaint(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setVerifying(false);
    }
  };

  // Human-readable label + color for the compact worker-stage badge.
  const WORKER_STAGE_LABEL = {
    NotAssigned: 'Not assigned',
    Assigned: 'Assigned',
    Accepted: 'Accepted',
    LocationConfirmed: 'On site',
    Working: 'Working',
    ProofSubmitted: 'Proof submitted',
    Verified: 'Verified',
  };

  const WORKER_STAGE_COLOR = {
    Assigned: 'bg-gray-100 text-gray-700',
    Accepted: 'bg-blue-100 text-blue-700',
    LocationConfirmed: 'bg-indigo-100 text-indigo-700',
    Working: 'bg-amber-100 text-amber-700',
    ProofSubmitted: 'bg-purple-100 text-purple-700',
    Verified: 'bg-green-100 text-green-700',
  };

  // Tracks complaint/resolution photo URLs that failed to load, so we can
  // show a graceful "unavailable" state instead of a broken link/404 page.
  const [brokenImages, setBrokenImages] = useState(() => new Set());

  const markImageBroken = (url) => {
    setBrokenImages((prev) => {
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };


  // ─────────────────────────────────────────────────────────
  // Dark Mode
  // ─────────────────────────────────────────────────────────

  const toggleDark = () => {

    setDarkMode((prev) => {

      document.documentElement.classList.toggle(
        'dark',
        !prev
      );

      return !prev;
    });
  };


  // ─────────────────────────────────────────────────────────
  // Initial Load
  // ─────────────────────────────────────────────────────────

  useEffect(() => {

    const loadInitial = async () => {

      setLoading(true);

      try {

        const { data } = await api.get('/admin/stats');

        setStats(data);

      } catch (err) {

        toast.error(
          'Failed to load dashboard'
        );

      } finally {

        setLoading(false);
      }
    };

    loadInitial();

  }, []);


  // ─────────────────────────────────────────────────────────
  // Fetch Complaints
  // ─────────────────────────────────────────────────────────

  const fetchComplaints = useCallback(
    async (page = 1) => {

      const params = new URLSearchParams({
        page,
        limit: 12,
      });

      if (filters.status) {
        params.append('status', filters.status);
      }

      if (filters.category) {
        params.append(
          'category',
          filters.category
        );
      }

      if (filters.priority) {
        params.append(
          'priority',
          filters.priority
        );
      }

      if (filters.district) {
        params.append(
          'district',
          filters.district
        );
      }

      if (filters.search) {
        params.append(
          'search',
          filters.search
        );
      }

      try {

        const { data } = await api.get(
          `/admin/complaints?${params}`
        );

        setComplaints(data.complaints);

        setPagination({
          page: data.page,
          pages: data.pages,
          total: data.total,
        });

      } catch {

        toast.error(
          'Failed to load complaints'
        );
      }

    },
    [filters]
  );


  useEffect(() => {

    if (tab === 'complaints') {
      fetchComplaints(1);
    }

  }, [tab, fetchComplaints]);


  // ─────────────────────────────────────────────────────────
  // Fetch Users
  // ─────────────────────────────────────────────────────────

  useEffect(() => {

    if (tab === 'users') {

      api.get('/admin/users')

        .then(({ data }) => {
          setUsers(data.users);
        })

        .catch(() => {
          toast.error(
            'Failed to load users'
          );
        });
    }

  }, [tab]);



  // ─────────────────────────────────────────────────────────
  // Fetch Departments list (for the Departments tab)
  // ─────────────────────────────────────────────────────────

  const [departmentsList, setDepartmentsList] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const emptyDepartmentForm = { name: '', email: '', password: '', mobile: '', departmentCategory: '' };
  const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm);
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // { created: [...] } shown once, has plaintext passwords

  const handleBulkCreateStandard = async () => {
    setBulkCreating(true);
    try {
      const { data } = await api.post('/admin/departments/bulk-create-standard');
      if (data.created.length === 0) {
        toast('Every standard department already exists for your district.');
      } else {
        setBulkResult(data.created);
        toast.success(`Created ${data.created.length} department account(s)`);
      }
      fetchDepartmentsList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create standard departments');
    } finally {
      setBulkCreating(false);
    }
  };

  const fetchDepartmentsList = async () => {
    setLoadingDepartments(true);
    try {
      const { data } = await api.get('/admin/departments');
      setDepartmentsList(data.departments);
    } catch (err) {
      toast.error('Failed to load departments');
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    setCreatingDepartment(true);
    try {
      await api.post('/admin/departments', departmentForm);
      toast.success('Department created');
      setDepartmentForm(emptyDepartmentForm);
      setShowAddDepartment(false);
      fetchDepartmentsList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create department');
    } finally {
      setCreatingDepartment(false);
    }
  };

  const handleToggleDepartment = async (id) => {
    try {
      await api.put(`/admin/departments/${id}/toggle`);
      fetchDepartmentsList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update department');
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm('Delete this department account?')) return;
    try {
      await api.delete(`/admin/departments/${id}`);
      toast.success('Department deleted');
      fetchDepartmentsList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete department');
    }
  };

  const [reassigningId, setReassigningId] = useState(null);
  const handleReassignDepartment = async (complaintId, departmentId) => {
    if (!departmentId) return;
    setReassigningId(complaintId);
    try {
      const { data } = await api.put(`/admin/complaints/${complaintId}/assign-department`, { departmentId });
      setComplaints((prev) => prev.map((c) => (c._id === complaintId ? { ...c, ...data.complaint } : c)));
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign department');
    } finally {
      setReassigningId(null);
    }
  };

  useEffect(() => {

    if (tab === 'departments' || tab === 'complaints') {
      fetchDepartmentsList();
    }

  }, [tab]);




  // ─────────────────────────────────────────────────────────
  // Instant Status Update
  // ─────────────────────────────────────────────────────────

  const updateStatus = async (
    complaintId,
    newStatus
  ) => {
    try {

      setUpdating(complaintId);

      const { data } = await api.put(
        `/admin/complaints/${complaintId}/status`,
        {
          status: newStatus,
        }
      );

      // Instant UI Update
      setComplaints((prev) =>
        prev.map((c) =>
          c._id === complaintId
            ? data.complaint
            : c
        )
      );

      toast.success(
        `Status updated to ${newStatus}`
      );

    } catch (err) {

      toast.error(
        err.response?.data?.message ||
        'Update failed'
      );

    } finally {

      setUpdating(null);
    }
  };


  // ─────────────────────────────────────────────────────────
  // Upload Resolution Photo (proof of fix)
  // ─────────────────────────────────────────────────────────

  const fileInputRefs = useRef({});

  const handlePhotoButtonClick = (complaintId) => {
    fileInputRefs.current[complaintId]?.click();
  };

  const handleResolutionPhotoSelected = async (complaintId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const { data } = await api.post(
        `/admin/complaints/${complaintId}/resolution-photo`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setComplaints((prev) =>
        prev.map((c) =>
          c._id === complaintId
            ? { ...c, resolutionPhoto: data.resolutionPhoto }
            : c
        )
      );

      toast.success('Resolution photo uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      e.target.value = '';
    }
  };


  // ─────────────────────────────────────────────────────────
  // Export Complaints (CSV — opens in Excel)
  // ─────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status)   params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.district) params.append('district', filters.district);
      if (filters.search)   params.append('search', filters.search);

      const res = await api.get(`/admin/complaints/export?${params}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `complaints-export-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };


  // ─────────────────────────────────────────────────────────
  // Print / Save-as-PDF report (no backend dependency — uses browser print)
  // ─────────────────────────────────────────────────────────

  const handlePrintReport = () => {
    const rows = complaints.map((c) => `
      <tr>
        <td>${c.trackingId}</td>
        <td>${c.title}</td>
        <td>${c.category}</td>
        <td>${c.priority}</td>
        <td>${c.status}</td>
        <td>${c.district || '—'}</td>
        <td>${c.user?.name || '—'}</td>
        <td>${new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Complaints Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            p { color: #666; font-size: 12px; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>Smart Village — Complaints Report</h1>
          <p>Generated ${new Date().toLocaleString('en-IN')} · ${complaints.length} complaint(s)</p>
          <table>
            <thead>
              <tr>
                <th>Tracking ID</th><th>Title</th><th>Category</th><th>Priority</th>
                <th>Status</th><th>District</th><th>Citizen</th><th>Date</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };


  // ─────────────────────────────────────────────────────────
  // Delete Complaint
  // ─────────────────────────────────────────────────────────

  const handleDelete = async (id) => {

    if (
      !window.confirm(
        'Delete this complaint permanently?'
      )
    ) {
      return;
    }

    try {

      await api.delete(
        `/admin/complaints/${id}`
      );

      setComplaints((prev) =>
        prev.filter((c) => c._id !== id)
      );

      toast.success(
        'Complaint deleted'
      );

    } catch {

      toast.error(
        'Delete failed'
      );
    }
  };


  // ─────────────────────────────────────────────────────────
  // Toggle User
  // ─────────────────────────────────────────────────────────

  const handleToggleUser = async (id) => {

    try {

      const { data } = await api.put(
        `/admin/users/${id}/toggle`
      );

      setUsers((prev) =>
        prev.map((u) =>
          u._id === id
            ? data.user
            : u
        )
      );

      toast.success(data.message);

    } catch {

      toast.error('Failed');
    }
  };


  // ─────────────────────────────────────────────────────────
  // Delete User (permanent)
  // ─────────────────────────────────────────────────────────

  const handleDeleteUser = async (id, name) => {

    if (!window.confirm(`Permanently delete ${name}'s account? This cannot be undone.`)) return;

    try {

      await api.delete(`/admin/users/${id}`);

      setUsers((prev) => prev.filter((u) => u._id !== id));

      toast.success('User deleted permanently');

    } catch (err) {

      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };


  // ─────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────

  if (loading) {

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

        <Navbar
          darkMode={darkMode}
          toggleDark={toggleDark}
        />

        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
        </div>

      </div>
    );
  }


  // ─────────────────────────────────────────────────────────
  // Chart Data
  // ─────────────────────────────────────────────────────────

  const categoryChartData =
    (stats?.categoryStats || []).map(
      (c) => ({
        name: c._id || 'Unknown',
        count: c.count,
        fill:
          CATEGORY_COLORS[c._id] ||
          '#8b5cf6',
      })
    );


  // ─────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────

  return (

    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      <Navbar
        darkMode={darkMode}
        toggleDark={toggleDark}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>

          <p className="text-gray-500 text-sm mt-1">
            Smart Village · Civic Issue Management
            {user?.district && (
              <span className="ml-2 inline-flex items-center gap-1 bg-primary-50 text-primary-700 text-xs font-medium px-2 py-0.5 rounded-full">
                <MapPin size={11} /> {user.district} District
              </span>
            )}
          </p>

        </div>


        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 mb-6 shadow-sm border border-gray-100 dark:border-gray-700 w-fit">

          {TABS.map(
            ({
              id,
              label,
              icon: Icon,
            }) => (

              <button
                key={id}
                onClick={() => setTab(id)}
                className={`
                  flex items-center gap-2
                  px-4 py-2 rounded-lg
                  text-sm font-medium transition-all

                  ${
                    tab === id
                      ? 'bg-primary-600 text-white shadow'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >

                <Icon size={15} />

                {label}

              </button>
            )
          )}

        </div>


        {/* LIVE MAP — every complaint with a location, updating in real time */}
        {tab === 'map' && <LiveComplaintMap endpoint="/admin/map/complaints" />}

        {/* PERFORMANCE — department response times, SLA breaches, SLA agent */}
        {tab === 'performance' && <PerformancePanel mode="admin" />}

        {/* OVERVIEW */}
        {tab === 'overview' &&
          stats && (

            <div className="space-y-6">

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

                <StatsCard
                  label="Total"
                  value={
                    stats.stats?.total || 0
                  }
                  icon={FileText}
                  color="blue"
                />

                <StatsCard
                  label="Pending"
                  value={
                    stats.stats?.pending || 0
                  }
                  icon={Clock}
                  color="yellow"
                />

                <StatsCard
                  label="In Progress"
                  value={
                    stats.stats?.inProgress || 0
                  }
                  icon={AlertTriangle}
                  color="primary"
                />

                <StatsCard
                  label="Resolved"
                  value={
                    stats.stats?.resolved || 0
                  }
                  icon={CheckCircle}
                  color="green"
                />

                <StatsCard
                  label="Rejected"
                  value={
                    stats.stats?.rejected || 0
                  }
                  icon={XCircle}
                  color="red"
                />

                <StatsCard
                  label="Citizens"
                  value={
                    stats.stats?.totalUsers || 0
                  }
                  icon={Users}
                  color="purple"
                />

              </div>

            </div>
          )}


        {/* COMPLAINTS */}
        {tab === 'complaints' && (

          <div className="space-y-4">

            {/* Export toolbar */}
            <div className="flex justify-end gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 px-3 py-2 rounded-lg border border-green-200"
              >
                <Download size={13} /> Export Excel (.xlsx)
              </button>
              <button
                onClick={handlePrintReport}
                className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200"
              >
                <Printer size={13} /> Print / Save PDF
              </button>
            </div>

            {/* Filters */}
            <div className="card p-4">

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

                <input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      search:
                        e.target.value,
                    })
                  }
                  placeholder="Search..."
                  className="input-field"
                />

                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      status:
                        e.target.value,
                    })
                  }
                  className="input-field"
                >

                  <option value="">
                    All Status
                  </option>

                  {STATUS_LIST.map((s) => (

                    <option
                      key={s}
                      value={s}
                    >
                      {s}
                    </option>

                  ))}

                </select>

                <button
                  onClick={() =>
                    fetchComplaints(1)
                  }
                  className="btn-primary flex items-center justify-center gap-2"
                >

                  <Search size={15} />

                  Filter

                </button>

              </div>

            </div>


            {/* Complaints Table */}
            <div className="card overflow-hidden">

              <div className="overflow-x-auto">

                <table className="w-full text-sm">

                  <thead className="bg-gray-50 dark:bg-gray-800 border-b">

                    <tr>

                      {[
                        'ID',
                        'Image',
                        'Title',
                        'Location',
                        'Status',
                        'Priority',
                        'Worker',
                        'Date',
                        'Actions',
                      ].map((h) => (

                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"
                        >
                          {h}
                        </th>

                      ))}

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">

                    {complaints.length === 0 ? (

                      <tr>

                        <td
                          colSpan={9}
                          className="text-center py-12 text-gray-400"
                        >
                          No complaints found.
                        </td>

                      </tr>

                    ) : (

                      complaints.map((c) => (

                        <tr
                          key={c._id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >

                          <td className="px-4 py-3 font-mono text-xs text-gray-500">
                            {c.trackingId}
                          </td>

                          <td className="px-4 py-3">
                            {c.image && !brokenImages.has(c.image) ? (
                              <a
                                href={c.image}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open full image"
                              >
                                <img
                                  src={c.image}
                                  alt="Complaint"
                                  onError={() => markImageBroken(c.image)}
                                  className="w-12 h-12 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition"
                                />
                              </a>
                            ) : c.image ? (
                              <span
                                className="text-xs text-red-400 italic"
                                title="This photo's file is missing from the server (e.g. lost/moved uploads folder)"
                              >
                                Image unavailable
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 italic">No image</span>
                            )}
                          </td>

                          <td className="px-4 py-3">

                            <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                              {c.title}
                              {c.isDuplicate && (
                                <span
                                  title="Flagged as a likely duplicate of an existing complaint"
                                  className="text-[10px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full"
                                >
                                  Duplicate
                                </span>
                              )}
                            </p>

                            <p className="text-xs text-gray-400">
                              {c.user?.name}
                            </p>

                            {c.voiceNote?.file && (
                              <div className="mt-1">
                                <VoicePlayer complaintId={c._id} durationSec={c.voiceNote.durationSec} />
                              </div>
                            )}

                          </td>

                          <td className="px-4 py-3">
                            {c.latitude != null && c.longitude != null ? (
                              <a
                                href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                                title="Open in Google Maps"
                              >
                                <MapPin size={11} />
                                {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                              </a>
                            ) : (
                              <span className="text-xs text-gray-300 italic">No location</span>
                            )}
                            {c.locationName && (
                              <p className="text-[11px] text-gray-400 mt-0.5">{c.locationName}</p>
                            )}
                          </td>


                          {/* FIXED STATUS */}
                          <td className="px-4 py-3">

                            <div className="flex items-center gap-2">

                              <select
                                value={c.status}

                                onChange={(e) =>
                                  updateStatus(
                                    c._id,
                                    e.target.value
                                  )
                                }

                                disabled={
                                  updating === c._id
                                }

                                className={`
                                  px-3 py-1.5 rounded-lg text-xs font-medium border-0 outline-none cursor-pointer

                                  ${
                                    c.status === 'Resolved'
                                      ? 'bg-green-100 text-green-800'

                                      : c.status === 'In Progress'
                                      ? 'bg-blue-100 text-blue-800'

                                      : c.status === 'Rejected'
                                      ? 'bg-red-100 text-red-800'

                                      : 'bg-yellow-100 text-yellow-800'
                                  }
                                `}
                              >

                                <option value="Pending">
                                  Pending
                                </option>

                                <option value="In Progress">
                                  In Progress
                                </option>

                                <option value="Resolved">
                                  Resolved
                                </option>

                                <option value="Rejected">
                                  Rejected
                                </option>

                              </select>

                              {updating === c._id && (

                                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />

                              )}

                            </div>

                          </td>


                          <td className="px-4 py-3">
                            {c.priority}
                          </td>

                          {/* Department ownership / worker stage / verify */}
                          <td className="px-4 py-3 min-w-[180px]">
                            {!c.assignedWorkers || c.assignedWorkers.length === 0 ? (
                              <div className="flex flex-col gap-1">
                                {c.assignedDepartment ? (
                                  <>
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">
                                      <Building2 size={12} /> {c.assignedDepartment.name}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium w-fit bg-amber-100 text-amber-700">
                                      Awaiting worker assignment
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-gray-400 italic">
                                    No department covers this category/district yet
                                  </span>
                                )}
                                <select
                                  value=""
                                  disabled={reassigningId === c._id}
                                  onChange={(e) => handleReassignDepartment(c._id, e.target.value)}
                                  className="text-[11px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-1.5 py-1 outline-none focus:ring-1 focus:ring-primary-500 w-fit max-w-[160px]"
                                >
                                  <option value="">
                                    {reassigningId === c._id ? 'Assigning…' : c.assignedDepartment ? 'Reassign to…' : 'Assign to…'}
                                  </option>
                                  {departmentsList
                                    .filter((d) => d.isActive)
                                    .map((d) => (
                                      <option key={d._id} value={d._id}>
                                        {d.departmentCategory} — {d.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {c.assignedWorkers.map((tw) => (
                                  <span key={tw.worker?._id || tw.worker} className="text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">
                                    <UserCog size={12} /> {tw.worker?.name || 'Worker'}{tw.worker?.teamSize > 1 ? ` (team of ${tw.worker.teamSize})` : ''}{tw.isLead ? ' (lead)' : ''}
                                  </span>
                                ))}
                                {c.assignedDepartment && (
                                  <span className="text-[10px] text-gray-400">
                                    via {c.assignedDepartment.name}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium w-fit ${
                                    WORKER_STAGE_COLOR[c.workerStage] || 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {c.assignedWorkers.length > 1 ? `Team (${c.assignedWorkers.length}) — ` : ''}
                                  {WORKER_STAGE_LABEL[c.workerStage] || c.workerStage}
                                </span>
                                {c.workerStage === 'ProofSubmitted' && (
                                  <button
                                    onClick={() => openVerifyModal(c)}
                                    className="text-[11px] bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-1 rounded-lg flex items-center gap-1 w-fit"
                                  >
                                    <ImageIcon size={11} /> Review proof
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-xs text-gray-400">
                            {timeAgo(
                              c.createdAt
                            )}
                          </td>

                          <td className="px-4 py-3">

                            <div className="flex items-center gap-1.5">

                              {c.status === 'Resolved' && (
                                <>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    ref={(el) => (fileInputRefs.current[c._id] = el)}
                                    onChange={(e) => handleResolutionPhotoSelected(c._id, e)}
                                    className="hidden"
                                  />

                                  {c.resolutionPhoto && !brokenImages.has(c.resolutionPhoto) ? (
                                    <a
                                      href={c.resolutionPhoto}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="View resolution photo"
                                    >
                                      <img
                                        src={c.resolutionPhoto}
                                        alt="Proof of resolution"
                                        onError={() => markImageBroken(c.resolutionPhoto)}
                                        className="w-7 h-7 rounded object-cover border border-green-300"
                                      />
                                    </a>
                                  ) : c.resolutionPhoto ? (
                                    <span
                                      className="text-[10px] text-red-400 italic"
                                      title="This photo's file is missing from the server"
                                    >
                                      unavailable
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handlePhotoButtonClick(c._id)}
                                      title="Upload proof-of-resolution photo"
                                      className="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded-lg"
                                    >
                                      <Camera size={12} />
                                    </button>
                                  )}
                                </>
                              )}

                              <button
                                onClick={() =>
                                  handleDelete(
                                    c._id
                                  )
                                }
                                className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded-lg"
                              >

                                <Trash2 size={12} />

                              </button>

                            </div>

                          </td>

                        </tr>

                      ))
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </div>
        )}


        {/* DEPARTMENTS */}
        {tab === 'departments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Departments {departmentsList.length > 0 && `(${departmentsList.length})`}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkCreateStandard}
                  disabled={bulkCreating}
                  className="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 dark:border-primary-800 dark:text-primary-400 disabled:opacity-50"
                >
                  {bulkCreating ? 'Setting up…' : '⚡ Quick Setup (all standard departments)'}
                </button>
                <button
                  onClick={() => setShowAddDepartment(true)}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <Building2 size={15} /> Add Department
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Not sure what departments a district needs? Click "Quick Setup" — it creates one
              department per complaint category (Electricity, Road Damage, Water Leakage, Garbage,
              Drainage, Street Light) in one click, with a login generated for each. You can hand
              those logins to whoever runs each department, or add a custom one manually instead.
            </p>

            {/* One-time credentials reveal after Quick Setup — passwords can't be shown again */}
            {bulkResult && (
              <div className="card p-4 border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                    Save these logins now — shown only once
                  </h3>
                  <button onClick={() => setBulkResult(null)} className="text-xs text-amber-600 hover:underline">
                    Dismiss
                  </button>
                </div>
                <div className="space-y-1.5">
                  {bulkResult.map((d) => (
                    <div key={d.email} className="text-xs font-mono bg-white dark:bg-gray-900 rounded-lg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="font-semibold not-italic">{d.departmentCategory}</span>
                      <span>{d.email}</span>
                      <span>pwd: {d.password}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingDepartments ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : departmentsList.length === 0 ? (
              <div className="card p-10 text-center text-gray-400">
                No departments yet in your district. Click "Add Department" to create one —
                e.g. an "Electricity Problem" department — it can then create its own
                workers and start receiving matching complaints automatically.
              </div>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
                    <tr>
                      {['Name', 'Category', 'Email', 'Mobile', 'Open complaints', 'Workers', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {departmentsList.map((d) => (
                      <tr key={d._id}>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{d.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            {d.departmentCategory}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{d.email}</td>
                        <td className="px-4 py-3 text-gray-500">{d.mobile}</td>
                        <td className="px-4 py-3 text-gray-500">{d.openComplaints}</td>
                        <td className="px-4 py-3 text-gray-500">{d.workerCount}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleDepartment(d._id)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              d.isActive
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {d.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteDepartment(d._id)}
                            title="Delete department permanently"
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}


        {tab === 'users' && (

          <div className="card overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                  <tr>
                    {['Name', 'Email', 'Mobile', 'District', 'Citizen ID', 'Status', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.name}</td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3 text-gray-500">{u.mobile || u.phone || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{u.district || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{u.userId || '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleUser(u._id)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              u.isActive === false
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {u.isActive === false ? 'Inactive' : 'Active'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteUser(u._id, u.name)}
                            title="Delete user permanently"
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

              </table>

            </div>

          </div>
        )}

      </div>

      {/* Add Department modal */}
      {showAddDepartment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreateDepartment}
            className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              Add Department
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              This creates a login for one department covering one category in your district.
              Complaints of that category will route to it automatically.
            </p>

            <div className="space-y-3">
              <input
                required
                placeholder="Department name (e.g. Electricity Department)"
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                required
                type="email"
                placeholder="Email (used to log in)"
                value={departmentForm.email}
                onChange={(e) => setDepartmentForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                required
                type="password"
                placeholder="Temporary password"
                minLength={6}
                value={departmentForm.password}
                onChange={(e) => setDepartmentForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                required
                placeholder="Mobile number"
                value={departmentForm.mobile}
                onChange={(e) => setDepartmentForm((p) => ({ ...p, mobile: e.target.value }))}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
              />

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Category this department handles
                </p>
                <select
                  required
                  value={departmentForm.departmentCategory}
                  onChange={(e) => setDepartmentForm((p) => ({ ...p, departmentCategory: e.target.value }))}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowAddDepartment(false)}
                disabled={creatingDepartment}
                className="text-sm px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingDepartment}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {creatingDepartment ? 'Creating…' : 'Create Department'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Worker proof review modal (Phase 1) */}
      {reviewComplaint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              Review worker completion
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {reviewComplaint.trackingId} — {reviewComplaint.title}
            </p>

            <div className="space-y-4 mb-4">
              {(reviewComplaint.assignedWorkers || []).map((tw) => (
                <div key={tw.worker?._id || tw.worker} className="border-b border-gray-100 dark:border-gray-800 pb-4 last:border-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {tw.worker?.name || 'Worker'}{tw.worker?.teamSize > 1 ? ` (team of ${tw.worker.teamSize})` : ''}{tw.isLead ? ' (lead)' : ''}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Before</p>
                      {tw.proof?.beforePhoto ? (
                        <img
                          src={tw.proof.beforePhoto}
                          alt="Before"
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center text-xs text-gray-300 border border-dashed rounded-lg">
                          No photo
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">After</p>
                      {tw.proof?.afterPhoto ? (
                        <img
                          src={tw.proof.afterPhoto}
                          alt="After"
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center text-xs text-gray-300 border border-dashed rounded-lg">
                          No photo
                        </div>
                      )}
                    </div>
                  </div>
                  {tw.proof?.workDescription && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Work done: </span>
                      {tw.proof.workDescription}
                    </p>
                  )}
                  {tw.proof?.materialsUsed && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Materials: </span>
                      {tw.proof.materialsUsed}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <textarea
              value={verifyNote}
              onChange={(e) => setVerifyNote(e.target.value)}
              placeholder="Optional note (visible to worker if you reject, or on the complaint history if you approve)"
              rows={2}
              maxLength={300}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-primary-500"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReviewComplaint(null)}
                disabled={verifying}
                className="text-sm px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVerifyWork(false)}
                disabled={verifying}
                className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                Reject — send back
              </button>
              <button
                onClick={() => handleVerifyWork(true)}
                disabled={verifying}
                className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {verifying ? 'Saving…' : 'Approve & resolve'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}