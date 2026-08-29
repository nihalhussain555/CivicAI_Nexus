import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2, UserRound, Mail, Phone, LockKeyhole, Eye, EyeOff, Sparkles } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

const Register = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      await login(form.email, form.password);
      toast.success("Account created — welcome to CivicAI Nexus!");
      navigate("/citizen/dashboard", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-visual" aria-hidden="true"><div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" /><div className="auth-visual-content"><span className="eyebrow"><Sparkles size={14} /> A better way to be heard</span><h1>Turn a civic concern into meaningful action.</h1><p>Join a transparent, AI-supported service experience designed around your community.</p><div className="auth-visual-stat"><strong>Track every update</strong><span>From report to resolution.</span></div></div></aside>
      <div className="auth-card auth-card-wide">
        <Link to="/" className="auth-logo">
          <ShieldCheck size={22} color="var(--accent)" /> CivicAI Nexus
        </Link>
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Create your account</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 24 }}>
          Start reporting and tracking civic issues in your area.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group input-with-icon">
            <label className="form-label" htmlFor="name">Full name</label>
            <UserRound size={16} />
            <input id="name" className="input" required minLength={2} value={form.name}
                   onChange={update("name")} placeholder="Aditya Verma" />
          </div>
          <div className="form-group input-with-icon">
            <label className="form-label" htmlFor="email">Email</label>
            <Mail size={16} />
            <input id="email" type="email" className="input" required value={form.email}
                   onChange={update("email")} placeholder="you@example.com" />
          </div>
          <div className="form-group input-with-icon">
            <label className="form-label" htmlFor="phone">Phone (optional)</label>
            <Phone size={16} />
            <input id="phone" className="input" value={form.phone}
                   onChange={update("phone")} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group input-with-icon">
            <label className="form-label" htmlFor="password">Password</label>
            <LockKeyhole size={16} />
            <input id="password" type={showPassword ? "text" : "password"} className="input" required minLength={6} value={form.password}
                   onChange={update("password")} placeholder="At least 6 characters" />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            {form.password && <div className={`password-strength ${form.password.length >= 10 ? "strong" : form.password.length >= 6 ? "medium" : "weak"}`}><span /><span /><span /><em>{form.password.length >= 10 ? "Strong" : form.password.length >= 6 ? "Good" : "Use at least 6 characters"}</em></div>}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 18 }}>
          Already have an account? <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
