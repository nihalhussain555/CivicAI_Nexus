import { useEffect, useState } from "react";
import {
  ShieldCheck, Plus, MapPin, Lock, Globe, Eye, EyeOff,
} from "lucide-react";
import { getAdmins, createAdmin } from "../../services/adminService";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";
import { DISTRICTS } from "../../utils/constants";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Avatar from "../../components/common/Avatar";

const emptyForm = { name: "", email: "", password: "", phone: "", district: "", type: "district" };

const Admins = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [admins, setAdmins] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSuperAdmin = !user?.district;

  const load = () => getAdmins().then((res) => setAdmins(res.data)).catch(() => setLoadError(true));
  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={Lock}
        title="Super-admin access required"
        description={`Managing admin accounts is restricted to unrestricted super-admins. Your account is scoped to ${user?.district}, so you can create and manage officers within it, but not other admins.`}
      />
    );
  }

  const openModal = () => {
    setForm(emptyForm);
    setShowPassword(false);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createAdmin({
        name: form.name, email: form.email, password: form.password, phone: form.phone || undefined,
        district: form.type === "super" ? undefined : form.district,
      });
      toast.success("Admin account created");
      setModalOpen(false);
      load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.name && form.email && form.password.length >= 6 && (form.type === "super" || form.district);

  const superCount = admins?.filter((a) => !a.district).length ?? 0;
  const districtCount = admins?.filter((a) => a.district).length ?? 0;

  return (
    <div>
      <div className="page-header">
        <div><h1>Admins</h1><p>Manage admin accounts and their district scope.</p></div>
        <button className="btn btn-primary" onClick={openModal}><Plus size={15} /> New admin</button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 22 }}>
        <div className="stat-card">
          <span className="stat-label"><ShieldCheck size={13} /> Total admins</span>
          <span className="stat-value">{admins?.length ?? "—"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Globe size={13} /> Super-admins</span>
          <span className="stat-value">{superCount}</span>
          <span className="stat-sub">Unrestricted access</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><MapPin size={13} /> District-scoped</span>
          <span className="stat-value">{districtCount}</span>
          <span className="stat-sub">Limited to one district</span>
        </div>
      </div>

      {admins === null ? (
        loadError ? null : <SkeletonList rows={4} />
      ) : admins.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No admins yet" />
      ) : (
        admins.map((a) => (
          <div key={a._id} className="list-row">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar user={a} size={40} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <strong style={{ fontSize: 14 }}>{a.name}</strong>
                  {a._id === user.id && <span className="badge badge-neutral">You</span>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{a.email}</div>
              </div>
            </div>
            {a.district ? (
              <span className="badge badge-status"><MapPin size={10} /> {a.district}</span>
            ) : (
              <span className="badge badge-success"><Globe size={10} /> Unrestricted</span>
            )}
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
            <button className="btn btn-primary" disabled={saving || !canSubmit} onClick={handleCreate}>
              {saving ? "Creating..." : "Create admin"}
            </button>
          </>
        }
      >
        {/* Admin type — picker cards instead of a checkbox */}
        <div className="form-group">
          <label className="form-label">Admin type</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: "district" }))}
              style={{
                textAlign: "left", padding: "12px 14px", borderRadius: "var(--radius-md)",
                border: `1.5px solid ${form.type === "district" ? "var(--accent)" : "var(--border)"}`,
                background: form.type === "district" ? "var(--accent-soft)" : "var(--surface)",
              }}
            >
              <MapPin size={16} color={form.type === "district" ? "var(--accent)" : "var(--text-faint)"} />
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>District Admin</div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>Manages one district only</div>
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: "super", district: "" }))}
              style={{
                textAlign: "left", padding: "12px 14px", borderRadius: "var(--radius-md)",
                border: `1.5px solid ${form.type === "super" ? "var(--accent)" : "var(--border)"}`,
                background: form.type === "super" ? "var(--accent-soft)" : "var(--surface)",
              }}
            >
              <Globe size={16} color={form.type === "super" ? "var(--accent)" : "var(--text-faint)"} />
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>Super Admin</div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>Unrestricted, all districts</div>
            </button>
          </div>
        </div>

        {form.type === "district" && (
          <div className="form-group">
            <label className="form-label">District</label>
            <select className="select" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}>
              <option value="">Select district</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

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
          <p className="form-hint">At least 6 characters. Share this with the admin securely — they should change it after first login.</p>
        </div>
      </Modal>
    </div>
  );
};

export default Admins;