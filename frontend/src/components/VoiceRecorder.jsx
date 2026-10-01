import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, RotateCcw } from 'lucide-react';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const pickMime = () =>
  (typeof MediaRecorder !== 'undefined' && MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))) || '';

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Optional voice note recorder.
 * onChange(blob | null, durationSeconds | null) is called when a recording is
 * finished, re-recorded or deleted. Needs HTTPS (or localhost) for microphone access.
 */
export default function VoiceRecorder({ onChange, maxSeconds = 120, initialBlob = null, initialSeconds = 0 }) {
  // initialBlob/initialSeconds restore an earlier recording if this component is re-mounted
  // (e.g. the citizen goes to the next form step and comes back).
  const [state, setState] = useState(initialBlob ? 'ready' : 'idle'); // idle | recording | ready
  const [seconds, setSeconds] = useState(initialBlob ? initialSeconds || 0 : 0);
  const [url, setUrl] = useState(() => (initialBlob ? URL.createObjectURL(initialBlob) : null));
  const [error, setError] = useState('');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  const supported = typeof navigator !== 'undefined' && navigator.mediaDevices && typeof MediaRecorder !== 'undefined';

  const cleanupStream = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => {
    cleanupStream();
    if (url) URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || 'audio/webm' });
        cleanupStream();
        const u = URL.createObjectURL(blob);
        setUrl(u);
        setState('ready');
        onChange?.(blob, secondsRef.current);
      };
      recorderRef.current = rec;
      secondsRef.current = 0;
      setSeconds(0);
      rec.start();
      setState('recording');
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= maxSeconds) stop();
      }, 1000);
    } catch (e) {
      cleanupStream();
      setError(
        e && e.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow it in your browser settings to record.'
          : 'Could not access the microphone on this device.'
      );
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  const discard = () => {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    setSeconds(0);
    setState('idle');
    onChange?.(null, null);
  };

  if (!supported) {
    return <p className="text-xs text-gray-400">Voice recording is not supported in this browser.</p>;
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        Voice note <span className="text-gray-400 font-normal">(optional)</span>
      </p>
      <p className="text-xs text-gray-400 mb-3">
        Prefer to explain in your own words? Record up to {Math.floor(maxSeconds / 60)} minutes. Only the admin and
        the responsible department can listen.
      </p>

      {state === 'idle' && (
        <button type="button" onClick={start} className="btn-secondary inline-flex items-center gap-2 text-sm">
          <Mic size={16} /> Record voice note
        </button>
      )}

      {state === 'recording' && (
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <span className="font-mono text-sm text-gray-700 dark:text-gray-200">
            {fmt(seconds)} / {fmt(maxSeconds)}
          </span>
          <button type="button" onClick={stop} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">
            <Square size={14} /> Stop
          </button>
        </div>
      )}

      {state === 'ready' && url && (
        <div className="space-y-2">
          <audio controls src={url} className="w-full h-10" />
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => { discard(); start(); }} className="inline-flex items-center gap-1 text-primary-600 hover:underline">
              <RotateCcw size={12} /> Re-record
            </button>
            <button type="button" onClick={discard} className="inline-flex items-center gap-1 text-red-500 hover:underline">
              <Trash2 size={12} /> Delete
            </button>
            <span className="text-gray-400">{fmt(seconds)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}