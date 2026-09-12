import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
} from "lucide-react";

import {
  getOfficer,
  getOfficerPerformance,
} from "../../services/officerService";

import {
  getErrorMessage,
  formatDate,
  formatRelative,
} from "../../utils/helpers";

import {
  CATEGORY_LABELS,
} from "../../utils/constants";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOfficer = async () => {
    if (!officerId) {
      setError("Officer ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [officerResponse, performanceResponse] =
        await Promise.all([
          getOfficer(officerId),
          getOfficerPerformance(officerId),
        ]);

      const officerData =
        officerResponse?.data || null;

      const performanceData =
        performanceResponse?.data || {};

      setOfficer(officerData);

      setPerformance({
        total_assigned:
          Number(
            performanceData.total_assigned || 0
          ),

        open_cases:
          Number(
            performanceData.open_cases || 0
          ),

        resolved:
          Number(
            performanceData.resolved || 0
          ),

        escalated:
          Number(
            performanceData.escalated || 0
          ),

        resolution_rate:
          Number(
            performanceData.resolution_rate || 0
          ),

        avg_resolution_hours:
          performanceData.avg_resolution_hours ??
          null,

        trend:
          Array.isArray(
            performanceData.trend
          )
            ? performanceData.trend
            : [],

        recent_cases:
          Array.isArray(
            performanceData.recent_cases
          )
            ? performanceData.recent_cases
            : [],
      });
    } catch (requestError) {
      console.error(
        "Failed to load officer:",
        requestError
      );

      setError(
        getErrorMessage(requestError)
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfficer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officerId]);

  if (loading) {
    return (
      <div className="page-loading">
        <LoadingSpinner label="Loading officer profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            navigate("/admin/officers")
          }
          style={{ marginBottom: 14 }}
        >
          <ArrowLeft size={14} />
          Back to Officers
        </button>

        <ErrorState description={error} />

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 16,
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={loadOfficer}
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!officer) {
    return (
      <ErrorState description="Officer not found." />
    );
  }

  const safeName =
    officer.name || "Unnamed officer";

  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const trendData =
    performance.trend.map((item) => ({
      month:
        item.month || "Unknown",
      resolved:
        Number(item.resolved || 0),
    }));

  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          navigate("/admin/officers")
        }
        style={{ marginBottom: 14 }}
      >
        <ArrowLeft size={14} />
        Back to Officers
      </button>

      <div className="page-header">
        <div>
          <h1>Officer Profile</h1>
          <p>
            Case load, performance, department,
            and recent activity.
          </p>
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns:
            "320px minmax(0, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            className="card"
            style={{ textAlign: "center" }}
          >
            <div
              className="avatar"
              style={{
                width: 72,
                height: 72,
                fontSize: 24,
                margin:
                  "0 auto 14px",
              }}
            >
              {initials}
            </div>

            <div
              style={{
                fontWeight: 800,
                fontSize: 17,
              }}
            >
              {safeName}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                marginBottom: 14,
              }}
            >
              {officer.specialization ||
                "Field Officer"}
            </div>

            <div
              style={{
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Mail
                  size={14}
                  color="var(--text-faint)"
                />

                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {officer.email ||
                    "No email"}
                </span>
              </div>

              {officer.phone && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Phone
                    size={14}
                    color="var(--text-faint)"
                  />

                  <span>
                    {officer.phone}
                  </span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Building2
                  size={14}
                  color="var(--text-faint)"
                />

                <span>
                  {officer.department ||
                    "No department"}
                </span>
              </div>

              {officer.district && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <MapPin
                    size={14}
                    color="var(--text-faint)"
                  />

                  <span>
                    {officer.district} district
                  </span>
                </div>
              )}

              {officer.badge_id && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Briefcase
                    size={14}
                    color="var(--text-faint)"
                  />

                  <span>
                    Badge #{officer.badge_id}
                  </span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Calendar
                  size={14}
                  color="var(--text-faint)"
                />

                <span>
                  Joined{" "}
                  {officer.created_at
                    ? formatDate(
                        officer.created_at
                      )
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">
              About Officer
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Department
                </span>

                <strong>
                  {officer.department ||
                    "—"}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  District
                </span>

                <strong>
                  {officer.district ||
                    "—"}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Avg. resolution
                </span>

                <strong>
                  {performance.avg_resolution_hours !==
                  null
                    ? `${performance.avg_resolution_hours}h`
                    : "—"}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Status
                </span>

                <span
                  className={`badge ${
                    officer.active === false
                      ? "badge-danger"
                      : "badge-success"
                  }`}
                >
                  {officer.active === false
                    ? "Inactive"
                    : "Active"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            minWidth: 0,
          }}
        >
          <div className="grid grid-4">
            <div className="stat-card">
              <span className="stat-label">
                <ListChecks size={13} />
                Total assigned
              </span>

              <span className="stat-value">
                {performance.total_assigned}
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">
                <Clock size={13} />
                Open cases
              </span>

              <span className="stat-value">
                {performance.open_cases}
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">
                <CheckCircle2 size={13} />
                Resolved
              </span>

              <span className="stat-value">
                {performance.resolved}
              </span>

              <span className="stat-sub">
                {performance.resolution_rate}%
                {" "}
                resolution rate
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">
                <AlertTriangle size={13} />
                Escalated
              </span>

              <span className="stat-value">
                {performance.escalated}
              </span>
            </div>
          </div>

          {trendData.length > 0 ? (
            <LineChartCard
              title="Resolutions per month"
              data={trendData}
              nameKey="month"
              dataKey="resolved"
              height={220}
            />
          ) : (
            <div className="card">
              <div className="section-title">
                Resolution trend
              </div>

              <p
                style={{
                  color:
                    "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No resolution history is
                available yet.
              </p>
            </div>
          )}

          <div className="card">
            <div className="section-title">
              Recent Cases
            </div>

            {performance.recent_cases.length ===
            0 ? (
              <p
                style={{
                  fontSize: 13,
                  color:
                    "var(--text-muted)",
                }}
              >
                No cases assigned yet.
              </p>
            ) : (
              performance.recent_cases.map(
                (item) => (
                  <Link
                    key={
                      item.grievance_id
                    }
                    to={`/admin/grievances/${item.grievance_id}`}
                    className="list-row"
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          gap: 8,
                          marginBottom: 4,
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontFamily:
                              "monospace",
                            fontSize: 11.5,
                            color:
                              "var(--text-faint)",
                          }}
                        >
                          {item.grievance_id}
                        </span>

                        <span className="badge badge-neutral">
                          {CATEGORY_LABELS[
                            item.category
                          ] ||
                            item.category ||
                            "General"}
                        </span>
                      </div>

                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13.5,
                        }}
                      >
                        {item.title ||
                          "Untitled grievance"}
                      </div>

                      <div
                        style={{
                          fontSize: 11.5,
                          color:
                            "var(--text-faint)",
                          marginTop: 4,
                        }}
                      >
                        Updated{" "}
                        {item.updated_at
                          ? formatRelative(
                              item.updated_at
                            )
                          : "—"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection:
                          "column",
                        gap: 8,
                        alignItems:
                          "flex-end",
                      }}
                    >
                      <PriorityBadge
                        priority={
                          item.priority ||
                          "LOW"
                        }
                      />

                      <StatusBadge
                        status={
                          item.status ||
                          "SUBMITTED"
                        }
                      />
                    </div>
                  </Link>
                )
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficerDetail;