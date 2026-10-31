import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  X,
  UserRound,
  Clock,
  Gavel,
  Inbox,
} from "lucide-react";
import { getIntegrityQueue, triageIntegrity, reviewFlagAppeal } from "../../services/grievanceService";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, formatRelative } from "../../utils/helpers";
import { CATEGORY_LABELS } from "../../utils/constants";
import Pagination from "../../components/common/Pagination";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Modal from "../../components/common/Modal";
import { SkeletonList } from "../../components/common/Skeleton";

const VERDICT_TABS = [
  { key: "", label: "All", countKey: null },
  { key: "LIKELY_FAKE", label: "Likely fake", countKey: "LIKELY_FAKE" },
  { key: "NEEDS_REVIEW", label: "Uncertain", countKey: "NEEDS_REVIEW" },
];

const VERDICT_STYLE = {
  LIKELY_FAKE: { color: "var(--danger, #dc2626)", bg: "var(--danger-soft)", label: "Likely fake" },
  NEEDS_REVIEW: { color: "var(--warning, #d97706)", bg: "var(--warning-soft)", label: "Uncertain" },
  LIKELY_GENUINE: { color: "var(--priority-low, #16a34a)", bg: "var(--success-soft)", label: "Likely genuine" },
};

// A case that has already been judged by a human doesn't need a second guess
// from the queue — the row says so instead of offering buttons.
const decided = (grievance) =>
  grievance.integrity?.human_decision ||
  grievance.flagged_invalid ||
  (grievance.reopen_request_status === "PENDING" && false);

const IntegrityReview = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState("queue"); // queue | appeals
  const [verdict, setVerdict] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [action, setAction] = useState(null); // { grievance, decision } | { grievance, approve }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const detailBase = `/${user.role}/grievances`;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getIntegrityQueue({
      page,
      limit: 10,
      only_appeals: tab === "appeals" || undefined,
      verdict: tab === "queue" && verdict ? verdict : undefined,
      search: search || undefined,
    })
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [tab, verdict, search, page]);

  useEffect(() => { load(); }, [load]);

  const items = data?.items || [];
  const counts = data?.queue_counts || {};

  const openTriage = (grievance, decision) => {
    setAction({ kind: "triage", grievance, decision });
    setNote("");
  };

  const openAppealReview = (grievance, approve) => {
    setAction({ kind: "appeal", grievance, approve });
    setNote("");
  };

  const submit = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === "triage") {
        const res = await triageIntegrity(action.grievance.grievance_id, {
          decision: action.decision,
          note: note.trim() || undefined,
        });
        toast.success(res.message || "Review recorded");
      } else {
        const res = await reviewFlagAppeal(action.grievance.grievance_id, {
          approve: action.approve,
          note: note.trim(),
        });
        toast.success(res.message || "Appeal decided");
      }
      setAction(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const needsNote =
    action?.kind === "appeal" ||
    (action?.kind === "triage" && action.decision === "FAKE");
  const noteTooShort = action?.kind === "appeal"
    ? note.trim().length < 5
    : action?.kind === "triage" && action.decision === "FAKE"
      ? note.trim().length < 5
      : false;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Integrity Review</h1>
          <p>Reports the platform isn't sure about, most suspicious first. Your call always outranks the score.</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <span className="stat-label"><ShieldAlert size={12} /> Likely fake</span>
          <span className="stat-value" style={{ color: "var(--danger)" }}>{counts.LIKELY_FAKE ?? "—"}</span>
          <span className="stat-sub">awaiting a human decision</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Uncertain</span>
          <span className="stat-value">{counts.NEEDS_REVIEW ?? "—"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Flagged as false</span>
          <span className="stat-value">{counts.flagged_total ?? "—"}</span>
          <span className="stat-sub">total on your scope</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Gavel size={12} /> Open appeals</span>
          <span className="stat-value" style={{ color: counts.appeals_pending ? "var(--warning)" : undefined }}>
            {counts.appeals_pending ?? "—"}
          </span>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "queue" ? "active" : ""}`} onClick={() => { setTab("queue"); setPage(1); }}>
          Review queue
        </button>
        <button className={`tab ${tab === "appeals" ? "active" : ""}`} onClick={() => { setTab("appeals"); setPage(1); }}>
          Appeals{counts.appeals_pending ? ` (${counts.appeals_pending})` : ""}
        </button>
      </div>

      {tab === "queue" && (
        <div className="tabs" style={{ flexWrap: "wrap" }}>
          {VERDICT_TABS.map((t) => (
            <button key={t.key} className={`tab ${verdict === t.key ? "active" : ""}`}
                    onClick={() => { setVerdict(t.key); setPage(1); }}>
              {t.label}
              {t.countKey && counts[t.countKey] != null ? ` (${counts[t.countKey]})` : ""}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Search size={15} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
          <input
            className="input"
            style={{ border: "none", padding: 0, flex: 1 }}
            placeholder="Search by title, description, or reference ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setSearchInput("")}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState title="Couldn’t load the queue" description={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={tab === "appeals" ? Gavel : Inbox}
          title={tab === "appeals" ? "No appeals waiting" : "Queue is clear"}
          description={
            tab === "appeals"
              ? "Nobody is contesting a false-report flag right now."
              : search || verdict
                ? "No cases match this filter."
                : "Nothing needs an integrity decision right now."
          }
        />
      ) : (
        <>
          {items.map((g) => {
            const style = VERDICT_STYLE[g.authenticity?.verdict] || VERDICT_STYLE.NEEDS_REVIEW;
            const appealPending = g.flag_appeal_status === "PENDING";
            return (
              <div key={g.grievance_id} className="list-row" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <Link to={`${detailBase}/${g.grievance_id}`} style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-faint)" }}>
                      {g.grievance_id}
                    </Link>
                    {tab === "queue" && (
                      <span style={{ background: style.bg, color: style.color, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                        {style.label} · {g.authenticity?.score ?? "?"}
                      </span>
                    )}
                    {appealPending && <span className="badge badge-medium">Appeal pending</span>}
                    {g.flagged_invalid && <span className="badge badge-critical">Flagged false</span>}
                    <span className="badge badge-neutral">{CATEGORY_LABELS[g.category] || g.category}</span>
                    {g.district && <span className="badge badge-status">{g.district}</span>}
                  </div>

                  <Link to={`${detailBase}/${g.grievance_id}`} style={{ fontWeight: 700, fontSize: 14.5 }}>
                    {g.title || "Untitled grievance"}
                  </Link>

                  {g.top_signals?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8 }}>
                      {g.top_signals.map((s) => (
                        <span key={s.signal} style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          <strong style={{ color: "var(--danger, #dc2626)" }}>{s.signal.replace(/_/g, " ")}</strong>
                          {" "}{s.detail}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: "var(--text-faint)", flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <UserRound size={12} />
                      {g.citizen?.name || "Citizen"}
                      {g.citizen?.trust?.score != null && (
                        <> · trust {g.citizen.trust.score} ({g.citizen.trust.label})</>
                      )}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={12} /> {formatRelative(g.created_at)}
                    </span>
                  </div>

                  {appealPending && g.flag_appeal_reason && (
                    <div style={{ marginTop: 10, padding: 10, background: "var(--surface-hover)", borderRadius: 10, fontSize: 12.5, color: "var(--text-muted)" }}>
                      <strong style={{ color: "var(--text)" }}>Citizen's appeal: </strong>{g.flag_appeal_reason}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                  {tab === "appeals" ? (
                    decided(g) && !appealPending ? (
                      <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Decided</span>
                    ) : (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => openAppealReview(g, true)}>
                          <ShieldCheck size={13} /> Uphold appeal
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openAppealReview(g, false)}>
                          Keep flag
                        </button>
                      </>
                    )
                  ) : decided(g) ? (
                    <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Already decided</span>
                  ) : (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => openTriage(g, "GENUINE")}>
                        <ShieldCheck size={13} /> Genuine
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => openTriage(g, "FAKE")}>
                        <ShieldAlert size={13} /> Flag as false
                      </button>
                    </>
                  )}
                  <Link to={`${detailBase}/${g.grievance_id}`} className="btn btn-ghost btn-sm">Open</Link>
                </div>
              </div>
            );
          })}
          <Pagination page={data.page || 1} totalPages={data.total_pages || 1} onChange={setPage} />
        </>
      )}

      <Modal
        open={!!action}
        title={
          action?.kind === "appeal"
            ? action.approve ? "Uphold this appeal?" : "Reject this appeal?"
            : action?.decision === "FAKE" ? "Mark as false or misleading?" : "Confirm this report is genuine?"
        }
        onClose={() => setAction(null)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
            <button
              className={`btn ${action?.kind === "appeal" && !action.approve ? "btn-danger" : action?.decision === "FAKE" ? "btn-danger" : "btn-primary"}`}
              disabled={busy || (needsNote && noteTooShort)}
              onClick={submit}
            >
              {busy ? "Saving..." : action?.kind === "appeal"
                ? (action.approve ? "Uphold & restore points" : "Reject appeal")
                : (action?.decision === "FAKE" ? "Flag as false" : "Confirm genuine")}
            </button>
          </>
        }
      >
        {action && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {action.kind === "appeal" ? (
                <>
                  Appeal on <strong>{action.grievance.grievance_id}</strong>:
                  "{action.grievance.flag_appeal_reason}"
                </>
              ) : action.decision === "FAKE" ? (
                <>
                  This reverses any civic points earned for <strong>{action.grievance.grievance_id}</strong>{" "}
                  and lowers the account's trust. The citizen sees your reason and can appeal it — the report is
                  <strong> not</strong> deleted.
                </>
              ) : (
                <>
                  Clears the review flag on <strong>{action.grievance.grievance_id}</strong> and releases any
                  points withheld while it was suspected. If it had been flagged false, the penalty is refunded.
                </>
              )}
            </p>
            <label className="form-label">
              {needsNote ? "Reason (required)" : "Note for the record (optional)"}
            </label>
            <textarea
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                action.kind === "appeal"
                  ? "Explain the decision — the citizen reads this..."
                  : action.decision === "FAKE"
                    ? "What makes this false or misleading?"
                    : "Anything that helped you decide..."
              }
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default IntegrityReview;
