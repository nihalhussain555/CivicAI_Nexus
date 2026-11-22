import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { getSlaDashboard, getSchedulerHealth } from "../../services/slaService";
import LineChartCard from "../../components/charts/LineChartCard";
import BarChartCard from "../../components/charts/BarChartCard";
import PieChartCard from "../../components/charts/PieChartCard";
import PriorityBadge from "../../components/grievances/PriorityBadge";
import StatusBadge from "../../components/grievances/StatusBadge";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import { SkeletonList } from "../../components/common/Skeleton";
import { formatDateTime, formatRelative, getErrorMessage, titleCase } from "../../utils/helpers";

const SLA_STATE_CLASS = {
  ON_TRACK: "badge-success",
  WARNING: "badge-medium",
  URGENT: "badge-high",
  BREACHED: "badge-danger",
  ESCALATED: "badge-critical",
  RESOLVED: "badge-status",
};

const LEVEL_LABEL = {
  WARNING: "Warning",
  URGENT: "Urgent",
  BREACH: "Breach",
  SENIOR_ESCALATION: "Senior escalation",
  PRIORITY_RECALC: "Priority recalc",
  CYCLE_RESTART: "Reopened — new clock",
  RESOLVED_MET: "Resolved on time",
  RESOLVED_MISSED: "Resolved late",
  VOID: "Voided",
  MANUAL_ESCALATION: "Manual escalation",
};

const fmt = (value, suffix = "") => (value === null || value === undefined ? "—" : `${value}${suffix}`);

const SlaDashboard = () => {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await getSlaDashboard(params);
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getSchedulerHealth()
      .then((res) => setHealth(res.data))
      .catch(() => setHealth(null));
  }, []);

  const overview = data?.overview;
  const escalated = (overview?.breached ?? 0) > 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>SLA Management</h1>
          <p>Deadline compliance, escalations and department punctuality across the platform.</p>
        </div>
        <div className="filter-controls">
          {health && (
            <span className={`badge ${health.lease_live ? "badge-success" : "badge-danger"}`}>
              <Activity size={12} style={{ marginRight: 5, verticalAlign: -2 }} />
              Scheduler {health.enabled ? (health.lease_live ? "running" : "between runs") : "disabled"}
              {health.last_run_at ? ` · last sweep ${formatRelative(health.last_run_at)}` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <CalendarClock size={14} color="var(--text-faint)" />
        <label className="form-label" style={{ margin: 0 }}>Created from</label>
        <input className="input" type="date" style={{ maxWidth: 170 }} value={range.from}
               onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        <label className="form-label" style={{ margin: 0 }}>to</label>
        <input className="input" type="date" style={{ maxWidth: 170 }} value={range.to}
               onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? "Loading…" : "Apply"}
        </button>
        {(range.from || range.to) && (
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setRange({ from: "", to: "" })}>Clear</button>
        )}
      </div>

      {data === null && !error ? (
        <SkeletonList rows={6} />
      ) : error ? (
        <div className="card"><ErrorState description={error} onRetry={load} /></div>
      ) : (
        <>
          <div className="grid grid-3 stat-grid">
            <div className="stat-card">
              <span className="stat-label"><Timer size={13} /> Active cases</span>
              <span className="stat-value">{overview.total_active}</span>
              <span className="stat-sub">currently under an SLA clock</span>
            </div>
            <div className="stat-card">
              <span className="stat-label"><AlertTriangle size={13} /> Warning / urgent</span>
              <span className="stat-value is-warning">{overview.warning}<span style={{ fontSize: 16 }}> / </span>{overview.urgent}</span>
              <span className="stat-sub">past 75% and 90% of the window</span>
            </div>
            <div className="stat-card">
              <span className="stat-label"><Flame size={13} /> Breached / escalated</span>
              <span className="stat-value is-danger">{overview.breached}</span>
              <span className="stat-sub">active cases past their deadline</span>
            </div>
            <div className="stat-card">
              <span className="stat-label"><CheckCircle2 size={13} /> SLA compliance</span>
              <span className="stat-value">{fmt(overview.compliance_pct, "%")}</span>
              <span className="stat-sub">
                {overview.on_time_resolutions} of {overview.resolved_total} resolved on time
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label"><ShieldAlert size={13} /> Overdue now</span>
              <span className="stat-value is-danger">{overview.overdue_active}</span>
              <span className="stat-sub">{overview.overdue_rate_active}% of active cases</span>
            </div>
            <div className="stat-card">
              <span className="stat-label"><Gauge size={13} /> Avg resolution time</span>
              <span className="stat-value">{fmt(overview.avg_resolution_hours, "h")}</span>
              <span className="stat-sub">measured against each case's deadline</span>
            </div>
          </div>

          <div className="grid grid-2 chart-grid">
            <PieChartCard title="Active cases by SLA state" data={data.status_distribution} nameKey="name" />
            <LineChartCard title="Monthly resolution outcome" data={data.monthly_trends}
                           dataKey="resolved" nameKey="month"
                           height={260} />
          </div>

          <BarChartCard title="Department compliance (% resolved on time)"
                        data={data.department_compliance.filter((d) => d.compliance_pct !== null)}
                        dataKey="compliance_pct" nameKey="department" />

          <div className="grid grid-2 chart-grid" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="section-title">Active cases by priority</div>
              {data.priority_breakdown.map((row) => (
                <div key={row.priority} className="bar-row">
                  <PriorityBadge priority={row.priority} />
                  <div className="bar-track">
                    <span className="bar-fill"
                          style={{ width: `${Math.min(100, (row.active / Math.max(1, overview.total_active)) * 100)}%` }} />
                  </div>
                  <span className="bar-value">
                    {row.active} active · <span style={{ color: escalated ? "var(--danger)" : undefined }}>{row.breached} breached</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="section-title">Escalation events (all time)</div>
              {data.escalation_stats.total === 0 ? (
                <p className="prose-sm">No escalation events recorded yet.</p>
              ) : (
                Object.entries(data.escalation_stats.by_level)
                  .sort((a, b) => b[1] - a[1])
                  .map(([level, count]) => (
                    <div key={level} className="list-row">
                      <span className={`badge ${SLA_STATE_CLASS[level] || "badge-neutral"}`}>
                        {LEVEL_LABEL[level] || titleCase(level)}
                      </span>
                      <span className="mini-stats"><span><strong>{count}</strong></span></span>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="section-title" style={{ marginTop: 24 }}>
            <Clock size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            Critical &amp; high priority — oldest deadlines first
          </div>
          {data.critical_unresolved.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No critical or high-priority cases open"
                        description="Every high-stakes case is currently resolved or withdrawn." />
          ) : (
            data.critical_unresolved.map((g) => (
              <Link key={g.grievance_id} to={`/admin/grievances/${g.grievance_id}`} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{g.title}</div>
                  <div className="list-row-sub">
                    {g.grievance_id} · {g.department || "Unassigned"}
                    {g.district ? ` · ${g.district}` : ""}
                  </div>
                </div>
                <div className="list-row-actions">
                  <div className="badge-row">
                    <PriorityBadge priority={g.priority} />
                    <span className={`badge ${SLA_STATE_CLASS[g.sla_status] || "badge-neutral"}`}>
                      {g.sla_status ? titleCase(g.sla_status) : "ON TRACK"}
                    </span>
                  </div>
                  <span className="row-time">
                    {g.sla_due_at ? `Due ${formatDateTime(g.sla_due_at)}` : "No deadline yet"}
                  </span>
                </div>
              </Link>
            ))
          )}

          <div className="section-title" style={{ marginTop: 24 }}>Recent escalation events</div>
          {data.recent_escalations.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No escalation events yet"
                        description="Events appear here automatically once cases pass their SLA thresholds." />
          ) : (
            data.recent_escalations.map((log, i) => (
              <div key={`${log.grievance_id}-${log.level}-${log.cycle}-${i}`} className="list-row list-row-start">
                <div className="list-row-body">
                  <div className="badge-row" style={{ marginBottom: 4 }}>
                    <span className={`badge ${SLA_STATE_CLASS[log.level] || "badge-neutral"}`}>
                      {LEVEL_LABEL[log.level] || titleCase(log.level)}
                    </span>
                    <Link className="record-id" to={`/admin/grievances/${log.grievance_id}`}>{log.grievance_id}</Link>
                  </div>
                  {log.message && <div className="list-row-sub" style={{ whiteSpace: "normal" }}>{log.message}</div>}
                  <div className="row-time" style={{ marginLeft: 0 }}>{formatRelative(log.created_at)}</div>
                </div>
              </div>
            ))
          )}

          {data.status_distribution.length === 0 && overview.total_active === 0 && (
            <p className="prose-sm" style={{ marginTop: 16 }}>
              Nothing is currently under an SLA clock in this range.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default SlaDashboard;
