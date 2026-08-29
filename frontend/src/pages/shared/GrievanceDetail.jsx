import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  MapPin, Clock, Sparkles, ArrowLeft, CheckCircle2, XCircle, PlayCircle,
  Send, AlertTriangle, ImageIcon, Mic,
} from "lucide-react";
import {
  getGrievance, acceptCase, startProgress, submitResolution,
  escalateCase, verifyResolution, getCopilotBrief,
} from "../../services/grievanceService";
import { uploadsBaseUrl } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, formatDateTime, toDisplayText } from "../../utils/helpers";
import { CATEGORY_LABELS } from "../../utils/constants";
import PriorityBadge from "../../components/grievances/PriorityBadge";
import StatusBadge from "../../components/grievances/StatusBadge";
import StatusTimeline from "../../components/grievances/StatusTimeline";
import CopilotPanel from "../../components/ai/CopilotPanel";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorState from "../../components/common/ErrorState";
import Modal from "../../components/common/Modal";

const roleBasePath = { citizen: "/citizen/grievances", officer: "/officer/grievances", admin: "/admin/grievances" };

const GrievanceDetail = () => {
  const { grievanceId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [grievance, setGrievance] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [copilotBrief, setCopilotBrief] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  const [verifyOpen, setVerifyOpen] = useState(null); // true/false
  const [feedback, setFeedback] = useState("");

  const load = useCallback(() => {
    getGrievance(grievanceId)
      .then((res) => setGrievance(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [grievanceId]);

  useEffect(() => { load(); }, [load]);

  const loadCopilot = useCallback(() => {
    if (user?.role === "citizen") return;
    setCopilotLoading(true);
    getCopilotBrief(grievanceId)
      .then((res) => setCopilotBrief(res.data))
      .catch(() => {})
      .finally(() => setCopilotLoading(false));
  }, [grievanceId, user?.role]);

  useEffect(() => { loadCopilot(); }, [loadCopilot]);

  const runAction = async (fn, successMsg) => {
    setActionLoading(true);
    try {
      await fn();
      toast.success(successMsg);
      load();
      loadCopilot();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!grievance) return <div className="page-loading"><LoadingSpinner label="Loading grievance..." /></div>;

  const isOwnerCitizen = user.role === "citizen" && grievance.citizen_id === user.id;
  const isStaff = user.role === "officer" || user.role === "admin";
  const basePath = roleBasePath[user.role];
  const description = toDisplayText(grievance.description, "No description was provided for this grievance.");
  const aiSummary = toDisplayText(grievance.ai_summary, "");

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(basePath)} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "var(--text-faint)" }}>{toDisplayText(grievance.grievance_id, "—")}</span>
            <StatusBadge status={grievance.status} />
            <PriorityBadge priority={grievance.priority} />
            {grievance.incident_id && (
              <Link to={`/${user.role}/incidents/${grievance.incident_id}`} className="badge badge-status">
                <AlertTriangle size={11} /> Part of community incident
              </Link>
            )}
          </div>
          <h1>{toDisplayText(grievance.title, "Untitled grievance")}</h1>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="section-title">Description</div>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{description}</p>

            {grievance.voice_transcript && (
              <div style={{ marginTop: 14, padding: 12, background: "var(--surface-hover)", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <Mic size={12} /> Voice transcript
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>{toDisplayText(grievance.voice_transcript)}</p>
              </div>
            )}

            {grievance.attachments?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  <ImageIcon size={12} /> Attachments
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {grievance.attachments.map((a, i) => (
                    <img key={i} src={`${uploadsBaseUrl}${a.url}`} alt={a.filename || "attachment"}
                         style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 18, marginTop: 16, fontSize: 12.5, color: "var(--text-muted)", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={13} /> {grievance.location?.address || "No location provided"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={13} /> Reported {formatDateTime(grievance.created_at)}
              </span>
            </div>
          </div>

          <div className="card" style={{ borderColor: "var(--accent)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Sparkles size={15} color="var(--accent)" />
              <strong style={{ fontSize: 14 }}>CivicAI Intelligence</strong>
              <span className="ai-tag">AI generated</span>
            </div>
            <div className="grid grid-2">
              <div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Category</div>
                <strong>{toDisplayText(CATEGORY_LABELS[grievance.category] || grievance.category)}</strong></div>
              <div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Severity</div>
                <PriorityBadge priority={grievance.severity} /></div>
              <div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>AI Confidence</div>
                <strong>{Math.round((grievance.confidence || 0) * 100)}%</strong></div>
              <div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Escalation Risk</div>
                <strong>{toDisplayText(grievance.escalation_risk)}</strong></div>
            </div>
            {aiSummary ? (
              <p className="ai-response-copy" style={{ marginTop: 14 }}>{aiSummary}</p>
            ) : (
              <div className="ai-response-empty" role="status">AI description could not be generated. Please try again.</div>
            )}
          </div>

          {grievance.resolution_note && (
            <div className="card">
              <div className="section-title">Resolution</div>
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{toDisplayText(grievance.resolution_note)}</p>
              {grievance.citizen_feedback && (
                <p style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 10, fontStyle: "italic" }}>
                  Citizen feedback: "{toDisplayText(grievance.citizen_feedback)}"
                </p>
              )}
            </div>
          )}

          {isStaff && <CopilotPanel brief={copilotBrief} loading={copilotLoading} onRefresh={loadCopilot} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="section-title">Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {isStaff && grievance.status === "DEPARTMENT_ASSIGNED" && (
                <button className="btn btn-primary btn-block" disabled={actionLoading}
                        onClick={() => runAction(() => acceptCase(grievanceId), "Case accepted")}>
                  <CheckCircle2 size={15} /> Accept case
                </button>
              )}
              {isStaff && grievance.status === "OFFICER_ACCEPTED" && (
                <button className="btn btn-primary btn-block" disabled={actionLoading}
                        onClick={() => runAction(() => startProgress(grievanceId), "Marked in progress")}>
                  <PlayCircle size={15} /> Start work
                </button>
              )}
              {isStaff && grievance.status === "IN_PROGRESS" && (
                <button className="btn btn-primary btn-block" onClick={() => setResolveOpen(true)}>
                  <Send size={15} /> Submit resolution
                </button>
              )}
              {isStaff && ["DEPARTMENT_ASSIGNED", "OFFICER_ACCEPTED", "IN_PROGRESS"].includes(grievance.status) && (
                <button className="btn btn-secondary btn-block" disabled={actionLoading}
                        onClick={() => runAction(() => escalateCase(grievanceId), "Case escalated")}>
                  <AlertTriangle size={15} /> Escalate
                </button>
              )}
              {isOwnerCitizen && grievance.status === "CITIZEN_VERIFICATION" && (
                <>
                  <button className="btn btn-primary btn-block" onClick={() => setVerifyOpen(true)}>
                    <CheckCircle2 size={15} /> Confirm resolved
                  </button>
                  <button className="btn btn-secondary btn-block" onClick={() => setVerifyOpen(false)}>
                    <XCircle size={15} /> Not resolved — reopen
                  </button>
                </>
              )}
              {!isStaff && !isOwnerCitizen && grievance.status === "CLOSED" && (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>This grievance has been closed.</p>
              )}
              {isStaff && ["CLOSED", "CITIZEN_VERIFICATION", "RESOLUTION_SUBMITTED"].includes(grievance.status) && (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {grievance.status === "CLOSED" ? "Case closed." : "Awaiting citizen verification."}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Case Info</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Department</span><strong>{toDisplayText(grievance.department)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Predicted resolution</span><strong>~{toDisplayText(grievance.predicted_resolution_hours)}h</strong>
              </div>
              {grievance.sla_due_at && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>SLA due</span><strong>{formatDateTime(grievance.sla_due_at)}</strong>
                </div>
              )}
              {grievance.reopen_count > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Reopened</span><strong>{grievance.reopen_count}×</strong>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Timeline</div>
            <StatusTimeline history={grievance.history} />
          </div>
        </div>
      </div>

      <Modal
        open={resolveOpen}
        title="Submit resolution"
        onClose={() => setResolveOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setResolveOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={actionLoading || resolutionNote.trim().length < 5}
                    onClick={() => runAction(
                      () => submitResolution(grievanceId, { resolution_note: resolutionNote }),
                      "Resolution submitted"
                    ).then(() => setResolveOpen(false))}>
              Submit
            </button>
          </>
        }
      >
        <label className="form-label">What was done to resolve this?</label>
        <textarea className="textarea" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Describe the action taken..." />
      </Modal>

      <Modal
        open={verifyOpen !== null}
        title={verifyOpen ? "Confirm resolution" : "Reopen grievance"}
        onClose={() => setVerifyOpen(null)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setVerifyOpen(null)}>Cancel</button>
            <button className={`btn ${verifyOpen ? "btn-primary" : "btn-danger"}`} disabled={actionLoading}
                    onClick={() => runAction(
                      () => verifyResolution(grievanceId, { verified: !!verifyOpen, feedback }),
                      verifyOpen ? "Grievance closed — thanks for confirming!" : "Grievance reopened"
                    ).then(() => setVerifyOpen(null))}>
              {verifyOpen ? "Confirm & close" : "Reopen"}
            </button>
          </>
        }
      >
        <label className="form-label">
          {verifyOpen ? "Anything to add? (optional)" : "What's still wrong?"}
        </label>
        <textarea className="textarea" value={feedback} onChange={(e) => setFeedback(e.target.value)}
                  placeholder={verifyOpen ? "All good, thanks!" : "Describe what's still not fixed..."} />
      </Modal>
    </div>
  );
};

export default GrievanceDetail;
