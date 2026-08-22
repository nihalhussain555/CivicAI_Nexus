import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

const Register = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
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
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <ShieldCheck size={22} color="var(--accent)" /> CivicAI Nexus
        </Link>
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Create your account</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 24 }}>
          Start reporting and tracking civic issues in your area.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full name</label>
            <input id="name" className="input" required minLength={2} value={form.name}
                   onChange={update("name")} placeholder="Aditya Verma" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" required value={form.email}
                   onChange={update("email")} placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="phone">Phone (optional)</label>
            <input id="phone" className="input" value={form.phone}
                   onChange={update("phone")} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" required minLength={6} value={form.password}
                   onChange={update("password")} placeholder="At least 6 characters" />
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
