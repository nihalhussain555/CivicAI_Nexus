import { useState, useRef } from "react";
import { Mic, Square, Trash2 } from "lucide-react";

/**
 * Uses the browser's SpeechRecognition API (where available) to transcribe
 * speech client-side. Falls back to a manual-entry hint when unsupported
 * (e.g. Firefox) — the citizen can always type instead.
 */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const VoiceRecorder = ({ value, onChange, language = "English" }) => {
  const [recording, setRecording] = useState(false);
  const [supported] = useState(!!SpeechRecognition);
  const recognitionRef = useRef(null);

  const langMap = { English: "en-IN", Hindi: "hi-IN", Tamil: "ta-IN" };

  const start = () => {
    if (!supported) return;
    const recognition = new SpeechRecognition();
    recognition.lang = langMap[language] || "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ");
      onChange((value ? value + " " : "") + transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: value ? 10 : 0 }}>
        {!recording ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={start} disabled={!supported}>
            <Mic size={15} /> {supported ? "Record voice note" : "Voice input not supported"}
          </button>
        ) : (
          <button type="button" className="btn btn-danger btn-sm" onClick={stop}>
            <Square size={13} /> Stop recording
          </button>
        )}
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>
      {value && (
        <div className="card" style={{ marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)", fontSize: 12 }}>Voice transcript:</strong>
          <p style={{ marginTop: 4 }}>{value}</p>
        </div>
      )}
      {!supported && (
        <p className="form-hint">Your browser doesn't support voice input — you can type your report instead.</p>
      )}
    </div>
  );
};

export default VoiceRecorder;
