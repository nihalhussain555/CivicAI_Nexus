import {
  useEffect,
  useState,
} from "react";

import {
  UserPlus,
  MapPin,
  Building2,
  Clock,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  CheckSquare,
  Square,
  Users,
} from "lucide-react";

import {
  getUnassignedGrievances,
  assignOfficer,
  bulkAssignOfficer,
} from "../../services/grievanceService";

import {
  getOfficers,
} from "../../services/officerService";

import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";

import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";

import {
  getErrorMessage,
} from "../../utils/helpers";

const UnassignedGrievances = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [selectedGrievance, setSelectedGrievance] =
    useState(null);

  const [officers, setOfficers] =
    useState([]);

  const [selectedOfficer, setSelectedOfficer] =
    useState("");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [assigning, setAssigning] =
    useState(false);

  const [selected, setSelected] = useState(() => new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkOfficers, setBulkOfficers] = useState([]);
  const [bulkOfficer, setBulkOfficer] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const load = async () => {
    try {
      setRefreshing(true);

      const response =
        await getUnassignedGrievances({
          page: 1,
          limit: 100,
        });

      setItems(
        response.data?.items || []
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
    load();
  }, []);

  const openAssignModal =
    async (grievance) => {
      try {
        const response =
          await getOfficers({
            department:
              grievance.department,
            district:
              grievance.district,
          });

        const available =
          (
            response.data || []
          ).filter(
            (officer) =>
              officer.active !==
              false
          );

        setOfficers(
          available
        );

        setSelectedGrievance(
          grievance
        );

        setSelectedOfficer("");

        setModalOpen(true);
      } catch (error) {
        toast.error(
          getErrorMessage(error)
        );
      }
    };

  const closeModal = () => {
    if (assigning) {
      return;
    }

    setModalOpen(false);
    setSelectedGrievance(
      null
    );
    setSelectedOfficer("");
  };

  const handleAssign =
    async () => {
      if (
        !selectedGrievance ||
        !selectedOfficer
      ) {
        return;
      }

      try {
        setAssigning(true);

        await assignOfficer(
          selectedGrievance.grievance_id,
          selectedOfficer
        );

        toast.success(
          "Grievance assigned successfully"
        );

        closeModal();

        await load();
      } catch (error) {
        toast.error(
          getErrorMessage(error)
        );
      } finally {
        setAssigning(false);
      }
    };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = items.length > 0 && items.every((g) => selected.has(g.grievance_id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        items.forEach((g) => next.delete(g.grievance_id));
      } else {
        items.forEach((g) => next.add(g.grievance_id));
      }
      return next;
    });
  };

  const selectedItems = items.filter((g) => selected.has(g.grievance_id));
  const selectedDepartments = new Set(selectedItems.map((g) => g.department));
  const sameDepartment = selectedDepartments.size === 1;

  const openBulkModal = async () => {
    if (!sameDepartment) return;
    try {
      const first = selectedItems[0];
      const response = await getOfficers({ department: first.department, district: first.district });
      const available = (response.data || []).filter((officer) => officer.active !== false);
      setBulkOfficers(available);
      setBulkOfficer("");
      setBulkModalOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const closeBulkModal = () => {
    if (bulkAssigning) return;
    setBulkModalOpen(false);
    setBulkOfficer("");
  };

  const handleBulkAssign = async () => {
    if (!bulkOfficer) return;
    try {
      setBulkAssigning(true);
      const res = await bulkAssignOfficer(Array.from(selected), bulkOfficer);
      setBulkModalOpen(false);
      setBulkResult(res.data);
      setSelected(new Set());
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBulkAssigning(false);
    }
  };

  if (
    user?.role !== "admin" ||
    !user?.district
  ) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="District Admin access required"
        description="Only district-scoped administrators can manually assign district grievances."
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: 7,
              marginBottom: 5,
              color:
                "var(--accent)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <MapPin
              size={14}
            />

            {user.district}
          </div>

          <h1>
            Unassigned Grievances
          </h1>

          <p>
            Cases waiting for an
            officer to take ownership.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={load}
          disabled={refreshing}
        >
          <RefreshCw
            size={15}
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      <div
        className="card"
        style={{
          display:
            "flex",
          alignItems:
            "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <UserCheck
          size={20}
          color="var(--accent)"
        />

        <div>
          <strong>
            {items.length}{" "}
            unassigned case
            {items.length === 1
              ? ""
              : "s"}
          </strong>

          <div
            style={{
              fontSize: 12,
              color:
                "var(--text-muted)",
              marginTop: 2,
            }}
          >
            Officers may self-claim
            these cases. Manual
            assignment is available
            when necessary.
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="bulk-action-bar">
          <button type="button" className="bulk-select-all" onClick={toggleAll}>
            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            Select all
          </button>
          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{selected.size} selected</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
              <button className="btn btn-primary btn-sm" disabled={!sameDepartment} onClick={openBulkModal}>
                <Users size={14} /> Assign selected to officer
              </button>
              {!sameDepartment && (
                <span style={{ fontSize: 12, color: "var(--warning)" }}>
                  Select cases from one department to bulk-assign
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonList rows={6} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No unassigned grievances"
          description="Every grievance in your district currently has an officer assigned."
        />
      ) : (
        <div
          style={{
            display:
              "grid",
            gap: 12,
          }}
        >
          {items.map(
            (grievance) => (
              <div
                key={
                  grievance.grievance_id
                }
                className="card"
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: 20,
                  flexWrap:
                    "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 280 }}>
                  <button
                    type="button"
                    className="bulk-checkbox"
                    aria-label={selected.has(grievance.grievance_id) ? "Deselect" : "Select"}
                    onClick={() => toggleOne(grievance.grievance_id)}
                  >
                    {selected.has(grievance.grievance_id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>

                <div
                  style={{
                    flex: 1,
                    minWidth: 280,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <strong>
                      {grievance.title ||
                        grievance.grievance_id}
                    </strong>

                    {grievance.priority && (
                      <span className="badge badge-status">
                        {
                          grievance.priority
                        }
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      flexWrap:
                        "wrap",
                      gap: 14,
                      color:
                        "var(--text-muted)",
                      fontSize: 12.5,
                    }}
                  >
                    <span
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 4,
                      }}
                    >
                      <MapPin
                        size={12}
                      />

                      {grievance.district}
                    </span>

                    <span
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 4,
                      }}
                    >
                      <Building2
                        size={12}
                      />

                      {
                        grievance.department
                      }
                    </span>

                    <span
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 4,
                      }}
                    >
                      <Clock
                        size={12}
                      />

                      Waiting for
                      officer
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 11,
                      color:
                        "var(--text-faint)",
                    }}
                  >
                    {
                      grievance.grievance_id
                    }
                  </div>
                </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() =>
                    openAssignModal(
                      grievance
                    )
                  }
                >
                  <UserPlus
                    size={15}
                  />

                  Assign Officer
                </button>
              </div>
            )
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        title="Assign Officer"
        onClose={closeModal}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={
                closeModal
              }
              disabled={assigning}
            >
              Cancel
            </button>

            <button
              className="btn btn-primary"
              disabled={
                assigning ||
                !selectedOfficer ||
                officers.length === 0
              }
              onClick={
                handleAssign
              }
            >
              {assigning
                ? "Assigning..."
                : "Assign Officer"}
            </button>
          </>
        }
      >
        {selectedGrievance && (
          <>
            <div
              className="card"
              style={{
                marginBottom: 18,
              }}
            >
              <strong>
                {selectedGrievance.title ||
                  selectedGrievance.grievance_id}
              </strong>

              <div
                style={{
                  display:
                    "grid",
                  gap: 6,
                  marginTop: 10,
                  fontSize: 12.5,
                  color:
                    "var(--text-muted)",
                }}
              >
                <div>
                  <b>Grievance:</b>{" "}
                  {
                    selectedGrievance.grievance_id
                  }
                </div>

                <div>
                  <b>District:</b>{" "}
                  {
                    selectedGrievance.district
                  }
                </div>

                <div>
                  <b>Department:</b>{" "}
                  {
                    selectedGrievance.department
                  }
                </div>

                <div>
                  <b>Priority:</b>{" "}
                  {
                    selectedGrievance.priority ||
                    "LOW"
                  }
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Select Officer
              </label>

              {officers.length ===
              0 ? (
                <div
                  className="card"
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 10,
                  }}
                >
                  <AlertTriangle
                    size={17}
                  />

                  <span
                    style={{
                      fontSize: 13,
                    }}
                  >
                    No active officer
                    is available for
                    this department
                    and district.
                  </span>
                </div>
              ) : (
                <select
                  className="select"
                  value={
                    selectedOfficer
                  }
                  onChange={(event) =>
                    setSelectedOfficer(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select an officer
                  </option>

                  {officers.map(
                    (officer) => (
                      <option
                        key={
                          officer._id
                        }
                        value={
                          officer._id
                        }
                      >
                        {
                          officer.name
                        }{" "}
                        —{" "}
                        {officer.open_cases ??
                          0}{" "}
                        open cases
                      </option>
                    )
                  )}
                </select>
              )}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={bulkModalOpen}
        title={`Assign ${selected.size} case(s) to an officer`}
        onClose={closeBulkModal}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeBulkModal} disabled={bulkAssigning}>Cancel</button>
            <button className="btn btn-primary" disabled={bulkAssigning || !bulkOfficer || bulkOfficers.length === 0}
                    onClick={handleBulkAssign}>
              {bulkAssigning ? "Assigning..." : `Assign ${selected.size} case(s)`}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
          All {selected.size} selected cases are in <strong>{selectedItems[0]?.department}</strong>.
          Choose one officer to assign them all to — any case someone else takes in the
          meantime will be skipped automatically.
        </p>

        <div className="form-group">
          <label className="form-label">Select Officer</label>
          {bulkOfficers.length === 0 ? (
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={17} />
              <span style={{ fontSize: 13 }}>No active officer is available for this department and district.</span>
            </div>
          ) : (
            <select className="select" value={bulkOfficer} onChange={(e) => setBulkOfficer(e.target.value)}>
              <option value="">Select an officer</option>
              {bulkOfficers.map((officer) => (
                <option key={officer._id} value={officer._id}>
                  {officer.name} — {officer.open_cases ?? 0} open cases
                </option>
              ))}
            </select>
          )}
        </div>
      </Modal>

      <Modal
        open={!!bulkResult}
        title="Bulk assign results"
        onClose={() => setBulkResult(null)}
        footer={<button className="btn btn-primary" onClick={() => setBulkResult(null)}>Done</button>}
      >
        {bulkResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13.5 }}>
              <strong style={{ color: "var(--priority-low)" }}>{bulkResult.assigned.length}</strong> assigned
              {bulkResult.skipped.length > 0 && (
                <> · <strong style={{ color: "var(--warning)" }}>{bulkResult.skipped.length}</strong> skipped</>
              )}
            </p>
            {bulkResult.skipped.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {bulkResult.skipped.map((s) => (
                  <div key={s.grievance_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)" }}>
                    <span style={{ fontFamily: "monospace" }}>{s.grievance_id}</span>
                    <span>{s.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UnassignedGrievances;