import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  CATEGORY_ICONS,
  PRIORITY_COLORS,
  STATUS_COLORS,
  timeAgo,
} from '../utils/helpers';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Users,
  UserPlus,
  X,
  Loader2,
  Phone,
  ThumbsUp,
  ThumbsDown,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const emptyWorkerForm = { name: '', email: '', password: '', mobile: '', teamSize: '1' };

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [tab, setTab] = useState('complaints');

  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [assigningId, setAssigningId] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState({});

  const [reviewComplaint, setReviewComplaint] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');

  const [showAddWorker, setShowAddWorker] = useState(false);
  const [workerForm, setWorkerForm] = useState(emptyWorkerForm);
  const [creatingWorker, setCreatingWorker] = useState(false);

  const toggleDark = () => {
    setDarkMode((d) => {
      document.documentElement.classList.toggle('dark', !d);
      return !d;
    });
  };

  const loadStats = async () => {
    try {
      const { data } = await api.get('/department/stats');
      setStats(data);
    } catch (err) {
      toast.error('Failed to load dashboard stats');
    }
  };

  const loadComplaints = async () => {
    try {
      const params = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const { data } = await api.get(`/department/complaints${params}`);
      setComplaints(data.complaints);
    } catch (err) {
      toast.error('Failed to load complaints');
    }
  };

  const loadWorkers = async () => {
    try {
      const { data } = await api.get('/department/workers');
      setWorkers(data.workers);
    } catch (err) {
      toast.error('Failed to load workers');
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadComplaints(), loadWorkers()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) loadComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleAssign = async (complaintId) => {
    const workerId = selectedWorker[complaintId];
    if (!workerId) return toast.error('Pick a worker first');
    setAssigningId(complaintId);
    try {
      await api.post(`/department/complaints/${complaintId}/assign-worker`, { workerId });
      toast.success('Worker added to the job');
      setSelectedWorker((prev) => ({ ...prev, [complaintId]: '' }));
      loadComplaints();
      loadWorkers();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign worker');
    } finally {
      setAssigningId(null);
    }
  };

  const handleRemoveWorker = async (complaintId, workerId) => {
    if (!window.confirm('Remove this worker from the job?')) return;
    setAssigningId(complaintId);
    try {
      await api.delete(`/department/complaints/${complaintId}/workers/${workerId}`);
      toast.success('Worker removed');
      loadComplaints();
      loadWorkers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove worker');
    } finally {
      setAssigningId(null);
    }
  };

  const handleVerify = async (approved) => {
    if (!reviewComplaint) return;
    setVerifying(true);
    try {
      await api.post(`/department/complaints/${reviewComplaint._id}/verify-work`, {
        approved,
        note: verifyNote || undefined,
      });
      toast.success(approved ? 'Work verified — complaint resolved' : 'Sent back to worker for rework');
      setReviewComplaint(null);
      setVerifyNote('');
      loadComplaints();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    setCreatingWorker(true);
    try {
      await api.post('/department/workers', workerForm);
      toast.success('Worker account created');
      setWorkerForm(emptyWorkerForm);
      setShowAddWorker(false);
      loadWorkers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create worker');
    } finally {
      setCreatingWorker(false);
    }
  };

  const handleToggleWorker = async (id) => {
    try {
      await api.put(`/department/workers/${id}/toggle`);
      loadWorkers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update worker');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar darkMode={darkMode} toggleDark={toggleDark} />
        <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar darkMode={darkMode} toggleDark={toggleDark} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {user?.departmentCategory} Department
          </h1>
          <p className="text-sm text-gray-400">
            {user?.district} · Complaints routed to your department, and the workers you manage.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total', value: stats.stats.total, icon: ClipboardList, color: 'text-gray-500' },
              { label: 'Unassigned', value: stats.stats.unassigned, icon: Clock, color: 'text-amber-500' },
              { label: 'Resolved', value: stats.stats.resolved, icon: CheckCircle2, color: 'text-green-600' },
              { label: 'Workers', value: stats.stats.workerCount, icon: Users, color: 'text-indigo-500' },
            ].map((s) => (
              <div key={s.label} className="card p-4 flex items-center gap-3">
                <s.icon size={20} className={s.color} />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'complaints', label: 'Complaints' },
            { id: 'workers', label: 'Workers' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Complaints Tab */}
        {tab === 'complaints' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-1.5 outline-none"
              >
                <option value="">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {complaints.length === 0 && (
              <div className="card p-10 text-center text-gray-400">
                No complaints in your department yet.
              </div>
            )}

            <div className="space-y-3">
              {complaints.map((c) => (
                <div key={c._id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{CATEGORY_ICONS[c.category]}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{c.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[c.priority]}`}>
                          {c.priority}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {c.trackingId} · {c.user?.name} · {timeAgo(c.createdAt)}
                      </p>
                      {c.user?.mobile && (
                        <a href={`tel:${c.user.mobile}`} className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                          <Phone size={11} /> {c.user.mobile}
                        </a>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {/* Current team, if any */}
                      {c.assignedWorkers?.length > 0 && (
                        <div className="flex flex-col gap-1 items-end">
                          {c.assignedWorkers.map((tw) => (
                            <div key={tw.worker?._id || tw.worker} className="flex items-center gap-1.5 text-xs">
                              <span className="text-gray-500 dark:text-gray-400">
                                {tw.worker?.name || 'Worker'}{tw.worker?.teamSize > 1 ? ` (team of ${tw.worker.teamSize})` : ''}{tw.isLead ? ' (lead)' : ''} — {tw.stage}
                              </span>
                              {!tw.proof?.submittedAt && c.status !== 'Resolved' && c.status !== 'Rejected' && (
                                <button
                                  onClick={() => handleRemoveWorker(c._id, tw.worker?._id || tw.worker)}
                                  title="Remove from job"
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {/* Add a worker — always available pre-resolution, so a job can
                            grow into a team as needed, not just at initial assignment */}
                        {c.status !== 'Resolved' && c.status !== 'Rejected' && (
                          <>
                            <select
                              value={selectedWorker[c._id] || ''}
                              onChange={(e) =>
                                setSelectedWorker((prev) => ({ ...prev, [c._id]: e.target.value }))
                              }
                              className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5 outline-none"
                            >
                              <option value="">
                                {c.assignedWorkers?.length > 0 ? 'Add another worker…' : 'Assign worker…'}
                              </option>
                              {workers
                                .filter((w) => !c.assignedWorkers?.some((tw) => (tw.worker?._id || tw.worker) === w._id))
                                .map((w) => (
                                  <option key={w._id} value={w._id}>
                                    {w.name}{w.teamSize > 1 ? ` (team of ${w.teamSize})` : ''} — {w.activeAssignments} active
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={() => handleAssign(c._id)}
                              disabled={assigningId === c._id}
                              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                            >
                              {assigningId === c._id ? <Loader2 size={14} className="animate-spin" /> : (c.assignedWorkers?.length > 0 ? 'Add' : 'Assign')}
                            </button>
                          </>
                        )}

                        {c.assignedWorkers?.length > 0 && c.workerStage === 'ProofSubmitted' && (
                          <button
                            onClick={() => setReviewComplaint(c)}
                            className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg font-medium"
                          >
                            Review Proof
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workers Tab */}
        {tab === 'workers' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                Field Workers {workers.length > 0 && `(${workers.length})`}
              </h2>
              <button
                onClick={() => setShowAddWorker(true)}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <UserPlus size={14} /> Add Worker
              </button>
            </div>

            {workers.length === 0 && (
              <div className="card p-10 text-center text-gray-400">
                No workers yet — add your first one to start assigning jobs.
              </div>
            )}

            <div className="space-y-2">
              {workers.map((w) => (
                <div key={w._id} className="card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      {w.name}
                      {w.teamSize > 1 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                          team of {w.teamSize}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{w.mobile} · {w.activeAssignments} active jobs</p>
                  </div>
                  <button
                    onClick={() => handleToggleWorker(w._id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                      w.isActive
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {w.isActive === false ? 'Inactive' : 'Active'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add Worker Modal */}
      {showAddWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Add Worker</h3>
              <button onClick={() => setShowAddWorker(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreateWorker} className="space-y-3">
              <input
                required
                placeholder="Full name"
                value={workerForm.name}
                onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg px-3 py-2 outline-none"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={workerForm.email}
                onChange={(e) => setWorkerForm({ ...workerForm, email: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg px-3 py-2 outline-none"
              />
              <input
                required
                placeholder="10-digit mobile"
                value={workerForm.mobile}
                onChange={(e) => setWorkerForm({ ...workerForm, mobile: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg px-3 py-2 outline-none"
              />
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                  Team size — how many people does this one login represent?
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="1"
                  value={workerForm.teamSize}
                  onChange={(e) => setWorkerForm({ ...workerForm, teamSize: e.target.value })}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg px-3 py-2 outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  E.g. for a 20-person road repair crew sharing one login held by the head, enter 20.
                  Leave as 1 for a single person. Record-keeping only — doesn't change how the job works.
                </p>
              </div>
              <input
                required
                type="password"
                placeholder="Password (min 6 chars)"
                minLength={6}
                value={workerForm.password}
                onChange={(e) => setWorkerForm({ ...workerForm, password: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg px-3 py-2 outline-none"
              />
              <button
                type="submit"
                disabled={creatingWorker}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creatingWorker ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Create Worker Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Verify Proof Modal */}
      {reviewComplaint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Review Completion</h3>
              <button onClick={() => setReviewComplaint(null)}><X size={18} className="text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{reviewComplaint.title}</p>

            <div className="space-y-4 mb-3 max-h-[50vh] overflow-y-auto">
              {(reviewComplaint.assignedWorkers || []).map((tw) => (
                <div key={tw.worker?._id || tw.worker} className="border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {tw.worker?.name || 'Worker'}{tw.worker?.teamSize > 1 ? ` (team of ${tw.worker.teamSize})` : ''}{tw.isLead ? ' (lead)' : ''}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {tw.proof?.beforePhoto && (
                      <div>
                        <p className="text-[11px] text-gray-400 mb-1">Before</p>
                        <img src={tw.proof.beforePhoto} alt="Before" className="rounded-lg object-cover h-28 w-full border" />
                      </div>
                    )}
                    {tw.proof?.afterPhoto && (
                      <div>
                        <p className="text-[11px] text-gray-400 mb-1">After</p>
                        <img src={tw.proof.afterPhoto} alt="After" className="rounded-lg object-cover h-28 w-full border" />
                      </div>
                    )}
                  </div>
                  {tw.proof?.workDescription && (
                    <p className="text-xs text-gray-500 mt-2">
                      <strong>Note:</strong> {tw.proof.workDescription}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <textarea
              value={verifyNote}
              onChange={(e) => setVerifyNote(e.target.value)}
              placeholder="Optional note…"
              rows={2}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg px-3 py-2 outline-none mb-3"
            />

            <div className="flex gap-2">
              <button
                onClick={() => handleVerify(false)}
                disabled={verifying}
                className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-700 py-2 rounded-xl font-medium disabled:opacity-50"
              >
                <ThumbsDown size={15} /> Reject / Redo
              </button>
              <button
                onClick={() => handleVerify(true)}
                disabled={verifying}
                className="flex-1 flex items-center justify-center gap-2 btn-primary disabled:opacity-50"
              >
                {verifying ? <Loader2 size={15} className="animate-spin" /> : <ThumbsUp size={15} />}
                Verify &amp; Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}