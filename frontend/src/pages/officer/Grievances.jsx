import { useEffect, useState } from "react";
import { ListChecks, Search, X, CheckSquare, Square, CheckCircle2 } from "lucide-react";
import { getQueue, getAssigned, bulkAcceptCases } from "../../services/grievanceService";
import { STATUSES, STATUS_LABELS } from "../../utils/constants";
import GrievanceCard from "../../components/grievances/GrievanceCard";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Pagination from "../../components/common/Pagination";
import ErrorState from "../../components/common/ErrorState";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

const TABS = [
  { key: "queue", label: "Priority Queue" },
  { key: "assigned", label: "My Cases" },
];

const Grievances = () => {
  const [tab, setTab] = useState("queue");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [selected, setSelected] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [resultModal, setResultModal] = useState(null); // { accepted, skipped }

  const toast = useToast();

  // Debounced search — waits for a pause in typing before hitting the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    setError("");
    setSelected(new Set());
    const params = { page, limit: 10, search: search || undefined };
    const fetcher = tab === "queue" ? getQueue(params) : getAssigned({ ...params, status: status || undefined });
    fetcher
      .then((res) => setData(res.data && Array.isArray(res.data.items) ? res.data : { items: [], page: 1, total_pages: 1 }))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [tab, status, search, page, refreshKey]);

  const items = data?.items || [];
  const allSelectedOnPage = items.length > 0 && items.every((g) => selected.has(g.grievance_id));

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        items.forEach((g) => next.delete(g.grievance_id));
      } else {
        items.forEach((g) => next.add(g.grievance_id));
      }
      return next;
    });
  };

  const runBulkAccept = async () => {
    setBulkLoading(true);
    try {
      const res = await bulkAcceptCases(Array.from(selected));
      setConfirmOpen(false);
      setResultModal(res.data);
      setSelected(new Set());
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header"><div><h1>Grievances</h1><p>Cases waiting for you, and cases you're working on.</p></div></div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`}
                  onClick={() => { setTab(t.key); setStatus(""); setPage(1); }}>{t.label}</button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16, padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Search size={15} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
          <input
            className="input"
            style={{ border: "none", padding: 0, flex: 1 }}
            placeholder="Search by title, description, or reference ID (e.g. CIV-2026-3F7BDDD8)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setSearchInput("")}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {tab === "assigned" && (
        <div className="tabs" style={{ flexWrap: "wrap" }}>
          <button className={`tab ${status === "" ? "active" : ""}`} onClick={() => { setStatus(""); setPage(1); }}>All</button>
          {STATUSES.filter((s) => s !== "SUBMITTED" && s !== "AI_ANALYZED" && s !== "DEPARTMENT_ASSIGNED").map((s) => (
            <button key={s} className={`tab ${status === s ? "active" : ""}`} onClick={() => { setStatus(s); setPage(1); }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {tab === "queue" && items.length > 0 && (
        <div className="bulk-action-bar">
          <button type="button" className="bulk-select-all" onClick={toggleAllOnPage}>
            {allSelectedOnPage ? <CheckSquare size={16} /> : <Square size={16} />}
            Select all on this page
          </button>
          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{selected.size} selected</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
              <button className="btn btn-primary btn-sm" onClick={() => setConfirmOpen(true)}>
                <CheckCircle2 size={14} /> Accept selected
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState title="Couldn’t load grievances" description={error} onRetry={() => setRefreshKey((key) => key + 1)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={search ? Search : ListChecks}
          title={search ? "No matches" : "Nothing here"}
          description={search ? `No cases match "${search}".` : tab === "queue" ? "No new cases waiting in your department." : "No cases matching this filter."}
        />
      ) : (
        <>
          {items.map((g) => (
            <div key={g.grievance_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {tab === "queue" && (
                <button
                  type="button"
                  className="bulk-checkbox"
                  aria-label={selected.has(g.grievance_id) ? "Deselect" : "Select"}
                  onClick={() => toggleOne(g.grievance_id)}
                >
                  {selected.has(g.grievance_id) ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <GrievanceCard grievance={g} basePath="/officer/grievances" />
              </div>
            </div>
          ))}
          <Pagination page={data.page || 1} totalPages={data.total_pages || Math.ceil(data.total / (data.limit || 10)) || 1} onChange={setPage} />
        </>
      )}

      <Modal
        open={confirmOpen}
        title="Accept selected cases?"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={bulkLoading} onClick={runBulkAccept}>
              {bulkLoading ? "Accepting..." : `Accept ${selected.size} case(s)`}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
          You're about to accept <strong>{selected.size}</strong> case(s) and assign them all to yourself.
          Any case someone else takes in the meantime will be skipped automatically.
        </p>
      </Modal>

      <Modal
        open={!!resultModal}
        title="Bulk accept results"
        onClose={() => setResultModal(null)}
        footer={<button className="btn btn-primary" onClick={() => setResultModal(null)}>Done</button>}
      >
        {resultModal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13.5 }}>
              <strong style={{ color: "var(--priority-low)" }}>{resultModal.accepted.length}</strong> accepted
              {resultModal.skipped.length > 0 && (
                <> · <strong style={{ color: "var(--warning)" }}>{resultModal.skipped.length}</strong> skipped</>
              )}
            </p>
            {resultModal.skipped.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {resultModal.skipped.map((s) => (
                  <div key={s.grievance_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)" }}>
                    <span style={{ fontFamily: "monospace" }}>{s.grievance_id}</span>
                    <span>{s.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Grievances;