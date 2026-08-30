import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2, UserRound, Mail, Phone, LockKeyhole, Eye, EyeOff, Sparkles, ArrowRight, MapPin, CheckCircle2 } from "lucide-react";
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
      <section className="auth-frame auth-frame-register">
        <div className="auth-card auth-card-wide">
          <div className="auth-topline">
            <Link to="/" className="auth-logo"><ShieldCheck size={21} /> CivicAI <span>Nexus</span></Link>
            <p>Already a member? <Link to="/login">Sign in</Link></p>
          </div>
          <div className="auth-heading">
            <span className="auth-kicker">Create your account</span>
            <h1>Make your community voice count.</h1>
            <p>Start reporting and tracking civic issues in your area.</p>
          </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group input-with-icon">
            <label className="form-label" htmlFor="name">Full Name</label>
            <UserRound size={16} />
            <input id="name" className="input" required minLength={2} value={form.name}
                   onChange={update("name")} placeholder="Full Name" />
          </div>
          <div className="form-group input-with-icon">
            <label className="form-label" htmlFor="email">Email</label>
            <Mail size={16} />
            <input id="email" type="email" className="input" required value={form.email}
                   onChange={update("email")} placeholder="you@gmail.com" />
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
          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
            {loading ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <>Create account <ArrowRight size={16} /></>}
          </button>
        </form>

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
    <div className="showcase-copy"><h2>From concern to action, together.</h2><p>Join a secure civic network built for a more responsive community.</p></div>
    <div className="showcase-dashboard">
      <div className="showcase-status"><span><MapPin size={15} /> Issue CX-2048</span><strong>In progress</strong></div>
      <div className="showcase-map"><span className="map-pin"><MapPin size={22} fill="currentColor" /></span><i /><i /><i /></div>
      <div className="showcase-update"><div className="showcase-check"><CheckCircle2 size={20} /></div><div><strong>Routed to City Works</strong><span>Updated just now</span></div></div>
    </div>
  </aside>
);

export default Register;
