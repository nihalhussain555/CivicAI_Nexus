import {
  useEffect,
  useState,
} from "react";

import {
  FileText,
  Clock,
  CheckCircle2,
  UserPlus,
  Users,
  MapPin,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  BarChart3,
} from "lucide-react";

import {
  getAdminOverview,
  getTrends,
  getDepartmentPerformanceAll,
} from "../../services/analyticsService";

import {
  getUnassignedGrievances,
} from "../../services/grievanceService";

import {
  getOfficers,
} from "../../services/officerService";

import LineChartCard from "../../components/charts/LineChartCard";
import BarChartCard from "../../components/charts/BarChartCard";

import EmptyState from "../../components/common/EmptyState";
import LoadingSpinner from "../../components/common/LoadingSpinner";

import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

const DistrictAdmin = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [stats, setStats] =
    useState(null);

  const [trends, setTrends] =
    useState([]);

  const [departments, setDepartments] =
    useState([]);

  const [unassigned, setUnassigned] =
    useState([]);

  const [officers, setOfficers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const district =
    user?.district;

  const loadDashboard =
    async () => {
      if (!district) {
        return;
      }

      try {
        setRefreshing(true);

        const [
          overviewResponse,
          trendsResponse,
          departmentResponse,
          unassignedResponse,
          officersResponse,
        ] = await Promise.all([
          getAdminOverview(),
          getTrends(30),
          getDepartmentPerformanceAll(),
          getUnassignedGrievances({
            page: 1,
            limit: 8,
          }),
          getOfficers({
            district,
          }),
        ]);

        setStats(
          overviewResponse.data
        );

        setTrends(
          trendsResponse.data || []
        );

        setDepartments(
          (departmentResponse.data || []).map(
            (item) => ({
              ...item,
              department:
                item._id,
            })
          )
        );

        setUnassigned(
          unassignedResponse.data
            ?.items || []
        );

        setOfficers(
          officersResponse.data || []
        );
      } catch (error) {
        toast.error(
          getErrorMessage(error)
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

  useEffect(() => {
    loadDashboard();
  }, [district]);

  if (
    user?.role !== "admin"
  ) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Admin access required"
        description="Only administrators can access this page."
      />
    );
  }

  if (!district) {
    return (
      <EmptyState
        icon={MapPin}
        title="Super Admin account"
        description="Use the main admin dashboard for unrestricted administration."
      />
    );
  }

  if (loading) {
    return (
      <div className="page-loading">
        <LoadingSpinner
          label="Loading district dashboard..."
        />
      </div>
    );
  }

  const busyOfficers =
    [...officers]
      .sort(
        (a, b) =>
          (b.open_cases || 0) -
          (a.open_cases || 0)
      )
      .slice(0, 5);

  return (
    <div>
      {/* HEADER */}

      <div className="page-header">
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 5,
            }}
          >
            <MapPin
              size={18}
              color="var(--accent)"
            />

            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color:
                  "var(--accent)",
              }}
            >
              DISTRICT ADMINISTRATION
            </span>
          </div>

          <h1>
            {district} District
          </h1>

          <p>
            Manage grievances,
            officers and civic
            operations within your
            district.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={loadDashboard}
          disabled={refreshing}
        >
          <RefreshCw
            size={15}
            className={
              refreshing
                ? "spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {/* STATS */}

      <div
        className="grid grid-4"
        style={{
          marginBottom: 20,
        }}
      >
        <div className="stat-card">
          <span className="stat-label">
            <FileText size={13} />
            Total grievances
          </span>

          <span className="stat-value">
            {stats?.total_grievances ??
              0}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <Clock size={13} />
            Open cases
          </span>

          <span className="stat-value">
            {stats?.open ?? 0}
          </span>
        </div>

        <div
          className="stat-card"
          style={{
            borderColor:
              stats?.unassigned > 0
                ? "var(--danger)"
                : undefined,
          }}
        >
          <span className="stat-label">
            <UserPlus size={13} />
            Unassigned
          </span>

          <span
            className="stat-value"
            style={{
              color:
                stats?.unassigned > 0
                  ? "var(--danger)"
                  : undefined,
            }}
          >
            {stats?.unassigned ??
              unassigned.length}
          </span>

          <span className="stat-sub">
            Need officer assignment
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <CheckCircle2
              size={13}
            />
            Resolved
          </span>

          <span className="stat-value">
            {stats?.resolved ?? 0}
          </span>

          <span className="stat-sub">
            {stats?.resolution_rate ??
              0}
            % resolution rate
          </span>
        </div>
      </div>

      {/* SECOND STATS */}

      <div
        className="grid grid-4"
        style={{
          marginBottom: 24,
        }}
      >
        <div className="stat-card">
          <span className="stat-label">
            <Users size={13} />
            District officers
          </span>

          <span className="stat-value">
            {stats?.total_officers ??
              officers.length}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <AlertTriangle
              size={13}
            />
            High priority
          </span>

          <span className="stat-value">
            {stats?.high_priority ??
              0}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Escalated
          </span>

          <span className="stat-value">
            {stats?.escalated ?? 0}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <BarChart3
              size={13}
            />
            Avg resolution
          </span>

          <span className="stat-value">
            {stats?.avg_resolution_hours ??
              "—"}
            h
          </span>
        </div>
      </div>

      {/* UNASSIGNED */}

      <div
        className="page-header"
        style={{
          marginTop: 12,
        }}
      >
        <div>
          <h2>
            Unassigned grievances
          </h2>

          <p>
            Officers can take cases
            themselves. You can
            manually assign cases
            that remain unattended.
          </p>
        </div>
      </div>

      {unassigned.length === 0 ? (
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <UserCheck
            size={20}
            color="var(--accent)"
          />

          <div>
            <strong>
              All grievances are
              assigned
            </strong>

            <div
              style={{
                fontSize: 12,
                color:
                  "var(--text-muted)",
                marginTop: 3,
              }}
            >
              No manual assignment
              is currently required.
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {unassigned.map(
            (grievance) => (
              <div
                key={
                  grievance.grievance_id
                }
                className="card"
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: 16,
                  flexWrap:
                    "wrap",
                }}
              >
                <div>
                  <strong>
                    {grievance.title ||
                      grievance.grievance_id}
                  </strong>

                  <div
                    style={{
                      display:
                        "flex",
                      gap: 12,
                      flexWrap:
                        "wrap",
                      fontSize: 12,
                      color:
                        "var(--text-muted)",
                      marginTop: 6,
                    }}
                  >
                    <span>
                      {grievance.grievance_id}
                    </span>

                    <span>
                      {grievance.department}
                    </span>

                    <span>
                      {grievance.priority}
                    </span>
                  </div>
                </div>

                <a
                  className="btn btn-primary"
                  href={`/admin/district/unassigned`}
                >
                  <UserPlus
                    size={15}
                  />
                  Assign Officer
                </a>
              </div>
            )
          )}
        </div>
      )}

      {/* CHARTS */}

      <div
        className="grid grid-2"
        style={{
          marginBottom: 24,
          alignItems: "start",
        }}
      >
        <LineChartCard
          title={`${district} grievances — last 30 days`}
          data={trends}
        />

        <BarChartCard
          title="Department workload"
          data={departments}
          nameKey="department"
          dataKey="total"
        />
      </div>

      {/* OFFICER WORKLOAD */}

      <div
        className="page-header"
        style={{
          marginTop: 20,
        }}
      >
        <div>
          <h2>
            Officer workload
          </h2>

          <p>
            Current workload for
            officers in{" "}
            {district}.
          </p>
        </div>
      </div>

      {busyOfficers.length ===
      0 ? (
        <EmptyState
          icon={Users}
          title="No officers"
          description="No officers are currently registered in this district."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {busyOfficers.map(
            (officer) => (
              <div
                key={officer._id}
                className="list-row"
              >
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius:
                        "50%",
                      display:
                        "grid",
                      placeItems:
                        "center",
                      background:
                        "var(--accent-soft)",
                      color:
                        "var(--accent)",
                      fontWeight: 800,
                    }}
                  >
                    {officer.name
                      ?.charAt(
                        0
                      )
                      ?.toUpperCase() ||
                      "O"}
                  </div>

                  <div>
                    <strong>
                      {officer.name}
                    </strong>

                    <div
                      style={{
                        fontSize: 12,
                        color:
                          "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {
                        officer.department
                      }
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    gap: 8,
                    alignItems:
                      "center",
                  }}
                >
                  <span className="badge badge-neutral">
                    {officer.open_cases ??
                      0}{" "}
                    open
                  </span>

                  <span
                    className={`badge ${
                      officer.active ===
                      false
                        ? "badge-danger"
                        : "badge-success"
                    }`}
                  >
                    {officer.active ===
                    false
                      ? "Inactive"
                      : "Active"}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default DistrictAdmin;