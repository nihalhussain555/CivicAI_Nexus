import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2, ArrowRight, FileText } from "lucide-react";
import { getMyGrievances } from "../../services/grievanceService";
import { useAuth } from "../../hooks/useAuth";
import GrievanceCard from "../../components/grievances/GrievanceCard";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";

const Dashboard = () => {
  const { user } = useAuth();
  const [grievances, setGrievances] = useState(null);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0 });

  useEffect(() => {
    getMyGrievances({ limit: 5 }).then((res) => {
      setGrievances(res.data.items);
      const items = res.data.items;
      setStats({
        total: res.data.total,
        open: items.filter((g) => g.status !== "CLOSED").length,
        resolved: items.filter((g) => g.status === "CLOSED").length,
      });
    });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p>Here's what's happening with your reports.</p>
        </div>
        <Link to="/citizen/report" className="btn btn-primary">
          <FilePlus2 size={16} /> Report an issue
        </Link>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 26 }}>
        <div className="stat-card">
          <span className="stat-label">Total reports</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">In progress</span>
          <span className="stat-value">{stats.open}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Resolved</span>
          <span className="stat-value">{stats.resolved}</span>
        </div>
      </div>

      <div className="section-title" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Recent grievances</span>
        <Link to="/citizen/grievances" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          View all <ArrowRight size={13} />
        </Link>
      </div>

      {grievances === null ? (
        <SkeletonList rows={3} />
      ) : grievances.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No grievances yet"
          description="Report your first civic issue and AI will route it to the right department."
          action={<Link to="/citizen/report" className="btn btn-primary btn-sm">Report an issue</Link>}
        />
      ) : (
        grievances.map((g) => <GrievanceCard key={g.grievance_id} grievance={g} basePath="/citizen/grievances" />)
      )}
    </div>
  );
};

export default Dashboard;
