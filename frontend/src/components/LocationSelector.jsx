// frontend/src/components/LocationSelector.jsx  ← NEW FILE
/**
 * Cascading location selector: State → District → Taluk → Village
 * Fetches data from /api/superadmin/location/* endpoints (public, no auth).
 */
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { MapPin, ChevronDown } from 'lucide-react';

const Select = ({ label, value, onChange, options, placeholder, loading, disabled }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      {label}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled || loading}
        className="input-field appearance-none pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">{loading ? 'Loading…' : placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  </div>
);

/**
 * Props:
 *  value     — { state, district, taluk, villageId, villageName }
 *  onChange  — called with the updated value object
 *  required  — boolean
 */
export default function LocationSelector({ value = {}, onChange, required }) {
  const [states,    setStates]   = useState([]);
  const [districts, setDistricts] = useState([]);
  const [taluks,    setTaluks]   = useState([]);
  const [villages,  setVillages] = useState([]);

  const [loadingStates,    setLoadingStates]   = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingTaluks,    setLoadingTaluks]   = useState(false);
  const [loadingVillages,  setLoadingVillages] = useState(false);

  // Load states on mount
  useEffect(() => {
    setLoadingStates(true);
    api.get('/superadmin/location/states')
      .then(({ data }) => setStates(data.states || []))
      .catch(() => {})
      .finally(() => setLoadingStates(false));
  }, []);

  // Load districts when state changes
  useEffect(() => {
    if (!value.state) { setDistricts([]); setTaluks([]); setVillages([]); return; }
    setLoadingDistricts(true);
    api.get(`/superadmin/location/districts/${encodeURIComponent(value.state)}`)
      .then(({ data }) => setDistricts(data.districts || []))
      .catch(() => {})
      .finally(() => setLoadingDistricts(false));
  }, [value.state]);

  // Load taluks when district changes
  useEffect(() => {
    if (!value.state || !value.district) { setTaluks([]); setVillages([]); return; }
    setLoadingTaluks(true);
    api.get(`/superadmin/location/taluks/${encodeURIComponent(value.state)}/${encodeURIComponent(value.district)}`)
      .then(({ data }) => setTaluks(data.taluks || []))
      .catch(() => {})
      .finally(() => setLoadingTaluks(false));
  }, [value.district]);

  // Load villages when taluk changes
  useEffect(() => {
    if (!value.state || !value.district || !value.taluk) { setVillages([]); return; }
    setLoadingVillages(true);
    api.get(`/superadmin/location/villages/${encodeURIComponent(value.state)}/${encodeURIComponent(value.district)}/${encodeURIComponent(value.taluk)}`)
      .then(({ data }) => setVillages(data.villages || []))
      .catch(() => {})
      .finally(() => setLoadingVillages(false));
  }, [value.taluk]);

  const handle = (field) => (e) => {
    const val = e.target.value;
    // Reset downstream fields
    const reset = {};
    if (field === 'state')    reset = { district: '', taluk: '', villageId: '', villageName: '' };
    if (field === 'district') reset = { taluk: '', villageId: '', villageName: '' };
    if (field === 'taluk')    reset = { villageId: '', villageName: '' };
    if (field === 'villageId') {
      const v = villages.find((vv) => vv._id === val);
      onChange({ ...value, villageId: val, villageName: v?.villageName || '' });
      return;
    }
    onChange({ ...value, [field]: val, ...reset });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
        <MapPin size={14} />
        Location {required && <span className="text-red-500">*</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="State"
          value={value.state || ''}
          onChange={handle('state')}
          options={states}
          placeholder="Select State"
          loading={loadingStates}
        />
        <Select
          label="District"
          value={value.district || ''}
          onChange={handle('district')}
          options={districts}
          placeholder="Select District"
          loading={loadingDistricts}
          disabled={!value.state}
        />
        <Select
          label="Taluk"
          value={value.taluk || ''}
          onChange={handle('taluk')}
          options={taluks}
          placeholder="Select Taluk"
          loading={loadingTaluks}
          disabled={!value.district}
        />
        <Select
          label="Village"
          value={value.villageId || ''}
          onChange={handle('villageId')}
          options={villages.map((v) => ({ value: v._id, label: v.villageName }))}
          placeholder="Select Village"
          loading={loadingVillages}
          disabled={!value.taluk}
        />
      </div>

      {villages.length === 0 && value.taluk && !loadingVillages && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          ⚠️ No villages found for this taluk. Please type your village name below.
        </p>
      )}
    </div>
  );
}