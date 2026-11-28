import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity, AlertOctagon, ChevronDown, ChevronRight, RefreshCw, ShieldCheck, UserCheck,
} from "lucide-react";
import {
  fetchErrorEvents,
  fetchErrorGroups,
  fetchErrorSummary,
  updateErrorStatus,
} from "../../services/diagnosticService";
import { useDiagnostics, useErrorToast } from "../../hooks/useDiagnostics";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import FilterChips from "../../components/common/FilterChips";
import { formatRelative } from "../../utils/helpers";

/*
 * The failures the platform has seen, grouped so one broken endpoint reads as
 * one row with a count instead of forty rows.
 *
 * This page dogfoods the system it displays: its own load failure is captured
 * as a diagnosis and rendered through the same ErrorState a citizen sees.
 */

const WINDOWS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

const STATUSES = [
  { value: "", label: "Any" },
  { value: "new", label: "New" },
  { value: "triaged", label: "Triaged" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
];

const SOURCES = [
  { value: "", label: "All sources" },
  { value: "backend", label: "Server" },
  { value: "frontend", label: "In the app" },
  { value: "user_report", label: "Reported by users" },
];

const STATUS_LABEL = { new: "New", triaged: "Triaged", resolved: "Resolved", ignored: "Ignored" };
const STATUS_BADGE = {
  new: "badge-danger",
  triaged: "badge-status",
  resolved: "badge-success",
  ignored: "badge-neutral",
};

const SEVERITY_LABEL = { blocking: "Blocking", degraded: "Degraded", minor: "Minor" };

const ErrorDiagnostics = () => {
  const [params, setParams] = useSearchParams();

  const days = params.get("days") || "30";
  const status = params.get("status") || "";
  const category = params.get("category") || "";
  const source = params.get("source") || "";
  const userReports = params.get("reports") === "1";

  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [openGroup, setOpenGroup] = useState(null);
  const [occurrences, setOccurrences] = useState(null);
  const [savingFingerprint, setSavingFingerprint] = useState(null);

  const { capture } = useDiagnostics();
  const fail = useErrorToast();

  const setFilters = useCallback(
    (changes) => {
      const next = new URLSearchParams(params);
      Object.entries(changes).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      });
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  const filters = useMemo(
    () => ({
      days: Number(days),
      status: status || undefined,
      category: category || undefined,
      source: source || undefined,
      user_reports: userReports || undefined,
      limit: 50,
    }),
    [days, status, category, source, userReports]
  );

  const load = useCallback((viaRefresh = false) => {
    if (viaRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    Promise.all([fetchErrorSummary(filters.days), fetchErrorGroups(filters)])
      .then(([summaryData, groupData]) => {
        setSummary(summaryData);
        setGroups(groupData?.items || []);
        if (groupData?.categories) setCategories(groupData.categories);
      })
      // The dashboard for errors must not fail quietly: an admin who sees an
      // empty table cannot tell "no failures" from "the query broke".
      .catch((err) => setError(capture(err, { feature: "admin_list" })))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [filters, capture]);

  useEffect(() => { load(); }, [load]);

  const toggleGroup = (group) => {
    if (openGroup === group.fingerprint) {
      setOpenGroup(null);
      setOccurrences(null);
      return;
    }
    setOpenGroup(group.fingerprint);
    setOccurrences({ loading: true, items: [], failed: false });
    fetchErrorEvents({ fingerprint: group.fingerprint, days: Number(days), limit: 20 })
      .then((items) => setOccurrences({ loading: false, items, failed: false }))
      .catch((err) => {
        capture(err, { feature: "admin_list" });
        setOccurrences({ loading: false, items: [], failed: true });
      });
  };

  const triage = (group, nextStatus) => {
    setSavingFingerprint(group.fingerprint);
    updateErrorStatus({ fingerprint: group.fingerprint, status: nextStatus })
      .then(() => {
        setGroups((rows) => rows.map((row) => (
          row.fingerprint === group.fingerprint ? { ...row, status: nextStatus } : row
        )));
      })
      .catch((err) => fail(err, {
        feature: "admin_list",
        message: `Could not mark this failure as ${STATUS_LABEL[nextStatus].toLowerCase()} — it is still ${STATUS_LABEL[group.status].toLowerCase()}.`,
        onRetry: () => triage(group, nextStatus),
      }))
      .finally(() => setSavingFingerprint(null));
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div><h1>Error diagnostics</h1><p>Every failure the platform has seen, grouped by what broke.</p></div>
        </div>
        <SkeletonList rows={6} />
      </div>
    );
  }

  const categoryRows = Object.entries(summary?.by_category || {})
    .map(([value, count]) => ({
      value,
      label: categories.find((c) => c.value === value)?.label || value,
      count,
    }))
    .sort((a, b) => b.count - a.count);
  const categoryMax = Math.max(1, ...categoryRows.map((r) => r.count));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Error diagnostics</h1>
          <p>Every failure the platform has seen, grouped by what broke.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "spin" : undefined} /> {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <ErrorState
          diagnosis={error}
          title="The diagnostics dashboard could not load"
          onRetry={() => load()}
        />
      )}

      {!error && summary && (
        <>
          <div className="grid grid-4 stat-grid">
            <div className="stat-card">
              <span className="stat-label">Failures logged</span>
              <span className="stat-value">{summary.total}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Distinct problems</span>
              <span className="stat-value">{summary.distinct_failures}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">New in last 24h</span>
              <span className="stat-value">{summary.new_last_24h > 0 ? summary.new_last_24h : "—"}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Reported by users</span>
              <span className="stat-value">{summary.user_reports || "—"}</span>
            </div>
          </div>

          <div className="card errdash-categories">
            <div className="section-title">By category <span className="errdash-hint">click to filter</span></div>
            {categoryRows.length === 0 ? (
              <p className="errdash-empty">No failures recorded in this window.</p>
            ) : categoryRows.map((row) => (
              <button
                type="button"
                key={row.value}
                className={`errdash-bar-row${category === row.value ? " active" : ""}`}
                onClick={() => setFilters({ category: category === row.value ? "" : row.value })}
                aria-pressed={category === row.value}
              >
                <span className="errdash-bar-label">{row.label}</span>
                <span className="errdash-bar-track">
                  <span className="errdash-bar-fill" style={{ width: `${Math.max(4, (row.count / categoryMax) * 100)}%` }} />
                </span>
                <span className="errdash-bar-count">{row.count}</span>
              </button>
            ))}
          </div>

          <div className="card errdash-filters">
            <FilterChips label="Time window" options={WINDOWS} value={days} onChange={(value) => setFilters({ days: value })} />
            <FilterChips label="Status" options={STATUSES} value={status} onChange={(value) => setFilters({ status: value })} />
            <FilterChips label="Where it happened" options={SOURCES} value={source} onChange={(value) => setFilters({ source: value })} />
            <div className="filter-row">
              <span className="filter-row-label">Only what users reported</span>
              <div className="filter-chips" role="group" aria-label="Only user reports">
                <button
                  type="button"
                  className={`filter-pill${userReports ? " active" : ""}`}
                  aria-pressed={userReports}
                  onClick={() => setFilters({ reports: userReports ? "" : "1" })}
                >
                  <UserCheck size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  User reports
                </button>
              </div>
            </div>
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No failures in this window"
              description="Nothing matched these filters. Widening the time window or clearing the status filter usually shows the older ones."
            />
          ) : (
            <div className="card errdash-list">
              <div className="errdash-head">
                <span>What went wrong</span>
                <span>Feature</span>
                <span>Count</span>
                <span>Last seen</span>
                <span>Status</span>
                <span />
              </div>

              {groups.map((group) => {
                const open = openGroup === group.fingerprint;
                return (
                  <div key={group.fingerprint || group.latest_event_id} className="errdash-group">
                    <div className={`errdash-row errdash-severity-${group.severity || "minor"}`}>
                      <button type="button" className="errdash-main" onClick={() => toggleGroup(group)} aria-expanded={open}>
                        <span className="errdash-chevron">
                          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </span>
                        <span className="errdash-what">
                          <strong>{group.what || group.message || "Unnamed failure"}</strong>
                          <span className="errdash-meta">
                            <span className={`badge ${STATUS_BADGE.new} errdash-sev-badge`}>
                              {SEVERITY_LABEL[group.severity] || group.severity || "Minor"}
                            </span>
                            {group.category_label || group.category}
                            {group.reported_by_user && " · reported by a user"}
                            {group.source === "user_report" && group.reason ? ` — ${group.reason}` : ""}
                          </span>
                        </span>
                        <span className="errdash-feature">{group.feature_label || group.feature || "—"}</span>
                        <span className={`errdash-count${group.count > 1 ? " many" : ""}`}>{group.count}</span>
                        <span className="errdash-when">
                          {formatRelative(group.last_seen)}
                          <span className="errdash-first">first {formatRelative(group.first_seen)}</span>
                        </span>
                        <span className={`badge ${STATUS_BADGE[group.status] || "badge-neutral"}`}>
                          {STATUS_LABEL[group.status] || group.status || "New"}
                        </span>
                      </button>

                      <span className="errdash-actions">
                        {group.status !== "resolved" && (
                          <button className="btn btn-ghost btn-xs" disabled={savingFingerprint === group.fingerprint}
                                  onClick={() => triage(group, "resolved")}>
                            Resolve
                          </button>
                        )}
                        {group.status === "new" && (
                          <button className="btn btn-ghost btn-xs" disabled={savingFingerprint === group.fingerprint}
                                  onClick={() => triage(group, "triaged")}>
                            Triage
                          </button>
                        )}
                        {group.status !== "ignored" && group.status !== "resolved" && (
                          <button className="btn btn-ghost btn-xs" disabled={savingFingerprint === group.fingerprint}
                                  onClick={() => triage(group, "ignored")}>
                            Ignore
                          </button>
                        )}
                      </span>
                    </div>

                    {open && (
                      <div className="errdash-detail">
                        <div className="errdash-explain">
                          <div><span className="errdash-explain-label">Why</span>{group.reason || "Not recorded."}</div>
                          <div><span className="errdash-explain-label">Suggested fix</span>{group.solution || "Not recorded."}</div>
                        </div>

                        {occurrences?.loading && <SkeletonList rows={2} />}
                        {occurrences?.failed && (
                          <p className="errdash-occurrence-failed">
                            These occurrences could not be loaded. The count above still stands.
                          </p>
                        )}
                        {occurrences && !occurrences.loading && occurrences.items.length === 0 && !occurrences.failed && (
                          <p className="errdash-empty">No occurrences to show.</p>
                        )}
                        {occurrences?.items?.map((event) => (
                          <div key={event._id || event.occurred_at} className="errdash-occurrence">
                            <span className="errdash-occ-when">{formatRelative(event.occurred_at)}</span>
                            <span className="errdash-occ-src">
                              {event.source === "backend" ? "Server" : event.source === "user_report" ? "User report" : "App"}
                            </span>
                            <span className="errdash-occ-msg">
                              {event.reporter_note || event.what || event.message || "—"}
                              {event.technical && Object.keys(event.technical).length > 0 && (
                                <span className="errdash-occ-tech">
                                  {Object.entries(event.technical)
                                    .filter(([, value]) => value !== null && value !== undefined && value !== "")
                                    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
                                    .join("  ")}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}

                        <p className="errdash-privacy">
                          <Activity size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                          Keys, tokens, passwords and file paths are removed before an error is stored. User identity is kept as an
                          irreversible hash. Raw events are deleted after 90 days.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {groups.length > 0 && (
            <p className="errdash-footnote">
              <AlertOctagon size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Each row is one distinct failure. Its count is how many times that same failure happened, not how
              many people were affected. Events older than 90 days are removed automatically.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default ErrorDiagnostics;
