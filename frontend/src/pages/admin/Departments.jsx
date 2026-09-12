import {
  useEffect,
  useState,
} from "react";

import {
  Building2,
  RefreshCw,
  Users,
  FileText,
} from "lucide-react";

import {
  getDepartments,
} from "../../services/departmentService";

import {
  useToast,
} from "../../context/ToastContext";

import {
  getErrorMessage,
} from "../../utils/helpers";

import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";


const Departments = () => {
  const toast = useToast();

  const [
    departments,
    setDepartments,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  // ==========================================================
  // LOAD
  // ==========================================================

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await getDepartments();

      setDepartments(
        Array.isArray(response.data)
          ? response.data
          : []
      );

    } catch (requestError) {
      const message =
        getErrorMessage(
          requestError
        );

      setError(message);

      toast.error(message);

    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    load();
  }, []);


  return (
    <div>

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="page-header">

        <div>

          <h1>
            Departments
          </h1>

          <p>
            CivicAI's canonical departments used
            by AI classification and officer routing.
          </p>

        </div>


        <button
          type="button"
          className="btn btn-secondary"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw
            size={15}
            className={
              loading
                ? "spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>


      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}


      {/* =====================================================
          LOADING
      ====================================================== */}

      {departments === null ? (

        <SkeletonList rows={7} />

      ) : departments.length === 0 ? (

        <EmptyState
          icon={Building2}
          title="No departments found"
          description="The backend department service did not return any departments."
        />

      ) : (

        <div className="grid grid-2">

          {departments.map(
            (department) => (

              <div
                key={
                  department.code ||
                  department.name
                }
                className="card"
              >

                {/* HEADER */}

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "flex-start",
                    gap: 12,
                  }}
                >

                  <div>

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >

                      <Building2
                        size={16}
                        color={
                          "var(--accent)"
                        }
                      />

                      <strong
                        style={{
                          fontSize: 15,
                        }}
                      >
                        {department.name}
                      </strong>

                    </div>


                    <span className="badge badge-neutral">
                      {department.code}
                    </span>

                  </div>


                  <span className="badge badge-status">
                    Active
                  </span>

                </div>


                {/* DESCRIPTION */}

                <p
                  style={{
                    fontSize: 13,
                    color:
                      "var(--text-muted)",
                    margin:
                      "12px 0 16px",
                    lineHeight: 1.6,
                  }}
                >
                  {department.description ||
                    "CivicAI department for handling related citizen grievances."}
                </p>


                {/* STATS */}

                <div
                  className="grid grid-3"
                  style={{
                    gap: 10,
                  }}
                >

                  <div>

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 5,
                        fontSize: 11,
                        color:
                          "var(--text-faint)",
                        marginBottom: 3,
                      }}
                    >
                      <FileText
                        size={11}
                      />
                      Grievances
                    </div>

                    <strong>
                      {department.total_grievances ??
                        0}
                    </strong>

                  </div>


                  <div>

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 5,
                        fontSize: 11,
                        color:
                          "var(--text-faint)",
                        marginBottom: 3,
                      }}
                    >
                      <FileText
                        size={11}
                      />
                      Open
                    </div>

                    <strong>
                      {department.open_grievances ??
                        0}
                    </strong>

                  </div>


                  <div>

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 5,
                        fontSize: 11,
                        color:
                          "var(--text-faint)",
                        marginBottom: 3,
                      }}
                    >
                      <Users
                        size={11}
                      />
                      Officers
                    </div>

                    <strong>
                      {department.officer_count ??
                        0}
                    </strong>

                  </div>

                </div>

              </div>

            )
          )}

        </div>

      )}

    </div>
  );
};


export default Departments;