import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Plus,
  MapPin,
  Eye,
  EyeOff,
  Briefcase,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  getOfficers,
  createOfficer,
} from "../../services/officerService";

import {
  DEPARTMENTS,
  DISTRICTS,
} from "../../utils/constants";

import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../utils/helpers";

import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Avatar from "../../components/common/Avatar";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  department: "",
  district: "",
  specialization: "",
  phone: "",
};

const Officers = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [officers, setOfficers] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isDistrictAdmin = Boolean(user?.district);

  const effectiveDistrict = isDistrictAdmin
    ? user.district
    : districtFilter;

  const loadOfficers = async () => {
    setLoadError("");
    setOfficers(null);

    try {
      const params = {};

      if (effectiveDistrict) {
        params.district = effectiveDistrict;
      }

      const response = await getOfficers(params);

      const data = Array.isArray(response?.data)
        ? response.data
        : [];

      setOfficers(data);
    } catch (error) {
      console.error("Failed to load officers:", error);
      setLoadError(getErrorMessage(error));
      setOfficers([]);
    }
  };

  useEffect(() => {
    loadOfficers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDistrict]);

  const openCreateModal = () => {
    setForm({
      ...EMPTY_FORM,
      district: isDistrictAdmin ? user.district : "",
    });

    setShowPassword(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setForm({
      ...EMPTY_FORM,
      district: isDistrictAdmin ? user.district : "",
    });
    setShowPassword(false);
  };

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleCreate = async () => {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      department: form.department,
      district: form.district,
      specialization: form.specialization.trim() || null,
      phone: form.phone.trim() || null,
    };

    if (!payload.name) {
      toast.error("Enter the officer name.");
      return;
    }

    if (!payload.email) {
      toast.error("Enter the officer email.");
      return;
    }

    if (payload.password.length < 6) {
      toast.error("Password must contain at least 6 characters.");
      return;
    }

    if (!DEPARTMENTS.includes(payload.department)) {
      toast.error("Please select a valid department.");
      return;
    }

    if (!DISTRICTS.includes(payload.district)) {
      toast.error("Please select a valid district.");
      return;
    }

    setSaving(true);

    try {
      await createOfficer(payload);

      toast.success("Officer created successfully.");

      closeModal();
      await loadOfficers();
    } catch (error) {
      console.error("Officer creation failed:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const totalOpenCases = useMemo(
    () =>
      (officers || []).reduce(
        (sum, officer) => sum + Number(officer.open_cases || 0),
        0
      ),
    [officers]
  );

  const totalResolved = useMemo(
    () =>
      (officers || []).reduce(
        (sum, officer) => sum + Number(officer.cases_resolved || 0),
        0
      ),
    [officers]
  );

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email.trim().length > 3 &&
    form.password.length >= 6 &&
    DEPARTMENTS.includes(form.department) &&
    DISTRICTS.includes(form.district);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Officers</h1>

          <p>
            Manage field officers and their department assignments.
            {isDistrictAdmin && (
              <>
                {" "}
                Your jurisdiction:{" "}
                <strong>{user.district}</strong>.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
        >
          <Plus size={15} />
          New officer
        </button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-label">
            <Users size={13} />
            Total officers
          </span>

          <span className="stat-value">
            {officers === null ? "—" : officers.length}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <Briefcase size={13} />
            Open cases
          </span>

          <span className="stat-value">
            {officers === null ? "—" : totalOpenCases}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Resolved
          </span>

          <span className="stat-value">
            {officers === null ? "—" : totalResolved}
          </span>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <MapPin
          size={14}
          color="var(--text-faint)"
        />

        {isDistrictAdmin ? (
          <input
            className="input"
            value={user.district}
            disabled
            style={{ maxWidth: 260 }}
          />
        ) : (
          <select
            className="select"
            style={{ maxWidth: 260 }}
            value={districtFilter}
            onChange={(event) =>
              setDistrictFilter(event.target.value)
            }
          >
            <option value="">
              All districts
            </option>

            {DISTRICTS.map((district) => (
              <option
                key={district}
                value={district}
              >
                {district}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadOfficers}
          disabled={officers === null}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {officers === null ? (
        <SkeletonList rows={5} />
      ) : loadError ? (
        <div className="card">
          <div
            style={{
              textAlign: "center",
              padding: 30,
            }}
          >
            <Users
              size={30}
              color="var(--danger)"
              style={{ marginBottom: 10 }}
            />

            <h3 style={{ marginBottom: 6 }}>
              Unable to load officers
            </h3>

            <p
              style={{
                color: "var(--text-muted)",
                marginBottom: 16,
              }}
            >
              {loadError}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={loadOfficers}
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </div>
      ) : officers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No officers found"
          description="Create an officer for the required district and department."
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {officers.map((officer) => (
            <Link
              key={String(officer._id)}
              to={`/admin/officers/${officer._id}`}
              className="list-row"
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  minWidth: 0,
                }}
              >
                <Avatar
                  user={officer}
                  size={40}
                />

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>
                      {officer.name || "Unnamed officer"}
                    </strong>

                    <span className="badge badge-neutral">
                      {officer.department || "No department"}
                    </span>

                    {officer.district && (
                      <span className="badge badge-status">
                        <MapPin size={10} />
                        {officer.district}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {officer.email || "No email"}
                    {officer.specialization
                      ? ` · ${officer.specialization}`
                      : ""}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 18,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700 }}>
                    {officer.open_cases || 0}
                  </div>

                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--text-faint)",
                    }}
                  >
                    OPEN
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700 }}>
                    {officer.cases_resolved || 0}
                  </div>

                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--text-faint)",
                    }}
                  >
                    RESOLVED
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title="Create new officer"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSubmit || saving}
              onClick={handleCreate}
            >
              {saving
                ? "Creating..."
                : "Create officer"}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Full name
            </label>

            <input
              className="input"
              value={form.name}
              onChange={(event) =>
                updateForm("name", event.target.value)
              }
              placeholder="Officer name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Phone
            </label>

            <input
              className="input"
              value={form.phone}
              onChange={(event) =>
                updateForm("phone", event.target.value)
              }
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Email
          </label>

          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(event) =>
              updateForm("email", event.target.value)
            }
            placeholder="officer@example.com"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Temporary password
          </label>

          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={form.password}
              onChange={(event) =>
                updateForm(
                  "password",
                  event.target.value
                )
              }
              placeholder="Minimum 6 characters"
              style={{ paddingRight: 42 }}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (previous) => !previous
                )
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform:
                  "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--text-faint)",
                display: "flex",
                cursor: "pointer",
              }}
            >
              {showPassword ? (
                <EyeOff size={15} />
              ) : (
                <Eye size={15} />
              )}
            </button>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Department
            </label>

            <select
              className="select"
              value={form.department}
              onChange={(event) =>
                updateForm(
                  "department",
                  event.target.value
                )
              }
            >
              <option value="">
                Select department
              </option>

              {DEPARTMENTS.map(
                (department) => (
                  <option
                    key={department}
                    value={department}
                  >
                    {department}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              District
            </label>

            {isDistrictAdmin ? (
              <input
                className="input"
                value={form.district}
                disabled
              />
            ) : (
              <select
                className="select"
                value={form.district}
                onChange={(event) =>
                  updateForm(
                    "district",
                    event.target.value
                  )
                }
              >
                <option value="">
                  Select district
                </option>

                {DISTRICTS.map(
                  (district) => (
                    <option
                      key={district}
                      value={district}
                    >
                      {district}
                    </option>
                  )
                )}
              </select>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Specialization
          </label>

          <input
            className="input"
            value={form.specialization}
            onChange={(event) =>
              updateForm(
                "specialization",
                event.target.value
              )
            }
            placeholder="Optional"
          />
        </div>

        <p className="form-hint">
          The officer's department must exactly match
          the department assigned to grievances.
        </p>
      </Modal>
    </div>
  );
};

export default Officers;