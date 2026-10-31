import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Sparkles,
  Users,
  ImageIcon,
  UserCheck,
} from "lucide-react";

// Staff-only triage aid. A low score means "look closer", never "reject":
// it's built from weak signals and can be wrong, so the card always shows
// *why* it scored the way it did, and the decision stays with the officer.
const VERDICTS = {
  LIKELY_GENUINE: { label: "Likely genuine", icon: ShieldCheck, color: "var(--priority-low, #16a34a)", bg: "var(--success-soft)" },
  NEEDS_REVIEW: { label: "Needs a closer look", icon: ShieldQuestion, color: "var(--warning, #d97706)", bg: "var(--warning-soft)" },
  LIKELY_FAKE: { label: "Likely fake or spam", icon: ShieldAlert, color: "var(--danger, #dc2626)", bg: "var(--danger-soft)" },
};

const SIGNAL_LABELS = {
  test_phrase: "Test entry", mostly_symbols: "Mostly symbols", very_short: "Very short",
  repeated_characters: "Repeated characters", keyboard_mashing: "Keyboard mashing",
  vowelless_words: "Random typing", repetitive_text: "Repetitive text", all_caps: "All capitals",
  spam_markers: "Links / promotion", detailed: "Detailed description", landmark_mentioned: "Landmark mentioned",
  duration_or_number: "Duration / number given", null_island: "Placeholder location",
  outside_service_area: "Outside service area", no_coordinates: "No GPS location", no_address: "No address",
  photo_attached: "Photo evidence", brand_new_account: "Brand-new account", new_account: "New account",
  submission_burst: "Burst of submissions", high_daily_volume: "High daily volume",
  strongly_corroborated: "Others reported it nearby", corroborated: "Another citizen reported it",
  severe_but_vague: "Severe but vague", repeat_of_own_report: "Repeats own report",
  // Evidence reuse (server-side photo signatures)
  recycled_evidence: "Photo reused on unrelated reports", shared_evidence: "Same photo from other accounts",
  reused_own_photo: "Own photo reused",
  // Cross-account wording
  coordinated_campaign: "Coordinated campaign", templated_text: "Template-like wording",
  // Account standing
  low_trust_account: "Low-trust account", prior_substantiated_flag: "Earlier report flagged false",
  verified_history: "Has a verified report", trusted_account: "Trusted account",
  // Estimators
  estimator_disagreement: "Rule/AI disagreement",
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

const AuthenticityCard = ({ authenticity, integrity }) => {
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
            <span style={{ fontWeight: 700, color: s.impact < 0 ? "var(--danger, #dc2626)" : "var(--priority-low, #16a34a)", flexShrink: 0 }}>
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

      <p className="form-hint" style={{ marginTop: 12 }}>
        An automated estimate from weak signals — it can be wrong, and an AI read is not proof either way.
        If this is spam or false, use "Flag as false"; otherwise accepting the case clears it.
      </p>
    </div>
  );
};

export default AuthenticityCard;
