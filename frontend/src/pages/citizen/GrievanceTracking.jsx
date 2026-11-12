import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  Building2,
  Camera,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  MapPin,
  MessageSquareQuote,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react";
import { getTracking, updateFeedback } from "../../services/trackingService";
import { requestReopen, deleteGrievance, verifyResolution } from "../../services/grievanceService";
import { uploadsBaseUrl } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { formatDate, formatDateTime, formatRelative, getErrorMessage, toDisplayText } from "../../utils/helpers";
import { CATEGORY_LABELS, STATUS_LABELS } from "../../utils/constants";
import StatusBadge from "../../components/grievances/StatusBadge";
import PriorityBadge from "../../components/grievances/PriorityBadge";
import TrackingTimeline from "../../components/tracking/TrackingTimeline";
import SlaCountdown from "../../components/tracking/SlaCountdown";
import StarRating from "../../components/tracking/StarRating";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorState from "../../components/common/ErrorState";
import Modal from "../../components/common/Modal";

// How often the page re-reads the case while it is open. Deliberately gentle:
// this is a status page people leave on a phone screen, not a live feed, and
// a status change is pushed by notification the moment it happens.
const REFRESH_MS = 45000;

const GrievanceTracking = () => {
  const { grievanceId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    return getTracking(grievanceId)
      .then((res) => {
        setData(res.data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setRefreshing(false));
  }, [grievanceId]);

  useEffect(() => {
    load();
  }, [load]);

  // While the case is still moving, keep it current. A finished case doesn't
  // change by itself, so the interval is simply never set up again — the
  // effect re-runs when `live` flips and tears itself down.
  const live = Boolean(data) && !["CLOSED", "REJECTED", "WITHDRAWN"].includes(data.status);

  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [live, load]);

  if (error && !data) return <ErrorState description={error} onRetry={() => load()} />;
  if (!data) return <div className="page-loading"><LoadingSpinner label="Loading your tracking page..." /></div>;

  const { stage, sla, permissions, feedback, reopen, resolution, officer, remarks, notifications, override, flag } = data;

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(data.grievance_id);
      toast.success("Reference copied");
    } catch {
      toast.error("Your browser blocked the clipboard — the reference is shown above");
    }
  };

  const runAction = async (fn, successMessage, close) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMessage);
      await load();
      close?.();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openFeedback = () => {
    setRating(feedback?.rating || 0);
    setComment(feedback?.comment || "");
    setFeedbackOpen(true);
  };

  // One call for both halves of the verdict: confirming the fix closes the
  // case, and the rating/comment ride along with it. A citizen who only wants
  // to tap stars uses /feedback, which never changes the state.
  const submitFeedback = async (closeCase) =>
    runAction(
      () => (closeCase
        ? verifyResolution(grievanceId, { verified: true, feedback: comment.trim() || undefined, rating: rating || undefined })
        : updateFeedback(grievanceId, { rating, feedback: comment.trim() || undefined })),
      closeCase ? "Thank you — your case is marked resolved" : "Feedback saved",
      () => setFeedbackOpen(false),
    );

  const visibleNotifications = showAllNotifications ? notifications : notifications.slice(0, 4);

  return (
    <div className="track-page">
      <div className="track-topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/citizen/grievances")}>
          <ArrowLeft size={14} /> My grievances
        </button>
        <div className="track-topbar-actions">
          <Link className="btn btn-ghost btn-sm" to={`/citizen/grievances/${data.grievance_id}`}>
            <FileText size={14} /> Full case file
          </Link>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => load(true)}
            aria-label="Refresh status"
            title="Check for updates"
          >
            <RefreshCcw size={14} className={refreshing ? "spin" : undefined} />
          </button>
        </div>
      </div>
      {/* ---------------- Identity + where it stands ---------------- */}
      <section className="card track-hero">
        <div className="track-hero-head">
          <button type="button" className="track-reference" onClick={copyReference} title="Copy reference number">
            <span>{toDisplayText(data.grievance_id)}</span>
            <Copy size={13} />
          </button>
          <div className="badge-row">
            <StatusBadge status={data.status} />
            <PriorityBadge priority={data.priority} />
          </div>
        </div>

        <h1 className="track-title">{toDisplayText(data.title, "Untitled grievance")}</h1>

        <div className="track-stage-row">
          <div className="track-stage-label">
            {override ? override.label : stage.label}
          </div>
          <div className="track-stage-percent">{stage.progress_percent}%</div>
        </div>
        <div className="track-progress-track">
          <span className="track-progress-fill" style={{ width: `${stage.progress_percent}%` }} />
        </div>
        <p className="track-stage-description">
          {override ? "This case has left the normal path — the reason is below." : toDisplayText(stage.description, "")}
        </p>

        <div className="track-hero-meta">
          <span><CalendarClock size={13} /> Filed {formatDate(data.submitted_at)}</span>
          <span><BadgeCheck size={13} /> Updated {formatRelative(data.latest_update_at)}</span>
          <span><MapPin size={13} /> {toDisplayText(data.location?.address || data.district, "Location on file")}</span>
        </div>
      </section>

      {override && (
        <section className={`card ${override.state === "REJECTED" ? "card-danger" : "card-warning"}`}>
          <div className="card-head">
            <ShieldAlert size={15} color="var(--danger)" />
            <strong>{toDisplayText(override.label)}</strong>
          </div>
          <p className="prose-sm">
            {toDisplayText(override.reason || data.rejection?.reason,
              "The department gave no written reason. Ask through your updates or reply to the notice we sent you.")}
          </p>
        </section>
      )}

      {/* ---------------- SLA + facts ---------------- */}
      <section className="grid grid-2 track-facts">
        <div className="card">
          <div className="section-title">Expected resolution date</div>
          <SlaCountdown sla={sla} />
        </div>

        <div className="card">
          <div className="section-title">Who has your case</div>
          <div className="stack-tight">
            <div className="kv-row">
              <span><Building2 size={13} /> Department</span>
              <strong>{toDisplayText(data.department)}</strong>
            </div>
            <div className="kv-row">
              <span><MapPin size={13} /> District</span>
              <strong>{toDisplayText(data.district)}</strong>
            </div>
            <div className="kv-row">
              <span><UserCheck size={13} /> Officer</span>
              <strong>
                {officer.assigned
                  ? toDisplayText(officer.designation)
                  : "Not yet picked up"}
              </strong>
            </div>
            {officer.since && (
              <div className="kv-row">
                <span><BadgeCheck size={13} /> Assigned</span>
                <strong>{formatRelative(officer.since)}</strong>
              </div>
            )}
            <div className="kv-row">
              <span><FileText size={13} /> Category</span>
              <strong>{toDisplayText(CATEGORY_LABELS[data.category] || data.category)}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Progress ladder ---------------- */}
      <section className="card">
        <div className="section-title">Progress</div>
        <TrackingTimeline stages={data.stages} override={override} />
      </section>

      {/* ---------------- Officer remarks ---------------- */}
      <section className="card">
        <div className="section-title">
          Updates from the department
          <span className="track-count">{remarks.length}</span>
        </div>
        {remarks.length === 0 ? (
          <p className="prose-sm muted-note">
            Nothing written yet. When an officer posts an update meant for you it appears here, and you get a notification.
          </p>
        ) : (
          <ul className="track-remarks">
            {remarks.map((remark) => (
              <li key={remark.remark_id || remark.created_at} className="track-remark">
                <MessageSquareQuote size={15} />
                <div>
                  <p>{toDisplayText(remark.text)}</p>
                  <span className="track-remark-meta">
                    {toDisplayText(remark.designation, "Department")} · {formatRelative(remark.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- Resolution + evidence ---------------- */}
      {resolution.note && (
        <section className="card card-accent">
          <div className="card-head">
            <CheckCircle2 size={15} color="var(--success)" />
            <strong>What the department says was done</strong>
            <span className="track-count">{formatRelative(resolution.submitted_at)}</span>
          </div>
          <p className="prose">{toDisplayText(resolution.note)}</p>

          {resolution.evidence?.length > 0 && (
            <>
              <div className="sub-head"><Camera size={12} /> Before-and-after photographs</div>
              <div className="thumb-row">
                {resolution.evidence.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    className="thumb track-thumb"
                    onClick={() => setEvidenceOpen({ url, index })}
                    title={`Photograph ${index + 1}`}
                  >
                    <img src={`${uploadsBaseUrl}${url}`} alt={`Resolution evidence ${index + 1}`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------------- Feedback ---------------- */}
      <section className="card">
        <div className="section-title">Your satisfaction</div>
        {/* A display of the standing rating, never the control that changes it:
            collecting a rating needs the comment box and the confirm/cancel
            choices alongside it, so the only interactive stars on this page
            are the ones inside the modal. */}
        <StarRating value={feedback.rating || 0} readOnly />
        {feedback.comment && <p className="quote-note">“{toDisplayText(feedback.comment)}”</p>}

        {permissions.can_give_feedback ? (
          <div className="stack-tight">
            <button className="btn btn-primary btn-block" onClick={openFeedback}>
              {feedback.rating ? "Change your rating" : "Rate the resolution"}
            </button>
            <p className="form-hint">
              {data.status === "CITIZEN_VERIFICATION"
                ? "Confirming the fix closes your case. You can still ask for it to be reopened afterwards."
                : "Your case is closed — you can still correct this rating."}
            </p>
          </div>
        ) : (
          <p className="muted-note">
            {data.status === "REJECTED"
              ? "There is nothing to rate on a rejected report."
              : "You can rate the fix once the department submits one."}
          </p>
        )}
      </section>

      {/* ---------------- Reopen ---------------- */}
      <section className="card">
        <div className="section-title">Is it actually fixed?</div>
        {reopen.request_status === "PENDING" ? (
          <p className="prose-sm">
            Your request to reopen this case is with {toDisplayText(data.department, "the department")} for review.
            Filed {formatRelative(reopen.requested_at)}.
          </p>
        ) : reopen.request_status === "REJECTED" ? (
          <p className="prose-sm">
            A reopen request was reviewed and declined.
            {reopen.review_note && <> Their reason: “{toDisplayText(reopen.review_note)}”</>}
          </p>
        ) : reopen.count > 0 ? (
          <p className="prose-sm">This case has been reopened {reopen.count} time{reopen.count > 1 ? "s" : ""}.</p>
        ) : null}

        {permissions.can_request_reopen ? (
          <button className="btn btn-secondary btn-block" onClick={() => setReopenOpen(true)}>
            <RotateCcw size={15} /> Request to reopen
          </button>
        ) : (
          /* Explains a missing button, which is only useful when no request is
             already sitting in front of the department — the pending line above
             says that for itself. */
          data.status === "CLOSED" && !reopen.can_request && reopen.request_status !== "PENDING" && (
            <p className="muted-note">
              A reopen request can be made within {reopen.window_days} days of the fix
              ({reopen.max} per case). {reopen.count >= reopen.max ? "This case has used them." : ""}
            </p>
          )
        )}
      </section>

      {/* ---------------- Notification history ---------------- */}
      <section className="card">
        <div className="section-title">
          Everything we sent you about this case
          <span className="track-count">{notifications.length}</span>
        </div>
        {notifications.length === 0 ? (
          <p className="muted-note">No notices yet.</p>
        ) : (
          <>
            <ul className="track-notifications">
              {visibleNotifications.map((note, index) => (
                <li key={`${note.created_at}-${index}`} className={`track-notification${note.read ? "" : " unread"}`}>
                  <BellRing size={14} />
                  <div>
                    <strong>{toDisplayText(note.title, "Update")}</strong>
                    <p>{toDisplayText(note.message)}</p>
                    <span>{formatDateTime(note.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
            {notifications.length > 4 && (
              <button className="btn btn-ghost btn-sm btn-block" onClick={() => setShowAllNotifications((v) => !v)}>
                <ChevronDown size={14} className={showAllNotifications ? "spin-up" : undefined} />
                {showAllNotifications ? "Show fewer" : `Show all ${notifications.length}`}
              </button>
            )}
          </>
        )}
      </section>

      {permissions.can_withdraw && (
        <section className="card danger-zone">
          <div className="danger-zone-content">
            <strong>Withdraw this report</strong>
            <p className="muted-note">
              Only possible while no officer has accepted it. It is recorded as withdrawn, not erased —
              the reference stays in the system.
            </p>
          </div>
          <button className="btn btn-danger btn-sm danger-zone-btn" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} /> Withdraw
          </button>
        </section>
      )}

      {flag.flagged && (
        <section className="card card-danger">
          <div className="card-head">
            <ShieldAlert size={15} color="var(--danger)" />
            <strong>Marked as false or misleading</strong>
          </div>
          <p className="prose-sm">{toDisplayText(flag.reason, "A reviewing officer could not confirm this report.")}</p>
          {flag.appeal_status && <p className="muted-note">Appeal status: {toDisplayText(flag.appeal_status)}</p>}
          <Link className="btn btn-secondary btn-sm" to={`/citizen/grievances/${data.grievance_id}`}>
            Review and appeal
          </Link>
        </section>
      )}

      <p className="track-footnote">
        Status changes are recorded on your case the moment they happen, with who made them.
        {STATUS_LABELS[data.status] ? ` Currently: ${STATUS_LABELS[data.status]}.` : ""}
      </p>

      {/* ---------------- Modals ---------------- */}
      <Modal
        open={feedbackOpen}
        title="How was the resolution?"
        onClose={() => setFeedbackOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFeedbackOpen(false)}>Cancel</button>
            {data.status === "CITIZEN_VERIFICATION" && (
              <button className="btn btn-secondary" disabled={busy || !rating}
                      onClick={() => submitFeedback(false)}>
                Save rating only
              </button>
            )}
            <button className="btn btn-primary" disabled={busy || !rating}
                    onClick={() => submitFeedback(data.status === "CITIZEN_VERIFICATION")}>
              {data.status === "CITIZEN_VERIFICATION" ? "Confirm resolved" : "Save feedback"}
            </button>
          </>
        }
      >
        <div className="stack-tight">
          <p className="prose-sm">
            Your rating is how the department is measured on this kind of issue. It does not change your case status.
          </p>
          <div className="track-modal-rating">
            <StarRating value={rating} onChange={setRating} size={34} />
          </div>
          <div>
            <label className="form-label">Anything to add? (optional)</label>
            <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)}
                      placeholder="Was the work complete, timely, courteous?" />
          </div>
        </div>
      </Modal>

      <Modal
        open={reopenOpen}
        title="Request to reopen this case"
        onClose={() => setReopenOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReopenOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || reopenReason.trim().length < 10}
                    onClick={() => runAction(
                      () => requestReopen(grievanceId, reopenReason.trim()),
                      "Reopen request submitted — awaiting staff review",
                      () => { setReopenOpen(false); setReopenReason(""); },
                    )}>
              Submit request
            </button>
          </>
        }
      >
        <p className="modal-intro">
          This goes to {toDisplayText(data.department, "the department")} for review; it does not reopen the case by itself.
        </p>
        <label className="form-label">What is still wrong? (10+ characters)</label>
        <textarea className="textarea" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Describe what was not fixed — the more specific, the faster it can be checked." />
      </Modal>

      <Modal
        open={deleteOpen}
        title="Withdraw this grievance?"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteOpen(false)}>Keep it</button>
            <button className="btn btn-danger" disabled={busy}
                    onClick={() => runAction(async () => {
                      await deleteGrievance(grievanceId);
                      navigate("/citizen/grievances");
                    }, "Grievance withdrawn")}>
              <Trash2 size={14} /> Withdraw
            </button>
          </>
        }
      >
        <p className="prose">
          Points earned for filing it are reversed, and it leaves the department's queue.
          If the problem is still there, you can report it again.
        </p>
      </Modal>

      <Modal
        open={!!evidenceOpen}
        title={`Resolution photograph ${evidenceOpen ? evidenceOpen.index + 1 : ""}`}
        onClose={() => setEvidenceOpen(null)}
        footer={<button className="btn btn-secondary" onClick={() => setEvidenceOpen(null)}>Close</button>}
      >
        {evidenceOpen && (
          <img className="track-evidence-full" src={`${uploadsBaseUrl}${evidenceOpen.url}`}
               alt="Resolution evidence photograph" />
        )}
      </Modal>
    </div>
  );
};

export default GrievanceTracking;
