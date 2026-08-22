import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getIncidents } from "../../services/incidentService";
import { useAuth } from "../../hooks/useAuth";
import IncidentCard from "../../components/incidents/IncidentCard";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Pagination from "../../components/common/Pagination";

const Incidents = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [riskLevel, setRiskLevel] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getIncidents({ page, limit: 10, risk_level: riskLevel || undefined })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [page, riskLevel]);

  const basePath = `/${user.role}/incidents`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Community Incidents</h1>
          <p>Clusters of related reports the AI has grouped together, so root causes get fixed.</p>
        </div>
      </div>

      <div className="tabs">
        {["", "LOW", "MEDIUM", "HIGH"].map((r) => (
          <button key={r} className={`tab ${riskLevel === r ? "active" : ""}`} onClick={() => { setRiskLevel(r); setPage(1); }}>
            {r === "" ? "All" : `${r} risk`}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No community incidents" description="No clusters of related reports have formed yet." />
      ) : (
        <>
          <div className="grid grid-2">
            {data.items.map((incident) => <IncidentCard key={incident.incident_id} incident={incident} basePath={basePath} />)}
          </div>
          <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default Incidents;
