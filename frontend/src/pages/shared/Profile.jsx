import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { updateProfile } from "../../services/authService";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user.name || "", phone: user.phone || "", address: user.address || "" });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateProfile(form);
      updateUser(res.data);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const initials = (user.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-header"><div><h1>Profile</h1><p>Your account details.</p></div></div>

      <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{user.name}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.email}</div>
          <span className="badge badge-neutral" style={{ marginTop: 6, textTransform: "capitalize" }}>{user.role}</span>
          {user.department && <span className="badge badge-status" style={{ marginTop: 6, marginLeft: 6 }}>{user.department}</span>}
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Full name</label>
          <input className="input" value={form.name} onChange={update("name")} minLength={2} required />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="input" value={form.phone} onChange={update("phone")} placeholder="+91 98765 43210" />
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input className="input" value={form.address} onChange={update("address")} placeholder="Your address" />
        </div>
        {user.role === "officer" && (
          <>
            <div className="form-group">
              <label className="form-label">Cases resolved</label>
              <input className="input" value={user.cases_resolved || 0} disabled />
            </div>
          </>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={15} />}
          Save changes
        </button>
      </form>
    </div>
  );
};

export default Profile;
