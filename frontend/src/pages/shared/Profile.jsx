import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Pencil,
  Loader2,
  Check,
  X,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Shield,
  User,
} from "lucide-react";

import { getMe, updateProfile } from "../../services/authService";
import { uploadImage } from "../../services/uploadService";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, formatDate } from "../../utils/helpers";
import { useAuth } from "../../hooks/useAuth";
import Avatar from "../../components/common/Avatar";

const Profile = () => {
  const toast = useToast();
  const { user, updateUser } = useAuth();

  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(user || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);

  const [personalForm, setPersonalForm] = useState({
    firstName: "",
    lastName: "",
    date_of_birth: "",
    phone: "",
    email: "",
  });

  const [addressForm, setAddressForm] = useState({
    country: "",
    city: "",
    postal_code: "",
  });

  /* =========================================================
     LOAD PROFILE
  ========================================================= */

  const loadProfile = async () => {
    setLoading(true);

    try {
      const res = await getMe();

      if (res?.data) {
        setProfile(res.data);

        // Keep topbar/sidebar user data synchronized.
        if (typeof updateUser === "function") {
          updateUser(res.data);
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  /* =========================================================
     HELPERS
  ========================================================= */

  const splitName = (name = "") => {
    const parts = name.trim().split(/\s+/);

    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
    };
  };

  if (!profile) {
    return (
      <div className="profile-loading">
        <Loader2
          size={28}
          style={{
            animation: "spin 0.8s linear infinite",
            color: "#6d28d9",
          }}
        />

        <p>Loading profile...</p>
      </div>
    );
  }

  const { firstName, lastName } = splitName(profile.name);

  const locationText = [profile.city, profile.country]
    .filter(Boolean)
    .join(", ");

  /* =========================================================
     PERSONAL INFORMATION
  ========================================================= */

  const startPersonalEdit = () => {
    setPersonalForm({
      firstName,
      lastName,
      date_of_birth: profile.date_of_birth || "",
      phone: profile.phone || "",
      email: profile.email || "",
    });

    setEditingPersonal(true);
  };

  const cancelPersonalEdit = () => {
    setEditingPersonal(false);
  };

  const handlePersonalChange = (field, value) => {
    setPersonalForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const savePersonal = async (event) => {
    event.preventDefault();

    if (!personalForm.firstName.trim()) {
      toast.error("First name is required.");
      return;
    }

    setSaving(true);

    try {
      const fullName = `${personalForm.firstName} ${personalForm.lastName}`
        .trim()
        .replace(/\s+/g, " ");

      const res = await updateProfile({
        name: fullName,
        phone: personalForm.phone,
        date_of_birth: personalForm.date_of_birth,
      });

      if (res?.data) {
        setProfile(res.data);

        if (typeof updateUser === "function") {
          updateUser(res.data);
        }
      }

      setEditingPersonal(false);
      toast.success("Personal information updated successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     ADDRESS
  ========================================================= */

  const startAddressEdit = () => {
    setAddressForm({
      country: profile.country || "",
      city: profile.city || "",
      postal_code: profile.postal_code || "",
    });

    setEditingAddress(true);
  };

  const handleAddressChange = (field, value) => {
    setAddressForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const saveAddress = async (event) => {
    event.preventDefault();

    setSaving(true);

    try {
      const res = await updateProfile(addressForm);

      if (res?.data) {
        setProfile(res.data);

        if (typeof updateUser === "function") {
          updateUser(res.data);
        }
      }

      setEditingAddress(false);
      toast.success("Address updated successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     PROFILE PHOTO
  ========================================================= */

  const openPhotoPicker = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Please choose a JPEG, PNG, or WEBP image.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be smaller than 8MB.");
      return;
    }

    setUploadingPhoto(true);

    try {
      const uploadResponse = await uploadImage(file);

      const imageUrl = uploadResponse?.data?.url;

      if (!imageUrl) {
        throw new Error("Image upload failed.");
      }

      const response = await updateProfile({
        profile_image: imageUrl,
      });

      if (response?.data) {
        setProfile(response.data);

        if (typeof updateUser === "function") {
          updateUser(response.data);
        }
      }

      toast.success("Profile photo updated successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingPhoto(false);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      <style>{`
        .profile-page {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding-bottom: 40px;
        }

        .profile-loading {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-muted);
        }

        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 22px;
        }

        .profile-header h1 {
          margin: 0 0 6px;
          font-size: 28px;
          font-weight: 800;
        }

        .profile-header p {
          margin: 0;
          color: var(--text-muted);
          font-size: 15px;
        }

        .profile-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 28px;
          margin-bottom: 20px;
        }

        .profile-hero {
          display: flex;
          align-items: center;
          gap: 24px;
          background:
            linear-gradient(
              135deg,
              rgba(109, 40, 217, 0.10),
              transparent 60%
            ),
            var(--surface);
        }

        .profile-avatar-wrapper {
          position: relative;
          width: 96px;
          height: 96px;
          flex-shrink: 0;
        }

        .profile-avatar-wrapper > * {
          border-radius: 50%;
        }

        .profile-photo-button {
          position: absolute;
          right: -4px;
          bottom: -4px;
          width: 34px;
          height: 34px;
          border: 3px solid var(--surface);
          border-radius: 50%;
          background: #6d28d9;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .profile-photo-button:hover {
          background: #5b21b6;
          transform: scale(1.06);
        }

        .profile-photo-button:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .profile-name {
          font-size: 25px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .profile-email {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 9px;
        }

        .profile-role {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(109, 40, 217, 0.12);
          color: #6d28d9;
          font-size: 13px;
          font-weight: 800;
          text-transform: capitalize;
        }

        .profile-location {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--text-muted);
          font-size: 14px;
        }

        .profile-section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
          padding-bottom: 15px;
          border-bottom: 1px solid var(--border);
        }

        .profile-section-title-left {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .profile-section-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(109, 40, 217, 0.12);
          color: #6d28d9;
        }

        .profile-section-title h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }

        .profile-section-title p {
          margin: 3px 0 0;
          font-size: 13px;
          color: var(--text-muted);
        }

        .profile-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
        }

        .profile-field-label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 7px;
        }

        .profile-field-value {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 25px;
          font-size: 15px;
          font-weight: 650;
          color: var(--text);
          word-break: break-word;
        }

        .profile-field-value svg {
          color: #6d28d9;
          flex-shrink: 0;
        }

        .profile-edit-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: none;
          border-radius: 9px;
          padding: 9px 14px;
          background: #6d28d9;
          color: white;
          font-weight: 700;
          cursor: pointer;
        }

        .profile-edit-button:hover {
          background: #5b21b6;
        }

        .profile-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .profile-input {
          width: 100%;
          box-sizing: border-box;
          min-height: 46px;
          padding: 11px 13px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          outline: none;
          font-size: 14px;
        }

        .profile-input:focus {
          border-color: #6d28d9;
          box-shadow: 0 0 0 3px rgba(109, 40, 217, 0.12);
        }

        .profile-input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .profile-form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .profile-save-button,
        .profile-cancel-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 40px;
          padding: 9px 15px;
          border-radius: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .profile-save-button {
          border: none;
          background: #6d28d9;
          color: white;
        }

        .profile-cancel-button {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text);
        }

        .profile-save-button:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        @media (max-width: 800px) {
          .profile-page {
            max-width: 100%;
          }

          .profile-card {
            padding: 20px;
          }

          .profile-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .profile-header h1 {
            font-size: 23px;
          }

          .profile-hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .profile-name {
            font-size: 21px;
          }

          .profile-grid,
          .profile-form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="profile-page">

        {/* =====================================================
            PAGE HEADER
        ===================================================== */}

        <div className="profile-header">
          <div>
            <h1>My Profile</h1>
            <p>
              Manage your personal information and account details.
            </p>
          </div>

          {loading && (
            <Loader2
              size={20}
              style={{
                color: "#6d28d9",
                animation: "spin 0.8s linear infinite",
              }}
            />
          )}
        </div>

        {/* =====================================================
            PROFILE HERO
        ===================================================== */}

        <div className="profile-card profile-hero">

          <div className="profile-avatar-wrapper">

            <Avatar
              user={profile}
              size={96}
            />

            <button
              type="button"
              className="profile-photo-button"
              onClick={openPhotoPicker}
              disabled={uploadingPhoto}
              title="Change profile photo"
            >
              {uploadingPhoto ? (
                <Loader2
                  size={16}
                  style={{
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              ) : (
                <Camera size={16} />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handlePhotoChange}
            />

          </div>

          <div style={{ minWidth: 0 }}>

            <div className="profile-name">
              {profile.name || "User"}
            </div>

            <div className="profile-email">
              {profile.email || "No email available"}
            </div>

            <div className="profile-role">
              <Shield size={14} />
              {profile.role || "citizen"}
            </div>

            {locationText && (
              <div className="profile-location">
                <MapPin size={16} />
                {locationText}
              </div>
            )}

          </div>
        </div>

        {/* =====================================================
            PERSONAL INFORMATION
        ===================================================== */}

        <div className="profile-card">

          <div className="profile-section-title">

            <div className="profile-section-title-left">

              <div className="profile-section-icon">
                <User size={20} />
              </div>

              <div>
                <h2>Personal Information</h2>
                <p>Your basic account information</p>
              </div>

            </div>

            {!editingPersonal && (
              <button
                type="button"
                className="profile-edit-button"
                onClick={startPersonalEdit}
              >
                <Pencil size={15} />
                Edit
              </button>
            )}

          </div>

          {editingPersonal ? (

            <form onSubmit={savePersonal}>

              <div className="profile-form-grid">

                <div className="form-group">
                  <label className="form-label">
                    First Name
                  </label>

                  <input
                    className="profile-input"
                    value={personalForm.firstName}
                    onChange={(e) =>
                      handlePersonalChange(
                        "firstName",
                        e.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Last Name
                  </label>

                  <input
                    className="profile-input"
                    value={personalForm.lastName}
                    onChange={(e) =>
                      handlePersonalChange(
                        "lastName",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Date of Birth
                  </label>

                  <input
                    type="date"
                    className="profile-input"
                    value={personalForm.date_of_birth}
                    onChange={(e) =>
                      handlePersonalChange(
                        "date_of_birth",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Phone Number
                  </label>

                  <input
                    className="profile-input"
                    value={personalForm.phone}
                    onChange={(e) =>
                      handlePersonalChange(
                        "phone",
                        e.target.value
                      )
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div
                  className="form-group"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <label className="form-label">
                    Email Address
                  </label>

                  <input
                    className="profile-input"
                    value={personalForm.email}
                    disabled
                  />
                </div>

              </div>

              <div className="profile-form-actions">

                <button
                  type="submit"
                  className="profile-save-button"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2
                      size={15}
                      style={{
                        animation:
                          "spin 0.8s linear infinite",
                      }}
                    />
                  ) : (
                    <Check size={15} />
                  )}

                  Save Changes
                </button>

                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={cancelPersonalEdit}
                  disabled={saving}
                >
                  <X size={15} />
                  Cancel
                </button>

              </div>

            </form>

          ) : (

            <div className="profile-grid">

              <div>
                <span className="profile-field-label">
                  First Name
                </span>

                <div className="profile-field-value">
                  <User size={16} />
                  {firstName || "Not set"}
                </div>
              </div>

              <div>
                <span className="profile-field-label">
                  Last Name
                </span>

                <div className="profile-field-value">
                  <User size={16} />
                  {lastName || "Not set"}
                </div>
              </div>

              <div>
                <span className="profile-field-label">
                  Date of Birth
                </span>

                <div className="profile-field-value">
                  <Calendar size={16} />
                  {profile.date_of_birth
                    ? formatDate(profile.date_of_birth)
                    : "Not set"}
                </div>
              </div>

              <div>
                <span className="profile-field-label">
                  Email
                </span>

                <div className="profile-field-value">
                  <Mail size={16} />
                  {profile.email || "Not set"}
                </div>
              </div>

              <div>
                <span className="profile-field-label">
                  Phone
                </span>

                <div className="profile-field-value">
                  <Phone size={16} />
                  {profile.phone || "Not set"}
                </div>
              </div>

              <div>
                <span className="profile-field-label">
                  Role
                </span>

                <div className="profile-field-value">
                  <Shield size={16} />
                  <span style={{ textTransform: "capitalize" }}>
                    {profile.role || "citizen"}
                  </span>
                </div>
              </div>

            </div>

          )}

        </div>

        {/* =====================================================
            ADDRESS
        ===================================================== */}

        <div className="profile-card">

          <div className="profile-section-title">

            <div className="profile-section-title-left">

              <div className="profile-section-icon">
                <MapPin size={20} />
              </div>

              <div>
                <h2>Address</h2>
                <p>Your location information</p>
              </div>

            </div>

            {!editingAddress && (
              <button
                type="button"
                className="profile-edit-button"
                onClick={startAddressEdit}
              >
                <Pencil size={15} />
                Edit
              </button>
            )}

          </div>

          {editingAddress ? (

            <form onSubmit={saveAddress}>

              <div className="profile-form-grid">

                <div className="form-group">
                  <label className="form-label">
                    Country
                  </label>

                  <input
                    className="profile-input"
                    value={addressForm.country}
                    onChange={(e) =>
                      handleAddressChange(
                        "country",
                        e.target.value
                      )
                    }
                    placeholder="India"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    City
                  </label>

                  <input
                    className="profile-input"
                    value={addressForm.city}
                    onChange={(e) =>
                      handleAddressChange(
                        "city",
                        e.target.value
                      )
                    }
                    placeholder="Chennai"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Postal Code
                  </label>

                  <input
                    className="profile-input"
                    value={addressForm.postal_code}
                    onChange={(e) =>
                      handleAddressChange(
                        "postal_code",
                        e.target.value
                      )
                    }
                    placeholder="600001"
                  />
                </div>

              </div>

              <div className="profile-form-actions">

                <button
                  type="submit"
                  className="profile-save-button"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2
                      size={15}
                      style={{
                        animation:
                          "spin 0.8s linear infinite",
                      }}
                    />
                  ) : (
                    <Check size={15} />
                  )}

                  Save Changes
                </button>

                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={() =>
                    setEditingAddress(false)
                  }
                  disabled={saving}
                >
                  <X size={15} />
                  Cancel
                </button>

              </div>

            </form>

          ) : (

            <div className="profile-grid">

              <div>
                <span className="profile-field-label">
                  Country
                </span>

                <div className="profile-field-value">
                  <MapPin size={16} />
                  {profile.country || "Not set"}
                </div>
              </div>

              <div>
                <span className="profile-field-label">
                  City
                </span>

                <div className="profile-field-value">
                  <MapPin size={16} />
                  {profile.city || "Not set"}
                </div>
              </div>

              <div>
                <span className="profile-field-label">
                  Postal Code
                </span>

                <div className="profile-field-value">
                  <MapPin size={16} />
                  {profile.postal_code || "Not set"}
                </div>
              </div>

            </div>

          )}

        </div>

      </div>
    </>
  );
};

export default Profile;