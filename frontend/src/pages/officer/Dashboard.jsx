import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks, CheckCircle2, AlertTriangle, Flame, ArrowRight } from "lucide-react";
import { getOfficerOverview } from "../../services/analyticsService";
import { getQueue } from "../../services/grievanceService";
import { useAuth } from "../../hooks/useAuth";
import GrievanceCard from "../../components/grievances/GrievanceCard";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    getOfficerOverview().then((res) => setStats(res.data));
    getQueue({ limit: 5 }).then((res) => setQueue(res.data.items));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div><h1>Welcome, {user.name.split(" ")[0]}</h1><p>{user.department} · Priority queue and case load.</p></div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <div className="stat-card">
          <span className="stat-label"><ListChecks size={13} style={{ verticalAlign: "-2px" }} /> Assigned</span>
          <span className="stat-value">{stats?.total_assigned ?? "—"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Flame size={13} style={{ verticalAlign: "-2px" }} /> High priority</span>
          <span className="stat-value">{stats?.high_priority ?? "—"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><CheckCircle2 size={13} style={{ verticalAlign: "-2px" }} /> Resolved</span>
          <span className="stat-value">{stats?.resolved ?? "—"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> Escalated</span>
          <span className="stat-value">{stats?.escalated ?? "—"}</span>
        </div>
      </div>

      <div className="section-title" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Priority queue</span>
        <Link to="/officer/grievances" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          View all <ArrowRight size={13} />
        </Link>
      </div>

      {queue === null ? (
        <SkeletonList rows={3} />
      ) : queue.length === 0 ? (
        <EmptyState icon={ListChecks} title="Queue is empty" description="No new cases waiting in your department right now." />
      ) : (
        queue.map((g) => <GrievanceCard key={g.grievance_id} grievance={g} basePath="/officer/grievances" />)
      )}
    </div>
  );
};

export default Dashboard;
