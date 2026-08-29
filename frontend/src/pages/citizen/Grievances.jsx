import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { getMyGrievances } from "../../services/grievanceService";
import { STATUSES, STATUS_LABELS } from "../../utils/constants";
import GrievanceCard from "../../components/grievances/GrievanceCard";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Pagination from "../../components/common/Pagination";
import ErrorState from "../../components/common/ErrorState";
import { getErrorMessage } from "../../utils/helpers";

const Grievances = () => {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    getMyGrievances({ status: status || undefined, page, limit: 10 })
      .then((res) => setData(res.data && Array.isArray(res.data.items) ? res.data : { items: [], page: 1, total_pages: 1 }))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [status, page, refreshKey]);

  return (
    <div>
      <div className="page-header">
        <div><h1>My Grievances</h1><p>Every issue you've reported, and where it stands.</p></div>
      </div>

      <div className="tabs" style={{ flexWrap: "wrap" }}>
        <button className={`tab ${status === "" ? "active" : ""}`} onClick={() => { setStatus(""); setPage(1); }}>All</button>
        {STATUSES.map((s) => (
          <button key={s} className={`tab ${status === s ? "active" : ""}`} onClick={() => { setStatus(s); setPage(1); }}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState title="Couldn’t load your grievances" description={error} onRetry={() => setRefreshKey((key) => key + 1)} />
      ) : data?.items?.length === 0 ? (
        <EmptyState icon={FileText} title="No grievances found" description="Try a different filter, or report a new issue." />
      ) : (
        <>
          {data.items.map((g) => <GrievanceCard key={g.grievance_id} grievance={g} basePath="/citizen/grievances" />)}
          <Pagination page={data.page || 1} totalPages={data.total_pages || 1} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default Grievances;
