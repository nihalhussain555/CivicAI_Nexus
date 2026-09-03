import { useEffect, useState } from "react";
import { Users, Plus, MapPin, Eye, EyeOff, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { getOfficers, createOfficer } from "../../services/officerService";
import { getDepartments } from "../../services/departmentService";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../utils/helpers";
import { DISTRICTS } from "../../utils/constants";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Avatar from "../../components/common/Avatar";

const emptyForm = { name: "", email: "", password: "", department: "", district: "", specialization: "", phone: "" };

const Officers = () => {
  const { user } = useAuth();
  const [officers, setOfficers] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [districtFilter, setDistrictFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const toast = useToast();

  // If this admin has a home district, they can only create officers
  // there — lock the field instead of letting them pick a different one
  // just to have the request rejected server-side.
  const isDistrictRestricted = !!user?.district;

  const load = (district) =>
    getOfficers(district ? { district } : {})
      .then((res) => setOfficers(res.data))
      .catch(() => setLoadError(true));

  useEffect(() => {
    load(districtFilter);
    getDepartments().then((res) => setDepartments(res.data));
  }, [districtFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = () => {
    setForm({ ...emptyForm, district: isDistrictRestricted ? user.district : "" });
    setShowPassword(false);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createOfficer(form);
      toast.success("Officer created");
      setModalOpen(false);
      load(districtFilter);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.name && form.email && form.password.length >= 6 && form.department && form.district;

  const totalOpenCases = officers?.reduce((sum, o) => sum + (o.open_cases || 0), 0) ?? 0;
  const totalResolved = officers?.reduce((sum, o) => sum + (o.cases_resolved || 0), 0) ?? 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Officers</h1>
          <p>
            Field officers across all departments.
            {isDistrictRestricted && <> You can only add officers in <strong>{user.district}</strong>.</>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openModal}><Plus size={15} /> New officer</button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-label"><Users size={13} /> Total officers</span>
          <span className="stat-value">{officers?.length ?? "—"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Briefcase size={13} /> Open cases</span>
          <span className="stat-value">{totalOpenCases}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Resolved (all-time)</span>
          <span className="stat-value">{totalResolved}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <MapPin size={14} color="var(--text-faint)" />
        <select className="select" style={{ maxWidth: 220 }} value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
          <option value="">All districts</option>
          {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {officers === null ? (
        loadError ? null : <SkeletonList rows={5} />
      ) : officers.length === 0 ? (
        <EmptyState icon={Users} title="No officers yet" description="Add your first field officer to start assigning cases." />
      ) : (
        officers.map((o) => (
          <Link key={o._id} to={`/admin/officers/${o._id}`} className="list-row">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar user={o} size={40} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14 }}>{o.name}</strong>
                  <span className="badge badge-neutral">{o.department}</span>
                  {o.district && <span className="badge badge-status"><MapPin size={10} /> {o.district}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {o.email}{o.specialization ? ` · ${o.specialization}` : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 13, flexShrink: 0 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700 }}>{o.open_cases}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>OPEN</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700 }}>{o.cases_resolved}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>RESOLVED</div>
              </div>
            </div>
          </Link>
        ))
      )}

      <Modal
        open={modalOpen}
        title="New officer"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !canSubmit} onClick={handleCreate}>
              {saving ? "Creating..." : "Create officer"}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>

        <div className="form-group">
          <label className="form-label">Temporary password</label>
          <div style={{ position: "relative" }}>
            <input
              className="input" type={showPassword ? "text" : "password"} value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              style={{ paddingRight: 40 }}
            />
            <button
              type="button" onClick={() => setShowPassword((s) => !s)} aria-label="Toggle password visibility"
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="form-hint">At least 6 characters. Share this with the officer securely.</p>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="select" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.code} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">District</label>
            {isDistrictRestricted ? (
              <input className="input" value={form.district} disabled />
            ) : (
              <select className="select" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}>
                <option value="">Select district</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
        </div>
        {isDistrictRestricted && (
          <p className="form-hint" style={{ marginTop: -8, marginBottom: 14 }}>
            District locked to your own jurisdiction ({user.district}).
          </p>
        )}

        <div className="form-group">
          <label className="form-label">Specialization (optional)</label>
          <input className="input" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
};

export default Officers;