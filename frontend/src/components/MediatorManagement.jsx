import { useEffect, useState } from 'react';
import { Edit3, Phone, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import api from '../utils/api';
import { CATEGORIES } from '../utils/helpers';
import { KARNATAKA_DISTRICTS } from '../utils/districts';

const EMPTY_FORM = {
  name: '',
  phone: '',
  department: '',
  categories: [],
  district: '',
  taluk: '',
};

export default function MediatorManagement({ user }) {
  const [mediators, setMediators] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, district: user?.district || '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadMediators = async () => {
    try {
      const { data } = await api.get('/admin/mediators');
      setMediators(data.mediators || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load mediators');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMediators();
  }, []);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, district: user?.district || '' });
    setEditingId(null);
  };

  const toggleCategory = (category) => {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  };

  const saveMediator = async (event) => {
    event.preventDefault();
    if (!form.categories.length) {
      toast.error('Select at least one complaint category');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, taluk: form.taluk || null };
      if (editingId) {
        await api.put(`/admin/mediators/${editingId}`, payload);
        toast.success('Mediator updated');
      } else {
        await api.post('/admin/mediators', payload);
        toast.success('Mediator added');
      }
      resetForm();
      await loadMediators();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save mediator');
    } finally {
      setSaving(false);
    }
  };

  const editMediator = (mediator) => {
    setEditingId(mediator._id);
    setForm({
      name: mediator.name || '',
      phone: mediator.phone || '',
      department: mediator.department || '',
      categories: mediator.categories || [],
      district: mediator.district || '',
      taluk: mediator.taluk || '',
    });
  };

  const deleteMediator = async (id) => {
    if (!window.confirm('Remove this mediator? New complaints will no longer be assigned to them.')) return;
    try {
      await api.delete(`/admin/mediators/${id}`);
      setMediators((current) => current.filter((mediator) => mediator._id !== id));
      if (editingId === id) resetForm();
      toast.success('Mediator removed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove mediator');
    }
  };

  const inputClass = 'w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-white';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mediator Directory</h2>
          <p className="text-sm text-gray-500">Route complaints to the right department contact by category and location.</p>
        </div>
        {editingId && (
          <button onClick={resetForm} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <X size={15} /> Cancel edit
          </button>
        )}
      </div>

      <form onSubmit={saveMediator} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input className={inputClass} placeholder="Contact name *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <input className={inputClass} placeholder="10-digit phone *" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} pattern="[0-9]{10}" required />
          <input className={inputClass} placeholder="Department *" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} required />
          <input className={inputClass} placeholder="Taluk (optional)" value={form.taluk} onChange={(event) => setForm({ ...form, taluk: event.target.value })} />
          <select className={inputClass} value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} required disabled={user?.role === 'admin'}>
            <option value="">Select district *</option>
            {KARNATAKA_DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
          </select>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">Complaint categories *</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <label key={category} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-600 dark:text-gray-200">
                <input type="checkbox" checked={form.categories.includes(category)} onChange={() => toggleCategory(category)} />
                {category}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
          {editingId ? <Edit3 size={15} /> : <Plus size={15} />}
          {saving ? 'Saving...' : editingId ? 'Update mediator' : 'Add mediator'}
        </button>
      </form>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading mediators...</p>
      ) : mediators.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">No mediators configured yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {mediators.map((mediator) => (
            <div key={mediator._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{mediator.name}</h3>
                  <p className="text-sm text-gray-500">{mediator.department}</p>
                </div>
                <div className="flex gap-1">
                  <button title="Edit mediator" onClick={() => editMediator(mediator)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><Edit3 size={15} /></button>
                  <button title="Remove mediator" onClick={() => deleteMediator(mediator._id)} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300"><Phone size={13} /> {mediator.phone}</p>
              <p className="mt-1 text-xs text-gray-500">{mediator.district}{mediator.taluk ? ` · ${mediator.taluk}` : ' · Whole district'}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {mediator.categories.map((category) => <span key={category} className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">{category}</span>)}
              </div>
              <p className="mt-3 text-xs text-gray-500">Active assignments: {mediator.activeAssignments || 0}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}