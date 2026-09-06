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
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
};

const Field = ({ label, value }) => (
  <div>
    <div
      style={{
        fontSize: 11.5,
        color: "var(--text-faint)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.3px",
        marginBottom: 6,
      }}
    >
      {label}
    </div>

    <div
      style={{
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text)",
      }}
    >
      {value || (
        <span
          style={{
            color: "var(--text-faint)",
            fontWeight: 400,
          }}
        >
          Not set
        </span>
      )}
    </div>
  </div>
);

const SectionHeader = ({ title, editing, onEdit }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
      marginBottom: 20,
      paddingBottom: 14,
      borderBottom: "1px solid var(--border)",
    }}
  >
    <div
      style={{
        fontSize: 16,
        fontWeight: 750,
        color: "var(--accent)",
        letterSpacing: "-0.1px",
      }}
    >
      {title}
    </div>

    {!editing && (
      <button
        className="btn btn-primary btn-sm"
        onClick={onEdit}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minWidth: 72,
        }}
      >
        <Pencil size={13} />
        Edit
      </button>
    )}
  </div>
);

const Profile = () => {
  const { user: cachedUser, updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef();

  // Live profile data from database
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
        updateUser(res.data);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return null;

  const { firstName, lastName } = splitName(profile.name);

  const location = [profile.city, profile.country]
    .filter(Boolean)
    .join(", ");

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
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

      const saveRes = await updateProfile({
        profile_image: uploadRes.data.url,
      });

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
      firstName,
      lastName,
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
      const name =
        `${personalForm.firstName} ${personalForm.lastName}`.trim();

      const res = await updateProfile({
        name,
        phone: personalForm.phone,
        date_of_birth: personalForm.date_of_birth,
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
    <>
      <style>{`
        .profile-page {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .profile-page .profile-card {
          box-sizing: border-box;
          width: 100%;
        }

        .profile-page .profile-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 28px 36px;
        }

        .profile-page .profile-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        @media (max-width: 900px) {
          .profile-page {
            max-width: 100%;
          }

          .profile-page .profile-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .profile-page .profile-hero {
            padding: 20px !important;
          }

          .profile-page .profile-card {
            padding: 20px !important;
          }

          .profile-page .profile-grid,
          .profile-page .profile-form-grid {
            grid-template-columns: 1fr;
          }

          .profile-page .profile-avatar-wrapper {
            width: 72px !important;
            height: 72px !important;
          }

          .profile-page .profile-avatar-wrapper > div:first-child {
            transform: scale(0.82);
            transform-origin: top left;
          }

          .profile-page .profile-name {
            font-size: 18px !important;
          }
        }
      `}</style>

      <div className="profile-page">

        {/* PAGE HEADER */}
        <div
          className="page-header"
          style={{
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1 style={{ marginBottom: 5 }}>
              My Profile
            </h1>

            <p style={{ margin: 0 }}>
              Manage your personal information and account details.
            </p>
          </div>

          {loading && (
            <Loader2
              size={18}
              style={{
                animation: "spin 0.8s linear infinite",
                color: "var(--text-faint)",
              }}
            />
          )}
        </div>

        {/* PROFILE HEADER CARD */}
        <div
          className="card profile-card profile-hero"
          style={{
            minHeight: 135,
            display: "flex",
            alignItems: "center",
            padding: "24px 30px",
            borderRadius: 16,
            marginBottom: 18,
          }}
        >
          <div
            className="profile-avatar-wrapper"
            style={{
              position: "relative",
              flexShrink: 0,
              width: 88,
              height: 88,
            }}
          >
            <Avatar
              user={profile}
              size={88}
              fontSize={30}
            />

            <button
              onClick={handlePhotoClick}
              disabled={uploadingPhoto}
              aria-label="Change profile photo"
              title="Change profile photo"
              style={{
                position: "absolute",
                bottom: -3,
                right: -3,
                width: 29,
                height: 29,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "white",
                border: "3px solid var(--surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: uploadingPhoto
                  ? "wait"
                  : "pointer",
                padding: 0,
              }}
            >
              {uploadingPhoto ? (
                <Loader2
                  size={13}
                  style={{
                    animation:
                      "spin 0.8s linear infinite",
                  }}
                />
              ) : (
                <Camera size={13} />
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

          <div
            style={{
              marginLeft: 22,
              minWidth: 0,
            }}
          >
            <div
              className="profile-name"
              style={{
                fontWeight: 800,
                fontSize: 21,
                lineHeight: 1.25,
                marginBottom: 5,
              }}
            >
              {profile.name}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "var(--accent)",
                fontWeight: 700,
                marginBottom: 5,
                textTransform: "capitalize",
              }}
            >
              {profile.role}
            </div>

            {location && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                {location}
              </div>
            )}
          </div>
        </div>

        {/* PERSONAL INFORMATION */}
        <div
          className="card profile-card"
          style={{
            padding: "24px 30px",
            borderRadius: 16,
            marginBottom: 18,
          }}
        >
          <SectionHeader
            title="Personal Information"
            editing={editingPersonal}
            onEdit={startEditPersonal}
          />

          {editingPersonal ? (
            <form onSubmit={savePersonal}>

              <div className="profile-form-grid">

                <div className="form-group">
                  <label className="form-label">
                    First Name
                  </label>

                  <input
                    className="input"
                    value={personalForm.firstName}
                    onChange={(e) =>
                      setPersonalForm((f) => ({
                        ...f,
                        firstName: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Last Name
                  </label>

                  <input
                    className="input"
                    value={personalForm.lastName}
                    onChange={(e) =>
                      setPersonalForm((f) => ({
                        ...f,
                        lastName: e.target.value,
                      }))
                    }
                  />
                </div>

              </div>

              <div
                className="profile-form-grid"
                style={{ marginTop: 16 }}
              >

                <div className="form-group">
                  <label className="form-label">
                    Date of Birth
                  </label>

                  <input
                    type="date"
                    className="input"
                    value={
                      personalForm.date_of_birth || ""
                    }
                    onChange={(e) =>
                      setPersonalForm((f) => ({
                        ...f,
                        date_of_birth: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Phone Number
                  </label>

                  <input
                    className="input"
                    value={personalForm.phone}
                    onChange={(e) =>
                      setPersonalForm((f) => ({
                        ...f,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>

              </div>

              <div
                className="form-group"
                style={{ marginTop: 16 }}
              >
                <label className="form-label">
                  Email Address
                </label>

                <input
                  className="input"
                  value={personalForm.email}
                  disabled
                />

                <p className="form-hint">
                  Email can't be changed here — contact an
                  admin if this needs to change.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2
                      size={13}
                      style={{
                        animation:
                          "spin 0.8s linear infinite",
                      }}
                    />
                  ) : (
                    <Check size={13} />
                  )}

                  Save
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    setEditingPersonal(false)
                  }
                >
                  <X size={13} />
                  Cancel
                </button>
              </div>

            </form>
          ) : (
            <div className="profile-grid">

              <Field
                label="First Name"
                value={firstName}
              />

              <Field
                label="Last Name"
                value={lastName}
              />

              <Field
                label="Date of Birth"
                value={
                  profile.date_of_birth
                    ? formatDate(
                        profile.date_of_birth
                      )
                    : null
                }
              />

              <Field
                label="Email Address"
                value={profile.email}
              />

              <Field
                label="Phone Number"
                value={profile.phone}
              />

              <Field
                label="User Role"
                value={
                  <span
                    style={{
                      textTransform: "capitalize",
                    }}
                  >
                    {profile.role}
                  </span>
                }
              />

            </div>
          )}
        </div>

        {/* ADDRESS */}
        <div
          className="card profile-card"
          style={{
            padding: "24px 30px",
            borderRadius: 16,
          }}
        >
          <SectionHeader
            title="Address"
            editing={editingAddress}
            onEdit={startEditAddress}
          />

          {editingAddress ? (
            <form onSubmit={saveAddress}>

              <div
                className="profile-form-grid"
                style={{
                  gridTemplateColumns:
                    "repeat(3, minmax(0, 1fr))",
                }}
              >

                <div className="form-group">
                  <label className="form-label">
                    Country
                  </label>

                  <input
                    className="input"
                    value={addressForm.country}
                    onChange={(e) =>
                      setAddressForm((f) => ({
                        ...f,
                        country: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    City
                  </label>

                  <input
                    className="input"
                    value={addressForm.city}
                    onChange={(e) =>
                      setAddressForm((f) => ({
                        ...f,
                        city: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Postal Code
                  </label>

                  <input
                    className="input"
                    value={addressForm.postal_code}
                    onChange={(e) =>
                      setAddressForm((f) => ({
                        ...f,
                        postal_code: e.target.value,
                      }))
                    }
                  />
                </div>

              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 20,
                }}
              >
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2
                      size={13}
                      style={{
                        animation:
                          "spin 0.8s linear infinite",
                      }}
                    />
                  ) : (
                    <Check size={13} />
                  )}

                  Save
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    setEditingAddress(false)
                  }
                >
                  <X size={13} />
                  Cancel
                </button>
              </div>

            </form>
          ) : (
            <div className="profile-grid">

              <Field
                label="Country"
                value={profile.country}
              />

              <Field
                label="City"
                value={profile.city}
              />

              <Field
                label="Postal Code"
                value={profile.postal_code}
              />

            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default Profile;