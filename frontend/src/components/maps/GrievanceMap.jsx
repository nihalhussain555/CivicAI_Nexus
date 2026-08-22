import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import { CATEGORY_LABELS } from "../../utils/constants";

const PRIORITY_COLOR = { LOW: "#16a34a", MEDIUM: "#d97706", HIGH: "#ea580c", CRITICAL: "#dc2626" };
const RISK_COLOR = { LOW: "#16a34a", MEDIUM: "#d97706", HIGH: "#dc2626" };

const GrievanceMap = ({ grievances = [], incidents = [], basePath, center = [13.0827, 80.2707], height = 520 }) => {
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
      <MapContainer center={center} zoom={12} style={{ height, width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {grievances.filter((g) => g.location?.coordinates).map((g) => {
          const [lng, lat] = g.location.coordinates;
          return (
            <CircleMarker
              key={g.grievance_id}
              center={[lat, lng]}
              radius={7}
              pathOptions={{ color: PRIORITY_COLOR[g.priority] || "#4f46e5", fillOpacity: 0.75 }}
            >
              <Popup>
                <strong>{g.title}</strong>
                <div style={{ fontSize: 12, margin: "4px 0" }}>
                  {CATEGORY_LABELS[g.category] || g.category} · {g.priority} priority
                </div>
                {basePath && (
                  <Link to={`${basePath}/${g.grievance_id}`} style={{ color: "#4f46e5", fontSize: 12, fontWeight: 600 }}>
                    View details →
                  </Link>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
        {incidents.filter((i) => i.center?.coordinates).map((incident) => {
          const [lng, lat] = incident.center.coordinates;
          return (
            <CircleMarker
              key={incident.incident_id}
              center={[lat, lng]}
              radius={12 + Math.min(incident.report_count || 0, 20)}
              pathOptions={{
                color: RISK_COLOR[incident.risk_level] || "#dc2626",
                fillOpacity: 0.2,
                weight: 2,
                dashArray: "4",
              }}
            >
              <Popup>
                <strong>{incident.title}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {incident.report_count} reports · {incident.risk_level} risk
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default GrievanceMap;
