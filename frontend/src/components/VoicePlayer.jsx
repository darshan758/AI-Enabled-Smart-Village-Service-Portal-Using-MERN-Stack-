import React, { useEffect, useState } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import api from '../utils/api';

/**
 * Plays a complaint's voice note. The file is private, so it is fetched with
 * the user's token as a blob (an <audio src> tag cannot send auth headers).
 * Nothing is downloaded until the staff member presses play.
 */
export default function VoicePlayer({ complaintId, durationSec }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/complaints/${complaintId}/voice`, { responseType: 'blob' });
      setSrc(URL.createObjectURL(res.data));
    } catch (e) {
      setError(e.response?.status === 404 ? 'Voice file not found.' : 'Could not load voice note.');
    } finally {
      setLoading(false);
    }
  };

  if (src) return <audio controls autoPlay src={src} className="h-9 w-full max-w-xs" />;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-60"
        title="Play the citizen's voice note"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
        Voice note{durationSec ? ` · ${Math.round(durationSec)}s` : ''}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  );
}