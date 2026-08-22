import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Users, AlertTriangle } from "lucide-react";
import { getIncident } from "../../services/incidentService";
import { getAllGrievances } from "../../services/grievanceService";
import { useAuth } from "../../hooks/useAuth";
import { CATEGORY_LABELS } from "../../utils/constants";
import GrievanceCard from "../../components/grievances/GrievanceCard";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorState from "../../components/common/ErrorState";
import { getErrorMessage } from "../../utils/helpers";

const RISK_COLOR = { LOW: "badge-low", MEDIUM: "badge-medium", HIGH: "badge-critical" };

const IncidentDetail = () => {
  const { incidentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [relatedGrievances, setRelatedGrievances] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getIncident(incidentId)
      .then((res) => {
        setIncident(res.data);
        if (user.role !== "citizen") {
          getAllGrievances({ limit: 50 }).then((r) =>
            setRelatedGrievances(r.data.items.filter((g) => res.data.grievance_ids.includes(g.grievance_id)))
          );
        }
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [incidentId, user.role]);

  const basePath = `/${user.role}/grievances`;

  if (error) return <ErrorState description={error} />;
  if (!incident) return <div className="page-loading"><LoadingSpinner label="Loading incident..." /></div>;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span className="badge badge-neutral">{CATEGORY_LABELS[incident.category] || incident.category}</span>
            <span className={`badge ${RISK_COLOR[incident.risk_level]}`}>{incident.risk_level} RISK</span>
          </div>
          <h1><AlertTriangle size={20} style={{ verticalAlign: "-3px", marginRight: 8, color: "var(--warning)" }} />{incident.title}</h1>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 22 }}>
        <div className="stat-card">
          <span className="stat-label">Reports</span>
          <span className="stat-value">{incident.report_count}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Status</span>
          <span className="stat-value" style={{ fontSize: 18 }}>{incident.status}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Location</span>
          <span className="stat-value" style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin size={14} /> {incident.center?.address || "Unknown"}
          </span>
        </div>
      </div>

      {incident.ai_summary && (
        <div className="card" style={{ borderColor: "var(--accent)", marginBottom: 20 }}>
          <span className="ai-tag" style={{ marginBottom: 8, display: "inline-flex" }}>AI Summary</span>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7 }}>{incident.ai_summary}</p>
          {incident.probable_root_cause && (
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 10 }}>
              <strong>Probable root cause:</strong> {incident.probable_root_cause}
            </p>
          )}
        </div>
      )}

      {user.role !== "citizen" && (
        <>
          <div className="section-title"><Users size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Related grievances</div>
          {relatedGrievances.map((g) => <GrievanceCard key={g.grievance_id} grievance={g} basePath={basePath} />)}
        </>
      )}
    </div>
  );
};

export default IncidentDetail;
