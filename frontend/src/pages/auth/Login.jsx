import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Loader2, UserRound, ClipboardList, Shield, Zap, Mail, LockKeyhole, Eye, EyeOff, Sparkles } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

const roleHome = { citizen: "/citizen/dashboard", officer: "/officer/dashboard", admin: "/admin/dashboard" };

const ROLES = [
  { key: "citizen", label: "Citizen", icon: UserRound, desc: "Report & track issues" },
  { key: "officer", label: "Officer", icon: ClipboardList, desc: "Work assigned cases" },
  { key: "admin", label: "Admin", icon: Shield, desc: "Full platform oversight" },
];

const Login = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const doLogin = async (loginEmail, loginPassword) => {
    setLoading(true);
    try {
      const user = await login(loginEmail, loginPassword);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      const from = location.state?.from?.pathname;
      // Only honor "return to where you were" if that path actually
      // belongs to this role's section — otherwise a leftover redirect
      // target from a different role (e.g. an admin-only URL visited
      // while logged out) would bounce the user straight to a 403.
      const target = from && from.startsWith(`/${user.role}`) ? from : roleHome[user.role] || "/";
      navigate(target, { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    doLogin(email, password);
  };

  const selectRole = (role) => {
    setSelectedRole(role);
    setEmail(`${role}@demo.com`);
    setPassword("Demo@123");
  };

  const quickLoginAsDemo = (role) => {
    selectRole(role);
    doLogin(`${role}@demo.com`, "Demo@123");
  };

  return (
    <div className="auth-shell">
      <aside className="auth-visual" aria-hidden="true">
        <div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" />
        <div className="auth-visual-content"><span className="eyebrow"><Sparkles size={14} /> Civic intelligence, connected</span><h1>Better civic action starts with a clear signal.</h1><p>Report, route, and resolve issues with an AI-guided service platform built for every role.</p><div className="auth-visual-stat"><strong>AI-assisted triage</strong><span>Clearer reports. Faster routing.</span></div></div>
      </aside>
      <div className="auth-card auth-card-wide" style={{ maxWidth: 460 }}>
        <Link to="/" className="auth-logo">
          <ShieldCheck size={22} color="var(--accent)" /> CivicAI Nexus
        </Link>
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Welcome back</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 20 }}>
          Choose your role to try a demo account, or log in with your own credentials below.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 22 }}>
          {ROLES.map(({ key, label, icon: Icon, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() => selectRole(key)}
              className={`role-choice ${selectedRole === key ? "selected" : ""}`}
            >
              <Icon size={20} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</span>
              <span style={{ fontSize: 10.5, color: "var(--text-faint)", textAlign: "center", lineHeight: 1.3 }}>{desc}</span>
            </button>
          ))}
        </div>

        {selectedRole && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginBottom: 18 }}
            disabled={loading}
            onClick={() => quickLoginAsDemo(selectedRole)}
          >
            {loading
              ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
              : <><Zap size={15} /> Log in as demo {selectedRole}</>}
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", color: "var(--text-faint)", fontSize: 11.5 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          OR LOG IN MANUALLY
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group input-with-icon">
            <label className="form-label" htmlFor="email">Email</label>
            <Mail size={16} />
            <input id="email" type="email" className="input" required value={email}
                   onChange={(e) => { setEmail(e.target.value); setSelectedRole(null); }} placeholder="you@example.com" />
          </div>
          <div className="form-group input-with-icon">
            <label className="form-label" htmlFor="password">Password</label>
            <LockKeyhole size={16} />
            <input id="password" type={showPassword ? "text" : "password"} className="input" required value={password}
                   onChange={(e) => { setPassword(e.target.value); setSelectedRole(null); }} placeholder="••••••••" />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          <button type="submit" className="btn btn-secondary btn-block" disabled={loading}>
            {loading ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : "Log in"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 18 }}>
          Don't have an account? <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>Register</Link>
        </p>

        <div className="demo-hint">
          Demo password for every role: <strong>Demo@123</strong>. Selecting a role above fills the
          form automatically — you can still edit it before submitting.
        </div>
      </div>
    </div>
  );
};

export default Login;
