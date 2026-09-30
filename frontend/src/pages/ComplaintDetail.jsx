import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MapComponent from '../components/MapComponent';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../utils/api';
import {
  STATUS_COLORS, PRIORITY_COLORS, CATEGORY_ICONS, formatDateTime,
} from '../utils/helpers';
import { ArrowLeft, MapPin, Clock, Hash, User, Tag, Star, CheckCircle2, ThumbsUp, ThumbsDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ComplaintDetail() {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Rating widget state
  const [ratingInput, setRatingInput] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Confirm / reopen widget state (Phase 2)
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  // If the photo file is missing on disk (e.g. after a fresh clone, since
  // uploads/ isn't stored in git), hide it instead of showing a broken icon.
  const [imgBroken, setImgBroken] = useState(false);
  const [resPhotoBroken, setResPhotoBroken] = useState(false);

  const toggleDark = () => {
    setDarkMode((d) => { document.documentElement.classList.toggle('dark', !d); return !d; });
  };

  useEffect(() => {
    api.get(`/complaints/${id}`)
      .then(({ data }) => setComplaint(data.complaint))
      .catch(() => toast.error('Complaint not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const submitRating = async () => {
    if (!ratingInput) return toast.error('Please select a star rating');
    setSubmittingRating(true);
    try {
      const { data } = await api.put(`/complaints/${id}/rate`, {
        rating: ratingInput,
        feedback: feedback.trim() || undefined,
      });
      setComplaint((prev) => ({ ...prev, rating: data.rating, ratingFeedback: feedback.trim() || null }));
      toast.success(data.message || 'Thanks for your feedback!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const submitConfirmation = async (confirmed) => {
    if (confirmed === false && !showReopenForm) {
      // First click on "No" just reveals the reason box — doesn't submit yet.
      setShowReopenForm(true);
      return;
    }
    setSubmittingConfirm(true);
    try {
      const { data } = await api.put(`/complaints/${id}/confirm`, {
        confirmed,
        note: confirmed ? undefined : (reopenNote.trim() || undefined),
      });
      setComplaint(data.complaint);
      setShowReopenForm(false);
      setReopenNote('');
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit response');
    } finally {
      setSubmittingConfirm(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar darkMode={darkMode} toggleDark={toggleDark} />
      <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
    </div>
  );

  if (!complaint) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar darkMode={darkMode} toggleDark={toggleDark} />
      <div className="text-center py-24">
        <p className="text-gray-500">Complaint not found.</p>
        <Link to="/dashboard" className="btn-primary mt-4 inline-block">← Back</Link>
      </div>
    </div>
  );

  const {
    trackingId, title, description, category, status, priority,
    image, latitude, longitude, locationName, geoTagged,
    adminNote, createdAt, resolvedAt, user, statusHistory,
    resolutionPhoto, rating, ratingFeedback,
    citizenConfirmation, reopenCount,
    assignedWorkers, assignedDepartment, workerStage,
  } = complaint;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar darkMode={darkMode} toggleDark={toggleDark} />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 mb-6">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="card p-6 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Hash size={12} className="text-gray-400" />
                <span className="text-xs font-mono text-gray-400">{trackingId}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[status]}`}>{status}</span>
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${PRIORITY_COLORS[priority]}`}>{priority}</span>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Tag size={14} /> <span>{CATEGORY_ICONS[category]} {category}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <User size={14} /> <span>{user?.name || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Clock size={14} /> <span>{formatDateTime(createdAt)}</span>
            </div>
            {locationName && (
              <div className="flex items-center gap-2 text-gray-500 col-span-2">
                <MapPin size={14} /> <span>{locationName}</span>
              </div>
            )}
            {geoTagged && (
              <div className="flex items-center gap-2 text-green-600 text-xs col-span-2">
                <MapPin size={13} /> GeoTag automatically detected from image ✅
              </div>
            )}
            {resolvedAt && (
              <div className="flex items-center gap-2 text-green-600 text-xs">
                <Clock size={13} /> Resolved: {formatDateTime(resolvedAt)}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{description}</p>
          </div>

          {/* Admin note */}
          {adminNote && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl text-sm text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Admin Note: </span>{adminNote}
            </div>
          )}
        </div>

        {/* Image */}
        {image && !imgBroken && (
          <div className="card p-4 mb-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Uploaded Image</h3>
            <img
              src={image}
              alt="Complaint"
              className="w-full rounded-xl object-cover max-h-72"
              onError={() => setImgBroken(true)}
            />
          </div>
        )}

        {/* Resolution photo — proof uploaded by admin */}
        {resolutionPhoto && !resPhotoBroken && (
          <div className="card p-4 mb-5">
            <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Proof of Resolution
            </h3>
            <img
              src={resolutionPhoto}
              alt="Resolution proof"
              className="w-full rounded-xl object-cover max-h-72"
              onError={() => setResPhotoBroken(true)}
            />
          </div>
        )}

        {/* Who's handling this — visible once routed/assigned, before resolution */}
        {status !== 'Resolved' && (assignedDepartment || assignedWorkers?.length > 0) && (
          <div className="card p-4 mb-5 flex items-center gap-3 text-sm">
            <User size={16} className="text-primary-500 flex-shrink-0" />
            <div>
              {assignedDepartment && (
                <p className="text-gray-700 dark:text-gray-300">
                  Routed to <span className="font-medium">{assignedDepartment.name}</span>
                </p>
              )}
              {assignedWorkers?.length > 0 ? (
                <p className="text-gray-500 text-xs mt-0.5">
                  Assigned to {assignedWorkers.length > 1 ? 'field workers' : 'field worker'}{' '}
                  <span className="font-medium">
                    {assignedWorkers.map((w) => w.worker?.name + (w.worker?.teamSize > 1 ? ` (team of ${w.worker.teamSize})` : '') || 'a worker').join(', ')}
                  </span>
                  {workerStage && workerStage !== 'NotAssigned' && ` — ${workerStage}`}
                </p>
              ) : (
                <p className="text-gray-400 text-xs mt-0.5">Waiting for a worker to be assigned</p>
              )}
            </div>
          </div>
        )}

        {/* Workers' before/after proof photos — uploaded when each person's part is done */}
        {assignedWorkers?.some((w) => w.proof?.beforePhoto || w.proof?.afterPhoto) && (
          <div className="card p-4 mb-5">
            <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Worker{assignedWorkers.length > 1 ? "s'" : "'s"} Proof of Work
            </h3>
            <div className="space-y-4">
              {assignedWorkers
                .filter((w) => w.proof?.beforePhoto || w.proof?.afterPhoto)
                .map((w) => (
                  <div key={w.worker?._id || w.worker} className="border-t border-gray-100 dark:border-gray-800 pt-3 first:border-0 first:pt-0">
                    {assignedWorkers.length > 1 && (
                      <p className="text-xs font-medium text-gray-500 mb-2">— by {w.worker?.name || 'a worker'}{w.worker?.teamSize > 1 ? ` (team of ${w.worker.teamSize})` : ''}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {w.proof?.beforePhoto && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1.5">Before</p>
                          <img
                            src={w.proof.beforePhoto}
                            alt="Before work"
                            className="w-full rounded-xl object-cover max-h-64"
                          />
                        </div>
                      )}
                      {w.proof?.afterPhoto && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1.5">After</p>
                          <img
                            src={w.proof.afterPhoto}
                            alt="After work"
                            className="w-full rounded-xl object-cover max-h-64"
                          />
                        </div>
                      )}
                    </div>
                    {w.proof?.workDescription && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                        <span className="font-medium">Work done: </span>{w.proof.workDescription}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Confirm resolution / reopen — only when Resolved and not yet responded */}
        {status === 'Resolved' && citizenConfirmation?.confirmed === null && (
          <div className="card p-5 mb-5 border-2 border-primary-100 dark:border-primary-900">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
              Was your issue actually resolved?
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              This has been marked Resolved. Let us know if the problem is really fixed.
            </p>

            {!showReopenForm ? (
              <div className="flex gap-3">
                <button
                  onClick={() => submitConfirmation(true)}
                  disabled={submittingConfirm}
                  className="flex-1 flex items-center justify-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-medium disabled:opacity-50"
                >
                  <ThumbsUp size={15} /> Yes, it's fixed
                </button>
                <button
                  onClick={() => submitConfirmation(false)}
                  disabled={submittingConfirm}
                  className="flex-1 flex items-center justify-center gap-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2.5 rounded-xl font-medium disabled:opacity-50"
                >
                  <ThumbsDown size={15} /> No, still broken
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={reopenNote}
                  onChange={(e) => setReopenNote(e.target.value)}
                  placeholder="What's still wrong? (optional, but helps whoever picks this up)"
                  rows={2}
                  maxLength={300}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReopenForm(false)}
                    disabled={submittingConfirm}
                    className="text-sm px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => submitConfirmation(false)}
                    disabled={submittingConfirm}
                    className="flex-1 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-medium disabled:opacity-50"
                  >
                    {submittingConfirm ? 'Submitting…' : 'Reopen this complaint'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {citizenConfirmation?.confirmed === true && (
          <div className="card p-4 mb-5 flex items-center gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle2 size={16} /> You confirmed this issue was resolved.
          </div>
        )}

        {reopenCount > 0 && (
          <p className="text-xs text-gray-400 mb-5 -mt-3">
            This complaint has been reopened {reopenCount} time{reopenCount > 1 ? 's' : ''}.
          </p>
        )}

        {/* Rating widget — only after Resolved */}
        {status === 'Resolved' && (
          <div className="card p-5 mb-5">
            {rating ? (
              <>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Your Rating</h3>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={20}
                      className={n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
                {ratingFeedback && (
                  <p className="text-sm text-gray-500 mt-2 italic">"{ratingFeedback}"</p>
                )}
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">How satisfied are you with the resolution?</h3>
                <p className="text-xs text-gray-400 mb-3">Your feedback helps improve response quality in your district.</p>
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRatingInput(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                    >
                      <Star
                        size={26}
                        className={
                          n <= (hoverRating || ratingInput)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Any additional feedback? (optional)"
                  rows={2}
                  maxLength={500}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                />
                <button
                  onClick={submitRating}
                  disabled={submittingRating || !ratingInput}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {submittingRating ? 'Submitting…' : 'Submit Rating'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Map */}
        {latitude && longitude && (
          <div className="card p-4 mb-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1">
              <MapPin size={14} /> Issue Location
              {geoTagged && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Auto-detected from photo</span>}
            </h3>
            <MapComponent
              complaints={[complaint]}
              center={[latitude, longitude]}
              zoom={14}
              height="280px"
              selectedLat={latitude}
              selectedLng={longitude}
            />
            <p className="text-xs text-gray-400 mt-2">📍 {latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
          </div>
        )}

        {/* Status history */}
        {statusHistory?.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Status Timeline</h3>
            <div className="space-y-4">
              {statusHistory.map((h, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary-500 mt-1 flex-shrink-0" />
                    {i < statusHistory.length - 1 && <div className="w-0.5 bg-gray-200 dark:bg-gray-700 flex-1 mt-1" />}
                  </div>
                  <div className="pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[h.status]}`}>{h.status}</span>
                      <span className="text-xs text-gray-400">{formatDateTime(h.changedAt)}</span>
                    </div>
                    {h.note && <p className="text-xs text-gray-500 mt-1">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}