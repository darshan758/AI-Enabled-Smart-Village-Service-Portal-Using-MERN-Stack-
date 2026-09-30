import React, { useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * VoiceInput — a small, self-contained mic button that transcribes
 * speech to text using the browser's built-in SpeechRecognition API
 * (Chrome/Edge on desktop and Android). No API key, no server call —
 * the browser itself handles the audio -> text conversion.
 *
 * This is entirely additive: it renders nothing that blocks or replaces
 * the existing text input it sits next to, and if the browser doesn't
 * support speech recognition at all (Safari, Firefox, older browsers),
 * it quietly renders a disabled button with a one-line explanation
 * instead of breaking the page.
 *
 * Props:
 *   lang        - BCP-47 locale for recognition, default 'kn-IN' (Kannada)
 *   onTranscript(text, isFinal) - called with the recognized text
 *   className   - optional extra classes for the button
 */
export default function VoiceInput({ lang = 'kn-IN', onTranscript, className = '' }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const supported = Boolean(SpeechRecognitionAPI);

  const startListening = useCallback(() => {
    if (!supported) {
      toast.error('Voice input needs Chrome or Edge — this browser doesn\'t support it yet.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      onTranscript?.(transcript, isFinal);
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        toast.error('Microphone access was blocked — allow it in your browser to use voice input.');
      } else if (event.error === 'no-speech') {
        toast.error('Didn\'t catch that — try speaking again, closer to the mic.');
      } else {
        toast.error('Voice input had a problem — you can still type instead.');
      }
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI, supported, lang, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  if (!supported) {
    return (
      <span className={`text-xs text-gray-400 italic ${className}`}>
        🎤 Voice input available in Chrome/Edge — not supported in this browser
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={listening ? stopListening : startListening}
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
        listening
          ? 'bg-red-100 text-red-700 animate-pulse'
          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
      } ${className}`}
      title={listening ? 'Listening… click to stop' : 'Speak in Kannada instead of typing'}
    >
      {listening ? <MicOff size={13} /> : <Mic size={13} />}
      {listening ? 'Listening… (click to stop)' : 'ಕನ್ನಡದಲ್ಲಿ ಹೇಳಿ (Speak in Kannada)'}
    </button>
  );
}