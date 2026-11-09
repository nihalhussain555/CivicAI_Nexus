import { AlertTriangle, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { CATEGORY_LABELS } from "../../utils/constants";

const RISK_COLOR = { LOW: "badge-low", MEDIUM: "badge-medium", HIGH: "badge-critical" };

const IncidentCard = ({ incident, basePath }) => (
  <Link to={`${basePath}/${incident.incident_id}`} className="card card-hover incident-card">
    <div className="incident-card-head">
      <div>
        <div className="incident-card-title">
          <AlertTriangle size={15} />
          {incident.title}
        </div>
        <div className="incident-card-meta">
          <span><Users size={12} /> {incident.report_count} reports</span>
          <span><MapPin size={12} /> {incident.center?.address || "Location pending"}</span>
        </div>
      </div>
      <span className={`badge ${RISK_COLOR[incident.risk_level] || "badge-neutral"}`}>{incident.risk_level} RISK</span>
    </div>
    {incident.probable_root_cause && (
      <p className="incident-card-cause">Probable cause: {incident.probable_root_cause}</p>
    )}
    <div className="incident-card-tags">
      <span className="badge badge-neutral">{CATEGORY_LABELS[incident.category] || incident.category}</span>
    </div>
  </Link>
);

export default IncidentCard;
