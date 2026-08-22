import { Link } from "react-router-dom";
import { MapPin, Clock } from "lucide-react";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";
import { CATEGORY_LABELS } from "../../utils/constants";
import { formatRelative } from "../../utils/helpers";

const GrievanceCard = ({ grievance, basePath }) => (
  <Link to={`${basePath}/${grievance.grievance_id}`} className="list-row" style={{ alignItems: "flex-start" }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "monospace" }}>
          {grievance.grievance_id}
        </span>
        <span className="badge badge-neutral">{CATEGORY_LABELS[grievance.category] || grievance.category}</span>
        {grievance.incident_id && <span className="badge badge-status">Community Incident</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{grievance.title}</div>
      <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: "var(--text-muted)", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} /> {grievance.location?.address || grievance.department}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={12} /> {formatRelative(grievance.created_at)}
        </span>
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
      <PriorityBadge priority={grievance.priority} />
      <StatusBadge status={grievance.status} />
    </div>
  </Link>
);

export default GrievanceCard;
