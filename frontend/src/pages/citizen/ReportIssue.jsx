import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Loader2, Sparkles, ArrowLeft, Send } from "lucide-react";
import { previewAnalysis, submitGrievance } from "../../services/grievanceService";
import { reverseGeocode } from "../../services/geocodeService";
import { LANGUAGES } from "../../utils/constants";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";
import AIAnalysisPanel from "../../components/ai/AIAnalysisPanel";
import VoiceRecorder from "../../components/grievances/VoiceRecorder";
import ImageUploader from "../../components/grievances/ImageUploader";

const STEPS = ["Describe", "AI Review", "Submitted"];

const ReportIssue = () => {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const toast = useToast();
  const navigate = useNavigate();

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Show coordinates immediately so the button doesn't look stuck,
        // then swap in a real place name once reverse geocoding resolves.
        setLocation({ latitude, longitude, address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });

        try {
          const placeName = await reverseGeocode(latitude, longitude);
          setLocation({ latitude, longitude, address: placeName });
        } catch {
          // Keep the coordinate fallback already set — not a hard failure,
          // the report can still be submitted with lat/lon alone.
          toast.error("Couldn't resolve a place name — using coordinates instead.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast.error("Couldn't get your location. You can still submit without it.");
        setLocating(false);
      }
    );
  };

  const runAnalysis = async () => {
    if (title.trim().length < 3 || description.trim().length < 5) {
      toast.error("Please add a short title and a description of at least 5 characters.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await previewAnalysis({ title, description, language });
      setAnalysis(res.data);
      setStep(1);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        title, description, language,
        voice_transcript: voiceTranscript || undefined,
        attachments: attachments.map((a) => ({
          url: a.url, type: a.type, filename: a.filename, ai_description: a.ai_description,
        })),
        location: location || undefined,
      };
      const res = await submitGrievance(payload);
      setSubmitted(res.data);
      setStep(2);
      toast.success("Grievance submitted successfully");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <h1>Report an issue</h1>
          <p>Describe the problem — AI will analyze it before you submit.</p>
        </div>
      </div>

      <div className="tabs">
        {STEPS.map((label, i) => (
          <div key={label} className={`tab ${step === i ? "active" : ""}`} style={{ cursor: "default" }}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">Title</label>
            <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)}
                   placeholder="e.g. Overflowing garbage bin near market" maxLength={200} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea id="description" className="textarea" value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what's wrong, where exactly, and since when." maxLength={5000} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Language</label>
              <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                <option value="Auto">Auto-detect</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <button type="button" className="btn btn-secondary btn-block" onClick={useCurrentLocation} disabled={locating}>
                {locating ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <MapPin size={14} />}
                {location ? location.address : "Use current location"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Voice note (optional)</label>
            <VoiceRecorder value={voiceTranscript} onChange={setVoiceTranscript} language={language} />
          </div>

          <div className="form-group">
            <label className="form-label">Photos (optional)</label>
            <ImageUploader attachments={attachments} onChange={setAttachments} />
          </div>

          <button className="btn btn-primary btn-block" onClick={runAnalysis} disabled={analyzing}>
            {analyzing
              ? <><Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Analyzing with AI...</>
              : <><Sparkles size={16} /> Analyze with AI</>}
          </button>
        </div>
      )}

      {step === 1 && analysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <AIAnalysisPanel analysis={analysis} />
          <div className="card">
            <div className="section-title">Your report</div>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>{title}</p>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{description}</p>
            {location && (
              <p style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 10, display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={12} /> {location.address}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setStep(0)}>
              <ArrowLeft size={15} /> Edit
            </button>
            <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? <><Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Submitting...</>
                : <><Send size={15} /> Submit grievance</>}
            </button>
          </div>
        </div>
      )}

      {step === 2 && submitted && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", background: "var(--success-soft)",
            color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px",
          }}>
            <Sparkles size={26} />
          </div>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Grievance submitted</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 6 }}>
            Reference ID: <strong style={{ fontFamily: "monospace" }}>{submitted.grievance_id}</strong>
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 24 }}>
            Routed to <strong>{submitted.department}</strong>. You'll be notified as it progresses.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-secondary" onClick={() => navigate(`/citizen/grievances/${submitted.grievance_id}`)}>
              View grievance
            </button>
            <button className="btn btn-primary" onClick={() => {
              setStep(0); setTitle(""); setDescription(""); setAnalysis(null);
              setSubmitted(null); setAttachments([]); setVoiceTranscript(""); setLocation(null);
            }}>
              Report another issue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportIssue;