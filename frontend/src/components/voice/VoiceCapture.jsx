import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Send, Trash2, Loader2, AlertTriangle, Play, Keyboard } from "lucide-react";
import { transcribeVoiceNote } from "../../services/aiService";
import { formatDuration } from "../../utils/helpers";

/**
 * Voice capture for the assistant: press the microphone, speak the complaint
 * in any supported language, read back what was heard, fix it if it is wrong,
 * then send.
 *
 * Three promises this component is responsible for keeping:
 *
 * - nothing is sent to the assistant until the transcript has been shown, so
 *   a misheard "sewage" never becomes a filed complaint;
 * - the transcript is editable, because recognition on a noisy street
 *   recording is a first draft, not a statement;
 * - every failure mode ends at a text box, not at a dead end — no microphone
 *   permission, no speech provider on the server, or a recording nobody could
 *   read all produce the same "type it instead" path.
 *
 * The waveform is drawn from a live AnalyserNode so the citizen can see the
 * mic is really picking them up, which is the only feedback available to
 * someone recording a complaint in the street with gloves on.
 */

const MAX_SECONDS = 90;

const PHASES = { idle: "idle", recording: "recording", listening: "listening", review: "review" };

const VoiceCapture = ({ onAccept, language = "Auto", disabled = false }) => {
  const [phase, setPhase] = useState(PHASES.idle);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [text, setText] = useState("");
  // Held in state, not a ref, because it is rendered — and it points at the
  // local blob rather than the server's copy, so replaying a recording still
  // works for a citizen who has turned retention off.
  const [replayUrl, setReplayUrl] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const timerRef = useRef(null);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    clearInterval(timerRef.current);
    frameRef.current = null;
    timerRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // The recording itself outlives the live capture: it is revoked once the
  // preview goes away, whether that is a new take, a send, or unmount.
  useEffect(() => () => { if (replayUrl) URL.revokeObjectURL(replayUrl); }, [replayUrl]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    const data = new Uint8Array(analyser.frequencyBinCount);

    const paint = () => {
      analyser.getByteTimeDomainData(data);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#315efb";
      ctx.beginPath();
      const step = width / data.length;
      for (let i = 0; i < data.length; i += 1) {
        const y = (data[i] / 255) * height;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();
      frameRef.current = requestAnimationFrame(paint);
    };
    paint();
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const start = async () => {
    setError(null);
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Your browser can't record audio here. Type your message instead.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("The microphone was blocked. Allow microphone access, or type your message instead.");
      return;
    }

    streamRef.current = stream;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContextRef.current = new AudioContextClass();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024;
      audioContextRef.current.createMediaStreamSource(stream).connect(analyserRef.current);
      drawWaveform();
    }

    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      setReplayUrl(URL.createObjectURL(blob));
      cleanup();
      setPhase(PHASES.listening);
      try {
        const response = await transcribeVoiceNote(blob, language);
        const data = response.data;
        setResult(data);
        // A placeholder is never shown as the citizen's words: the box starts
        // empty so what they type is unmistakably theirs.
        setText(data.needs_text_fallback ? "" : data.transcript);
        setPhase(PHASES.review);
      } catch (err) {
        setPhase(PHASES.review);
        setResult({ needs_text_fallback: true, transcript: "", audio_url: null });
        setError(err?.response?.data?.detail || "The recording could not be processed. Type your message instead.");
      }
    };

    recorder.start();
    recorderRef.current = recorder;
    setSeconds(0);
    setPhase(PHASES.recording);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);
  };

  // A language read off silence, or off a provider that never ran at all, is
  // not evidence about what the citizen said. Handing it on as a hint is worse
  // than saying nothing: the backend then mis-reads the words they typed.
  const heard = result && !result.needs_text_fallback ? result : null;

  const send = () => {
    const message = text.trim();
    if (!message) return;
    onAccept({
      text: message,
      originalText: result?.transcript || "",
      audioUrl: result?.audio_url || null,
      language: heard?.language || null,
      languageCode: heard?.language_code || null,
    });
    setResult(null);
    setText("");
    setReplayUrl(null);
    setPhase(PHASES.idle);
    cleanup();
  };

  const discard = () => {
    cleanup();
    setResult(null);
    setText("");
    setReplayUrl(null);
    setError(null);
    setPhase(PHASES.idle);
  };

  const heardLabel = heard
    ? `${heard.language}${heard.language_detected ? " · detected from your voice" : ""}${heard.is_code_mixed ? " · mixed languages" : ""}`
    : "";

  return (
    <div className="voice-capture">
      <style>{`
        .voice-capture { display: flex; flex-direction: column; gap: 8px; }
        .voice-row { display: flex; align-items: center; gap: 10px; }
        .voice-mic-btn {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          min-width: 44px; min-height: 44px; padding: 0 14px; border-radius: 999px;
          border: 1px solid var(--border-strong); background: var(--surface);
          color: var(--text-muted); font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .voice-mic-btn:hover:not(:disabled) { background: var(--surface-hover); color: var(--text); }
        .voice-mic-btn:disabled { opacity: .5; cursor: not-allowed; }
        .voice-mic-btn.live {
          border-color: var(--danger); color: var(--danger);
          background: color-mix(in srgb, var(--danger) 8%, var(--surface));
          animation: voicePulse 1.4s ease-in-out infinite;
        }
        @keyframes voicePulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 35%, transparent); } 50% { box-shadow: 0 0 0 6px transparent; } }
        .voice-wave {
          flex: 1; min-width: 60px; height: 44px; border-radius: 10px;
          background: var(--surface-hover); border: 1px solid var(--border);
        }
        .voice-timer { font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--text-muted); min-width: 38px; }
        .voice-preview { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--surface); }
        .voice-preview-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
        .voice-lang {
          display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700;
          padding: 3px 9px; border-radius: 999px; background: var(--violet-soft); color: var(--violet-soft-text);
        }
        .voice-conf { font-size: 11.5px; color: var(--text-faint); }
        .voice-note {
          display: flex; gap: 7px; align-items: flex-start; font-size: 12px; line-height: 1.5;
          color: var(--warning); background: var(--warning-soft);
          border-radius: 9px; padding: 8px 10px; margin-bottom: 8px;
        }
        .voice-error { color: var(--danger); background: var(--danger-soft); }
        .voice-textarea {
          width: 100%; min-height: 68px; resize: vertical; border-radius: 9px;
          border: 1px solid var(--border-strong); background: var(--bg); color: var(--text);
          padding: 9px 11px; font: inherit; font-size: 13.5px; line-height: 1.5;
        }
        .voice-textarea:focus { outline: 2px solid var(--accent-ring); border-color: var(--accent); }
        .voice-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; flex-wrap: wrap; }
        .voice-replay { display: flex; align-items: center; gap: 6px; margin-right: auto; }
        .voice-replay audio { height: 30px; max-width: 190px; }
      `}</style>

      <p className="voice-status" aria-live="polite" style={{ position: "absolute", left: -9999 }}>
        {phase === PHASES.recording ? "Recording. Press Stop when you have finished speaking." : ""}
        {phase === PHASES.listening ? "Listening to your recording." : ""}
        {phase === PHASES.review ? "Transcript ready to check and send." : ""}
      </p>

      {phase === PHASES.review ? (
        <div className="voice-preview">
          <div className="voice-preview-head">
            {heardLabel && (
              <span className="voice-lang">
                <Mic size={11} /> {heardLabel}
              </span>
            )}
            {result?.transcript && typeof result.transcribe_confidence === "number" && (
              <span className="voice-conf">
                heard {Math.round(result.transcribe_confidence * 100)}% of it
              </span>
            )}
          </div>

          {error && (
            <div className="voice-note voice-error">
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
          {!error && result?.note && (
            <div className="voice-note">
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{result.note}</span>
            </div>
          )}
          {!error && !result?.note && result?.low_confidence && (
            <div className="voice-note">
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>We are not fully sure of these words — please correct anything that is wrong.</span>
            </div>
          )}

          <label className="sr-only" htmlFor="voice-transcript" style={{ position: "absolute", left: -9999 }}>
            Correct the transcript before sending
          </label>
          <textarea
            id="voice-transcript"
            className="voice-textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type your message here, or correct what we heard"
          />

          <div className="voice-actions">
            {replayUrl && (
              <span className="voice-replay">
                <Play size={13} style={{ color: "var(--text-faint)" }} />
                <audio controls src={replayUrl} preload="none" />
              </span>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={discard}>
              <Trash2 size={14} /> Discard
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={send} disabled={!text.trim() || disabled}>
              <Send size={14} /> Send
            </button>
          </div>
        </div>
      ) : (
        <div className="voice-row">
          <button
            type="button"
            className={`voice-mic-btn ${phase === PHASES.recording ? "live" : ""}`}
            onClick={phase === PHASES.recording ? stopRecording : start}
            disabled={disabled || phase === PHASES.listening}
            aria-pressed={phase === PHASES.recording}
            aria-label={phase === PHASES.recording ? "Stop recording" : "Record a voice message"}
          >
            {phase === PHASES.listening ? (
              <><Loader2 size={16} className="spin" /> Listening…</>
            ) : phase === PHASES.recording ? (
              <><Square size={14} /> Stop</>
            ) : (
              <><Mic size={16} /> Speak</>
            )}
          </button>

          <canvas
            ref={canvasRef}
            className="voice-wave"
            width={260}
            height={44}
            aria-hidden="true"
            style={{ visibility: phase === PHASES.recording ? "visible" : "hidden" }}
          />

          {phase === PHASES.recording && <span className="voice-timer">{formatDuration(seconds)}</span>}
        </div>
      )}

      {error && phase !== PHASES.review && (
        <div className="voice-note voice-error">
          <Keyboard size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default VoiceCapture;
