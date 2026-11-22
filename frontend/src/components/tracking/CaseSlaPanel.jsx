import { useCallback, useEffect, useState } from "react";
import { Flame, History, Siren } from "lucide-react";
import { getCaseSla, manualEscalate } from "../../services/slaService";
import SlaCountdown from "./SlaCountdown";
import Modal from "../common/Modal";
import Skeleton from "../common/Skeleton";
import { useToast } from "../../context/ToastContext";
import { formatDateTime, getErrorMessage, titleCase } from "../../utils/helpers";

// Maps the management-side SLA status onto the tone set SlaCountdown draws.
const STATE_MAP = {
  ON_TRACK: "on_track",
  WARNING: "at_risk",
  URGENT: "due_soon",
  BREACHED: "breached",
  ESCALATED: "breached",
  RESOLVED: null, // outcome decides: met → "met", missed → "missed"
};

const countdownState = (sla) => {
  if (!sla) return "unknown";
  if (sla.sla_status === "RESOLVED") return sla.outcome === "missed" ? "missed" : "met";
  return STATE_MAP[sla.sla_status] || "unknown";
};

const LEVEL_TONE = {
  WARNING: "badge-medium",
  URGENT: "badge-high",
  BREACH: "badge-danger",
  SENIOR_ESCALATION: "badge-critical",
  MANUAL_ESCALATION: "badge-danger",
  RESOLVED_MET: "badge-success",
  RESOLVED_MISSED: "badge-danger",
  PRIORITY_RECALC: "badge-status",
  CYCLE_RESTART: "badge-status",
  VOID: "badge-neutral",
};

const CaseSlaPanel = ({ grievanceId, isStaff }) => {
  const toast = useToast();
  const [sla, setSla] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getCaseSla(grievanceId)
      .then((res) => setSla(res.data))
      .catch(() => setSla(null))
      .finally(() => setLoaded(true));
  }, [grievanceId]);

  useEffect(() => { load(); }, [load]);

  const escalate = async () => {
    setBusy(true);
    try {
      const res = await manualEscalate(grievanceId, reason.trim());
      toast.success(res.message || "Escalation recorded.");
      setEscalateOpen(false);
      setReason("");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="card">
        <div className="section-title">SLA Tracking</div>
        <Skeleton height={64} style={{ marginBottom: 10 }} />
        <Skeleton height={18} width="60%" />
      </div>
    );
  }

  // The panel is additive: if the case has no SLA data at all (legacy
  // record, or the endpoint failed) the page simply omits it.
  if (!sla || !sla.sla_due_at) return null;

  const countdown = {
    state: countdownState(sla),
    due_at: sla.sla_due_at,
    clock_running: sla.clock_running,
    seconds_remaining: sla.seconds_remaining,
    percent_elapsed: sla.percent_elapsed,
  };

  const history = sla.escalation_history || [];

  return (
    <div className="card">
      <div className="section-title">SLA Tracking</div>

      <SlaCountdown sla={countdown} />

      <div className="stack-tight" style={{ marginTop: 12 }}>
        <div className="kv-row">
          <span>Clock started</span><strong>{formatDateTime(sla.sla_start_at)}</strong>
        </div>
        <div className="kv-row">
          <span>Window</span><strong>{sla.sla_hours ?? "—"}h ({titleCase(sla.sla_status)})</strong>
        </div>
        {sla.cycle > 0 && (
          <div className="kv-row">
            <span>SLA cycle</span><strong>#{sla.cycle + 1}{sla.cycle > 0 ? " (reopened)" : ""}</strong>
          </div>
        )}
        {sla.breached_at && (
          <div className="kv-row">
            <span>Breached at</span><strong style={{ color: "var(--danger)" }}>{formatDateTime(sla.breached_at)}</strong>
          </div>
        )}
        {!sla.clock_running && sla.outcome && (
          <div className="kv-row">
            <span>Outcome</span>
            <strong style={{ color: sla.outcome === "met" ? "var(--success)" : "var(--danger)" }}>
              {sla.outcome === "met" ? "Deadline met" : "Deadline missed"}
            </strong>
          </div>
        )}
        {sla.policy?.working_hours && (
          <div className="kv-row">
            <span>Counting</span><strong>Working hours only</strong>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <>
          <div className="sub-head" style={{ marginTop: 14 }}>
            <History size={13} /> Escalation history
          </div>
          {history.map((entry, i) => (
            <div key={`${entry.level}-${entry.cycle}-${entry.created_at}-${i}`}
                 className="list-row list-row-start" style={{ padding: "8px 0" }}>
              <div className="list-row-body">
                <div className="badge-row" style={{ marginBottom: 2 }}>
                  <span className={`badge ${LEVEL_TONE[entry.level] || "badge-neutral"}`}>
                    {titleCase(entry.level)}
                  </span>
                  <span className="record-id">{formatDateTime(entry.created_at)}</span>
                </div>
                {entry.message && (
                  <div className="list-row-sub" style={{ whiteSpace: "normal" }}>{entry.message}</div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {isStaff && (
        <button className="btn btn-secondary btn-block" style={{ marginTop: 12 }}
                onClick={() => setEscalateOpen(true)}>
          <Siren size={15} /> Escalate now
        </button>
      )}

      <Modal
        open={escalateOpen}
        title="Manual SLA escalation"
        onClose={() => setEscalateOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEscalateOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={escalate}>
              <Flame size={14} /> {busy ? "Escalating…" : "Escalate"}
            </button>
          </>
        }
      >
        <p className="prose-sm">
          Records a SLA escalation on this case and notifies the officer, the department and the
          district admins. It does not change who owns the case.
        </p>
        <label className="form-label">Reason (optional)</label>
        <textarea className="textarea" rows={3} maxLength={500} value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Citizen followed up; deadline is at risk." />
      </Modal>
    </div>
  );
};

export default CaseSlaPanel;
