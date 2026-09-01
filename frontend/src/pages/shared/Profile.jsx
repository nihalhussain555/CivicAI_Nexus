import { useEffect, useRef, useState } from "react";
import { Camera, Pencil, Loader2, Check, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getMe, updateProfile } from "../../services/authService";
import { uploadImage } from "../../services/uploadService";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, formatDate } from "../../utils/helpers";
import Avatar from "../../components/common/Avatar";

const splitName = (fullName = "") => {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
};

const Field = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 14, fontWeight: 600 }}>
      {value || <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>Not set</span>}
    </div>
  </div>
);

const SectionHeader = ({ title, editing, onEdit }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{title}</div>
    {!editing && (
      <button className="btn btn-primary btn-sm" onClick={onEdit}>
        <Pencil size={13} /> Edit
      </button>
    )}
  </div>
);

const Profile = () => {
  const { user: cachedUser, updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef();

  // Always show live data from the database, not just whatever was cached
  // at login — if anything (including role) changes directly in Mongo,
  // this page reflects it as soon as it loads.
  const [profile, setProfile] = useState(cachedUser);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
  const location = [profile.city, profile.country].filter(Boolean).join(", ");

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please choose a JPEG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const uploadRes = await uploadImage(file);
      const saveRes = await updateProfile({ profile_image: uploadRes.data.url });
      setProfile(saveRes.data);
      updateUser(saveRes.data);
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingPhoto(false);
    }
  };

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
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div><h1>My Profile</h1><p>Your account details, kept in sync with the database.</p></div>
        {loading && <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite", color: "var(--text-faint)" }} />}
      </div>

      {/* Header card */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar user={profile} size={76} fontSize={26} />
          <button
            onClick={handlePhotoClick}
            disabled={uploadingPhoto}
            aria-label="Change profile photo"
            style={{
              position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: "50%",
              background: "var(--accent)", color: "white", border: "3px solid var(--surface)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            {uploadingPhoto
              ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
              : <Camera size={12} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handlePhotoChange}
          />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{profile.name}</div>
          <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, margin: "2px 0" }}>
            <span style={{ textTransform: "capitalize" }}>{profile.role}</span>
          </div>
          {location && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{location}</div>}
        </div>
      </div>

      {/* Personal information */}
      <div className="card">
        <SectionHeader title="Personal Information" editing={editingPersonal} onEdit={startEditPersonal} />

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
          <div className="grid grid-3" style={{ rowGap: 16 }}>
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
        <SectionHeader title="Address" editing={editingAddress} onEdit={startEditAddress} />

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
          <div className="grid grid-3" style={{ rowGap: 16 }}>
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