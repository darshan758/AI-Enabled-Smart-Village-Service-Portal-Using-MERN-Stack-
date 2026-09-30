import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../utils/api';
import {
  CATEGORY_ICONS,
  PRIORITY_COLORS,
  timeAgo,
} from '../utils/helpers';
import {
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Camera,
  Loader2,
  ClipboardCheck,
  Copy,
  MessageCircle,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Order jobs should progress through, and a short human label for each.
const STAGE_LABEL = {
  Assigned: 'New — accept this job',
  Accepted: 'Accepted — confirm you\'ve reached the location',
  LocationConfirmed: 'On site — start work when ready',
  Working: 'In progress — upload before/after proof',
  ProofSubmitted: 'Submitted — waiting for supervisor verification',
  Verified: 'Verified — resolved',
};

const STAGE_COLOR = {
  Assigned: 'bg-gray-100 text-gray-700',
  Accepted: 'bg-blue-100 text-blue-700',
  LocationConfirmed: 'bg-indigo-100 text-indigo-700',
  Working: 'bg-amber-100 text-amber-700',
  ProofSubmitted: 'bg-purple-100 text-purple-700',
  Verified: 'bg-green-100 text-green-700',
};

export default function WorkerDashboard() {
  const [darkMode, setDarkMode] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Before/after upload form state, per complaint id
  const [workDescription, setWorkDescription] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');

  const handleCopyMobile = (mobile) => {
    navigator.clipboard.writeText(mobile)
      .then(() => toast.success('Number copied'))
      .catch(() => toast.error('Could not copy — long-press to copy manually'));
  };
  const beforeInputRef = useRef(null);
  const afterInputRef = useRef(null);

  const toggleDark = () => {
    setDarkMode((d) => {
      document.documentElement.classList.toggle('dark', !d);
      return !d;
    });
  };

  const loadJobs = async () => {
    try {
      const { data } = await api.get('/worker/complaints');
      setJobs(data.complaints);
    } catch (err) {
      toast.error('Failed to load your assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  // Replace one job in local state with a fresh copy from the server —
  // same instant-update pattern used in AdminDashboard.
  const patchJob = (id, patch) => {
    setJobs((prev) => prev.map((j) => (j._id === id ? { ...j, ...patch } : j)));
  };

  const handleAccept = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/worker/complaints/${id}/accept`);
      patchJob(id, { workerStage: 'Accepted' });
      toast.success('Job accepted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmLocation = (id) => {
    if (!navigator.geolocation) {
      toast.error('Your device does not support location');
      return;
    }
    setBusyId(id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data } = await api.post(`/worker/complaints/${id}/confirm-location`, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          patchJob(id, {
            workerStage: 'LocationConfirmed',
            workerLocationCheck: { confirmed: true, distanceMeters: data.distanceMeters },
          });
          toast.success(
            data.distanceMeters != null
              ? `Location confirmed — ${data.distanceMeters}m from reported spot`
              : 'Location confirmed'
          );
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to confirm location');
        } finally {
          setBusyId(null);
        }
      },
      () => {
        toast.error('Could not get your location — check device permissions');
        setBusyId(null);
      }
    );
  };

  const handleStartWork = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/worker/complaints/${id}/start`);
      patchJob(id, { workerStage: 'Working' });
      toast.success('Work started');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start work');
    } finally {
      setBusyId(null);
    }
  };

  const handleBeforePhoto = async (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    setBusyId(id);
    try {
      const { data } = await api.post(`/worker/complaints/${id}/before-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const existing = jobs.find((j) => j._id === id)?.workerProof || {};
      patchJob(id, { workerProof: { ...existing, beforePhoto: data.beforePhoto } });
      toast.success('Before photo uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setBusyId(null);
      e.target.value = '';
    }
  };

  const handleAfterPhotoAndSubmit = async (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    if (workDescription.trim()) formData.append('workDescription', workDescription.trim());
    if (materialsUsed.trim()) formData.append('materialsUsed', materialsUsed.trim());

    setBusyId(id);
    try {
      await api.post(`/worker/complaints/${id}/after-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      patchJob(id, { workerStage: 'ProofSubmitted' });
      toast.success('Completion submitted for supervisor review');
      setWorkDescription('');
      setMaterialsUsed('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setBusyId(null);
      e.target.value = '';
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

  const openJobs = jobs.filter((j) => j.workerStage !== 'Verified');
  const doneJobs = jobs.filter((j) => j.workerStage === 'Verified');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar darkMode={darkMode} toggleDark={toggleDark} />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">My Assigned Jobs</h1>
        <p className="text-sm text-gray-400 mb-6">
          {openJobs.length} open, {doneJobs.length} completed
        </p>

        {jobs.length === 0 && (
          <div className="card p-10 text-center text-gray-400">
            No complaints assigned to you yet.
          </div>
        )}

        <div className="space-y-3">
          {openJobs.map((job) => {
            const isOpen = expandedId === job._id;
            const isBusy = busyId === job._id;

            return (
              <div key={job._id} className="card overflow-hidden">
                {/* Summary row — always visible */}
                <button
                  onClick={() => setExpandedId(isOpen ? null : job._id)}
                  className="w-full text-left p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{CATEGORY_ICONS[job.category]}</span>
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {job.title}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[job.priority]}`}>
                        {job.priority}
                      </span>
                      {job.teamSize > 1 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
                          your team of {job.teamSize}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {job.trackingId} · {timeAgo(job.createdAt)}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${STAGE_COLOR[job.workerStage]}`}>
                    {job.workerStage}
                  </span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-4">
                    <p className="text-xs font-medium text-primary-600">
                      {STAGE_LABEL[job.workerStage]}
                    </p>

                    <p className="text-sm text-gray-600 dark:text-gray-300">{job.description}</p>

                    {job.image && (
                      <img src={job.image} alt="Complaint" className="w-full rounded-xl max-h-56 object-cover" />
                    )}

                    {/* Citizen contact — only ever shown to the assigned worker */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <p className="font-medium text-gray-800 dark:text-gray-200">{job.user?.name}</p>
                          <p className="text-xs text-gray-400">
                            {job.locationName || job.village || job.taluk || job.district || 'Location not specified'}
                          </p>
                        </div>
                        {job.user?.mobile && (
                          <p className="text-sm font-mono font-medium text-gray-700 dark:text-gray-200 tracking-wide">
                            {job.user.mobile}
                          </p>
                        )}
                      </div>

                      {job.user?.mobile && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyMobile(job.user.mobile)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg font-medium"
                          >
                            <Copy size={13} /> Copy number
                          </button>
                          <a
                            href={`https://wa.me/91${job.user.mobile}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-medium"
                          >
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                          <a
                            href={`tel:${job.user.mobile}`}
                            title="Only works if this device has a calling app — on a plain desktop browser, use Copy or WhatsApp instead"
                            className="flex items-center justify-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-medium"
                          >
                            <Phone size={13} />
                          </a>
                        </div>
                      )}
                    </div>

                    {job.teammates?.length > 0 && (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Users size={13} />
                        With you on this job: {job.teammates.map((t) => `${t.name}${t.teamSize > 1 ? ` (team of ${t.teamSize})` : ''} (${t.stage})`).join(', ')}
                      </p>
                    )}

                    {job.latitude != null && job.longitude != null && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-sm bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl font-medium"
                      >
                        <Navigation size={15} /> Navigate to location
                      </a>
                    )}

                    {/* Stage-specific action */}
                    {job.workerStage === 'Assigned' && (
                      <button
                        onClick={() => handleAccept(job._id)}
                        disabled={isBusy}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Accept Job
                      </button>
                    )}

                    {job.workerStage === 'Accepted' && (
                      <button
                        onClick={() => handleConfirmLocation(job._id)}
                        disabled={isBusy}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                        Confirm I've Reached the Location
                      </button>
                    )}

                    {job.workerLocationCheck?.distanceMeters != null && (
                      <p className="text-xs text-gray-400 text-center">
                        You confirmed ~{job.workerLocationCheck.distanceMeters}m from the reported spot
                      </p>
                    )}

                    {job.workerStage === 'LocationConfirmed' && (
                      <button
                        onClick={() => handleStartWork(job._id)}
                        disabled={isBusy}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                        Start Work
                      </button>
                    )}

                    {job.workerStage === 'Working' && (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1.5">1. Before photo</p>
                          {job.workerProof?.beforePhoto ? (
                            <img src={job.workerProof.beforePhoto} alt="Before" className="w-24 h-24 rounded-lg object-cover border" />
                          ) : (
                            <>
                              <input
                                type="file"
                                accept="image/*"
                                ref={beforeInputRef}
                                onChange={(e) => handleBeforePhoto(job._id, e)}
                                className="hidden"
                              />
                              <button
                                onClick={() => beforeInputRef.current?.click()}
                                disabled={isBusy}
                                className="flex items-center gap-2 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg disabled:opacity-50"
                              >
                                <Camera size={14} /> Upload before photo
                              </button>
                            </>
                          )}
                        </div>

                        {job.workerProof?.beforePhoto && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-500">2. Fix the issue, then submit completion</p>
                            <textarea
                              value={workDescription}
                              onChange={(e) => setWorkDescription(e.target.value)}
                              placeholder="What did you do? (e.g. Replaced damaged LED lamp)"
                              rows={2}
                              maxLength={500}
                              className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <input
                              value={materialsUsed}
                              onChange={(e) => setMaterialsUsed(e.target.value)}
                              placeholder="Materials used (optional)"
                              maxLength={200}
                              className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <input
                              type="file"
                              accept="image/*"
                              ref={afterInputRef}
                              onChange={(e) => handleAfterPhotoAndSubmit(job._id, e)}
                              className="hidden"
                            />
                            <button
                              onClick={() => afterInputRef.current?.click()}
                              disabled={isBusy}
                              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                              Upload After Photo &amp; Submit
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {job.workerStage === 'ProofSubmitted' && (
                      <div className="grid grid-cols-2 gap-2">
                        {job.workerProof?.beforePhoto && (
                          <img src={job.workerProof.beforePhoto} alt="Before" className="rounded-lg object-cover h-24 w-full border" />
                        )}
                        {job.workerProof?.afterPhoto && (
                          <img src={job.workerProof.afterPhoto} alt="After" className="rounded-lg object-cover h-24 w-full border" />
                        )}
                        <p className="col-span-2 text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-2 text-center">
                          Waiting for supervisor to verify your work.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {doneJobs.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-gray-500 mt-8 mb-3">Completed</h2>
            <div className="space-y-2">
              {doneJobs.map((job) => (
                <div key={job._id} className="card p-3 flex items-center justify-between opacity-70">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{job.title}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    Verified
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}