import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, Loader2, Sparkles, ArrowLeft, Send, AlertCircle, Mic, Square, Check } from "lucide-react";
import { previewAnalysis, submitGrievance } from "../../services/grievanceService";
import { uploadImage } from "../../services/uploadService";
import { reverseGeocode } from "../../services/geocodeService";
import { LANGUAGES, DISTRICTS } from "../../utils/constants";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, toDisplayText } from "../../utils/helpers";
import AIAnalysisPanel from "../../components/ai/AIAnalysisPanel";
import AIProcessingAnimation from "../../components/ai/AIProcessingAnimation";
import ImageUploader from "../../components/grievances/ImageUploader";
import LocationPicker from "../../components/grievances/LocationPicker";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Keep the citizen's title in sync with their description until they
// deliberately edit the title themselves — the conversational flow only
// asks "tell us what happened", so the title is derived rather than a
// separate field they have to fill in.
const deriveTitle = (description) => {
  const words = description.trim().split(/\s+/).slice(0, 10).join(" ");
  return words.length > 0 ? (words.length < description.trim().length ? `${words}...` : words) : "";
};

const STEPS = ["Describe", "AI Review", "Submitted"];

const ReportIssue = () => {
  const routerLocation = useLocation();
  const prefill = routerLocation.state || {};

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState(prefill.prefillDescription || "");
  const [language, setLanguage] = useState("English");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [prefillUploading, setPrefillUploading] = useState(!!prefill.prefillFile);
  const [location, setLocation] = useState(null); // { latitude, longitude, address, district }
  const [locating, setLocating] = useState(false);
  const [resolvingPin, setResolvingPin] = useState(false);
  const [districtWasGuessed, setDistrictWasGuessed] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const toast = useToast();
  const navigate = useNavigate();
  const recognitionRef = useRef(null);

  // A photo attached from the dashboard's quick-start box arrives as a raw
  // File — upload it the same way ImageUploader would, once, on mount.
  useEffect(() => {
    if (!prefill.prefillFile) return;
    uploadImage(prefill.prefillFile)
      .then((res) => setAttachments((prev) => [...prev, res.data]))
      .catch(() => toast.error("Couldn't attach the photo from your quick note — please add it again below."))
      .finally(() => setPrefillUploading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep title derived from description unless the citizen has typed into
  // the title field themselves.
  useEffect(() => {
    if (!titleTouched) setTitle(deriveTitle(description));
  }, [description, titleTouched]);

  const toggleVoice = () => {
    if (!SpeechRecognition) return;
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = { English: "en-IN", Hindi: "hi-IN", Tamil: "ta-IN", Malayalam: "ml-IN" }[language] || "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join(" ");
      setDescription((prev) => (prev ? prev + " " : "") + transcript);
      setVoiceTranscript((prev) => (prev ? prev + " " : "") + transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  // Location is mandatory: an officer can only be matched to a report
  // through its district, so we can't let one through without both a
  // pinned point and a confirmed, canonical district.
  const isLocationComplete = !!(location?.latitude && location?.district);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ latitude, longitude, address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, district: null });

        try {
          const { label, district } = await reverseGeocode(latitude, longitude);
          setLocation({ latitude, longitude, address: label, district: district || "" });
          setDistrictWasGuessed(!!district);
          if (!district) {
            toast.error("Couldn't confidently detect your district — please select it below.");
          }
        } catch {
          toast.error("Couldn't resolve an address — please select your district manually.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast.error("Couldn't get your location. Please allow location access to report an issue.");
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Fires when the citizen drags the pin or taps elsewhere on the map to
  // correct GPS drift — re-resolves the address/district for the new spot.
  const handlePinMove = async (lat, lng) => {
    setLocation((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    setResolvingPin(true);
    try {
      const { label, district } = await reverseGeocode(lat, lng);
      setLocation((prev) => ({ ...prev, latitude: lat, longitude: lng, address: label, district: district || prev?.district || "" }));
      setDistrictWasGuessed(!!district);
    } catch {
      // keep the coordinates even if the address lookup fails
    } finally {
      setResolvingPin(false);
    }
  };

  const handleDistrictChange = (value) => {
    setLocation((prev) => ({ ...prev, district: value }));
    setDistrictWasGuessed(false); // citizen took over — no longer just a guess
  };

  const runAnalysis = async () => {
    if (title.trim().length < 3 || description.trim().length < 5) {
      toast.error("Please add a little more detail — at least a few words describing the issue.");
      return;
    }
    if (!isLocationComplete) {
      toast.error("Please share your location and confirm the district before continuing.");
      return;
    }
    setAnalyzing(true);
    setAnalysisReady(false);
    try {
      const res = await previewAnalysis({ title, description, language });
      setAnalysis(res.data);
      setAnalysisReady(true);
      // Let the processing animation land on "done" for a beat before
      // advancing, so it doesn't feel like it was skipped.
      setTimeout(() => {
        setStep(1);
        setAnalyzing(false);
      }, 500);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!isLocationComplete) {
      toast.error("Please share your location and confirm the district before submitting.");
      setStep(0);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title, description, language,
        voice_transcript: voiceTranscript || undefined,
        attachments: attachments.map((a) => ({
          url: a.url, type: a.type, filename: a.filename, ai_description: a.ai_description,
        })),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          district: location.district,
        },
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
      <div className="tabs">
        {STEPS.map((label, i) => (
          <div key={label} className={`tab ${step === i ? "active" : ""}`} style={{ cursor: "default" }}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 0 && !analyzing && (
        <div className="card ai-assistant-card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Sparkles size={17} color="var(--accent)" />
            <strong style={{ fontSize: 15.5 }}>CivicAI Assistant</strong>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 10 }}>Tell me what happened.</p>

          <div className="form-group">
            <textarea id="description" className="textarea" value={description} rows={4}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what's wrong, where exactly, and since when." maxLength={5000} />
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            {SpeechRecognition ? (
              <button
                type="button"
                className={`hero-input-icon-btn ${recording ? "is-recording" : ""}`}
                onClick={toggleVoice}
              >
                {recording ? <Square size={13} /> : <Mic size={13} />}
                {recording ? "Listening... tap to stop" : "Hold to speak"}
              </button>
            ) : (
              <p className="form-hint">Voice input isn't supported in this browser — you can type instead.</p>
            )}
          </div>

          {prefillUploading && (
            <p className="form-hint" style={{ textAlign: "center" }}>
              <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite", verticalAlign: "-2px" }} /> Attaching your photo...
            </p>
          )}

          <div className="form-group" style={{ marginTop: 6 }}>
            <label className="form-label" htmlFor="title">
              Title <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(auto-filled from your description — edit if you'd like)</span>
            </label>
            <input id="title" className="input" value={title}
                   onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
                   placeholder="e.g. Overflowing garbage bin near market" maxLength={200} />
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
              <label className="form-label">
                Location <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <button type="button" className="btn btn-secondary btn-block" onClick={useCurrentLocation} disabled={locating}>
                {locating ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <MapPin size={14} />}
                {location ? location.address : "Use current location (required)"}
              </button>
            </div>
          </div>

          {location && (
            <>
              <div className="form-group">
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Exact location
                  {resolvingPin && <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite", color: "var(--text-faint)" }} />}
                </label>
                <LocationPicker
                  center={[location.latitude, location.longitude]}
                  onMove={handlePinMove}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  District <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <select
                  className="select"
                  value={location.district || ""}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                >
                  <option value="">Select your district</option>
                  {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                {location.district && districtWasGuessed && (
                  <p className="form-hint">Auto-detected from your location — change it if this isn't right.</p>
                )}
                {!location.district && (
                  <p className="form-hint" style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 5 }}>
                    <AlertCircle size={12} /> Required — this determines which officer your report reaches.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Photos (optional)</label>
            <ImageUploader attachments={attachments} onChange={setAttachments} />
          </div>

          <button className="btn btn-primary btn-block" onClick={runAnalysis} disabled={analyzing || !isLocationComplete}>
            <Sparkles size={16} /> Analyze with AI
          </button>
          {!isLocationComplete && (
            <p className="form-hint" style={{ textAlign: "center", marginTop: 6 }}>
              Add your location and confirm the district to continue.
            </p>
          )}
        </div>
      )}

      {step === 0 && analyzing && (
        <AIProcessingAnimation done={analysisReady} />
      )}

      {step === 1 && analysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ borderColor: "var(--accent)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Sparkles size={16} color="var(--accent)" />
              <strong style={{ fontSize: 14 }}>AI Understanding</strong>
            </div>
            <div className="ai-understanding-list">
              <div className="ai-understanding-row">
                <span className="ai-understanding-check"><Check size={12} /></span>
                <span className="ai-understanding-label">Language</span>
                <span className="ai-understanding-value">{toDisplayText(language)}</span>
              </div>
              <div className="ai-understanding-row">
                <span className="ai-understanding-check"><Check size={12} /></span>
                <span className="ai-understanding-label">Department</span>
                <span className="ai-understanding-value">{toDisplayText(analysis.department || analysis.recommended_department)}</span>
              </div>
              <div className="ai-understanding-row">
                <span className="ai-understanding-check"><Check size={12} /></span>
                <span className="ai-understanding-label">Priority</span>
                <span className="ai-understanding-value">{toDisplayText(analysis.priority)}</span>
              </div>
              <div className="ai-understanding-row">
                <span className="ai-understanding-check"><Check size={12} /></span>
                <span className="ai-understanding-label">Location</span>
                <span className="ai-understanding-value">{toDisplayText(location?.address)} · {toDisplayText(location?.district)}</span>
              </div>
            </div>
          </div>

          <AIAnalysisPanel analysis={analysis} />

          <div className="card">
            <div className="section-title">Your report</div>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>{title}</p>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{description}</p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setStep(0)}>
              <ArrowLeft size={15} /> Edit
            </button>
            <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? <><Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Submitting...</>
                : <><Send size={15} /> Confirm & submit</>}
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
            Routed to <strong>{submitted.department}</strong> ({submitted.district}). You'll be notified as it progresses.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-secondary" onClick={() => navigate(`/citizen/grievances/${submitted.grievance_id}`)}>
              View grievance
            </button>
            <button className="btn btn-primary" onClick={() => {
              setStep(0); setTitle(""); setTitleTouched(false); setDescription(""); setAnalysis(null);
              setSubmitted(null); setAttachments([]); setVoiceTranscript(""); setLocation(null);
              setDistrictWasGuessed(false);
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