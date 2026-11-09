import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Sparkles,
  Users,
  ImageIcon,
  UserCheck,
} from "lucide-react";
import { SIGNAL_LABELS } from "../../utils/constants";

// Staff-only triage aid. A low score means "look closer", never "reject":
// it's built from weak signals and can be wrong, so the card always shows
// *why* it scored the way it did, and the decision stays with the officer.
const VERDICTS = {
  LIKELY_GENUINE: { label: "Likely genuine", icon: ShieldCheck, color: "var(--priority-low)", bg: "var(--success-soft)" },
  NEEDS_REVIEW: { label: "Needs a closer look", icon: ShieldQuestion, color: "var(--warning)", bg: "var(--warning-soft)" },
  LIKELY_FAKE: { label: "Likely fake or spam", icon: ShieldAlert, color: "var(--danger)", bg: "var(--danger-soft)" },
};

// Three independent little readouts on one line each — kept separate from the
// signal list because they're context the officer can act on (call this
// person, ask for a photo), not scoring reasons.
const ContextRow = ({ icon: Icon, children }) => (
  <div style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12.5, color: "var(--text-muted)" }}>
    <Icon size={13} style={{ marginTop: 2, flexShrink: 0 }} color="var(--text-faint)" />
    <span style={{ lineHeight: 1.55 }}>{children}</span>
  </div>
);

const AuthenticityCard = ({ authenticity, integrity, canTriage = false, onDecision }) => {
  if (!authenticity) return null;
  const v = VERDICTS[authenticity.verdict] || VERDICTS.NEEDS_REVIEW;
  const Icon = v.icon;
  const ai = authenticity.ai;
  const trust = authenticity.trust;
  const campaign = authenticity.campaign;
  const reuse = authenticity.evidence_reuse;
  const humanDecision = integrity?.human_decision;

  return (
    <div className="card" style={{ borderColor: v.color }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={16} color={v.color} />
          <strong style={{ fontSize: 14 }}>Authenticity check</strong>
          <span className="ai-tag">Staff only</span>
        </div>
        <span style={{ background: v.bg, color: v.color, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
          {v.label} · {authenticity.score}/100
        </span>
      </div>

      {authenticity.recommendation && (
        <div style={{ background: "var(--surface-hover)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12.5, lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text)" }}>Suggested next step: </strong>
          <span style={{ color: "var(--text-muted)" }}>{authenticity.recommendation}</span>
        </div>
      )}

      {humanDecision && (
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 12 }}>
          Already decided by staff as {humanDecision === "FAKE" ? "false/misleading" : "genuine"} — this breakdown is kept for the record only.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {(authenticity.signals || []).map((s) => (
          <div key={s.signal} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
            <span style={{ color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text)" }}>{SIGNAL_LABELS[s.signal] || s.signal}</strong> — {s.detail}
            </span>
            <span style={{ fontWeight: 700, color: s.impact < 0 ? "var(--danger)" : "var(--priority-low)", flexShrink: 0 }}>
              {s.impact > 0 ? "+" : ""}{s.impact}
            </span>
          </div>
        ))}
      </div>

      {(campaign || reuse || trust) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          {campaign?.matches > 0 && (
            <ContextRow icon={Users}>
              <strong>{campaign.matches}</strong> other report(s) use identical wording
              {" "}{campaign.districts?.length ? `across ${campaign.districts.length} district(s)` : "in this area"}
              {campaign.categories?.length ? ` (${campaign.categories.slice(0, 3).join(", ")})` : ""}.
            </ContextRow>
          )}
          {reuse?.matches > 0 && (
            <ContextRow icon={ImageIcon}>
              This photo appears on <strong>{reuse.matches}</strong> other report(s)
              {reuse.other_citizens ? `, from ${reuse.other_citizens} other account(s)` : ""}
              {reuse.scope_note ? ` — across different ${reuse.scope_note} issues` : ""}.
            </ContextRow>
          )}
          {trust && (
            <ContextRow icon={UserCheck}>
              Account trust <strong>{trust.score}</strong> ({trust.label})
              {trust.flags ? ` · ${trust.flags} earlier report(s) flagged false` : " · no substantiated flags"}.
            </ContextRow>
          )}
        </div>
      )}

      {ai && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <Sparkles size={13} color="var(--accent)" />
            <strong style={{ fontSize: 12.5 }}>Separate AI read</strong>
            <span className="badge badge-neutral">{ai.verdict || "—"}</span>
            {typeof ai.score === "number" && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ai.score}/100</span>}
            {authenticity.basis && (
              <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                combined from {authenticity.basis.replace("+", " + ")}
                {authenticity.rule_score != null && ` (rules alone: ${authenticity.rule_score})`}
              </span>
            )}
          </div>
          {ai.indicators?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {ai.indicators.map((indicator, i) => (
                <span key={i} className="badge badge-neutral" style={{ fontWeight: 500 }}>{indicator}</span>
              ))}
            </div>
          )}
          {ai.reasoning && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>{ai.reasoning}</p>
          )}
        </div>
      )}

      {canTriage && onDecision && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm"
                  onClick={() => onDecision({ kind: "triage", decision: "GENUINE" })}>
            <ShieldCheck size={14} /> Confirm genuine
          </button>
          <button className="btn btn-danger btn-sm"
                  onClick={() => onDecision({ kind: "triage", decision: "FAKE" })}>
            <ShieldAlert size={14} /> Flag as false
          </button>
        </div>
      )}

      <p className="form-hint" style={{ marginTop: 12 }}>
        An automated estimate from weak signals — it can be wrong, and an AI read is not proof either way.
        {" "}{canTriage
          ? "Your decision replaces the score; the breakdown above is kept for the record."
          : "This case already has a human decision on file."}
      </p>
    </div>
  );
};

export default AuthenticityCard;
