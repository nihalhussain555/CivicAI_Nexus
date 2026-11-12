import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MapPin, Clock, Sparkles, ArrowLeft, CheckCircle2, XCircle, PlayCircle, Send, AlertTriangle, ImageIcon, Mic, RotateCcw, ShieldQuestion, ShieldCheck, ShieldAlert, Gavel, Trash2, Radar, MessageSquare, Ban,} from "lucide-react";
import { getGrievance, acceptCase, startProgress, submitResolution, escalateCase, verifyResolution, requestReopen, reviewReopenRequest, deleteGrievance, getCopilotBrief, triageIntegrity, unflagGrievance, appealFlag, reviewFlagAppeal,} from "../../services/grievanceService";
import { addRemark, rejectGrievance } from "../../services/trackingService";
import { uploadsBaseUrl } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, formatDateTime } from "../../utils/helpers";
import { CATEGORY_LABELS } from "../../utils/constants";
import PriorityBadge from "../../components/grievances/PriorityBadge";
import StatusBadge from "../../components/grievances/StatusBadge";
import ComplaintTimeline from "../../components/grievances/ComplaintTimeline";
import AuthenticityCard from "../../components/grievances/AuthenticityCard";
import CopilotPanel from "../../components/ai/CopilotPanel";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorState from "../../components/common/ErrorState";
import Modal from "../../components/common/Modal";

const roleBasePath = { citizen: "/citizen/grievances", officer: "/officer/grievances", admin: "/admin/grievances" };

// Mirrors the states VALID_TRANSITIONS lets REJECTED be reached from
// (backend/app/models/grievance.py). Offering the button anywhere else would
// only produce a 400 after the officer has written out their reason.
const REJECTABLE_STATUSES = [
  "SUBMITTED", "AI_ANALYZED", "DEPARTMENT_ASSIGNED",
  "OFFICER_ACCEPTED", "IN_PROGRESS", "ESCALATED",
];

// The two audiences a remark can have. Kept as a list so the modal and the
// staff-visible remarks card describe them in the same words.
const AUDIENCES = [
  {
    key: "PUBLIC",
    label: "Update for the citizen",
    hint: "Appears on their tracking page and sends them a notification. Write it for them — plain words, no names or internal jargon.",
    placeholder: "e.g. A drainage crew is scheduled for your street tomorrow morning.",
  },
  {
    key: "INTERNAL",
    label: "Internal note",
    hint: "Stays on the case file for the department. It is never sent to the citizen.",
    placeholder: "e.g. Waiting on the vendor quote before dispatching a crew.",
  },
];

// Leaflet only downloads when a case actually has coordinates to plot — this
// page is opened dozens of times a shift and most of them don't need a map.
const GrievanceMap = lazy(() => import("../../components/maps/mapKit"));

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

  const [reopenRequestOpen, setReopenRequestOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const [reopenReviewOpen, setReopenReviewOpen] = useState(null); // true (approve) / false (reject)
  const [reopenReviewNote, setReopenReviewNote] = useState("");

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [remarkOpen, setRemarkOpen] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [remarkAudience, setRemarkAudience] = useState("PUBLIC");

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Integrity decisions share one modal because they all need a reason on
  // record and all reload the case afterwards. `kind` picks the wording and
  // the endpoint; `null` keeps it closed.
  const [integrityModal, setIntegrityModal] = useState(null);
  // triage: {kind:"triage", decision:"GENUINE"|"FAKE"}
  // unflag: {kind:"unflag"}
  // appeal: {kind:"appeal", approve:boolean}
  // citizen: {kind:"citizen"}
  const [integrityNote, setIntegrityNote] = useState("");

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
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const openIntegrity = (config) => {
    setIntegrityNote("");
    setIntegrityModal(config);
  };

  const submitIntegrity = async () => {
    const note = integrityNote.trim();
    const kind = integrityModal.kind;
    let done;

    // The reason the citizen reads back is the one typed here, so each message
    // names what actually changed for them rather than what was clicked.
    if (kind === "triage") {
      done = await runAction(
        () => triageIntegrity(grievanceId, {
          decision: integrityModal.decision,
          note: note || undefined,
        }),
        integrityModal.decision === "FAKE"
          ? "Marked as false or misleading"
          : "Confirmed genuine — held points released",
      );
    } else if (kind === "unflag") {
      done = await runAction(
        () => unflagGrievance(grievanceId, note),
        "Flag reversed and points restored",
      );
    } else if (kind === "appeal") {
      done = await runAction(
        () => reviewFlagAppeal(grievanceId, { approve: integrityModal.approve, note }),
        integrityModal.approve ? "Appeal upheld — flag reversed" : "Appeal rejected — flag stands",
      );
    } else {
      done = await runAction(
        () => appealFlag(grievanceId, note),
        "Appeal sent for review",
      );
    }

    if (done) setIntegrityModal(null);
  };

  const openRemark = () => {
    setRemarkText("");
    setRemarkAudience("PUBLIC");
    setRemarkOpen(true);
  };

  const submitRemark = async () => {
    const done = await runAction(
      () => addRemark(grievanceId, { text: remarkText.trim(), audience: remarkAudience }),
      remarkAudience === "PUBLIC" ? "Update posted — the citizen has been notified" : "Internal note added",
    );
    if (done) setRemarkOpen(false);
  };

  const submitRejection = async () => {
    const done = await runAction(
      () => rejectGrievance(grievanceId, rejectReason.trim()),
      "Case rejected",
    );
    if (done) setRejectOpen(false);
  };

  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!grievance) return <div className="page-loading"><LoadingSpinner label="Loading grievance..." /></div>;

  const isOwnerCitizen = user.role === "citizen" && grievance.citizen_id === user.id;
  const isStaff = user.role === "officer" || user.role === "admin";
  const basePath = roleBasePath[user.role];

  const appealPending = grievance.flag_appeal_status === "PENDING";
  // Two appeals is the backend ceiling (app/models/grievance.py). Hiding the
  // button once it's reached is kinder than a 400 after they've typed it out.
  const appealsExhausted = (grievance.flag_appeal_count || 0) >= 2;
  // A staff member can judge any live case, not only the ones the scorer
  // was unsure about — a report can read perfectly plausibly and still be
  // knowingly false, and "genuine" is a decision worth recording either way.
  const canTriage =
    isStaff && !grievance.flagged_invalid && !appealPending && !grievance.integrity?.human_decision;

  const copy = integrityModal && (() => {
    const { kind } = integrityModal;
    if (kind === "citizen") return {
      title: "Appeal this decision",
      body: "A reviewing officer who did not make the original decision reads this along with your report. "
        + "Say what is accurate about it — a photograph of the site, a date, a witness.",
      label: "Why was this flag wrong? (required)",
      placeholder: "Explain what happened...",
      submit: "Send appeal",
      min: 10,
    };
    if (kind === "unflag") return {
      title: "Reverse the false-report flag?",
      body: "Restores the civic points the flag took back and records your reason on the case. "
        + "Use this when the flag turns out to have been wrong.",
      label: "Why is the flag being reversed? (required)",
      placeholder: "What convinced you this report is genuine?",
      submit: "Reverse flag",
      min: 5,
    };
    if (kind === "appeal") return integrityModal.approve ? {
      title: "Uphold this appeal?",
      body: "Agreeing with the citizen reverses the flag, restores their points, and clears the integrity mark "
        + "on this report.",
      label: "Reason (required — the citizen reads this)",
      placeholder: "What made you accept the appeal?",
      submit: "Uphold appeal",
      min: 5,
    } : {
      title: "Keep the flag?",
      body: "The citizen's points stay reversed and the flag stands. Your note is the only explanation they get, "
        + "so it should say what was wrong with the report.",
      label: "Reason (required — the citizen reads this)",
      placeholder: "Why does the flag stand?",
      submit: "Reject appeal",
      min: 5,
      danger: true,
    };
    return integrityModal.decision === "FAKE" ? {
      title: "Mark this report as false or misleading?",
      body: "Reverses the civic points earned for it and lowers the account's trust. The citizen sees your reason "
        + "and can appeal — the report is not deleted, and the department still works it.",
      label: "Reason (required)",
      placeholder: "What makes this false or misleading?",
      submit: "Flag as false",
      min: 5,
      danger: true,
    } : {
      title: "Confirm this report is genuine?",
      body: "Clears the review flag and releases any civic points withheld while it was suspected. "
        + "The scored breakdown stays on file, and the detector learns from your decision.",
      label: "Note for the record (optional)",
      placeholder: "Anything that helped you decide...",
      submit: "Confirm genuine",
      min: 0,
    };
  })();

  const activeAudience = AUDIENCES.find((option) => option.key === remarkAudience);

  return (
    <div>
      <div className="detail-back-row">
        <button className="btn btn-ghost btn-sm btn-back" onClick={() => navigate(basePath)}>
          <ArrowLeft size={14} /> Back
        </button>
        {/* The citizen's own case page is the tracking view; this file is the
            full record behind it. Staff have no tracking page, so the link
            only appears for the reporter. */}
        {isOwnerCitizen && (
          <Link className="btn btn-secondary btn-sm" to={`/citizen/track/${grievance.grievance_id}`}>
            <Radar size={14} /> Live tracking
          </Link>
        )}
      </div>

      <div className="page-header">
        <div>
          <div className="badge-row">
            <span className="record-id">{grievance.grievance_id}</span>
            <StatusBadge status={grievance.status} />
            <PriorityBadge priority={grievance.priority} />
            {grievance.incident_id && (
              <Link to={`/${user.role}/incidents/${grievance.incident_id}`} className="badge badge-status">
                <AlertTriangle size={11} /> Part of community incident
              </Link>
            )}
          </div>
          <h1>{grievance.title}</h1>
        </div>
      </div>

      <div className="grid detail-split">
        <div className="stack">
          <div className="card">
            <div className="section-title">Description</div>
            <p className="prose">{grievance.description}</p>

            {grievance.voice_transcript && (
              <div className="note-box">
                <div className="sub-head">
                  <Mic size={12} /> Voice transcript
                </div>
                <p className="prose-sm">{grievance.voice_transcript}</p>
              </div>
            )}

            {grievance.attachments?.length > 0 && (
              <div className="card-section">
                <div className="sub-head">
                  <ImageIcon size={12} /> Attachments
                </div>
                <div className="thumb-row">
                  {grievance.attachments.map((a, i) => (
                    <img key={i} className="thumb" src={`${uploadsBaseUrl}${a.url}`} alt={a.filename || "attachment"} />
                  ))}
                </div>
              </div>
            )}

            <div className="meta-row">
              <span className="meta-item">
                <MapPin size={13} /> {grievance.location?.address || "No location provided"}
                {grievance.district && <span className="badge badge-status">{grievance.district}</span>}
              </span>
              <span className="meta-item">
                <Clock size={13} /> Reported {formatDateTime(grievance.created_at)}
              </span>
            </div>

            {grievance.location?.coordinates?.length === 2 && (
              <div className="card-section">
                <div className="sub-head">
                  <MapPin size={12} /> Where it was reported
                </div>
                <Suspense fallback={<div className="map-shell" style={{ height: 220, opacity: 0.5 }} />}>
                  <GrievanceMap
                    grievances={[grievance]}
                    fitKey={grievance.grievance_id}
                    height={220}
                    showIncidents={false}
                  />
                </Suspense>
                <p className="form-hint">
                  {grievance.location.address || "Pinned from the citizen's device — the map shows where the report was filed."}
                </p>
              </div>
            )}
          </div>

          <div className="card card-accent">
            <div className="card-head">
              <Sparkles size={15} color="var(--accent)" />
              <strong>AI Analysis</strong>
              <span className="ai-tag">AI generated</span>
            </div>
            <div className="grid grid-2">
              <div><div className="data-label">Category</div>
                <strong>{CATEGORY_LABELS[grievance.category] || grievance.category}</strong></div>
              <div><div className="data-label">Severity</div>
                <PriorityBadge priority={grievance.severity} /></div>
              <div><div className="data-label">AI Confidence</div>
                <strong>{Math.round((grievance.confidence || 0) * 100)}%</strong></div>
              <div><div className="data-label">Escalation Risk</div>
                <strong>{grievance.escalation_risk}</strong></div>
            </div>
            {grievance.ai_summary && (
              <p className="prose-sm card-section">{grievance.ai_summary}</p>
            )}
          </div>

          {isStaff && (
            <AuthenticityCard
              authenticity={grievance.authenticity}
              integrity={grievance.integrity}
              canTriage={canTriage}
              onDecision={openIntegrity}
            />
          )}

          {/* Staff see both audiences. This is the only place the internal
              shift notes appear at all — the citizen's tracking page is built
              from the PUBLIC subset, so seeing it here shows the officer
              exactly what the reporter does and what they don't. */}
          {isStaff && grievance.remarks?.length > 0 && (
            <div className="card">
              <div className="section-title">Case remarks</div>
              <ul className="track-remarks">
                {[...grievance.remarks].reverse().map((remark) => (
                  <li key={remark.remark_id} className="track-remark">
                    <MessageSquare size={14} />
                    <div>
                      <p className="prose">{remark.text}</p>
                      <span className="track-remark-meta">
                        {remark.author_name} · {formatDateTime(remark.created_at)}
                      </span>
                      <span className={`badge ${remark.audience === "PUBLIC" ? "badge-low" : "badge-neutral"}`}>
                        {remark.audience === "PUBLIC" ? "Visible to citizen" : "Internal"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {grievance.resolution_note && (
            <div className="card">
              <div className="section-title">Resolution</div>
              <p className="prose">{grievance.resolution_note}</p>
              {grievance.citizen_feedback && (
                <p className="quote-note">
                  Citizen feedback: "{grievance.citizen_feedback}"
                </p>
              )}
            </div>
          )}

          {/* What a flagged case looks like to the person who filed it: the
              reason in plain words and the appeal route, never the signals or
              weights behind the score. */}
          {isOwnerCitizen && grievance.flagged_invalid && (
            <div className="card card-danger">
              <div className="card-head">
                <ShieldAlert size={15} color="var(--danger)" />
                <strong>Marked as false or misleading</strong>
                {appealPending
                  ? <span className="badge badge-medium">Appeal pending</span>
                  : grievance.flag_appeal_status
                    ? <span className={`badge ${grievance.flag_appeal_status === "APPROVED" ? "badge-low" : "badge-critical"}`}>
                        {grievance.flag_appeal_status === "APPROVED" ? "Appeal upheld" : "Appeal rejected"}
                      </span>
                    : <span className="badge badge-neutral">No appeal yet</span>}
              </div>
              <p className="prose-sm">
                {grievance.flagged_reason || "A reviewing officer could not confirm this report."}
              </p>
              <p className="muted-note card-section">
                Your civic points for this report were reversed. The report itself is still visible to the
                department and still counts towards the issue being fixed — nothing was deleted.
              </p>
              {grievance.flag_appeal_reason && (
                <p className="muted-note card-section">
                  <strong>Your appeal: </strong>{grievance.flag_appeal_reason}
                </p>
              )}
              {grievance.flag_appeal_note && (
                <p className="quote-note">
                  Reviewer's note: "{grievance.flag_appeal_note}"
                </p>
              )}
            </div>
          )}

          {/* The same reason the tracking page shows as an override banner — the
              case file stays truthful for staff, who also get who decided it. */}
          {grievance.rejection_reason && (
            <div className="card card-danger">
              <div className="card-head">
                <Ban size={15} color="var(--danger)" />
                <strong>Rejected — the department will not action this</strong>
              </div>
              <p className="prose">{grievance.rejection_reason}</p>
              {isStaff && grievance.rejected_by_name && (
                <p className="muted-note card-section">
                  By {grievance.rejected_by_name} · {formatDateTime(grievance.rejected_at)}
                </p>
              )}
            </div>
          )}

          {grievance.reopen_request_status && (
            <div className={`card${grievance.reopen_request_status === "PENDING" ? " card-warning" : ""}`}>
              <div className="card-head">
                <ShieldQuestion size={15} />
                <strong>Reopen Request</strong>
                <span className={`badge ${
                  grievance.reopen_request_status === "PENDING" ? "badge-medium" :
                  grievance.reopen_request_status === "APPROVED" ? "badge-low" : "badge-critical"
                }`}>
                  {grievance.reopen_request_status}
                </span>
              </div>
              <p className="prose-sm">{grievance.reopen_reason}</p>
              {grievance.reopen_review_note && (
                <p className="quote-note">
                  Staff note: "{grievance.reopen_review_note}"
                </p>
              )}
            </div>
          )}

          {isStaff && <CopilotPanel brief={copilotBrief} loading={copilotLoading} onRefresh={loadCopilot} />}
        </div>

        <div className="stack">
          <div className="card">
            <div className="section-title">Actions</div>
            <div className="stack-tight">
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
              {/* Remarks and rejection are the two tracking-system capabilities
                  that exist nowhere else in this UI, so they live here next to
                  the workflow buttons that move the case along. */}
              {isStaff && (
                <button className="btn btn-secondary btn-block" disabled={actionLoading} onClick={openRemark}>
                  <MessageSquare size={15} /> Post an update
                </button>
              )}
              {isStaff && REJECTABLE_STATUSES.includes(grievance.status) && (
                <button className="btn btn-danger btn-block" onClick={() => setRejectOpen(true)}>
                  <Ban size={15} /> Reject case
                </button>
              )}
              {isOwnerCitizen
                && ["SUBMITTED", "AI_ANALYZED", "DEPARTMENT_ASSIGNED"].includes(grievance.status)
                && !grievance.has_assigned_officer && (
                <button className="btn btn-danger btn-block" disabled={actionLoading}
                        onClick={() => setDeleteConfirmOpen(true)}>
                  <Trash2 size={15} /> Delete grievance
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
              {isOwnerCitizen && grievance.status === "CLOSED" && grievance.reopen_request_status === "PENDING" && (
                <p className="prose-sm">
                  Your request to reopen this case is awaiting staff review.
                </p>
              )}
              {isOwnerCitizen && grievance.status === "CLOSED" && grievance.reopen_request_status !== "PENDING" && (
                <button className="btn btn-secondary btn-block" onClick={() => setReopenRequestOpen(true)}>
                  <RotateCcw size={15} /> Request to reopen
                </button>
              )}
              {isStaff && grievance.reopen_request_status === "PENDING" && (
                <>
                  <button className="btn btn-primary btn-block" disabled={actionLoading}
                          onClick={() => setReopenReviewOpen(true)}>
                    <CheckCircle2 size={15} /> Approve reopen
                  </button>
                  <button className="btn btn-secondary btn-block" disabled={actionLoading}
                          onClick={() => setReopenReviewOpen(false)}>
                    <XCircle size={15} /> Reject reopen
                  </button>
                </>
              )}
              {/* Integrity: nothing here changes the case's stage, only what
                  the platform believes about it. */}
              {isStaff && appealPending && (
                <>
                  <button className="btn btn-primary btn-block" onClick={() => openIntegrity({ kind: "appeal", approve: true })}>
                    <ShieldCheck size={15} /> Uphold appeal
                  </button>
                  <button className="btn btn-secondary btn-block" onClick={() => openIntegrity({ kind: "appeal", approve: false })}>
                    <ShieldAlert size={15} /> Keep the flag
                  </button>
                </>
              )}
              {isStaff && grievance.flagged_invalid && !appealPending && (
                <button className="btn btn-secondary btn-block" onClick={() => openIntegrity({ kind: "unflag" })}>
                  <RotateCcw size={15} /> Reverse false-report flag
                </button>
              )}
              {isOwnerCitizen && grievance.flagged_invalid && appealPending && (
                <p className="prose-sm">
                  Your appeal is with the department and awaiting a decision. You'll be notified either way.
                </p>
              )}
              {isOwnerCitizen && grievance.flagged_invalid && !appealPending && !appealsExhausted && (
                <button className="btn btn-secondary btn-block" onClick={() => openIntegrity({ kind: "citizen" })}>
                  <Gavel size={15} /> Appeal this decision
                </button>
              )}
              {!isStaff && !isOwnerCitizen && grievance.status === "CLOSED" && (
                <p className="prose-sm">This grievance has been closed.</p>
              )}
              {isStaff && ["CLOSED", "CITIZEN_VERIFICATION", "RESOLUTION_SUBMITTED"].includes(grievance.status) && grievance.reopen_request_status !== "PENDING" && (
                <p className="prose-sm">
                  {grievance.status === "CLOSED" ? "Case closed." : "Awaiting citizen verification."}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Case Info</div>
            <div className="stack-tight">
              <div className="kv-row">
                <span>Department</span><strong>{grievance.department}</strong>
              </div>
              {/* The same name the reporter sees on their tracking page — this
                  payload is redacted for everyone, so both sides read one line. */}
              {grievance.assigned_officer_name && (
                <div className="kv-row">
                  <span>Officer</span><strong>{grievance.assigned_officer_name}</strong>
                </div>
              )}
              <div className="kv-row">
                <span>Predicted resolution</span><strong>~{grievance.predicted_resolution_hours}h</strong>
              </div>
              {grievance.sla_due_at && (
                <div className="kv-row">
                  <span>SLA due</span><strong>{formatDateTime(grievance.sla_due_at)}</strong>
                </div>
              )}
              {grievance.reopen_count > 0 && (
                <div className="kv-row">
                  <span>Reopened</span><strong>{grievance.reopen_count}×</strong>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Progress</div>
            <ComplaintTimeline status={grievance.status} history={grievance.history} />
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

      <Modal
        open={reopenRequestOpen}
        title="Request to reopen this case"
        onClose={() => setReopenRequestOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReopenRequestOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={actionLoading || reopenReason.trim().length < 10}
                    onClick={() => runAction(
                      () => requestReopen(grievanceId, reopenReason),
                      "Reopen request submitted — awaiting staff review"
                    ).then(() => { setReopenRequestOpen(false); setReopenReason(""); })}>
              Submit request
            </button>
          </>
        }
      >
        <label className="form-label">Why isn't this actually resolved?</label>
        <textarea className="textarea" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Describe what's still wrong — this goes to staff for review before the case reopens..." />
      </Modal>

      <Modal
        open={reopenReviewOpen !== null}
        title={reopenReviewOpen ? "Approve reopen request" : "Reject reopen request"}
        onClose={() => setReopenReviewOpen(null)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReopenReviewOpen(null)}>Cancel</button>
            <button className={`btn ${reopenReviewOpen ? "btn-primary" : "btn-danger"}`} disabled={actionLoading}
                    onClick={() => runAction(
                      () => reviewReopenRequest(grievanceId, { approve: !!reopenReviewOpen, note: reopenReviewNote }),
                      reopenReviewOpen ? "Reopen approved — re-routed to department" : "Reopen request rejected"
                    ).then(() => { setReopenReviewOpen(null); setReopenReviewNote(""); })}>
              {reopenReviewOpen ? "Approve & reopen" : "Reject request"}
            </button>
          </>
        }
      >
        <p className="modal-intro">
          Citizen's reason: "{grievance.reopen_reason}"
        </p>
        <label className="form-label">Note (optional)</label>
        <textarea className="textarea" value={reopenReviewNote} onChange={(e) => setReopenReviewNote(e.target.value)}
                  placeholder="Add context for the citizen..." />
      </Modal>

      <Modal
        open={deleteConfirmOpen}
        title="Delete this grievance?"
        onClose={() => setDeleteConfirmOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancel</button>
            <button className="btn btn-danger" disabled={actionLoading}
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await deleteGrievance(grievanceId);
                        toast.success("Grievance deleted");
                        navigate(roleBasePath[user.role] || "/");
                      } catch (err) {
                        toast.error(getErrorMessage(err));
                      } finally {
                        setActionLoading(false);
                        setDeleteConfirmOpen(false);
                      }
                    }}>
              <Trash2 size={15} /> Delete
            </button>
          </>
        }
      >
        <p className="prose">
          This can't be undone. Once an officer accepts this case, it can no longer be deleted —
          only while it's still waiting to be picked up.
        </p>
      </Modal>
      <Modal
        open={!!integrityModal}
        title={copy?.title}
        onClose={() => setIntegrityModal(null)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIntegrityModal(null)}>Cancel</button>
            <button className={`btn ${copy?.danger ? "btn-danger" : "btn-primary"}`}
                    disabled={actionLoading || integrityNote.trim().length < (copy?.min ?? 0)}
                    onClick={submitIntegrity}>
              {copy?.submit}
            </button>
          </>
        }
      >
        {copy && (
          <div className="stack-tight">
            <p className="prose-sm">
              {copy.body}
            </p>
            {integrityModal?.kind === "appeal" && grievance.flag_appeal_reason && (
              <div className="note-box">
                <strong>Citizen's appeal: </strong>
                <span>{grievance.flag_appeal_reason}</span>
              </div>
            )}
            <div>
              <label className="form-label">{copy.label}</label>
              <textarea className="textarea" value={integrityNote}
                        onChange={(e) => setIntegrityNote(e.target.value)}
                        placeholder={copy.placeholder} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={remarkOpen}
        title="Post an update on this case"
        onClose={() => setRemarkOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRemarkOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={actionLoading || remarkText.trim().length < 3}
                    onClick={submitRemark}>
              <MessageSquare size={15} /> {remarkAudience === "PUBLIC" ? "Send update" : "Save note"}
            </button>
          </>
        }
      >
        <div className="stack-tight">
          <div>
            <div className="sub-head">Who is this for?</div>
            <div className="badge-row">
              {AUDIENCES.map((option) => (
                <button key={option.key} type="button"
                        className={`btn btn-sm ${remarkAudience === option.key ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setRemarkAudience(option.key)}>
                  {option.label}
                </button>
              ))}
            </div>
            <p className="form-hint">{activeAudience?.hint}</p>
          </div>
          <div>
            <label className="form-label">Message</label>
            <textarea className="textarea" value={remarkText}
                      onChange={(e) => setRemarkText(e.target.value)}
                      maxLength={2000}
                      placeholder={activeAudience?.placeholder} />
            <p className="form-hint">
              An update never moves the case along — use the workflow buttons for that.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={rejectOpen}
        title="Reject this report?"
        onClose={() => setRejectOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRejectOpen(false)}>Cancel</button>
            <button className="btn btn-danger" disabled={actionLoading || rejectReason.trim().length < 10}
                    onClick={submitRejection}>
              <Ban size={15} /> Reject case
            </button>
          </>
        }
      >
        <div className="stack-tight">
          <p className="prose-sm">
            The department will not act on this report. It is not deleted — it ends up as Rejected with your
            reason attached, and the citizen would have to file a fresh report if the issue is real.
          </p>
          <div>
            <label className="form-label">Reason (required — this is the whole explanation they get)</label>
            <textarea className="textarea" value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      maxLength={1000}
                      placeholder="Why can't this be acted on? e.g. the location is a private driveway, not a public road." />
            <p className="form-hint">
              {rejectReason.trim().length < 10
                ? `${10 - rejectReason.trim().length} more characters needed`
                : `${rejectReason.trim().length} characters`}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GrievanceDetail;