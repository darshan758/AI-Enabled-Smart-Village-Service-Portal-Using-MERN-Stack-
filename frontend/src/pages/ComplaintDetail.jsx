import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MapComponent from '../components/MapComponent';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../utils/api';
import {
  STATUS_COLORS, PRIORITY_COLORS, CATEGORY_ICONS, formatDateTime,
} from '../utils/helpers';
import { ArrowLeft, MapPin, Clock, Hash, User, Tag, Star, CheckCircle2 } from 'lucide-react';
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