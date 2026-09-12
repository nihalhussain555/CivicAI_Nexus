import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  Loader2,
  UserRound,
  ClipboardList,
  Shield,
  Zap,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";
import SocialLoginButtons from "../../pages/auth/SocialLoginButtons";

const roleHome = {
  citizen: "/citizen/dashboard",
  officer: "/officer/dashboard",
  admin: "/admin/dashboard",
};

const ROLES = [
  {
    key: "citizen",
    label: "Citizen",
    icon: UserRound,
    desc: "Report & track issues",
  },
  {
    key: "officer",
    label: "Officer",
    icon: ClipboardList,
    desc: "Work assigned cases",
  },
  {
    key: "admin",
    label: "Admin",
    icon: Shield,
    desc: "Full platform oversight",
  },
];

const Login = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation state
  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const validateEmail = (value) => {
    if (!value.trim()) {
      return "This field is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(value.trim())) {
      return "Please enter a valid email address";
    }

    return "";
  };

  const validatePassword = (value) => {
    if (!value) {
      return "This field is required";
    }

    return "";
  };

  const validateForm = () => {
    const newErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };

    setErrors(newErrors);

    return !newErrors.email && !newErrors.password;
  };

  const doLogin = async (loginEmail, loginPassword) => {
    setLoading(true);

    try {
      const user = await login(loginEmail, loginPassword);

      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);

      const from = location.state?.from?.pathname;

      let target = roleHome[user.role] || "/";

        if (user.role === "admin") {
          target = user.district
            ? "/admin/district"
            : "/admin/dashboard";
        } else if (
          from &&
          from.startsWith(`/${user.role}`)
        ) {
          target = from;
        }

      navigate(target, { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    doLogin(email.trim(), password);
  };

  const selectRole = (role) => {
    setSelectedRole(role);

    const demoEmail = `${role}@demo.com`;
    const demoPassword = "Demo@123";

    setEmail(demoEmail);
    setPassword(demoPassword);

    setErrors({
      email: "",
      password: "",
    });
  };

  const quickLoginAsDemo = (role) => {
    selectRole(role);
    doLogin(`${role}@demo.com`, "Demo@123");
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;

    setEmail(value);
    setSelectedRole(null);

    setErrors((prev) => ({
      ...prev,
      email: value.trim()
        ? validateEmail(value)
        : "",
    }));
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;

    setPassword(value);
    setSelectedRole(null);

    setErrors((prev) => ({
      ...prev,
      password: value ? "" : "",
    }));
  };

  const handleEmailBlur = () => {
    setErrors((prev) => ({
      ...prev,
      email: validateEmail(email),
    }));
  };

  const handlePasswordBlur = () => {
    setErrors((prev) => ({
      ...prev,
      password: validatePassword(password),
    }));
  };

  return (
    <div className="auth-shell">
      <section className="auth-frame auth-frame-login">
        <div className="auth-card auth-card-wide">

          <div className="auth-topline">
            <Link to="/" className="auth-logo">
              <ShieldCheck size={21} />
              CivicAI <span>Nexus</span>
            </Link>

            <p>
              New here?{" "}
              <Link to="/register">
                Create account
              </Link>
            </p>
          </div>

          <div className="auth-heading">
            <span className="auth-kicker">
              Welcome back
            </span>

            <h1>
              Sign in to your civic workspace.
            </h1>

            <p>
              Choose a demo role or use your account details below.
            </p>
          </div>

          <div className="role-grid">
            {ROLES.map(
              ({
                key,
                label,
                icon: Icon,
                desc,
              }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectRole(key)}
                  className={`role-choice ${
                    selectedRole === key
                      ? "selected"
                      : ""
                  }`}
                >
                  <Icon size={20} />

                  <span>
                    {label}
                  </span>

                  <small>
                    {desc}
                  </small>
                </button>
              )
            )}
          </div>

          {selectedRole && (
            <button
              type="button"
              className="btn btn-primary btn-block auth-demo-button"
              disabled={loading}
              onClick={() =>
                quickLoginAsDemo(selectedRole)
              }
            >
              {loading ? (
                <Loader2
                  size={16}
                  style={{
                    animation:
                      "spin 0.8s linear infinite",
                  }}
                />
              ) : (
                <>
                  <Zap size={15} />

                  Continue as demo{" "}
                  {selectedRole}

                  <ArrowRight size={15} />
                </>
              )}
            </button>
          )}

          <div className="auth-divider">
            <span>
              or sign in with email
            </span>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="form-group input-with-icon">

              <label
                className="form-label"
                htmlFor="email"
              >
                Email
              </label>

              <Mail size={16} />

              <input
                id="email"
                type="email"
                className={`input ${
                  errors.email
                    ? "input-error"
                    : ""
                }`}
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={
                  errors.email
                    ? "email-error"
                    : undefined
                }
              />

              {errors.email && (
                <div
                  id="email-error"
                  className="field-error"
                >
                  {errors.email}
                </div>
              )}
            </div>

            {/* Password */}
            <div className="form-group input-with-icon">

              <label
                className="form-label"
                htmlFor="password"
              >
                Password
              </label>

              <LockKeyhole size={16} />

              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                className={`input ${
                  errors.password
                    ? "input-error"
                    : ""
                }`}
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                placeholder="••••••••"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password
                    ? "password-error"
                    : undefined
                }
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (visible) => !visible
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={16} />
                ) : (
                  <Eye size={16} />
                )}
              </button>

              {errors.password && (
                <div
                  id="password-error"
                  className="field-error"
                >
                  {errors.password}
                </div>
              )}
            </div>

            {/* Forgot Password */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "-8px",
                marginBottom: "16px",
              }}
            >
              <Link
                to="/forgot-password"
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block auth-submit"
              disabled={loading}
            >
              {loading ? (
                <Loader2
                  size={16}
                  style={{
                    animation:
                      "spin 0.8s linear infinite",
                  }}
                />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>

          </form>

          <div className="auth-divider">
            <span>
              or continue with
            </span>
          </div>

          <SocialLoginButtons />

        </div>

        <AuthShowcase />
      </section>
    </div>
  );
};

const AuthShowcase = () => (
  <aside
    className="auth-visual"
    aria-hidden="true"
  >
    <div className="auth-ribbon auth-ribbon-top" />
    <div className="auth-ribbon auth-ribbon-bottom" />

    <div className="showcase-brand">
      <Sparkles size={15} />
      AI-powered public service
    </div>

    <div className="showcase-copy">
      <h2>
        Every civic issue deserves a clear path forward.
      </h2>

      <p>
        One secure place to report, track and resolve community needs.
      </p>
    </div>

    <div className="showcase-dashboard">

      <div className="showcase-status">
        <span>
          <MapPin size={15} />
          Issue CX-2048
        </span>

        <strong>
          In progress
        </strong>
      </div>

      <div className="showcase-map">
        <span className="map-pin">
          <MapPin
            size={22}
            fill="currentColor"
          />
        </span>

        <i />
        <i />
        <i />
      </div>

      <div className="showcase-update">
        <div className="showcase-check">
          <CheckCircle2 size={20} />
        </div>

        <div>
          <strong>
            Routed to City Works
          </strong>

          <span>
            Updated just now
          </span>
        </div>
      </div>

    </div>
  </aside>
);

export default Login;