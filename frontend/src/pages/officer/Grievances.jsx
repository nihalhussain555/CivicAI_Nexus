import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { getQueue, getAssigned } from "../../services/grievanceService";
import { STATUSES, STATUS_LABELS } from "../../utils/constants";
import GrievanceCard from "../../components/grievances/GrievanceCard";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Pagination from "../../components/common/Pagination";

const TABS = [
  { key: "queue", label: "Priority Queue" },
  { key: "assigned", label: "My Cases" },
];

const Grievances = () => {
  const [tab, setTab] = useState("queue");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetcher = tab === "queue" ? getQueue({ page, limit: 10 }) : getAssigned({ status: status || undefined, page, limit: 10 });
    fetcher.then((res) => setData(res.data)).finally(() => setLoading(false));
  }, [tab, status, page]);

  return (
    <div>
      <div className="page-header"><div><h1>Grievances</h1><p>Cases waiting for you, and cases you're working on.</p></div></div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`}
                  onClick={() => { setTab(t.key); setStatus(""); setPage(1); }}>{t.label}</button>
        ))}
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

      {loading ? (
        <SkeletonList rows={5} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nothing here" description={tab === "queue" ? "No new cases waiting in your department." : "No cases matching this filter."} />
      ) : (
        <>
          {data.items.map((g) => <GrievanceCard key={g.grievance_id} grievance={g} basePath="/officer/grievances" />)}
          <Pagination page={data.page} totalPages={data.total_pages || Math.ceil(data.total / (data.limit || 10))} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default Grievances;
