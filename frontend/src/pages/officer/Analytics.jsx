import { useEffect, useState } from "react";
import { getOfficerOverview } from "../../services/analyticsService";

const Analytics = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => { getOfficerOverview().then((res) => setStats(res.data)); }, []);

  return (
    <div>
      <div className="page-header"><div><h1>My Analytics</h1><p>Your personal case performance.</p></div></div>

      <div className="grid grid-3">
        <div className="stat-card"><span className="stat-label">Total assigned</span><span className="stat-value">{stats?.total_assigned ?? "—"}</span></div>
        <div className="stat-card"><span className="stat-label">Open cases</span><span className="stat-value">{stats?.open ?? "—"}</span></div>
        <div className="stat-card"><span className="stat-label">Resolved</span><span className="stat-value">{stats?.resolved ?? "—"}</span></div>
        <div className="stat-card"><span className="stat-label">Resolution rate</span><span className="stat-value">{stats?.resolution_rate ?? "—"}%</span></div>
        <div className="stat-card"><span className="stat-label">High priority</span><span className="stat-value">{stats?.high_priority ?? "—"}</span></div>
        <div className="stat-card"><span className="stat-label">Escalated</span><span className="stat-value">{stats?.escalated ?? "—"}</span></div>
      </div>
    </div>
  );
};

export default Analytics;
