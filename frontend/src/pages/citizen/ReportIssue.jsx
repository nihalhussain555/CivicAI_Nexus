import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Sparkles, ArrowLeft, Send, AlertCircle, Mic, Square, Check, Users } from "lucide-react";
import { previewAnalysis, submitGrievance, getNearbyReports } from "../../services/grievanceService";
import { uploadImage } from "../../services/uploadService";
import { reverseGeocode } from "../../services/geocodeService";
import { LANGUAGES, DISTRICTS, DISTRICT_CENTERS, STATE_CENTER } from "../../utils/constants";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, toDisplayText, formatRelative } from "../../utils/helpers";
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

const formatNearbyDistance = (km) =>
  km < 1 ? `${Math.max(Math.round(km * 1000), 1)} m` : `${km.toFixed(1)} km`;

const ReportIssue = () => {
  const routerLocation = useLocation();
  const prefill = routerLocation.state || {};

  const [step, setStep] = useState(0);
  const [manualTitle, setManualTitle] = useState("");
  const [description, setDescription] = useState(prefill.prefillDescription || "");
  const [language, setLanguage] = useState("English");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [prefillUploading, setPrefillUploading] = useState(!!prefill.prefillFile);
  const [location, setLocation] = useState(null); // { latitude, longitude, address, district }
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const [resolvingPin, setResolvingPin] = useState(false);
  const [districtWasGuessed, setDistrictWasGuessed] = useState(false);
  // Once the citizen picks a district from the list themselves, stop letting a
  // reverse-geocode guess overwrite it — their choice is the routing key, and
  // silently changing it after they set it is how reports go to the wrong office.
  const [districtConfirmed, setDistrictConfirmed] = useState(false);
  // Other citizens' open reports at the pinned spot, keyed to the pin they were
  // looked up for so a stale answer is never shown against a moved pin.
  const [nearby, setNearby] = useState(null); // { key, reports, total }
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const toast = useToast();
  const navigate = useNavigate();
  const recognitionRef = useRef(null);

  // Derived, not stored: an untouched title field follows the description, and
  // the citizen's own words take over the moment they type one.
  const title = manualTitle.trim() ? manualTitle : deriveTitle(description);

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

  const { latitude: pinLat, longitude: pinLng, district: pinDistrict } = location || {};
  const pinKey = pinLat ? `${pinLat.toFixed(5)},${pinLng.toFixed(5)},${pinDistrict || ""}` : null;

  // What else is already open at this exact spot. Debounced and keyed to the
  // pin, because a drag would otherwise fire a lookup per pixel — and an answer
  // for a pin the citizen has since moved is worse than no answer at all.
  useEffect(() => {
    if (!pinKey) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      getNearbyReports({ latitude: pinLat, longitude: pinLng, district: pinDistrict })
        .then((res) => { if (!cancelled) setNearby({ key: pinKey, ...res.data }); })
        .catch(() => { if (!cancelled) setNearby({ key: pinKey, reports: [], total_nearby: 0 }); });
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pinKey, pinLat, pinLng, pinDistrict]);

  const nearbyReports = nearby?.key === pinKey ? nearby.reports : [];

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

  // Before a pin exists the map still opens — on the middle of whichever
  // district they've chosen, so the first thing they see is their own area
  // rather than the whole state.
  const pin = location?.latitude ? [location.latitude, location.longitude] : null;
  const mapCenter = pin || DISTRICT_CENTERS[location?.district] || STATE_CENTER;

  const resolveAddress = async (latitude, longitude, keepDistrict) => {
    setResolvingPin(true);
    try {
      const { label, district } = await reverseGeocode(latitude, longitude);
      setLocation((prev) => ({
        latitude,
        longitude,
        address: label,
        district: keepDistrict || district || prev?.district || "",
      }));
      if (!keepDistrict && district) setDistrictWasGuessed(true);
    } catch {
      // Coordinates are what the report needs; an address is a convenience.
      setLocation((prev) => ({
        ...(prev || {}),
        latitude,
        longitude,
        address: prev?.address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        district: prev?.district || "",
      }));
    } finally {
      setResolvingPin(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError("This browser can't share a location.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocating(false);
        setLocation((prev) => ({ ...prev, latitude, longitude }));
        resolveAddress(latitude, longitude);
      },
      (error) => {
        setLocating(false);
        // Code 1 is a denial the citizen may never have seen a prompt for (an
        // embedded webview, a browser that silently blocks), so the message has
        // to point at the way out rather than at a permission they didn't refuse.
        setLocateError(
          error?.code === 1
            ? "Location access is blocked."
            : error?.code === 3
              ? "Taking too long to get a fix."
              : "Couldn't read your location."
        );
      },
      // Without `timeout` a browser that never answers the request leaves this
      // call pending forever — the spinner spins and no map ever appears.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // The pin moved by tap, drag or search — re-resolve the address for the new
  // spot, but never overrule a district the citizen selected by hand.
  const handlePick = (lat, lng, source, place) => {
    const locked = districtConfirmed ? location?.district || "" : "";

    if (place) {
      setLocation({
        latitude: lat,
        longitude: lng,
        address: place.label,
        district: locked || place.district || location?.district || "",
      });
      if (!locked && place.district) setDistrictWasGuessed(true);
      return;
    }

    setLocation((prev) => ({ ...(prev || {}), latitude: lat, longitude: lng }));
    resolveAddress(lat, lng, locked);
  };

  const handleDistrictChange = (value) => {
    setLocation((prev) => ({ ...(prev || {}), district: value }));
    setDistrictConfirmed(!!value);
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
              <Loader2 size={12} className="spin" style={{ verticalAlign: "-2px" }} /> Attaching your photo...
            </p>
          )}

          <div className="form-group" style={{ marginTop: 6 }}>
            <label className="form-label" htmlFor="title">
              Title <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(auto-filled from your description — edit if you'd like)</span>
            </label>
            <input id="title" className="input" value={title}
                   onChange={(e) => setManualTitle(e.target.value)}
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
                District <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                className="select"
                value={location?.district || ""}
                onChange={(e) => handleDistrictChange(e.target.value)}
              >
                <option value="">Select your district</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {location?.district && districtWasGuessed && (
                <p className="form-hint">Auto-detected from your location — change it if this isn't right.</p>
              )}
              {!location?.district && (
                <p className="form-hint" style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 5 }}>
                  <AlertCircle size={12} /> Required — this decides which officer receives your report.
                </p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Exact location <span style={{ color: "var(--danger)" }}>*</span>
              {resolvingPin && <Loader2 size={12} className="spin" style={{ color: "var(--text-faint)" }} />}
            </label>
            <LocationPicker
              center={mapCenter}
              hasPin={!!pin}
              nearby={nearbyReports}
              onPick={handlePick}
              onLocate={useCurrentLocation}
              locating={locating}
              locateError={locateError}
              busy={resolvingPin}
            />
            <p className="form-hint" style={{ marginTop: 6 }}>
              {pin
                ? <>Pinned at <strong>{toDisplayText(location?.address, `${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`)}</strong></>
                : "Search for your street, tap the map where the problem is, or use the location button. Nothing needs to be exact to the metre — a few streets away is enough for a field visit."}
            </p>
            {nearbyReports.length > 0 && (
              <div className="nearby-callout">
                <Users size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ fontSize: 12.5 }}>
                    {nearbyReports.length} {nearbyReports.length === 1 ? "report is" : "reports are"} already open here
                  </strong>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0 0" }}>
                    Nearest: “{nearbyReports[0].title}” {formatNearbyDistance(nearbyReports[0].distance_km)} away,
                    {" "}{nearbyReports[0].status.toLowerCase()} · reported {formatRelative(nearbyReports[0].created_at)}.
                    Reporting it too is fine and helps — the extra confirmations make the case harder to ignore.
                  </p>
                </div>
              </div>
            )}
          </div>

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
                ? <><Loader2 size={16} className="spin" /> Submitting...</>
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
              setStep(0); setManualTitle(""); setDescription(""); setAnalysis(null);
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