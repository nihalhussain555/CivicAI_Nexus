import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  ShieldQuestion,
  Gavel,
  RotateCw,
  Scale,
  Camera,
  Users,
  ArrowRight,
} from "lucide-react";
import { getIntegrityStats } from "../../services/analyticsService";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../utils/helpers";
import { SIGNAL_LABELS, CATEGORY_LABELS } from "../../utils/constants";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import BarChartCard from "../../components/charts/BarChartCard";
import LineChartCard from "../../components/charts/LineChartCard";

const WINDOWS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const trustTone = (label) =>
  ({ high: "var(--priority-low)", medium: "var(--warning)", low: "var(--danger)" }[label]);

const pct = (value) => `${value}%`;

// These numbers are all small and change every refresh, so the sentence has to
// follow them: "1 reports" on a demo dataset is what makes a dashboard look
// like it was never read.
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const StatCard = ({ icon: Icon, label, value, sub, tone }) => (
  <div className="stat-card">
    <span className="stat-label">
      {Icon && <Icon size={12} />}
      {label}
    </span>
    <span className={`stat-value${tone ? ` ${tone}` : ""}`}>{value}</span>
    {sub && <span className="stat-sub">{sub}</span>}
  </div>
);

const Integrity = () => {
  const { user } = useAuth();
  const [days, setDays] = useState("30");
  const [refreshKey, setRefreshKey] = useState(0);

  // Same shape as the map page: the last payload that arrived plus the outcome
  // keyed to the request it answers, so a failed refresh keeps the numbers on
  // screen instead of blanking a dashboard someone is reading.
  const [snapshot, setSnapshot] = useState(null);
  const [outcome, setOutcome] = useState(null);

  const requestKey = `${days}|${refreshKey}`;

  useEffect(() => {
    let cancelled = false;
    getIntegrityStats(Number(days))
      .then((res) => {
        if (cancelled) return;
        setSnapshot(res.data);
        setOutcome({ key: requestKey, error: null });
      })
      .catch((err) => {
        if (!cancelled) setOutcome({ key: requestKey, error: getErrorMessage(err) });
      });
    return () => { cancelled = true; };
  }, [days, requestKey]);

  const loading = outcome?.key !== requestKey;
  const error = outcome?.key === requestKey ? outcome.error : null;
  const data = snapshot;

  const reload = () => setRefreshKey((key) => key + 1);

  if (loading && !data) {
    return <div className="page-loading"><LoadingSpinner label="Reading the integrity record..." /></div>;
  }

  if (error && !data) {
    return (
      <div className="card">
        <ErrorState
          title="Couldn't load the integrity dashboard"
          description={`${error} The API may be asleep — retrying usually works.`}
          onRetry={reload}
        />
      </div>
    );
  }

  const scoredTotal = data.scored || 0;
  const appealsDecided = (data.appeals?.APPROVED ?? 0) + (data.appeals?.REJECTED ?? 0);
  const photoAdvantage =
    data.evidence?.with_photo?.scored && data.evidence?.no_photo?.scored
      ? data.evidence.no_photo.fake_rate - data.evidence.with_photo.fake_rate
      : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Fraud &amp; Integrity</h1>
          <p>
            {user?.district
              ? `False-reporting activity in ${user.district}.`
              : "False reporting across the state, and how well the detector matches the humans who overrode it."}
          </p>
        </div>
        <div className="page-tools">
          <select className="select" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Time window">
            {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={reload} disabled={loading}>
            <RotateCw size={14} className={loading ? "spin" : undefined} /> Refresh
          </button>
          <Link className="btn btn-primary btn-sm" to="/admin/integrity">
            Review queue <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
          <ErrorState title="The numbers below are from the last successful read" description={error} onRetry={reload} />
        </div>
      )}

      <div className="grid grid-4 stat-grid">
        <StatCard icon={ShieldAlert} label="Likely fake" value={pct(data.likely_fake_rate)}
                  sub={`${data.verdicts?.LIKELY_FAKE ?? 0} of ${scoredTotal} scored reports`}
                  tone={data.likely_fake_rate > 15 ? "is-danger" : undefined} />
        <StatCard icon={ShieldQuestion} label="Waiting on a person" value={data.queue_backlog ?? 0}
                  sub="in the queue with no decision yet" />
        <StatCard icon={Gavel} label="Open appeals" value={data.appeals?.PENDING ?? 0}
                  sub={appealsDecided
                    ? `${pct(data.appeals.uphold_rate)} of ${appealsDecided} upheld so far`
                    : "none decided yet"} />
        <StatCard icon={Scale} label="Detector vs humans" value={pct(data.human_agreement?.agreement_rate ?? 0)}
                  sub={data.human_agreement?.total
                    ? `${data.human_agreement.disagree} of ${data.human_agreement.total} decisions disagreed`
                    : "no overrides to compare yet"}
                  tone={data.human_agreement?.total && data.human_agreement.agreement_rate < 70 ? "is-warning" : undefined} />
      </div>

      <p className="form-hint" style={{ marginTop: -8, marginBottom: 18 }}>
        {count(data.reports_in_window, "report was", "reports were")} filed in the last {data.window_days} days
        {" "}{data.unscored
          ? `and ${count(data.unscored, "one has", "some have")} not been scored yet`
          : "and every one of them was scored"}.{" "}
        {count(data.flags?.active ?? 0, "report stands", "reports stand")} flagged as false
        {data.flags?.reversed
          ? ` and ${count(data.flags.reversed, "one flag was", "flags were")} reversed after review`
          : ""}
        {data.estimator_disagreements
          ? `; ${count(data.estimator_disagreements, "report had", "reports had")} the rules and the AI disagreeing`
          : ""}. A low agreement rate is a reason to retune the weights, not to flag more reports —
        every number here is an estimate built from weak signals, and a score has never been proof of anything.
      </p>

      {scoredTotal === 0 ? (
        <EmptyState icon={ShieldQuestion} title="Nothing to measure yet"
                    description="No grievances in this window have been scored for authenticity." />
      ) : (
        <>
          <div className="grid grid-2 chart-grid">
            <LineChartCard title="Likely-fake reports per day" data={data.timeline || []} dataKey="likely_fake" nameKey="date" />
            <BarChartCard title="Signals that fired most" data={(data.top_signals || []).map((s) => ({ label: SIGNAL_LABELS[s.signal] || s.signal.replace(/_/g, " "), count: s.count }))} dataKey="count" nameKey="label" />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">
              <Camera size={14} />
              Does a photo change the picture?
            </div>
            <div className="grid grid-2">
              {[["with_photo", "Reports with a photo"], ["no_photo", "Reports without one"]].map(([key, label]) => {
                const bucket = data.evidence[key];
                return (
                  <div key={key} className="mini-panel">
                    <div className="data-label">{label}</div>
                    <strong>{pct(bucket.fake_rate)}</strong>
                    <div className="muted-note">
                      {bucket.likely_fake} likely fake of {bucket.scored} scored
                    </div>
                  </div>
                );
              })}
            </div>
            {photoAdvantage !== null && (
              <p className="muted-note card-section">
                {photoAdvantage > 0
                  ? `Photoless reports are ${photoAdvantage.toFixed(1)} points more often judged fake — worth asking for a photo before spending a field visit.`
                  : "Photoless reports are not more often fake in this window, so treat a missing photo as neutral."}
              </p>
            )}
          </div>

          <div className="grid grid-2 chart-grid">
            <BreakdownTable title="By district" rows={data.by_district} />
            <BreakdownTable title="By category" rows={data.by_category} category />
          </div>

          <div className="card">
            <div className="section-title">
              <Users size={14} />
              Accounts behind the most flagged reports
            </div>
            {data.top_offenders?.length ? (
              data.top_offenders.map((row) => (
                <div key={row.citizen_id} className="list-row">
                  <div className="list-row-body">
                    <strong className="list-row-title">{row.name || "Unnamed citizen"}</strong>
                    <div className="muted-note">
                      {row.email}
                      {row.district ? ` · ${row.district}` : ""}
                    </div>
                  </div>
                  <div className="list-row-actions">
                    <div className="count-danger">
                      {row.flagged_reports} flagged
                    </div>
                    <div className="muted-note">
                      trust {row.trust_score ?? "—"}
                      {row.trust_label && (
                        <span style={{ color: trustTone(row.trust_label), fontWeight: 700, marginLeft: 4 }}>
                          {row.trust_label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="prose-sm">
                No account has had a report flagged in this window.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const BreakdownTable = ({ title, rows = {}, category = false }) => {
  const entries = Object.entries(rows).slice(0, 8);
  return (
    <div className="card">
      <div className="section-title">{title}</div>
      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Nothing scored in this window.</p>
      ) : (
        entries.map(([name, value]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 12.5 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {category ? (CATEGORY_LABELS[name] || name) : name}
            </span>
            <span style={{ width: 90, height: 6, background: "var(--surface-hover)", borderRadius: 4, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${value.scored ? (value.likely_fake / value.scored) * 100 : 0}%`, background: "var(--danger)" }} />
            </span>
            <span style={{ width: 86, textAlign: "right", color: "var(--text-muted)", flexShrink: 0 }}>
              {value.likely_fake} fake / {value.scored}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

export default Integrity;
