import { useEffect, useState } from "react";
import { ShieldCheck, Plus, MapPin, Lock } from "lucide-react";
import { getAdmins, createAdmin } from "../../services/adminService";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";
import { DISTRICTS } from "../../utils/constants";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";

const emptyForm = { name: "", email: "", password: "", phone: "", district: "", unrestricted: false };

const Admins = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [admins, setAdmins] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = !user?.district;

  useEffect(() => {
    if (!isSuperAdmin) return;
    getAdmins()
      .then((res) => setAdmins(res.data))
      .catch(() => setLoadError(true));
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={Lock}
        title="Super-admin access required"
        description={`Managing admin accounts is restricted to unrestricted super-admins. Your account is scoped to ${user?.district}, so you can create and manage officers within it, but not other admins.`}
      />
    );
  }

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createAdmin({
        name: form.name, email: form.email, password: form.password, phone: form.phone || undefined,
        district: form.unrestricted ? undefined : form.district,
      });
      toast.success("Admin account created");
      setModalOpen(false);
      setForm(emptyForm);
      getAdmins().then((res) => setAdmins(res.data));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.name && form.email && form.password && (form.unrestricted || form.district);

  return (
    <div>
      <div className="page-header">
        <div><h1>Admins</h1><p>Manage admin accounts and their district scope.</p></div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> New admin</button>
      </div>

      {admins === null ? (
        loadError ? null : <SkeletonList rows={4} />
      ) : admins.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No admins yet" />
      ) : (
        admins.map((a) => (
          <div key={a._id} className="list-row">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <ShieldCheck size={14} color="var(--accent)" />
                <strong style={{ fontSize: 14 }}>{a.name}</strong>
                {a.district ? (
                  <span className="badge badge-status"><MapPin size={10} /> {a.district}</span>
                ) : (
                  <span className="badge badge-neutral">Unrestricted</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{a.email}</div>
            </div>
          </div>
        ))
      )}

      <Modal
        open={modalOpen}
        title="New admin"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !canSubmit} onClick={handleCreate}>Create</button>
          </>
        }
      >
        <div className="form-group"><label className="form-label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Temporary password</label>
          <input className="input" type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Phone (optional)</label>
          <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>

        <div className="form-group">
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={form.unrestricted}
              onChange={(e) => setForm((f) => ({ ...f, unrestricted: e.target.checked, district: "" }))}
              style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
            />
            <span style={{ fontSize: 13.5 }}>Make this an unrestricted super-admin</span>
          </label>

          {!form.unrestricted && (
            <>
              <label className="form-label">District</label>
              <select className="select" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}>
                <option value="">Select district</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <p className="form-hint">This admin will only be able to create and manage officers within this district.</p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Admins;