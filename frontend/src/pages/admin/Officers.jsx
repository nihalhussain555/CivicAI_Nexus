import { useEffect, useState } from "react";
import { Users, Plus } from "lucide-react";
import { getOfficers, createOfficer } from "../../services/officerService";
import { getDepartments } from "../../services/departmentService";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";
import Modal from "../../components/common/Modal";
import { SkeletonList } from "../../components/common/Skeleton";

const Officers = () => {
  const [officers, setOfficers] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "", specialization: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => getOfficers().then((res) => setOfficers(res.data));
  useEffect(() => {
    load();
    getDepartments().then((res) => setDepartments(res.data));
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createOfficer(form);
      toast.success("Officer created");
      setModalOpen(false);
      setForm({ name: "", email: "", password: "", department: "", specialization: "", phone: "" });
      load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Officers</h1><p>Field officers across all departments.</p></div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> New officer</button>
      </div>

      {officers === null ? (
        <SkeletonList rows={5} />
      ) : (
        officers.map((o) => (
          <div key={o._id} className="list-row">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Users size={14} color="var(--accent)" />
                <strong style={{ fontSize: 14 }}>{o.name}</strong>
                <span className="badge badge-neutral">{o.department}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{o.email}{o.specialization ? ` · ${o.specialization}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 13 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700 }}>{o.open_cases}</div><div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>OPEN</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700 }}>{o.cases_resolved}</div><div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>RESOLVED</div></div>
            </div>
          </div>
        ))
      )}

      <Modal
        open={modalOpen}
        title="New officer"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !form.name || !form.email || !form.password || !form.department}
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
        <div className="form-group"><label className="form-label">Specialization (optional)</label>
          <input className="input" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} /></div>
      </Modal>
    </div>
  );
};

export default Officers;
