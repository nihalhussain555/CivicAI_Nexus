import { useState } from "react";
import {
  Loader2,
  KeyRound,
  Palette,
  Globe,
  Bell,
  ShieldCheck,
  User,
  Mail,
  Phone,
  CalendarDays,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  ChevronRight,
  Save,
  Settings as SettingsIcon,
  Activity,
} from "lucide-react";

import { changePassword, updateProfile } from "../../services/authService";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../utils/helpers";
import { LANGUAGES } from "../../utils/constants";
import ThemeToggle from "../../components/common/ThemeToggle";

const Settings = () => {
  const toast = useToast();
  const { mode } = useTheme();
  const { user, updateUser, logout } = useAuth();

  /* =========================================================
     PASSWORD STATE
  ========================================================= */

  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [savingPassword, setSavingPassword] =
    useState(false);

  /* =========================================================
     LANGUAGE STATE
  ========================================================= */

  const [language, setLanguage] = useState(
    user?.language || "English"
  );

  const [savingLanguage, setSavingLanguage] =
    useState(false);

  /* =========================================================
     NOTIFICATION STATE
  ========================================================= */

  const [notifications, setNotifications] = useState({
    complaintUpdates: true,
    aiRecommendations: true,
    announcements: true,
    emailNotifications: true,
  });

  /* =========================================================
     PRIVACY STATE
  ========================================================= */

  const [privacy, setPrivacy] = useState({
    profileVisibility: true,
    activityStatus: false,
  });

  /* =========================================================
     PASSWORD STRENGTH
  ========================================================= */

  const getPasswordStrength = () => {
    const password = pwForm.new_password;

    if (!password) {
      return {
        score: 0,
        label: "Not set",
      };
    }

    let score = 0;

    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) {
      return {
        score,
        label: "Weak",
      };
    }

    if (score <= 3) {
      return {
        score,
        label: "Medium",
      };
    }

    return {
      score,
      label: "Strong",
    };
  };

  const passwordStrength = getPasswordStrength();

  /* =========================================================
     CHANGE PASSWORD
  ========================================================= */

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    if (!pwForm.current_password) {
      toast.error("Please enter your current password.");
      return;
    }

    if (pwForm.new_password.length < 6) {
      toast.error(
        "New password must contain at least 6 characters."
      );
      return;
    }

    if (
      pwForm.current_password ===
      pwForm.new_password
    ) {
      toast.error(
        "New password must be different from your current password."
      );
      return;
    }

    setSavingPassword(true);

    try {
      await changePassword(pwForm);

      toast.success(
        "Password updated successfully."
      );

      setPwForm({
        current_password: "",
        new_password: "",
      });
    } catch (error) {
      toast.error(
        getErrorMessage(error)
      );
    } finally {
      setSavingPassword(false);
    }
  };

  /* =========================================================
     CHANGE LANGUAGE
  ========================================================= */

  const handleLanguageChange = async (selectedLanguage) => {
    setLanguage(selectedLanguage);
    setSavingLanguage(true);

    try {
      const response = await updateProfile({
        language: selectedLanguage,
      });

      updateUser(response.data);

      toast.success(
        "Preferred language updated."
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error)
      );
    } finally {
      setSavingLanguage(false);
    }
  };

  /* =========================================================
     TOGGLES
  ========================================================= */

  const toggleNotification = (key) => {
    setNotifications((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const togglePrivacy = (key) => {
    setPrivacy((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  /* =========================================================
     USER DATA
  ========================================================= */

  const accountName =
    user?.name || "CivicAI User";

  const accountEmail =
    user?.email || "No email available";

  const accountRole =
    user?.role || "citizen";

  const accountPhone =
    user?.phone || "Not added";

  const accountLanguage =
    user?.language || language;

  return (
    <div className="settings-page">

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <div className="settings-header">

        <div className="settings-header-content">

          <div className="settings-header-badge">
            <SettingsIcon size={15} />
            ACCOUNT CENTER
          </div>

          <h1>
            Settings
          </h1>

          <p>
            Manage your CivicAI Nexus account,
            preferences, security and privacy.
          </p>

        </div>

      </div>


      {/* =====================================================
          PROFILE OVERVIEW
      ====================================================== */}

      <section className="settings-profile-card">

        <div className="settings-profile-main">

          <div className="settings-profile-avatar">
            {accountName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="settings-profile-info">

            <div className="settings-profile-name-row">

              <h2>
                {accountName}
              </h2>

              <span className="settings-role-badge">
                {accountRole}
              </span>

            </div>

            <p>
              {accountEmail}
            </p>

            <div className="settings-profile-status">
              <CheckCircle2 size={16} />
              Account active
            </div>

          </div>

        </div>


        <div className="settings-profile-stats">

          <div>
            <span>
              ACCOUNT TYPE
            </span>

            <strong>
              {accountRole}
            </strong>
          </div>

          <div>
            <span> LANGUAGE </span>

            <strong> {accountLanguage} </strong>
          </div>

          <div>
            <span> PHONE </span>
            <strong>
              {accountPhone}
            </strong>
          </div>

        </div>

      </section>


      {/* =====================================================
          ACCOUNT INFORMATION
      ====================================================== */}

      <section className="settings-section">

        <div className="settings-section-heading">

          <div>
            <h2> Account information </h2>

            <p> Your basic CivicAI Nexus account details.  </p>
          </div>

        </div>


        <div className="settings-grid">

          <InfoCard icon={<User size={20} />} title="Full name" value={accountName}/>
          <InfoCard icon={<Mail size={20} />} title="Email address" value={accountEmail}/>
          <InfoCard icon={<Phone size={20} />} title="Phone number" value={accountPhone}/>
          <InfoCard icon={<CalendarDays size={20} />} title="Account status"  value="Active"/>

        </div>

      </section>


      {/* =====================================================
          APPEARANCE
      ====================================================== */}

      <section className="settings-section">

        <SectionHeading
          title="Appearance"
          description="Customize how CivicAI Nexus looks on your device."
        />

        <div className="settings-card">

          <div className="settings-card-row">

            <div className="settings-card-left">

              <div className="settings-icon-box">
                <Palette size={21} />
              </div>

              <div>
                <h3> Theme </h3>
                <p> Current theme:{" "}
                  <strong className="capitalize">
                    {mode}
                  </strong>
                </p>
              </div>
            </div>

            <div className="settings-theme-control">
              <ThemeToggle />
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          LANGUAGE
      ====================================================== */}

      <section className="settings-section">

        <SectionHeading
          title="Language & region"
          description="Select your preferred language for the CivicAI experience."
        />

        <div className="settings-card">

          <div className="settings-card-row">

            <div className="settings-card-left">

              <div className="settings-icon-box">
                <Globe size={21} />
              </div>

              <div>
                <h3>
                  Preferred language
                </h3>

                <p>
                  This preference is saved to your account.
                </p>
              </div>

            </div>


            <div className="settings-select-wrapper">

              {savingLanguage && (
                <Loader2
                  size={17}
                  className="settings-loading-icon"
                />
              )}

              <select
                className="settings-select"
                value={language}
                disabled={savingLanguage}
                onChange={(event) =>
                  handleLanguageChange(
                    event.target.value
                  )
                }
              >
                {LANGUAGES.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          SECURITY
      ====================================================== */}

      <section className="settings-section">

        <div className="settings-section-heading">

          <div>
            <h2>
              Security
            </h2>

            <p>
              Protect your account and manage your security preferences.
            </p>
          </div>

          <div className="security-status">
            <ShieldCheck size={17} />
            Protected
          </div>

        </div>


        {/* PASSWORD CARD */}

        <form
          className="settings-card security-password-card"
          onSubmit={handlePasswordChange}
        >

          <div className="settings-card-title-row">

            <div className="settings-icon-box">
              <KeyRound size={21} />
            </div>

            <div>
              <h3>
                Change password
              </h3>

              <p>
                Use a strong password that you do not use elsewhere.
              </p>
            </div>

          </div>


          <div className="settings-form-grid">

            {/* CURRENT PASSWORD */}

            <div className="settings-form-group">

              <label>
                Current password
              </label>

              <div className="password-input-wrapper">

                <Lock size={18} />

                <input
                  type={
                    showCurrentPassword
                      ? "text"
                      : "password"
                  }
                  className="settings-input"
                  placeholder="Enter current password"
                  value={
                    pwForm.current_password
                  }
                  onChange={(event) =>
                    setPwForm((previous) => ({
                      ...previous,
                      current_password:
                        event.target.value,
                    }))
                  }
                  required
                />

                <button
                  type="button"
                  className="password-visibility-btn"
                  onClick={() =>
                    setShowCurrentPassword(
                      (previous) =>
                        !previous
                    )
                  }
                >
                  {showCurrentPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>

            </div>


            {/* NEW PASSWORD */}

            <div className="settings-form-group">

              <label>
                New password
              </label>

              <div className="password-input-wrapper">

                <Lock size={18} />

                <input
                  type={
                    showNewPassword
                      ? "text"
                      : "password"
                  }
                  className="settings-input"
                  placeholder="Create a new password"
                  value={
                    pwForm.new_password
                  }
                  onChange={(event) =>
                    setPwForm((previous) => ({
                      ...previous,
                      new_password:
                        event.target.value,
                    }))
                  }
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  className="password-visibility-btn"
                  onClick={() =>
                    setShowNewPassword(
                      (previous) =>
                        !previous
                    )
                  }
                >
                  {showNewPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>

            </div>

          </div>


          {/* PASSWORD STRENGTH */}

          <div className="password-strength">

            <div className="password-strength-header">

              <span>
                Password strength
              </span>

              <strong
                className={`strength-${passwordStrength.label.toLowerCase()}`}
              >
                {passwordStrength.label}
              </strong>

            </div>


            <div className="password-strength-bars">

              {[1, 2, 3, 4, 5].map(
                (bar) => (
                  <span
                    key={bar}
                    className={
                      bar <=
                      passwordStrength.score
                        ? "filled"
                        : ""
                    }
                  />
                )
              )}

            </div>


            <p>
              Use 10+ characters with uppercase letters,
              numbers and special characters for stronger security.
            </p>

          </div>


          {/* FORM FOOTER */}

          <div className="settings-form-footer">

            <span>
              <ShieldCheck size={16} />
              Your password is securely processed.
            </span>

            <button
              type="submit"
              className="btn btn-primary settings-save-btn"
              disabled={savingPassword}
            >
              {savingPassword ? (
                <>
                  <Loader2
                    size={17}
                    className="settings-spin"
                  />
                  Updating...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Update password
                </>
              )}
            </button>

          </div>

        </form>


        {/* SECURITY FEATURES */}

        <div className="security-feature-grid">

          <SecurityFeature
            icon={<Smartphone size={20} />}
            title="Two-factor authentication"
            description="Add an additional layer of protection to your account."
            badge="Available soon"
          />

          <SecurityFeature
            icon={<Monitor size={20} />}
            title="Active sessions"
            description="Review devices that have recently accessed your account."
            badge="Current session active"
          />

        </div>

      </section>


      {/* =====================================================
          NOTIFICATIONS
      ====================================================== */}

      <section className="settings-section">

        <SectionHeading
          title="Notifications"
          description="Choose which CivicAI Nexus updates you want to receive."
        />

        <div className="settings-card settings-options-card">

          <SettingToggle
            icon={<Bell size={20} />}
            title="Complaint updates"
            description="Receive updates when your grievance status changes."
            checked={
              notifications.complaintUpdates
            }
            onChange={() =>
              toggleNotification(
                "complaintUpdates"
              )
            }
          />

          <SettingToggle
            icon={<ShieldCheck size={20} />}
            title="AI recommendations"
            description="Receive intelligent suggestions and AI-generated updates."
            checked={
              notifications.aiRecommendations
            }
            onChange={() =>
              toggleNotification(
                "aiRecommendations"
              )
            }
          />

          <SettingToggle
            icon={<Globe size={20} />}
            title="Announcements"
            description="Stay informed about important civic announcements."
            checked={
              notifications.announcements
            }
            onChange={() =>
              toggleNotification(
                "announcements"
              )
            }
          />

          <SettingToggle
            icon={<Mail size={20} />}
            title="Email notifications"
            description="Receive important CivicAI Nexus updates by email."
            checked={
              notifications.emailNotifications
            }
            onChange={() =>
              toggleNotification(
                "emailNotifications"
              )
            }
          />

        </div>

      </section>


      {/* =====================================================
          PRIVACY
      ====================================================== */}

      <section className="settings-section">

        <SectionHeading
          title="Privacy"
          description="Control how your information and activity are displayed."
        />

        <div className="settings-card settings-options-card">

          <SettingToggle
            icon={<Eye size={20} />}
            title="Profile visibility"
            description="Allow your basic profile information to be visible where appropriate."
            checked={
              privacy.profileVisibility
            }
            onChange={() =>
              togglePrivacy(
                "profileVisibility"
              )
            }
          />

          <SettingToggle
            icon={<Activity size={20} />}
            title="Activity status"
            description="Show when you are currently active on CivicAI Nexus."
            checked={
              privacy.activityStatus
            }
            onChange={() =>
              togglePrivacy(
                "activityStatus"
              )
            }
          />

        </div>

      </section>


      {/* =====================================================
          ACCOUNT SESSION
      ====================================================== */}

      <section className="settings-section">

        <SectionHeading
          title="Account session"
          description="Manage your current CivicAI Nexus session."
        />

        <div className="settings-card">

          <div className="settings-card-row">

            <div className="settings-card-left">

              <div className="settings-icon-box">
                <LogOut size={21} />
              </div>

              <div>
                <h3>
                  Sign out
                </h3>

                <p>
                  Sign out from your current CivicAI Nexus account.
                </p>
              </div>

            </div>


            <button
              type="button"
              className="settings-logout-btn"
              onClick={() => logout()}
            >
              <LogOut size={17} />
              Log out
            </button>

          </div>

        </div>

      </section>


      {/* =====================================================
          DANGER ZONE
      ====================================================== */}

      <section className="danger-zone">

        <div className="danger-zone-icon">
          <AlertTriangle size={22} />
        </div>

        <div className="danger-zone-content">

          <h2>
            Danger zone
          </h2>

          <p>
            Account deletion and other destructive actions
            should be handled carefully.
          </p>

        </div>

        <button
          type="button"
          className="danger-zone-btn"
          onClick={() =>
            toast.info(
              "Please contact the CivicAI Nexus administrator for account deletion."
            )
          }
        >
          Delete account
        </button>

      </section>

    </div>
  );
};


/* ===========================================================
   SECTION HEADING
=========================================================== */

const SectionHeading = ({
  title,
  description,
}) => {
  return (
    <div className="settings-section-heading">
      <div>
        <h2>
          {title}
        </h2>

        <p>
          {description}
        </p>
      </div>
    </div>
  );
};


/* ===========================================================
   INFORMATION CARD
=========================================================== */

const InfoCard = ({
  icon,
  title,
  value,
}) => {
  return (
    <div className="settings-info-card">

      <div className="settings-info-icon">
        {icon}
      </div>

      <div className="settings-info-content">

        <span>
          {title}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </div>
  );
};


/* ===========================================================
   SECURITY FEATURE
=========================================================== */

const SecurityFeature = ({
  icon,
  title,
  description,
  badge,
}) => {
  return (
    <div className="security-feature-card">

      <div className="security-feature-icon">
        {icon}
      </div>

      <div className="security-feature-content">

        <h3>
          {title}
        </h3>

        <p>
          {description}
        </p>

        <span className="security-feature-badge">
          {badge}
        </span>

      </div>

      <ChevronRight size={19} />

    </div>
  );
};


/* ===========================================================
   TOGGLE
=========================================================== */

const SettingToggle = ({
  icon,
  title,
  description,
  checked,
  onChange,
}) => {
  return (
    <div className="setting-toggle-row">

      <div className="setting-toggle-left">

        <div className="setting-toggle-icon">
          {icon}
        </div>

        <div className="setting-toggle-content">

          <h3>
            {title}
          </h3>

          <p>
            {description}
          </p>

        </div>

      </div>


      <button
        type="button"
        className={`settings-toggle ${
          checked ? "checked" : ""
        }`}
        onClick={onChange}
        aria-label={`${title}: ${
          checked ? "enabled" : "disabled"
        }`}
        aria-pressed={checked}
      >
        <span />
      </button>

    </div>
  );
};

export default Settings;