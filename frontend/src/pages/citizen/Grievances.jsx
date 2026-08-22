import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { getMyGrievances } from "../../services/grievanceService";
import { STATUSES, STATUS_LABELS } from "../../utils/constants";
import GrievanceCard from "../../components/grievances/GrievanceCard";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Pagination from "../../components/common/Pagination";

const Grievances = () => {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMyGrievances({ status: status || undefined, page, limit: 10 })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [status, page]);

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
      ) : data.items.length === 0 ? (
        <EmptyState icon={FileText} title="No grievances found" description="Try a different filter, or report a new issue." />
      ) : (
        <>
          {data.items.map((g) => <GrievanceCard key={g.grievance_id} grievance={g} basePath="/citizen/grievances" />)}
          <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default Grievances;
