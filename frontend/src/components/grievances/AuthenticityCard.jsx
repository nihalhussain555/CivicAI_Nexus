import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

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
  repeat_flagged: "Repeatedly flagged before", prior_flag: "Flagged before",
  good_track_record: "Good track record", some_track_record: "Has a resolved report",
  strongly_corroborated: "Others reported it nearby", corroborated: "Another citizen reported it",
  severe_but_vague: "Severe but vague", repeat_of_own_report: "Repeats own report",
};

const AuthenticityCard = ({ authenticity }) => {
  if (!authenticity) return null;
  const v = VERDICTS[authenticity.verdict] || VERDICTS.NEEDS_REVIEW;
  const Icon = v.icon;

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

      <p className="form-hint" style={{ marginTop: 12 }}>
        An automated estimate from weak signals — it can be wrong. If this is spam or false, use "Flag as false"; otherwise accepting the case clears it.
      </p>
    </div>
  );
};

export default AuthenticityCard;