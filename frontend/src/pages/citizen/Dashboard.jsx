import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUp, FileText, Mic, Paperclip, MapPin, Clock, Square } from "lucide-react";
import { getMyGrievances } from "../../services/grievanceService";
import { useAuth } from "../../hooks/useAuth";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import { SkeletonList } from "../../components/common/Skeleton";
import RewardsWidget from "../../components/rewards/RewardsWidget";
import PriorityBadge from "../../components/grievances/PriorityBadge";
import StatusBadge from "../../components/grievances/StatusBadge";
import { CATEGORY_LABELS } from "../../utils/constants";
import { formatRelative, toDisplayText } from "../../utils/helpers";
import { useTranslation } from "../../context/LanguageContext";
import { useDiagnostics } from "../../hooks/useDiagnostics";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const getGreetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "dashboard.greetingMorning";
  if (hour < 17) return "dashboard.greetingAfternoon";
  return "dashboard.greetingEvening";
};

const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { capture } = useDiagnostics();
  const [grievances, setGrievances] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [listError, setListError] = useState(null);

  const [heroText, setHeroText] = useState("");
  const [heroFile, setHeroFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const fileInputRef = useRef();
  const recognitionRef = useRef(null);
  const stoppedByUser = useRef(false);

  const loadGrievances = useCallback(() => {
    setGrievances(null);
    setListError(null);
    getMyGrievances({ limit: 6 })
      .then((res) => {
        setGrievances(res.data.items);
        const items = res.data.items;
        setStats({
          total: res.data.total,
          active: items.filter((g) => g.status !== "CLOSED").length,
          resolved: items.filter((g) => g.status === "CLOSED").length,
        });
      })
      // Without this the hero kept its skeleton forever: a failed first
      // request looked like a slow one.
      .catch((err) => setListError(capture(err, { feature: "grievance_list" })));
  }, [capture]);

  useEffect(() => { loadGrievances(); }, [loadGrievances]);

  const toggleVoice = () => {
    if (!SpeechRecognition) return;

    if (recording) {
      stoppedByUser.current = true;
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join(" ");
      setHeroText((prev) => (prev ? prev + " " : "") + transcript);
      setVoiceError(null);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = (event) => {
      setRecording(false);
      // The citizen pressing Stop is not a fault, and it is not a row on the
      // diagnostics dashboard either.
      if (stoppedByUser.current) {
        stoppedByUser.current = false;
        return;
      }
      setVoiceError(capture(event, {
        feature: "speech_recognition",
        category: "voice",
        speechError: event.error,
      }));
    };

    recognitionRef.current = recognition;
    setVoiceError(null);
    // Chrome throws here outright when the microphone is blocked for the site,
    // rather than reporting it through onerror.
    try {
      recognition.start();
    } catch (err) {
      setVoiceError(capture(err, { feature: "speech_recognition", category: "voice" }));
      return;
    }
    setRecording(true);
  };

  const handleFilePick = (e) => {
    if (e.target.files?.[0]) setHeroFile(e.target.files[0]);
  };

  const goToReport = () => {
    navigate("/citizen/report", {
      state: { prefillDescription: heroText.trim() || undefined, prefillFile: heroFile || undefined },
    });
  };

  return (
    <div>
      <div className="dashboard-hero-greeting">
        {t(getGreetingKey())}, {user?.name?.split(" ")[0]} 👋
      </div>
      <div
        className="dashboard-hero-subtitle"
        style={voiceError ? { color: "var(--danger)" } : undefined}
      >
        {/* The hint line doubles as the dictation failure: the mic button is
            right below it, so the fix belongs next to the thing to press. */}
        {voiceError ? `${voiceError.what} ${voiceError.solution}` : t("dashboard.howCanWeHelp")}
      </div>

      <div className="hero-input-card">
        <textarea
          rows={2}
          value={heroText}
          onChange={(e) => setHeroText(e.target.value)}
          placeholder={t("dashboard.describePlaceholder")}
        />
        <div className="hero-input-toolbar">
          <div className="hero-input-actions">
            {SpeechRecognition && (
              <button
                type="button"
                className={`hero-input-icon-btn ${recording ? "is-recording" : ""}`}
                onClick={toggleVoice}
              >
                {recording ? <Square size={13} /> : <Mic size={13} />}
                {recording ? "Stop" : t("dashboard.voice")}
              </button>
            )}
            <button type="button" className="hero-input-icon-btn" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={13} /> {heroFile ? heroFile.name.slice(0, 16) : t("dashboard.upload")}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFilePick} />
          </div>
          <button
            type="button"
            className="hero-input-submit"
            disabled={!heroText.trim() && !heroFile}
            onClick={goToReport}
            aria-label="Continue to report"
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </div>

      <div className="stats-pill-row">
        <div className="stats-pill"><strong>{stats.total}</strong><span>{t("dashboard.total")}</span></div>
        <span className="stats-pill-divider" />
        <div className="stats-pill"><strong>{stats.active}</strong><span>{t("dashboard.active")}</span></div>
        <span className="stats-pill-divider" />
        <div className="stats-pill"><strong>{stats.resolved}</strong><span>{t("dashboard.resolved")}</span></div>
      </div>

      <RewardsWidget />

      <div className="section-title" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{t("dashboard.activeComplaints")}</span>
        <Link to="/citizen/grievances" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          {t("common.viewAll")} <ArrowRight size={13} />
        </Link>
      </div>

      {listError ? (
        <ErrorState
          diagnosis={listError}
          title="Couldn’t load your grievances"
          onRetry={loadGrievances}
        />
      ) : grievances === null ? (
        <SkeletonList rows={3} />
      ) : grievances.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No grievances yet"
          description="Report your first civic issue and AI will route it to the right department."
          action={<Link to="/citizen/report" className="btn btn-primary btn-sm">Report an issue</Link>}
        />
      ) : (
        <div className="complaint-card-grid">
          {grievances.map((g) => (
            <Link key={g.grievance_id} to={`/citizen/grievances/${g.grievance_id}`} className="complaint-card">
              <div className="complaint-card-top">
                <span className="badge badge-neutral">{toDisplayText(CATEGORY_LABELS[g.category] || g.category)}</span>
                <StatusBadge status={g.status} />
              </div>
              <div className="complaint-card-title">{toDisplayText(g.title, "Untitled grievance")}</div>
              <div className="complaint-card-meta">
                <span className="complaint-card-meta-row"><MapPin size={11} /> {toDisplayText(g.location?.address || g.department, "Location not provided")}</span>
                <span className="complaint-card-meta-row"><Clock size={11} /> {formatRelative(g.created_at)}</span>
              </div>
              <PriorityBadge priority={g.priority} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;