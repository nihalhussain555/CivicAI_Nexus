import { useEffect, useState } from "react";
import { getMapMarkers } from "../../services/analyticsService";
import GrievanceMap from "../../components/maps/GrievanceMap";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const Map = () => {
  const [data, setData] = useState(null);

  useEffect(() => { getMapMarkers().then((res) => setData(res.data)); }, []);

  return (
    <div>
      <div className="page-header">
        <div><h1>City Map</h1><p>Live grievances and community incidents, plotted geographically.</p></div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12.5, color: "var(--text-muted)", flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#16a34a", marginRight: 5 }} />Low priority</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#d97706", marginRight: 5 }} />Medium</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#ea580c", marginRight: 5 }} />High</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#dc2626", marginRight: 5 }} />Critical</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "2px dashed #dc2626", marginRight: 5 }} />Community incident</span>
      </div>

      {data ? (
        <GrievanceMap grievances={data.grievances} incidents={data.incidents} basePath="/admin/grievances" />
      ) : (
        <div className="page-loading"><LoadingSpinner label="Loading map data..." /></div>
      )}
    </div>
  );
};

export default Map;
