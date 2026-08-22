import { AlertTriangle, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { CATEGORY_LABELS } from "../../utils/constants";

const RISK_COLOR = { LOW: "badge-low", MEDIUM: "badge-medium", HIGH: "badge-critical" };

const IncidentCard = ({ incident, basePath }) => (
  <Link to={`${basePath}/${incident.incident_id}`} className="card card-hover" style={{ display: "block" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <AlertTriangle size={15} color="var(--warning)" />
          <strong style={{ fontSize: 14.5 }}>{incident.title}</strong>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Users size={12} /> {incident.report_count} reports
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MapPin size={12} /> {incident.center?.address || "Location pending"}
          </span>
        </div>
      </div>
      <span className={`badge ${RISK_COLOR[incident.risk_level] || "badge-neutral"}`}>{incident.risk_level} RISK</span>
    </div>
    {incident.probable_root_cause && (
      <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-faint)" }}>
        Probable cause: {incident.probable_root_cause}
      </p>
    )}
    <div style={{ marginTop: 10 }}>
      <span className="badge badge-neutral">{CATEGORY_LABELS[incident.category] || incident.category}</span>
    </div>
  </Link>
);

export default IncidentCard;
