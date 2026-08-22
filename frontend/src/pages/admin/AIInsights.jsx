import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, TrendingUp, ShieldAlert } from "lucide-react";
import { getAdminOverview } from "../../services/analyticsService";
import { getIncidents } from "../../services/incidentService";
import IncidentCard from "../../components/incidents/IncidentCard";

const AIInsights = () => {
  const [stats, setStats] = useState(null);
  const [highRiskIncidents, setHighRiskIncidents] = useState([]);

  useEffect(() => {
    getAdminOverview().then((res) => setStats(res.data));
    getIncidents({ risk_level: "HIGH", limit: 6 }).then((res) => setHighRiskIncidents(res.data.items));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div><h1><Sparkles size={20} style={{ verticalAlign: "-3px", marginRight: 8, color: "var(--accent)" }} />AI Insights</h1>
          <p>Predictive signals across the platform. All figures are AI-generated estimates.</p></div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 26 }}>
        <div className="stat-card">
          <span className="stat-label"><ShieldAlert size={13} /> SLA breaches</span>
          <span className="stat-value" style={{ color: "var(--danger)" }}>{stats?.sla_breaches ?? "—"}</span>
          <span className="stat-sub">Cases past their AI-predicted deadline</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><TrendingUp size={13} /> Escalation rate</span>
          <span className="stat-value">{stats?.escalation_rate ?? "—"}%</span>
          <span className="stat-sub">Of all grievances ever escalated</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Sparkles size={13} /> Avg AI confidence</span>
          <span className="stat-value">{stats?.avg_ai_confidence ? Math.round(stats.avg_ai_confidence * 100) + "%" : "—"}</span>
          <span className="stat-sub">Across all classified grievances</span>
        </div>
      </div>

      <div className="section-title"><AlertTriangle size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--danger)" }} />High-risk community incidents</div>
      {highRiskIncidents.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No high-risk incidents detected right now.</p>
      ) : (
        <div className="grid grid-2">
          {highRiskIncidents.map((incident) => (
            <IncidentCard key={incident.incident_id} incident={incident} basePath="/admin/incidents" />
          ))}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 24 }}>
        All predictions above are AI-generated estimates based on historical patterns and current case data —
        they inform decisions but are never a guarantee of outcome.
      </p>
    </div>
  );
};

export default AIInsights;
