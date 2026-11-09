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
import BadgesAndCertificates from "../../components/common/BadgesAndCertificates";

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
            color: "var(--accent)",
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


      <div className="profile-page">

        {/* =====================================================
            PAGE HEADER
        ===================================================== */}

        <div className="profile-header">
          <div>
            <h1>My Profile</h1>
            <p> Manage your personal information and account details. </p>
          </div>
          {loading && ( 
            <Loader2 size={20} style={{ color: "var(--accent)", animation: "spin 0.8s linear infinite", }}/>
          )}
        </div>

        {/* =====================================================
            PROFILE HERO
        ===================================================== */}

        <div className="profile-card profile-hero">

          <div className="profile-avatar-wrapper">

            <Avatar user={profile} size={96} />
            <button type="button"
                className="profile-photo-button"
                onClick={openPhotoPicker}
                disabled={uploadingPhoto}
                title="Change profile photo" >
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

        <div style={{ marginTop: 24 }}>
          <BadgesAndCertificates />
        </div>

      </div>
    </>
  );
};

export default Profile;