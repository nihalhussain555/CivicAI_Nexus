import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { getIncidents } from "../../services/incidentService";
import { useAuth } from "../../hooks/useAuth";
import {
  CATEGORIES,
  CATEGORY_NAMES,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
} from "../../utils/constants";
import IncidentCard from "../../components/incidents/IncidentCard";
import FilterChips from "../../components/common/FilterChips";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Pagination from "../../components/common/Pagination";
import ErrorState from "../../components/common/ErrorState";
import { getErrorMessage, titleCase } from "../../utils/helpers";

const LIMIT = 10;
const RISKS = ["LOW", "MEDIUM", "HIGH"];

const RISK_OPTIONS = [
  { value: "", label: "Everything" },
  ...RISKS.map((risk) => ({ value: risk, label: `${titleCase(risk)} risk` })),
];

const Incidents = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const risk = params.get("risk") || "";
  const category = params.get("category") || "";
  const status = params.get("status") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Same deal as the grievance list: the filters live in the URL, so a link
  // or the back button returns to the crowd you were looking at.
  const setFilters = useCallback(
    (changes) => {
      const next = new URLSearchParams(params);
      Object.entries(changes).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      });
      if (!("page" in changes)) next.delete("page");
      setParams(next);
    },
    [params, setParams]
  );

  useEffect(() => {
    setLoading(true);
    setError("");
    getIncidents({
      risk_level: risk || undefined,
      category: category || undefined,
      status: status || undefined,
      page,
      limit: LIMIT,
    })
      .then((res) =>
        setData(res.data && Array.isArray(res.data.items) ? res.data : { items: [], page: 1, total_pages: 1 })
      )
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [risk, category, status, page, refreshKey]);

  const basePath = `/${user.role}/incidents`;
  const filtered = Boolean(risk || category || status);
  const clearFilters = () => setFilters({ risk: "", category: "", status: "" });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Community Incidents</h1>
          <p>Clusters of related reports the AI has grouped together, so root causes get fixed.</p>
        </div>
      </div>

      <div className="filter-toolbar">
        <FilterChips
          label="How serious"
          options={RISK_OPTIONS}
          value={risk}
          onChange={(value) => setFilters({ risk: value })}
        />

        <div className="filter-row">
          <span className="filter-row-label">Refine</span>
          <div className="filter-controls">
            <select
              className="select filter-select"
              aria-label="Category"
              value={category}
              onChange={(event) => setFilters({ category: event.target.value })}
            >
              <option value="">Any category</option>
              {CATEGORIES.map((code) => (
                <option key={code} value={code}>{CATEGORY_NAMES[code] || titleCase(code)}</option>
              ))}
            </select>
            <select
              className="select filter-select"
              aria-label="Incident status"
              value={status}
              onChange={(event) => setFilters({ status: event.target.value })}
            >
              <option value="">Any stage</option>
              {INCIDENT_STATUSES.map((code) => (
                <option key={code} value={code}>{INCIDENT_STATUS_LABELS[code]}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered && (
          <div className="filter-foot">
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
            {!loading && !error && (
              <span className="filter-count">
                {data?.total === 1 ? "1 incident" : `${data?.total ?? 0} incidents`} matching
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState
          title="Couldn’t load community incidents"
          description={error}
          onRetry={() => setRefreshKey((key) => key + 1)}
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={filtered ? "No incidents match those filters" : "No community incidents"}
          description={
            filtered
              ? "Widen the filters, or clear them to see every cluster the AI has found."
              : "No clusters of related reports have formed yet."
          }
          action={
            filtered ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="grid grid-2">
            {data.items.map((incident) => <IncidentCard key={incident.incident_id} incident={incident} basePath={basePath} />)}
          </div>
          <Pagination page={data.page} totalPages={data.total_pages} onChange={(next) => setFilters({ page: next })} />
        </>
      )}
    </div>
  );
};

export default Incidents;
