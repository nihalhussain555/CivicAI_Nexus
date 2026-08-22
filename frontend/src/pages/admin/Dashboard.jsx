import { useEffect, useState } from "react";
import { FileText, CheckCircle2, Flame, Clock, Sparkles } from "lucide-react";
import { getAdminOverview, getTrends, getCategoryDistribution } from "../../services/analyticsService";
import LineChartCard from "../../components/charts/LineChartCard";
import BarChartCard from "../../components/charts/BarChartCard";
import { CATEGORY_LABELS } from "../../utils/constants";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getAdminOverview().then((res) => setStats(res.data));
    getTrends(30).then((res) => setTrends(res.data));
    getCategoryDistribution().then((res) => setCategories(res.data.map((c) => ({ ...c, category: CATEGORY_LABELS[c.category] || c.category }))));
  }, []);

  return (
    <div>
      <div className="page-header"><div><h1>Admin Dashboard</h1><p>City-wide grievance intelligence at a glance.</p></div></div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card"><span className="stat-label"><FileText size={13} /> Total grievances</span><span className="stat-value">{stats?.total_grievances ?? "—"}</span></div>
        <div className="stat-card"><span className="stat-label"><Clock size={13} /> Open</span><span className="stat-value">{stats?.open ?? "—"}</span></div>
        <div className="stat-card"><span className="stat-label"><CheckCircle2 size={13} /> Resolved</span><span className="stat-value">{stats?.resolved ?? "—"}</span><span className="stat-sub">{stats?.resolution_rate}% resolution rate</span></div>
        <div className="stat-card"><span className="stat-label"><Flame size={13} /> High priority</span><span className="stat-value">{stats?.high_priority ?? "—"}</span></div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <div className="stat-card"><span className="stat-label">SLA breaches</span><span className="stat-value" style={{ color: "var(--danger)" }}>{stats?.sla_breaches ?? "—"}</span></div>
        <div className="stat-card"><span className="stat-label">Escalated</span><span className="stat-value">{stats?.escalated ?? "—"}</span><span className="stat-sub">{stats?.escalation_rate}% escalation rate</span></div>
        <div className="stat-card"><span className="stat-label">Avg resolution</span><span className="stat-value">{stats?.avg_resolution_hours ?? "—"}h</span></div>
        <div className="stat-card"><span className="stat-label"><Sparkles size={13} /> Avg AI confidence</span><span className="stat-value">{stats?.avg_ai_confidence ? Math.round(stats.avg_ai_confidence * 100) + "%" : "—"}</span></div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <LineChartCard title="Grievances over last 30 days" data={trends} />
        <BarChartCard title="Category distribution" data={categories} />
      </div>

      <div className="grid grid-3">
        <div className="stat-card"><span className="stat-label">Active incidents</span><span className="stat-value">{stats?.active_incidents ?? "—"}</span></div>
        <div className="stat-card"><span className="stat-label">Total officers</span><span className="stat-value">{stats?.total_officers ?? "—"}</span></div>
        <div className="stat-card"><span className="stat-label">Total citizens</span><span className="stat-value">{stats?.total_citizens ?? "—"}</span></div>
      </div>
    </div>
  );
};

export default Dashboard;
