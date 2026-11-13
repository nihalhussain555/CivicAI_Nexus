import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Search, X } from "lucide-react";
import { getMyGrievances } from "../../services/grievanceService";
import {
  PRIORITIES,
  STATUS_BUCKETS,
  STATUS_LABELS,
  STATUSES,
} from "../../utils/constants";
import GrievanceCard from "../../components/grievances/GrievanceCard";
import FilterChips from "../../components/common/FilterChips";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Pagination from "../../components/common/Pagination";
import ErrorState from "../../components/common/ErrorState";
import { getErrorMessage, titleCase } from "../../utils/helpers";

const LIMIT = 10;

// Sentinel chip value while one exact status is selected: it matches no
// option, so no chip lights up. "All" would be false there — the list is
// filtered, just not by a bucket.
const EXACT = "exact";

const BUCKET_OPTIONS = [
  { value: "", label: "Everything" },
  ...STATUS_BUCKETS.map((bucket) => ({ value: bucket.key, label: bucket.label })),
];

// Which statuses the request asks for: one exact status wins over the bucket
// chips, otherwise a bucket expands to the statuses it stands for and the
// backend answers them in the same single query.
const statusParam = (status, bucket) =>
  status || STATUS_BUCKETS.find((b) => b.key === bucket)?.statuses.join(",") || "";

const Grievances = () => {
  const [params, setParams] = useSearchParams();
  const bucket = params.get("bucket") || "";
  const status = params.get("status") || "";
  const priority = params.get("priority") || "";
  const search = params.get("q") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchInput, setSearchInput] = useState(search);

  // The URL holds the filters, so a reload, a back button or a link sent to
  // someone else lands on the same list instead of a reset one.
  const setFilters = useCallback(
    (changes) => {
      const next = new URLSearchParams(params);
      Object.entries(changes).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      });
      // Any change but the page itself is a different list; page 1 is the
      // only answer that cannot be a stale offset into the old one.
      if (!("page" in changes)) next.delete("page");
      setParams(next);
    },
    [params, setParams]
  );

  // Debounced so a citizen typing a reference ID doesn't fire a request per
  // keystroke. Nothing changes while they pause on the same text.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== search) setFilters({ q: trimmed });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, search, setFilters]);

  useEffect(() => {
    setLoading(true);
    setError("");
    getMyGrievances({
      status: statusParam(status, bucket) || undefined,
      priority: priority || undefined,
      search: search || undefined,
      page,
      limit: LIMIT,
    })
      .then((res) =>
        setData(res.data && Array.isArray(res.data.items) ? res.data : { items: [], page: 1, total_pages: 1 })
      )
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [status, bucket, priority, search, page, refreshKey]);

  const filtered = Boolean(bucket || status || priority || search);
  const items = data?.items || [];

  // Clearing resets the text box too: the debounced search would otherwise
  // write the old query straight back into the URL.
  const clearFilters = () => {
    setSearchInput("");
    setFilters({ bucket: "", status: "", priority: "", q: "" });
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>My Grievances</h1><p>Every issue you've reported, and where it stands.</p></div>
      </div>

      <div className="card search-bar">
        <Search size={15} />
        <input
          className="input"
          placeholder="Search by title, description, or reference ID (e.g. CIV-2026-3F7BDDD8)..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search my grievances"
        />
        {searchInput && (
          <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setSearchInput("")}>
            <X size={14} />
          </button>
        )}
      </div>

      <div className="filter-toolbar">
        <FilterChips
          label="Where they stand"
          options={BUCKET_OPTIONS}
          value={status ? EXACT : bucket}
          onChange={(value) => setFilters({ bucket: value, status: "" })}
        />

        <div className="filter-row">
          <span className="filter-row-label">Refine</span>
          <div className="filter-controls">
            <select
              className="select filter-select"
              aria-label="Specific status"
              value={status}
              onChange={(event) => setFilters({ status: event.target.value, bucket: "" })}
            >
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select
              className="select filter-select"
              aria-label="Priority"
              value={priority}
              onChange={(event) => setFilters({ priority: event.target.value })}
            >
              <option value="">Any priority</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{`${titleCase(p)} priority`}</option>)}
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
                {data?.total === 1 ? "1 grievance" : `${data?.total ?? items.length} grievances`} matching
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState title="Couldn’t load your grievances" description={error} onRetry={() => setRefreshKey((key) => key + 1)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtered ? "Nothing matches those filters" : "No grievances yet"}
          description={
            filtered
              ? "Widen the filters, or clear them to see everything you've reported."
              : "When you report an issue it will appear here with its progress."
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
          {items.map((g) => <GrievanceCard key={g.grievance_id} grievance={g} basePath="/citizen/track" />)}
          <Pagination page={data.page || 1} totalPages={data.total_pages || 1} onChange={(next) => setFilters({ page: next })} />
        </>
      )}
    </div>
  );
};

export default Grievances;
