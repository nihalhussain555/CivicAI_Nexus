import { useEffect, useState } from "react";
import { getAdminOverview, getCategoryDistribution, getDepartmentPerformanceAll, getTrends } from "../../services/analyticsService";
import LineChartCard from "../../components/charts/LineChartCard";
import BarChartCard from "../../components/charts/BarChartCard";
import PieChartCard from "../../components/charts/PieChartCard";
import { CATEGORY_LABELS } from "../../utils/constants";

const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [categories, setCategories] = useState([]);
  const [deptPerf, setDeptPerf] = useState([]);

  useEffect(() => {
    getAdminOverview().then((res) => setStats(res.data));
    getTrends(30).then((res) => setTrends(res.data));
    getCategoryDistribution().then((res) => setCategories(res.data.map((c) => ({ ...c, category: CATEGORY_LABELS[c.category] || c.category }))));
    getDepartmentPerformanceAll().then((res) => setDeptPerf(res.data.map((d) => ({ ...d, department: d._id }))));
  }, []);

  return (
    <div>
      <div className="page-header"><div><h1>Analytics</h1><p>Deep dive into platform-wide performance.</p></div></div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card"><span className="stat-label">Resolution rate</span><span className="stat-value">{stats?.resolution_rate ?? "—"}%</span></div>
        <div className="stat-card"><span className="stat-label">Escalation rate</span><span className="stat-value">{stats?.escalation_rate ?? "—"}%</span></div>
        <div className="stat-card"><span className="stat-label">Avg resolution</span><span className="stat-value">{stats?.avg_resolution_hours ?? "—"}h</span></div>
        <div className="stat-card"><span className="stat-label">SLA breaches</span><span className="stat-value" style={{ color: "var(--danger)" }}>{stats?.sla_breaches ?? "—"}</span></div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <LineChartCard title="Grievance trends (30 days)" data={trends} />
        <PieChartCard title="Category distribution" data={categories} nameKey="category" />
      </div>

      <BarChartCard title="Department performance (total cases)" data={deptPerf} nameKey="department" dataKey="total" />

      <div className="section-title" style={{ marginTop: 24 }}>Department resolution rates</div>
      {deptPerf.map((d) => (
        <div key={d.department} className="list-row">
          <strong>{d.department}</strong>
          <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
            <span>{d.total} total</span>
            <span>{d.resolved} resolved</span>
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>{d.resolution_rate}%</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Analytics;
