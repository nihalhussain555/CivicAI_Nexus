import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { getDepartments, createDepartment } from "../../services/departmentService";
import { CATEGORIES, CATEGORY_LABELS } from "../../utils/constants";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";
import Modal from "../../components/common/Modal";
import { SkeletonList } from "../../components/common/Skeleton";

const Departments = () => {
  const [departments, setDepartments] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "", categories: [] });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => getDepartments().then((res) => setDepartments(res.data));
  useEffect(() => { load(); }, []);

  const toggleCategory = (cat) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat) ? f.categories.filter((c) => c !== cat) : [...f.categories, cat],
    }));
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createDepartment(form);
      toast.success("Department created");
      setModalOpen(false);
      setForm({ name: "", code: "", description: "", categories: [] });
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
        <div><h1>Departments</h1><p>Manage the departments that grievances get routed to.</p></div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> New department</button>
      </div>

      {departments === null ? (
        <SkeletonList rows={4} />
      ) : (
        <div className="grid grid-2">
          {departments.map((d) => (
            <div key={d.code} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Building2 size={15} color="var(--accent)" />
                    <strong style={{ fontSize: 15 }}>{d.name}</strong>
                  </div>
                  <span className="badge badge-neutral">{d.code}</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "12px 0" }}>{d.description}</p>
              <div className="grid grid-3" style={{ gap: 10 }}>
                <div><div style={{ fontSize: 11, color: "var(--text-faint)" }}>Total</div><strong>{d.total_grievances}</strong></div>
                <div><div style={{ fontSize: 11, color: "var(--text-faint)" }}>Open</div><strong>{d.open_grievances}</strong></div>
                <div><div style={{ fontSize: 11, color: "var(--text-faint)" }}>Officers</div><strong>{d.officer_count}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title="New department"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !form.name || !form.code} onClick={handleCreate}>Create</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Code</label>
          <input className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={20} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Handles categories</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => toggleCategory(c)}
                      className={`badge ${form.categories.includes(c) ? "badge-status" : "badge-neutral"}`}
                      style={{ border: "none", cursor: "pointer" }}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Departments;
