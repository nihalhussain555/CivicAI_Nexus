import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  Download,
  RefreshCw,
  Trophy,
} from "lucide-react";
import {
  downloadDepartmentReport,
  getDepartmentPerformance,
} from "../../services/slaService";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import { SkeletonList } from "../../components/common/Skeleton";
import { getErrorMessage, titleCase } from "../../utils/helpers";
import { DEPARTMENTS, PRIORITIES } from "../../utils/constants";
import { useToast } from "../../context/ToastContext";

const fmtPct = (value) => (value === null || value === undefined ? "—" : `${value}%`);

// Small signed indicator used for the "vs last week / last month" columns:
// a percentage-point delta against the previous window, or em-dash when the
// department had no comparable sample.
const Delta = ({ current, previous }) => {
  if (current === null || current === undefined ||
      previous === null || previous === undefined) {
    return <span style={{ color: "var(--text-faint)" }}>—</span>;
  }
  const diff = Math.round((current - previous) * 10) / 10;
  const color = diff > 0 ? "var(--success)" : diff < 0 ? "var(--danger)" : "var(--text-muted)";
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "•";
  return <span style={{ color, fontWeight: 700 }}>{arrow} {Math.abs(diff)}pp</span>;
};

const SlaDepartmentPerformance = () => {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", priority: "", department: "" });

  const params = useCallback(() => {
    const p = {};
    if (filters.from) p.from = filters.from;
    if (filters.to) p.to = filters.to;
    if (filters.priority) p.priority = filters.priority;
    if (filters.department) p.department = filters.department;
    return p;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDepartmentPerformance(params());
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadDepartmentReport(params());
      toast.success("Report downloaded");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.departments ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>SLA Department Performance</h1>
          <p>Compliance ranking, overdue rates and period comparison per department.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <CalendarClock size={14} color="var(--text-faint)" />
        <input className="input" type="date" style={{ maxWidth: 160 }} title="Created from"
               value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
        <span style={{ color: "var(--text-faint)" }}>→</span>
        <input className="input" type="date" style={{ maxWidth: 160 }} title="Created to"
               value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        <select className="select" style={{ maxWidth: 180 }} value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{titleCase(p)}</option>
          ))}
        </select>
        <select className="select" style={{ maxWidth: 260 }} value={filters.department}
                onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? "Loading…" : "Apply"}
        </button>
        <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}
                onClick={exportCsv} disabled={exporting || rows.length === 0}>
          <Download size={14} /> {exporting ? "Preparing…" : "Export CSV"}
        </button>
      </div>

      {data === null && !error ? (
        <SkeletonList rows={6} />
      ) : error ? (
        <div className="card"><ErrorState description={error} onRetry={load} /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No cases in this window"
                    description="Widen the date range or clear the filters to see department performance." />
      ) : (
        <>
          <div className="list-row" style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-faint)" }}>
            <div className="list-row-main">Department</div>
            <div className="mini-stats">
              <span className="mini-stat"><strong>Cases</strong><span>Total</span></span>
              <span className="mini-stat"><strong>Res.</strong><span>Resolved</span></span>
              <span className="mini-stat"><strong>Open</strong><span>Pending</span></span>
              <span className="mini-stat"><strong>Overdue</strong><span>Active</span></span>
              <span className="mini-stat"><strong>Compl.</strong><span>On&nbsp;time</span></span>
              <span className="mini-stat"><strong>Week</strong><span>vs prev</span></span>
              <span className="mini-stat"><strong>Month</strong><span>vs prev</span></span>
              <span className="mini-stat"><strong>Esc.</strong><span>Events</span></span>
            </div>
          </div>

          {rows.map((row) => (
            <div key={row.department} className="list-row list-row-start">
              <div className="list-row-main">
                {row.rank === 1 && <Trophy size={16} color="var(--warning)" style={{ flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div className="list-row-title">
                    {row.rank}. {row.department}
                  </div>
                  <div className="list-row-sub">
                    Avg resolution {row.avg_resolution_hours ?? "—"}h
                    {" · "}avg response {row.avg_response_hours ?? "—"}h
                    {row.repeated_violations > 0 ? ` · ${row.repeated_violations} breach events` : ""}
                  </div>
                </div>
              </div>
              <div className="mini-stats">
                <span className="mini-stat"><strong>{row.total}</strong></span>
                <span className="mini-stat"><strong>{row.resolved}</strong></span>
                <span className="mini-stat"><strong>{row.pending}</strong></span>
                <span className="mini-stat">
                  <strong style={{ color: row.overdue > 0 ? "var(--danger)" : undefined }}>{row.overdue}</strong>
                </span>
                <span className="mini-stat">
                  <strong style={{
                    color: row.compliance_pct === null ? undefined
                      : row.compliance_pct >= 90 ? "var(--success)"
                      : row.compliance_pct >= 70 ? "var(--warning)" : "var(--danger)",
                  }}>
                    {fmtPct(row.compliance_pct)}
                  </strong>
                  <span>{row.overdue > 0 ? `${row.overdue_rate_pct}% overdue` : ""}</span>
                </span>
                <span className="mini-stat"><Delta current={row.compliance_pct} previous={row.prev_week?.compliance_pct} /></span>
                <span className="mini-stat"><Delta current={row.compliance_pct} previous={row.prev_month?.compliance_pct} /></span>
                <span className="mini-stat">
                  <strong style={{ color: row.escalations > 0 ? "var(--warning)" : undefined }}>{row.escalations}</strong>
                </span>
              </div>
            </div>
          ))}

          <p className="prose-sm" style={{ marginTop: 12, color: "var(--text-faint)" }}>
            Compliance = share of resolved cases filed on or before their SLA deadline. Overdue rate
            only counts still-active cases already past their deadline, so work still within its
            window never penalises a department. Comparisons use the trailing 7- and 30-day windows
            before the selected end date.
          </p>
        </>
      )}
    </div>
  );
};

export default SlaDepartmentPerformance;
