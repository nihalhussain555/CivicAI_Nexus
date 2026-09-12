import { useEffect, useState } from "react";
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
  getDepartments,
} from "../../services/departmentService";

import {
  useToast,
} from "../../context/ToastContext";

import {
  useAuth,
} from "../../hooks/useAuth";

import {
  getErrorMessage,
} from "../../utils/helpers";

import {
  DISTRICTS,
} from "../../utils/constants";

import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Avatar from "../../components/common/Avatar";


const emptyForm = {
  name: "",
  email: "",
  password: "",
  department: "",
  district: "",
  specialization: "",
  phone: "",
};


const Officers = () => {
  const {
    user,
  } = useAuth();

  const toast = useToast();

  const [officers, setOfficers] =
    useState(null);

  const [departments, setDepartments] =
    useState([]);

  const [districtFilter, setDistrictFilter] =
    useState("");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [form, setForm] =
    useState(emptyForm);

  const [saving, setSaving] =
    useState(false);

  const [loadingDepartments, setLoadingDepartments] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);


  const isDistrictRestricted =
    Boolean(user?.district);


  // ==========================================================
  // LOAD OFFICERS
  // ==========================================================

  const loadOfficers = async () => {
    try {
      setLoadError("");

      const params =
        districtFilter
          ? {
              district:
                districtFilter,
            }
          : {};

      const response =
        await getOfficers(params);

      setOfficers(
        response.data || []
      );

    } catch (error) {
      setLoadError(
        getErrorMessage(error)
      );
    }
  };


  // ==========================================================
  // LOAD DEPARTMENTS FROM BACKEND
  // ==========================================================

  const loadDepartments = async () => {
    try {
      setLoadingDepartments(true);

      const response =
        await getDepartments();

      const backendDepartments =
        Array.isArray(response.data)
          ? response.data
          : [];

      setDepartments(
        backendDepartments.filter(
          (department) =>
            department?.name
        )
      );

    } catch (error) {
      setDepartments([]);

      toast.error(
        getErrorMessage(error)
      );

    } finally {
      setLoadingDepartments(false);
    }
  };


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadOfficers();
  }, [districtFilter]);


  useEffect(() => {
    loadDepartments();
  }, []);


  // ==========================================================
  // OPEN CREATE MODAL
  // ==========================================================

  const openModal = () => {
    setForm({
      ...emptyForm,
      district:
        isDistrictRestricted
          ? user.district
          : "",
    });

    setShowPassword(false);
    setModalOpen(true);
  };


  // ==========================================================
  // CLOSE MODAL
  // ==========================================================

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setShowPassword(false);
    setForm(emptyForm);
  };


  // ==========================================================
  // CREATE OFFICER
  // ==========================================================

  const handleCreate = async () => {
    if (!canSubmit) {
      toast.error(
        "Please complete all required fields."
      );

      return;
    }

    setSaving(true);

    try {
      await createOfficer({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        department:
          form.department.trim(),
        district:
          form.district.trim(),
        specialization:
          form.specialization.trim(),
        phone:
          form.phone.trim(),
      });

      toast.success(
        "Officer created successfully."
      );

      setModalOpen(false);
      setForm(emptyForm);
      setShowPassword(false);

      await loadOfficers();

    } catch (error) {
      toast.error(
        getErrorMessage(error)
      );

    } finally {
      setSaving(false);
    }
  };


  // ==========================================================
  // VALIDATION
  // ==========================================================

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email.trim().length > 0 &&
    form.password.length >= 6 &&
    form.department.length > 0 &&
    form.district.length > 0;


  // ==========================================================
  // STATISTICS
  // ==========================================================

  const totalOpenCases =
    officers?.reduce(
      (sum, officer) =>
        sum +
        Number(
          officer.open_cases || 0
        ),
      0
    ) ?? 0;

  const totalResolved =
    officers?.reduce(
      (sum, officer) =>
        sum +
        Number(
          officer.cases_resolved || 0
        ),
      0
    ) ?? 0;


  return (
    <div>

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="page-header">

        <div>
          <h1>
            Officers
          </h1>

          <p>
            Field officers across CivicAI departments.
            {isDistrictRestricted && (
              <>
                {" "}
                You can only manage officers in{" "}
                <strong>
                  {user.district}
                </strong>
                .
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openModal}
        >
          <Plus size={15} />
          New officer
        </button>

      </div>


      {/* =====================================================
          STATISTICS
      ====================================================== */}

      <div
        className="grid grid-3"
        style={{
          marginBottom: 20,
        }}
      >

        <div className="stat-card">
          <span className="stat-label">
            <Users size={13} />
            Total officers
          </span>

          <span className="stat-value">
            {officers?.length ?? "—"}
          </span>
        </div>


        <div className="stat-card">
          <span className="stat-label">
            <Briefcase size={13} />
            Open cases
          </span>

          <span className="stat-value">
            {totalOpenCases}
          </span>
        </div>


        <div className="stat-card">
          <span className="stat-label">
            Resolved
          </span>

          <span className="stat-value">
            {totalResolved}
          </span>
        </div>

      </div>


      {/* =====================================================
          FILTER
      ====================================================== */}

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

        {isDistrictRestricted ? (

          <div
            className="badge badge-status"
            style={{
              minHeight: 34,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <MapPin size={11} />
            {user.district}
          </div>

        ) : (

          <select
            className="select"
            style={{
              maxWidth: 240,
            }}
            value={districtFilter}
            onChange={(event) =>
              setDistrictFilter(
                event.target.value
              )
            }
          >
            <option value="">
              All districts
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

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadOfficers}
          style={{
            marginLeft: "auto",
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>

      </div>


      {/* =====================================================
          ERROR
      ====================================================== */}

      {loadError && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            color: "var(--danger)",
          }}
        >
          {loadError}
        </div>
      )}


      {/* =====================================================
          OFFICER LIST
      ====================================================== */}

      {officers === null ? (

        <SkeletonList rows={5} />

      ) : officers.length === 0 ? (

        <EmptyState
          icon={Users}
          title="No officers yet"
          description="Add your first field officer to start assigning grievances."
        />

      ) : (

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >

          {officers.map(
            (officer) => (

              <Link
                key={officer._id}
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

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 3,
                        flexWrap: "wrap",
                      }}
                    >

                      <strong
                        style={{
                          fontSize: 14,
                        }}
                      >
                        {officer.name}
                      </strong>

                      <span className="badge badge-neutral">
                        {officer.department}
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
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      {officer.email}

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

                  <div
                    style={{
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                      }}
                    >
                      {officer.open_cases || 0}
                    </div>

                    <div
                      style={{
                        fontSize: 10.5,
                        color:
                          "var(--text-faint)",
                      }}
                    >
                      OPEN
                    </div>
                  </div>


                  <div
                    style={{
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                      }}
                    >
                      {officer.cases_resolved || 0}
                    </div>

                    <div
                      style={{
                        fontSize: 10.5,
                        color:
                          "var(--text-faint)",
                      }}
                    >
                      RESOLVED
                    </div>
                  </div>

                </div>

              </Link>

            )
          )}

        </div>

      )}


      {/* =====================================================
          CREATE OFFICER MODAL
      ====================================================== */}

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
              disabled={
                saving ||
                !canSubmit ||
                loadingDepartments
              }
              onClick={handleCreate}
            >
              {saving
                ? "Creating..."
                : "Create officer"}
            </button>
          </>
        }
      >

        {/* NAME + PHONE */}

        <div className="form-row">

          <div className="form-group">
            <label className="form-label">
              Full name *
            </label>

            <input
              className="input"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name:
                    event.target.value,
                }))
              }
              placeholder="Officer full name"
              autoComplete="name"
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
                setForm((current) => ({
                  ...current,
                  phone:
                    event.target.value,
                }))
              }
              placeholder="Optional phone number"
              autoComplete="tel"
            />
          </div>

        </div>


        {/* EMAIL */}

        <div className="form-group">

          <label className="form-label">
            Email *
          </label>

          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                email:
                  event.target.value,
              }))
            }
            placeholder="officer@example.com"
            autoComplete="email"
          />

        </div>


        {/* PASSWORD */}

        <div className="form-group">

          <label className="form-label">
            Temporary password *
          </label>

          <div
            style={{
              position: "relative",
            }}
          >

            <input
              className="input"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password:
                    event.target.value,
                }))
              }
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
              style={{
                paddingRight: 42,
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (current) =>
                    !current
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
                color:
                  "var(--text-faint)",
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              {showPassword ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>

          </div>

          <p className="form-hint">
            At least 6 characters.
          </p>

        </div>


        {/* DEPARTMENT + DISTRICT */}

        <div className="form-row">

          <div className="form-group">

            <label className="form-label">
              Department *
            </label>

            <select
              className="select"
              value={form.department}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  department:
                    event.target.value,
                }))
              }
              disabled={
                loadingDepartments
              }
            >

              <option value="">
                {loadingDepartments
                  ? "Loading departments..."
                  : "Select department"}
              </option>

              {departments.map(
                (department) => (
                  <option
                    key={
                      department.code ||
                      department.name
                    }
                    value={
                      department.name
                    }
                  >
                    {department.name}
                  </option>
                )
              )}

            </select>

            <p className="form-hint">
              Departments are loaded directly
              from the CivicAI backend.
            </p>

          </div>


          <div className="form-group">

            <label className="form-label">
              District *
            </label>

            {isDistrictRestricted ? (

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
                  setForm((current) => ({
                    ...current,
                    district:
                      event.target.value,
                  }))
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


        {isDistrictRestricted && (
          <p
            className="form-hint"
            style={{
              marginTop: -8,
              marginBottom: 14,
            }}
          >
            District is locked to your own
            jurisdiction:{" "}
            <strong>
              {user.district}
            </strong>
          </p>
        )}


        {/* SPECIALIZATION */}

        <div className="form-group">

          <label className="form-label">
            Specialization
          </label>

          <input
            className="input"
            value={form.specialization}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                specialization:
                  event.target.value,
              }))
            }
            placeholder="Optional specialization"
          />

        </div>

      </Modal>

    </div>
  );
};


export default Officers;