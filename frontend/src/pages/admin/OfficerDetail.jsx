import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Mail, Phone, Building2, Briefcase, Calendar, ListChecks,
  CheckCircle2, AlertTriangle, Clock,
} from "lucide-react";
import { getOfficer, getOfficerPerformance } from "../../services/officerService";
import { getErrorMessage, formatDate, formatRelative } from "../../utils/helpers";
import { CATEGORY_LABELS } from "../../utils/constants";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorState from "../../components/common/ErrorState";
import StatusBadge from "../../components/grievances/StatusBadge";
import PriorityBadge from "../../components/grievances/PriorityBadge";
import LineChartCard from "../../components/charts/LineChartCard";

const OfficerDetail = () => {
  const { officerId } = useParams();
  const navigate = useNavigate();

  const [officer, setOfficer] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getOfficer(officerId), getOfficerPerformance(officerId)])
      .then(([officerRes, perfRes]) => {
        setOfficer(officerRes.data);
        setPerformance(perfRes.data);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [officerId]);

  if (error) return <ErrorState description={error} />;
  if (!officer || !performance) {
    return <div className="page-loading"><LoadingSpinner label="Loading officer profile..." /></div>;
  }

  const initials = officer.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const trendData = performance.trend.map((t) => ({ month: t.month, resolved: t.resolved }));

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/admin/officers")} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Back to Officers
      </button>

      <div className="page-header">
        <div><h1>Officer Profile</h1><p>Case load, performance, and recent activity.</p></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        {/* Left: profile card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div
              className="avatar"
              style={{ width: 72, height: 72, fontSize: 24, margin: "0 auto 14px" }}
            >
              {initials}
            </div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{officer.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
              {officer.specialization || "Field Officer"}
            </div>

            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Mail size={14} color="var(--text-faint)" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{officer.email}</span>
              </div>
              {officer.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Phone size={14} color="var(--text-faint)" /><span>{officer.phone}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Building2 size={14} color="var(--text-faint)" /><span>{officer.department}</span>
              </div>
              {officer.badge_id && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Briefcase size={14} color="var(--text-faint)" /><span>Badge #{officer.badge_id}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Calendar size={14} color="var(--text-faint)" />
                <span>Joined {formatDate(officer.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">About Officer</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Department</span>
                <strong>{officer.department}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Specialization</span>
                <strong>{officer.specialization || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Avg. resolution time</span>
                <strong>{performance.avg_resolution_hours ? `${performance.avg_resolution_hours}h` : "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Status</span>
                <span className={`badge ${officer.active ? "badge-success" : "badge-danger"}`}>
                  {officer.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: stats, chart, case history */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="grid grid-4">
            <div className="stat-card">
              <span className="stat-label"><ListChecks size={13} /> Total assigned</span>
              <span className="stat-value">{performance.total_assigned}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label"><Clock size={13} /> Open cases</span>
              <span className="stat-value">{performance.open_cases}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label"><CheckCircle2 size={13} /> Resolved</span>
              <span className="stat-value">{performance.resolved}</span>
              <span className="stat-sub">{performance.resolution_rate}% resolution rate</span>
            </div>
            <div className="stat-card">
              <span className="stat-label"><AlertTriangle size={13} /> Escalated</span>
              <span className="stat-value">{performance.escalated}</span>
            </div>
          </div>

          <LineChartCard
            title="Resolutions per month (last 6 months)"
            data={trendData}
            nameKey="month"
            dataKey="resolved"
            height={220}
          />

          <div className="card">
            <div className="section-title">Recent Cases</div>
            {performance.recent_cases.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No cases assigned yet.</p>
            ) : (
              performance.recent_cases.map((c) => (
                <Link
                  key={c.grievance_id}
                  to={`/admin/grievances/${c.grievance_id}`}
                  className="list-row"
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11.5, color: "var(--text-faint)" }}>
                        {c.grievance_id}
                      </span>
                      <span className="badge badge-neutral">{CATEGORY_LABELS[c.category] || c.category}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>
                      Updated {formatRelative(c.updated_at)}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficerDetail;