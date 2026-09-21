import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUp, FileText, Mic, Paperclip, MapPin, Clock, Square } from "lucide-react";
import { getMyGrievances } from "../../services/grievanceService";
import { useAuth } from "../../hooks/useAuth";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import RewardsWidget from "../../components/rewards/RewardsWidget";
import PriorityBadge from "../../components/grievances/PriorityBadge";
import StatusBadge from "../../components/grievances/StatusBadge";
import { CATEGORY_LABELS } from "../../utils/constants";
import { formatRelative, toDisplayText } from "../../utils/helpers";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [grievances, setGrievances] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });

  const [heroText, setHeroText] = useState("");
  const [heroFile, setHeroFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef();
  const recognitionRef = useRef(null);

  useEffect(() => {
    getMyGrievances({ limit: 6 }).then((res) => {
      setGrievances(res.data.items);
      const items = res.data.items;
      setStats({
        total: res.data.total,
        active: items.filter((g) => g.status !== "CLOSED").length,
        resolved: items.filter((g) => g.status === "CLOSED").length,
      });
    });
  }, []);

  const toggleVoice = () => {
    if (!SpeechRecognition) return;

    if (recording) {
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
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
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
        {getGreeting()}, {user?.name?.split(" ")[0]} 👋
      </div>
      <div className="dashboard-hero-subtitle">How can we help you today?</div>

      <div className="hero-input-card">
        <textarea
          rows={2}
          value={heroText}
          onChange={(e) => setHeroText(e.target.value)}
          placeholder="Tell us what happened..."
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
                {recording ? "Stop" : "Voice"}
              </button>
            )}
            <button type="button" className="hero-input-icon-btn" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={13} /> {heroFile ? heroFile.name.slice(0, 16) : "Upload"}
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
        <div className="stats-pill"><strong>{stats.total}</strong><span>Total</span></div>
        <span className="stats-pill-divider" />
        <div className="stats-pill"><strong>{stats.active}</strong><span>Active</span></div>
        <span className="stats-pill-divider" />
        <div className="stats-pill"><strong>{stats.resolved}</strong><span>Resolved</span></div>
      </div>

      <RewardsWidget />

      <div className="section-title" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Active Complaints</span>
        <Link to="/citizen/grievances" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          View all <ArrowRight size={13} />
        </Link>
      </div>

      {grievances === null ? (
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