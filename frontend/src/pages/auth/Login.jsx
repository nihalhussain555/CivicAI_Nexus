import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Loader2, UserRound, ClipboardList, Shield, Zap, Mail, LockKeyhole, Eye, EyeOff, Sparkles, ArrowRight, MapPin, CheckCircle2 } from "lucide-react";
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
      <section className="auth-frame auth-frame-login">
        <div className="auth-card auth-card-wide">
          <div className="auth-topline">
            <Link to="/" className="auth-logo"><ShieldCheck size={21} /> CivicAI <span>Nexus</span></Link>
            <p>New here? <Link to="/register">Create account</Link></p>
          </div>
          <div className="auth-heading">
            <span className="auth-kicker">Welcome back</span>
            <h1>Sign in to your civic workspace.</h1>
            <p>Choose a demo role or use your account details below.</p>
          </div>

        <div className="role-grid">
          {ROLES.map(({ key, label, icon: Icon, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() => selectRole(key)}
              className={`role-choice ${selectedRole === key ? "selected" : ""}`}
            >
              <Icon size={20} />
              <span>{label}</span>
              <small>{desc}</small>
            </button>
          ))}
        </div>

        {selectedRole && (
          <button
            type="button"
            className="btn btn-primary btn-block auth-demo-button"
            disabled={loading}
            onClick={() => quickLoginAsDemo(selectedRole)}
          >
            {loading
              ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
              : <><Zap size={15} /> Continue as demo {selectedRole}<ArrowRight size={15} /></>}
          </button>
        )}

        <div className="auth-divider"><span>or sign in with email</span></div>

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
          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
            {loading ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <>Sign in <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="demo-hint">
          Demo password for every role: <strong>Demo@123</strong>. Selecting a role above fills the
          form automatically — you can still edit it before submitting.
        </div>
        </div>
        <AuthShowcase />
      </section>
    </div>
  );
};

const AuthShowcase = () => (
  <aside className="auth-visual" aria-hidden="true">
    <div className="auth-ribbon auth-ribbon-top" /><div className="auth-ribbon auth-ribbon-bottom" />
    <div className="showcase-brand"><Sparkles size={15} /> AI-powered public service</div>
    <div className="showcase-copy"><h2>Every civic issue deserves a clear path forward.</h2><p>One secure place to report, track and resolve community needs.</p></div>
    <div className="showcase-dashboard">
      <div className="showcase-status"><span><MapPin size={15} /> Issue CX-2048</span><strong>In progress</strong></div>
      <div className="showcase-map"><span className="map-pin"><MapPin size={22} fill="currentColor" /></span><i /><i /><i /></div>
      <div className="showcase-update"><div className="showcase-check"><CheckCircle2 size={20} /></div><div><strong>Routed to City Works</strong><span>Updated just now</span></div></div>
    </div>
  </aside>
);

export default Login;
