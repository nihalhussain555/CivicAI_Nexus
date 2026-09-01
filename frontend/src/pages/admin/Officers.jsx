import { useEffect, useState } from "react";
import { Users, Plus, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { getOfficers, createOfficer } from "../../services/officerService";
import { getDepartments } from "../../services/departmentService";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../utils/helpers";
import { DISTRICTS } from "../../utils/constants";
import Modal from "../../components/common/Modal";
import { SkeletonList } from "../../components/common/Skeleton";

const emptyForm = { name: "", email: "", password: "", department: "", district: "", specialization: "", phone: "" };

const Officers = () => {
  const { user } = useAuth();
  const [officers, setOfficers] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [districtFilter, setDistrictFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // If this admin has a home district, they can only create officers
  // there — lock the field instead of letting them pick a different one
  // just to have the request rejected server-side.
  const isDistrictRestricted = !!user?.district;

  const load = (district) => getOfficers(district ? { district } : {}).then((res) => setOfficers(res.data));
  useEffect(() => {
    load(districtFilter);
    getDepartments().then((res) => setDepartments(res.data));
  }, [districtFilter]);

  const openModal = () => {
    setForm({ ...emptyForm, district: isDistrictRestricted ? user.district : "" });
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

      <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <MapPin size={14} color="var(--text-faint)" />
        <select className="select" style={{ maxWidth: 220 }} value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
          <option value="">All districts</option>
          {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {officers === null ? (
        <SkeletonList rows={5} />
      ) : (
        officers.map((o) => (
          <Link key={o._id} to={`/admin/officers/${o._id}`} className="list-row">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <Users size={14} color="var(--accent)" />
                <strong style={{ fontSize: 14 }}>{o.name}</strong>
                <span className="badge badge-neutral">{o.department}</span>
                {o.district && <span className="badge badge-status"><MapPin size={10} /> {o.district}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{o.email}{o.specialization ? ` · ${o.specialization}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 13 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700 }}>{o.open_cases}</div><div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>OPEN</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700 }}>{o.cases_resolved}</div><div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>RESOLVED</div></div>
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
            <button className="btn btn-primary" disabled={saving || !form.name || !form.email || !form.password || !form.department || !form.district}
                    onClick={handleCreate}>Create</button>
          </>
        }
      >
        <div className="form-group"><label className="form-label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Temporary password</label>
          <input className="input" type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Department</label>
          <select className="select" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
            <option value="">Select department</option>
            {departments.map((d) => <option key={d.code} value={d.name}>{d.name}</option>)}
          </select></div>
        <div className="form-group">
          <label className="form-label">District</label>
          {isDistrictRestricted ? (
            <>
              <input className="input" value={form.district} disabled />
              <p className="form-hint">Locked to your district — admins can only add officers within their own jurisdiction.</p>
            </>
          ) : (
            <select className="select" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}>
              <option value="">Select district</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
        <div className="form-group"><label className="form-label">Specialization (optional)</label>
          <input className="input" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} /></div>
      </Modal>
    </div>
  );
};

export default Officers;