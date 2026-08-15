/**
 * ComplaintForm.jsx — Smart Village
 * MODIFIED
 *
 * Changes vs existing:
 *  1. Location is now optional — removed validation that blocked submission without lat/lng.
 *  2. Real-time duplicate check via GET /complaints/check-duplicate with debounce.
 *  3. Shows duplicate warning banner (never blocks submission).
 *  4. Priority defaults to 'Auto' — backend auto-detects; user can override.
 *  5. GPS browser button added (optional — gracefully handles denial).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MapComponent from '../components/MapComponent';
import api from '../utils/api';
import { CATEGORIES, PRIORITY_LIST } from '../utils/helpers';
import { Upload, MapPin, X, Send, AlertTriangle, Crosshair } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function ComplaintForm() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  const [form, setForm] = useState({
    title:        '',
    description:  '',
    category:     '',
    priority:     'Auto',   // MODIFIED: default to Auto
    locationName: '',
  });

  const [image,          setImage]          = useState(null);
  const [imagePreview,   setImagePreview]   = useState(null);
  const [lat,            setLat]            = useState(null);
  const [lng,            setLng]            = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [step,           setStep]           = useState(1);

  // Duplicate detection state
  const [dupWarning,     setDupWarning]     = useState(null);
  const [dupChecking,    setDupChecking]    = useState(false);
  const dupTimerRef = useRef(null);

  const toggleDark = () => {
    setDarkMode((d) => { document.documentElement.classList.toggle('dark', !d); return !d; });
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('Image must be under 10MB');
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    toast.success('Image selected! GeoTag will be extracted automatically on upload.');
  };

  const handleMapClick = (latitude, longitude) => {
    setLat(latitude);
    setLng(longitude);
    toast.success(`Location pinned: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
  };

  // Browser GPS (optional)
  const handleGPS = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported by your browser');
    toast.loading('Getting your location…', { id: 'gps' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        toast.success(`GPS location captured ✅`, { id: 'gps' });
      },
      () => {
        toast.error('GPS denied — please pin location on map manually', { id: 'gps' });
      },
      { timeout: 8000 }
    );
  };

  // ── Real-time duplicate check (debounced 800ms) ──────────────────────────
  const runDuplicateCheck = useCallback(async () => {
    if (!form.title || !form.category) return;
    setDupChecking(true);
    try {
      const params = new URLSearchParams({ title: form.title, category: form.category });
      if (lat) params.append('latitude', lat);
      if (lng) params.append('longitude', lng);
      if (user?.district) params.append('district', user.district);

      const { data } = await api.get(`/complaints/check-duplicate?${params}`);
      setDupWarning(data.isDuplicate ? data.matchedComplaint?.title : null);
    } catch {
      // Silently ignore check errors
    } finally {
      setDupChecking(false);
    }
  }, [form.title, form.category, lat, lng, user]);

  useEffect(() => {
    clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(runDuplicateCheck, 800);
    return () => clearTimeout(dupTimerRef.current);
  }, [runDuplicateCheck]);
  // ────────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.title.trim())       return toast.error('Please enter a complaint title');
    if (!form.category)           return toast.error('Please select a category');
    if (!form.description.trim()) return toast.error('Please add a description');
    // MODIFIED: location is optional — no longer blocks submission

    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (image) fd.append('image', image);
      if (lat)   fd.append('latitude',  lat);
      if (lng)   fd.append('longitude', lng);

      const { data } = await api.post('/complaints', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.geoTagExtracted) {
        toast.success('GeoTag detected from image! Location saved automatically. ✅');
      } else {
        toast.success('Complaint submitted successfully! 🎉');
      }
      if (data.duplicateWarning) {
        toast(`⚠️ Note: ${data.duplicateWarning}`, { icon: '⚠️', duration: 5000 });
      }
      if (data.autoPriority) {
        toast(`Priority set to ${data.autoPriority} automatically`, { icon: 'ℹ️', duration: 3000 });
      }

      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white';

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <Navbar darkMode={darkMode} toggleDark={toggleDark} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {['Details', 'Location', 'Review'].map((label, i) => (
            <button key={i} onClick={() => setStep(i + 1)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                step === i + 1
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-500 border border-gray-300 dark:bg-gray-700 dark:text-gray-300'
              }`}>
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {/* ── Step 1: Complaint Details ─────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Complaint Details</h2>

            {/* Duplicate warning banner */}
            {dupWarning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Possible duplicate detected.</strong> A similar complaint "{dupWarning}" already exists.
                  You can still submit — your complaint will be reviewed independently.
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input name="title" value={form.title} onChange={handleChange}
                className={inputCls} placeholder="e.g. Street light not working near bus stop"
                maxLength={100} />
              {dupChecking && <p className="text-xs text-gray-400 mt-1">Checking for duplicates…</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                <select name="category" value={form.category} onChange={handleChange} className={inputCls}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                  <span className="ml-1 text-xs text-gray-400">(Auto = suggested from category &amp; keywords)</span>
                </label>
                <select name="priority" value={form.priority} onChange={handleChange} className={inputCls}>
                  <option value="Auto">Auto-detect</option>
                  {PRIORITY_LIST.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  We scan your title/description for urgency keywords (e.g. "fire", "live wire") and combine that with the category to suggest a priority. You can always override it above.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
              <textarea name="description" value={form.description} onChange={handleChange}
                className={`${inputCls} resize-none`} rows={4}
                placeholder="Describe the issue in detail…" maxLength={1000} />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.description.length}/1000</p>
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Photo (optional)
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-green-400 transition">
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="preview" className="h-32 rounded-lg object-cover mx-auto" />
                    <button onClick={(e) => { e.stopPropagation(); setImage(null); setImagePreview(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm">
                    <Upload className="mx-auto mb-1" size={20} />
                    Click to upload image (max 10MB)
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </div>

            <button onClick={() => setStep(2)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition">
              Next: Add Location →
            </button>
          </div>
        )}

        {/* ── Step 2: Location ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Location (optional)</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">You can skip this</span>
            </div>

            <p className="text-sm text-gray-500">
              Pin the issue location on the map, or use GPS. You can skip if location is not applicable.
            </p>

            {/* GPS Button */}
            <button onClick={handleGPS} type="button"
              className="flex items-center gap-2 px-4 py-2 border border-green-500 text-green-600 rounded-lg text-sm hover:bg-green-50 transition">
              <Crosshair size={16} />
              Use my GPS location
            </button>

            {lat && lng && (
              <div className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                📍 Pinned: {lat.toFixed(5)}, {lng.toFixed(5)}
              </div>
            )}

            <div className="h-72 rounded-xl overflow-hidden border border-gray-200">
              <MapComponent
                onLocationSelect={handleMapClick}
                selectedLat={lat}
                selectedLng={lng}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location name / landmark (optional)
              </label>
              <input name="locationName" value={form.locationName} onChange={handleChange}
                className={inputCls} placeholder="e.g. Near Main Bus Stand, Gandhi Nagar" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition">
                ← Back
              </button>
              <button onClick={() => setStep(3)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition">
                Next: Review →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Submit ───────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Review & Submit</h2>

            {dupWarning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>Similar complaint exists — you can still submit.</span>
              </div>
            )}

            <dl className="space-y-2 text-sm">
              {[
                ['Title',       form.title],
                ['Category',    form.category],
                ['Priority',    form.priority === 'Auto' ? 'Will be auto-detected' : form.priority],
                ['Description', form.description],
                ['Location',    lat ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Not provided'],
                ['Landmark',    form.locationName || '—'],
                ['District',    user?.district || '—'],
                ['Image',       image ? image.name : 'No image'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-28 font-medium text-gray-500 flex-shrink-0">{k}:</dt>
                  <dd className="text-gray-800 dark:text-gray-200 break-all">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition">
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60">
                <Send size={16} />
                {loading ? 'Submitting…' : 'Submit Complaint'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}