import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCw, Filter, X } from "lucide-react";
import { getMapMarkers } from "../../services/analyticsService";
import GrievanceMap, { COLOR_MODES, colorFor, resolveClock } from "../../components/maps/mapKit";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorState from "../../components/common/ErrorState";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage, titleCase } from "../../utils/helpers";
import { CATEGORIES, DEPARTMENTS, DISTRICTS, PRIORITIES, STATE_CENTER } from "../../utils/constants";

const STAGE_OPTIONS = [
  { value: "all", label: "Every stage" },
  { value: "open", label: "Still open", open_only: true },
  { value: "new", label: "Awaiting a first response", status: "SUBMITTED,AI_ANALYZED,DEPARTMENT_ASSIGNED,REOPENED" },
  { value: "active", label: "Being worked", status: "OFFICER_ACCEPTED,IN_PROGRESS,ESCALATED" },
  { value: "verifying", label: "Awaiting citizen verification", status: "RESOLUTION_SUBMITTED,CITIZEN_VERIFICATION" },
  { value: "closed", label: "Closed", status: "CLOSED,WITHDRAWN" },
];

const TIME_WINDOWS = [
  { value: "", label: "Any time" },
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const EMPTY_FILTERS = {
  stage: "all",
  priorities: [],
  category: "",
  department: "",
  district: "",
  days: "",
  overdueOnly: false,
  showIncidents: true,
};

const Map = () => {
  const { user } = useAuth();
  const isDistrictScoped = !!user?.district;

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [colorMode, setColorMode] = useState("priority");
  const [refreshKey, setRefreshKey] = useState(0);
  const [focus, setFocus] = useState(null);

  // `snapshot` is the last payload that arrived and `outcome` records which
  // request it answered, so a refresh keeps the map populated instead of
  // blanking it, and an error always belongs to the current filters.
  const [snapshot, setSnapshot] = useState(null);
  const [outcome, setOutcome] = useState(null);

  // Only values the endpoint actually understands go on the query string —
  // sending "" for an unset filter makes FastAPI reject it as an int/bool.
  const params = useMemo(() => {
    const stage = STAGE_OPTIONS.find((option) => option.value === filters.stage);
    const query = { include_incidents: filters.showIncidents };
    if (stage?.status) query.status = stage.status;
    if (stage?.open_only) query.open_only = true;
    if (filters.priorities.length) query.priority = filters.priorities.join(",");
    if (filters.category) query.category = filters.category;
    if (filters.department) query.department = filters.department;
    if (filters.district && !isDistrictScoped) query.district = filters.district;
    if (filters.days) query.days = Number(filters.days);
    if (filters.overdueOnly) query.sla_breached = true;
    return query;
  }, [filters, isDistrictScoped]);

  const requestKey = `${JSON.stringify(params)}|${refreshKey}`;

  useEffect(() => {
    let cancelled = false;
    getMapMarkers(params)
      .then((res) => {
        if (cancelled) return;
        setSnapshot(res.data);
        setOutcome({ key: requestKey, error: null });
      })
      .catch((error) => {
        if (!cancelled) setOutcome({ key: requestKey, error: getErrorMessage(error) });
      });
    return () => { cancelled = true; };
  }, [params, requestKey]);

  const loading = outcome?.key !== requestKey;
  const error = outcome?.key === requestKey ? outcome.error : null;

  const setFilter = (patch) => setFilters((prev) => ({ ...prev, ...patch }));

  const togglePriority = (value) =>
    setFilters((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(value)
        ? prev.priorities.filter((p) => p !== value)
        : [...prev.priorities, value],
    }));

  const isDirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const reload = useCallback(() => setRefreshKey((key) => key + 1), []);

  const grievances = snapshot?.grievances || [];
  const incidents = snapshot?.incidents || [];
  const meta = snapshot?.meta;
  const clock = resolveClock(meta?.generated_at);

  // Category and department are written by the classifier, not picked from a
  // list, so the dropdowns offer whatever the current scope actually contains.
  const categoryOptions = meta?.facets?.categories?.length || CATEGORIES;
  const departmentOptions = meta?.facets?.departments?.length || DEPARTMENTS;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>City Map</h1>
          <p>
            {isDistrictScoped
              ? `Every report in ${user.district}, plotted where citizens filed it.`
              : "Live grievances and community incidents, plotted geographically."}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={reload} disabled={loading}>
          <RotateCw size={14} className={loading ? "spin" : undefined} /> Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="map-toolbar">
          <div className="form-group">
            <label className="form-label" htmlFor="map-stage">Stage</label>
            <select id="map-stage" className="select" value={filters.stage}
                    onChange={(e) => setFilter({ stage: e.target.value })}>
              {STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Priority</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  className={`filter-chip ${filters.priorities.includes(priority) ? "active" : ""}`}
                  onClick={() => togglePriority(priority)}
                >
                  {priority.charAt(0) + priority.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="map-category">Category</label>
            <select id="map-category" className="select" value={filters.category}
                    onChange={(e) => setFilter({ category: e.target.value })}>
              <option value="">All categories</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="map-department">Department</label>
            <select id="map-department" className="select" value={filters.department}
                    onChange={(e) => setFilter({ department: e.target.value })}>
              <option value="">All departments</option>
              {departmentOptions.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </select>
          </div>

          {!isDistrictScoped && (
            <div className="form-group">
              <label className="form-label" htmlFor="map-district">District</label>
              <select id="map-district" className="select" value={filters.district}
                      onChange={(e) => setFilter({ district: e.target.value })}>
                <option value="">All districts</option>
                {DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="map-days">Filed</label>
            <select id="map-days" className="select" value={filters.days}
                    onChange={(e) => setFilter({ days: e.target.value })}>
              {TIME_WINDOWS.map((window) => (
                <option key={window.value} value={window.value}>{window.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">View</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`filter-chip ${filters.overdueOnly ? "active" : ""}`}
                onClick={() => setFilter({ overdueOnly: !filters.overdueOnly })}
              >
                Past SLA only
              </button>
              <button
                type="button"
                className={`filter-chip ${filters.showIncidents ? "active" : ""}`}
                onClick={() => setFilter({ showIncidents: !filters.showIncidents })}
              >
                Community incidents
              </button>
              {isDirty && (
                <button type="button" className="filter-chip" onClick={() => setFilters(EMPTY_FILTERS)}>
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
            {Object.entries(COLOR_MODES).map(([key, mode]) => (
              <div
                key={key}
                className={`tab ${colorMode === key ? "active" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setColorMode(key)}
              >
                {mode.label}
              </div>
            ))}
          </div>
          <div className="map-legend">
            {COLOR_MODES[colorMode].legend.map((entry) => (
              <span key={entry.label}>
                <span className="legend-dot" style={{ background: entry.color }} />
                {entry.label}
              </span>
            ))}
            {filters.showIncidents && (
              <span><span className="legend-ring" /> Incident zone</span>
            )}
          </div>
        </div>
      </div>

      {loading && !snapshot && (
        <div className="page-loading"><LoadingSpinner label="Loading map data..." /></div>
      )}

      {error && (
        <div className="card">
          <ErrorState
            title="Couldn't load the map"
            description={`${error} The API may be asleep — retrying usually works.`}
            onRetry={reload}
          />
        </div>
      )}

      {snapshot && (
        <>
          <div className="map-meta" style={{ marginBottom: 12 }}>
            <Filter size={12} style={{ verticalAlign: "-1px", marginRight: 5 }} />
            Showing {meta.returned} of {meta.total_in_scope} reports
            {meta.without_coordinates > 0 && ` · ${meta.without_coordinates} hidden because they have no usable location`}
            {meta.truncated && " · oldest matches beyond the current limit are not shown"}
            {meta.returned === 0 && meta.total_in_scope > 0 && " · none of the matches can be plotted"}
            {loading && " · refreshing..."}
          </div>

          <div className="map-layout">
            <GrievanceMap
              grievances={grievances}
              incidents={incidents}
              basePath="/admin/grievances"
              colorMode={colorMode}
              fitKey={requestKey}
              focus={focus}
              showIncidents={filters.showIncidents}
              defaultCenter={STATE_CENTER}
              now={meta.generated_at}
              height={560}
            />

            <div className="card">
              <div className="section-title">
                {grievances.length ? `Map points (${grievances.length})` : "Nothing plotted"}
              </div>

              {!grievances.length && (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  No reports match these filters. Widen the stage or time window to see more.
                </p>
              )}

              <div className="map-results">
                {grievances.map((grievance) => {
                  const [lng, lat] = grievance.location.coordinates;
                  return (
                    <button
                      key={grievance.grievance_id}
                      type="button"
                      className={`map-result-row ${focus?.id === grievance.grievance_id ? "active" : ""}`}
                      onClick={() => setFocus({ id: grievance.grievance_id, latitude: lat, longitude: lng })}
                    >
                      <span className="legend-dot" style={{ background: colorFor(grievance, colorMode, clock), marginTop: 4 }} />
                      <span>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700 }}>
                          {grievance.title}
                        </span>
                        <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                          {grievance.priority} · {grievance.status}
                          {grievance.district ? ` · ${grievance.district}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Map;
