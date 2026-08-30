import { useEffect, useState } from "react";
import { Camera, Pencil, Loader2, Check, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getMe, updateProfile } from "../../services/authService";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, formatDate } from "../../utils/helpers";

const splitName = (fullName = "") => {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
};

const Field = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600 }}>{value || <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>Not set</span>}</div>
  </div>
);

const Profile = () => {
  const { user: cachedUser, updateUser } = useAuth();
  const toast = useToast();

  // Always show live data from the database, not just whatever was cached
  // at login — if a role (or anything else) changes directly in Mongo,
  // this page reflects it as soon as it loads.
  const [profile, setProfile] = useState(cachedUser);
  const [loading, setLoading] = useState(true);

  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personalForm, setPersonalForm] = useState({});
  const [addressForm, setAddressForm] = useState({});

  const refresh = () => {
    setLoading(true);
    getMe()
      .then((res) => {
        setProfile(res.data);
        updateUser(res.data); // heal the cached copy app-wide (sidebar, topbar, etc.)
      })
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null;

  const { firstName, lastName } = splitName(profile.name);
  const initials = (profile.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");

  const startEditPersonal = () => {
    setPersonalForm({
      firstName, lastName,
      date_of_birth: profile.date_of_birth || "",
      email: profile.email,
      phone: profile.phone || "",
    });
    setEditingPersonal(true);
  };

  const startEditAddress = () => {
    setAddressForm({
      country: profile.country || "",
      city: profile.city || "",
      postal_code: profile.postal_code || "",
    });
    setEditingAddress(true);
  };

  const savePersonal = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const name = `${personalForm.firstName} ${personalForm.lastName}`.trim();
      const res = await updateProfile({
        name, phone: personalForm.phone, date_of_birth: personalForm.date_of_birth,
      });
      setProfile(res.data);
      updateUser(res.data);
      setEditingPersonal(false);
      toast.success("Personal information updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const saveAddress = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateProfile(addressForm);
      setProfile(res.data);
      updateUser(res.data);
      setEditingAddress(false);
      toast.success("Address updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div><h1>My Profile</h1><p>Your account details, kept in sync with the database.</p></div>
        {loading && <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite", color: "var(--text-faint)" }} />}
      </div>

      {/* Header card */}
      <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>{initials}</div>
          <div
            style={{
              position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: "50%",
              background: "var(--surface)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)",
            }}
            title="Profile photo isn't stored yet — you can add avatar upload later"
          >
            <Camera size={11} />
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{profile.name}</div>
          <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, textTransform: "capitalize" }}>{profile.role}</div>
          {location && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{location}</div>}
          {profile.department && <span className="badge badge-status" style={{ marginTop: 6 }}>{profile.department}</span>}
        </div>
      </div>

      {/* Personal information */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Personal Information</div>
          {!editingPersonal && (
            <button className="btn btn-secondary btn-sm" onClick={startEditPersonal}>
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>

        {editingPersonal ? (
          <form onSubmit={savePersonal}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input className="input" value={personalForm.firstName}
                       onChange={(e) => setPersonalForm((f) => ({ ...f, firstName: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="input" value={personalForm.lastName}
                       onChange={(e) => setPersonalForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input type="date" className="input" value={personalForm.date_of_birth || ""}
                       onChange={(e) => setPersonalForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="input" value={personalForm.phone}
                       onChange={(e) => setPersonalForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="input" value={personalForm.email} disabled />
              <p className="form-hint">Email can't be changed here — contact an admin if this needs to change.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Check size={13} />} Save
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingPersonal(false)}>
                <X size={13} /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-3">
            <Field label="First Name" value={firstName} />
            <Field label="Last Name" value={lastName} />
            <Field label="Date of Birth" value={profile.date_of_birth ? formatDate(profile.date_of_birth) : null} />
            <Field label="Email Address" value={profile.email} />
            <Field label="Phone Number" value={profile.phone} />
            <Field label="User Role" value={<span style={{ textTransform: "capitalize" }}>{profile.role}</span>} />
          </div>
        )}
      </div>

      {/* Address */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Address</div>
          {!editingAddress && (
            <button className="btn btn-secondary btn-sm" onClick={startEditAddress}>
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>

        {editingAddress ? (
          <form onSubmit={saveAddress}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Country</label>
                <input className="input" value={addressForm.country}
                       onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="input" value={addressForm.city}
                       onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Postal Code</label>
                <input className="input" value={addressForm.postal_code}
                       onChange={(e) => setAddressForm((f) => ({ ...f, postal_code: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Check size={13} />} Save
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingAddress(false)}>
                <X size={13} /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-3">
            <Field label="Country" value={profile.country} />
            <Field label="City" value={profile.city} />
            <Field label="Postal Code" value={profile.postal_code} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;