import {
  useCallback,
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

import { Link } from "react-router-dom";

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

  /* =========================================================
     STATE
  ========================================================= */

  const [stats, setStats] = useState(null);

  const [trends, setTrends] = useState([]);

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


  /* =========================================================
     LOAD UNASSIGNED GRIEVANCES
     
     This is intentionally separated from the other APIs.
     If analytics/officers fail, unassigned grievances still load.
  ========================================================= */

  const loadUnassigned = useCallback(
    async (showError = false) => {
      if (!district) {
        return false;
      }

      try {
        const response =
          await getUnassignedGrievances({
            page: 1,
            limit: 8,
          });

        const data =
          response?.data || {};

        const items = Array.isArray(
          data.items
        )
          ? data.items
          : [];

        setUnassigned(items);

        return true;
      } catch (error) {
        console.error(
          "Failed to load unassigned grievances:",
          error
        );

        if (showError) {
          toast.error(
            getErrorMessage(error)
          );
        }

        return false;
      }
    },
    [district, toast]
  );


  /* =========================================================
     LOAD DASHBOARD
     
     Each API is loaded independently.
     One failure will NOT break the complete dashboard.
  ========================================================= */

  const loadDashboard =
    useCallback(async () => {
      if (!district) {
        return;
      }

      setRefreshing(true);

      /*
       * We don't use Promise.all here.
       *
       * Every request gets its own try/catch so that:
       *
       * Analytics error
       *      ↓
       * Unassigned grievances still load
       */

      const loadOverview = async () => {
        try {
          const response =
            await getAdminOverview();

          setStats(
            response?.data || null
          );
        } catch (error) {
          console.error(
            "District overview error:",
            error
          );
        }
      };


      const loadTrends = async () => {
        try {
          const response =
            await getTrends(30);

          setTrends(
            Array.isArray(
              response?.data
            )
              ? response.data
              : []
          );
        } catch (error) {
          console.error(
            "District trends error:",
            error
          );
        }
      };


      const loadDepartments = async () => {
        try {
          const response =
            await getDepartmentPerformanceAll();

          const data =
            Array.isArray(
              response?.data
            )
              ? response.data
              : [];

          setDepartments(
            data.map((item) => ({
              ...item,
              department:
                item?.department ||
                item?._id ||
                "Unknown",
            }))
          );
        } catch (error) {
          console.error(
            "Department performance error:",
            error
          );
        }
      };


      const loadOfficers = async () => {
        try {
          const response =
            await getOfficers({
              district,
            });

          setOfficers(
            Array.isArray(
              response?.data
            )
              ? response.data
              : []
          );
        } catch (error) {
          console.error(
            "District officers error:",
            error
          );
        }
      };


      /*
       * Run all requests at the same time,
       * but independently.
       */
      await Promise.allSettled([
        loadOverview(),
        loadTrends(),
        loadDepartments(),
        loadUnassigned(false),
        loadOfficers(),
      ]);

      setLoading(false);
      setRefreshing(false);
    }, [
      district,
      loadUnassigned,
    ]);


  /* =========================================================
     INITIAL LOAD
     
     When the district becomes available after login,
     the dashboard automatically loads.
  ========================================================= */

  useEffect(() => {
    if (!district) {
      return;
    }

    let cancelled = false;

    const start = async () => {
      if (cancelled) {
        return;
      }

      await loadDashboard();
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [
    district,
    loadDashboard,
  ]);


  /* =========================================================
     LOGIN / AUTH RACE PROTECTION
     
     Sometimes the authentication token/user information
     becomes available slightly after the page mounts.
     
     Retry the unassigned API a few times automatically.
     
     User does NOT need to refresh the browser.
  ========================================================= */

  useEffect(() => {
    if (!district) {
      return;
    }

    let attempts = 0;

    const retryTimer =
      setInterval(async () => {
        attempts += 1;

        await loadUnassigned(false);

        /*
         * Four attempts:
         *
         * immediately from dashboard load
         * + 1 second
         * + 2 seconds
         * + 3 seconds
         */
        if (attempts >= 3) {
          clearInterval(retryTimer);
        }
      }, 1000);

    return () => {
      clearInterval(retryTimer);
    };
  }, [
    district,
    loadUnassigned,
  ]);


  /* =========================================================
     ACCESS CONTROL
  ========================================================= */

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


  /* =========================================================
     SUPER ADMIN
  ========================================================= */

  if (!district) {
    return (
      <EmptyState
        icon={MapPin}
        title="Super Admin account"
        description="Use the main admin dashboard for unrestricted administration."
      />
    );
  }


  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="page-loading">
        <LoadingSpinner
          label="Loading district dashboard..."
        />
      </div>
    );
  }


  /* =========================================================
     OFFICER WORKLOAD
  ========================================================= */

  const busyOfficers =
    [...officers]
      .sort(
        (a, b) =>
          (b?.open_cases || 0) -
          (a?.open_cases || 0)
      )
      .slice(0, 5);


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div>

      {/* =====================================================
          HEADER
      ===================================================== */}

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
          type="button"
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


      {/* =====================================================
          PRIMARY STATS
      ===================================================== */}

      <div
        className="grid grid-4"
        style={{
          marginBottom: 20,
        }}
      >

        {/* TOTAL GRIEVANCES */}
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


        {/* OPEN CASES */}
        <div className="stat-card">

          <span className="stat-label">
            <Clock size={13} />
            Open cases
          </span>

          <span className="stat-value">
            {stats?.open ?? 0}
          </span>

        </div>


        {/* UNASSIGNED */}
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


        {/* RESOLVED */}
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


      {/* =====================================================
          SECONDARY STATS
      ===================================================== */}

      <div
        className="grid grid-4"
        style={{
          marginBottom: 24,
        }}
      >

        {/* OFFICERS */}
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


        {/* HIGH PRIORITY */}
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


        {/* ESCALATED */}
        <div className="stat-card">

          <span className="stat-label">
            Escalated
          </span>

          <span className="stat-value">
            {stats?.escalated ?? 0}
          </span>

        </div>


        {/* AVG RESOLUTION */}
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


      {/* =====================================================
          UNASSIGNED GRIEVANCES
      ===================================================== */}

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

        /* ===================================================
           EMPTY STATE
        =================================================== */

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

        /* ===================================================
           UNASSIGNED LIST
        =================================================== */

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
                  grievance?._id ||
                  grievance?.grievance_id
                }
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >

                <div>

                  <strong>
                    {grievance?.title ||
                      grievance?.grievance_id ||
                      "Untitled grievance"}
                  </strong>


                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      fontSize: 12,
                      color:
                        "var(--text-muted)",
                      marginTop: 6,
                    }}
                  >

                    <span>
                      {
                        grievance?.grievance_id ||
                        "No ID"
                      }
                    </span>


                    <span>
                      {
                        grievance?.department ||
                        "Department pending"
                      }
                    </span>


                    <span>
                      {
                        grievance?.priority ||
                        "NORMAL"
                      }
                    </span>

                  </div>

                </div>


                <Link
                  className="btn btn-primary"
                  to="/admin/district/unassigned"
                >
                  <UserPlus
                    size={15}
                  />

                  Assign Officer
                </Link>

              </div>

            )
          )}

        </div>

      )}


      {/* =====================================================
          CHARTS
      ===================================================== */}

      <div
        className="grid grid-2"
        style={{
          marginBottom: 24,
          alignItems: "start",
        }}
      >

        <LineChartCard
          title={`${district} grievances — last 30 days`}
          data={
            Array.isArray(trends)
              ? trends
              : []
          }
        />


        <BarChartCard
          title="Department workload"
          data={
            Array.isArray(
              departments
            )
              ? departments
              : []
          }
          nameKey="department"
          dataKey="total"
        />

      </div>


      {/* =====================================================
          OFFICER WORKLOAD
      ===================================================== */}

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


      {busyOfficers.length === 0 ? (

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
                key={officer?._id}
                className="list-row"
              >

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >

                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background:
                        "var(--accent-soft)",
                      color:
                        "var(--accent)",
                      fontWeight: 800,
                    }}
                  >
                    {officer?.name
                      ?.charAt(0)
                      ?.toUpperCase() ||
                      "O"}
                  </div>


                  <div>

                    <strong>
                      {officer?.name ||
                        "Officer"}
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
                        officer?.department ||
                        "Department not assigned"
                      }
                    </div>

                  </div>

                </div>


                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >

                  <span className="badge badge-neutral">
                    {officer?.open_cases ??
                      0}{" "}
                    open
                  </span>


                  <span
                    className={`badge ${
                      officer?.active ===
                      false
                        ? "badge-danger"
                        : "badge-success"
                    }`}
                  >
                    {officer?.active ===
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