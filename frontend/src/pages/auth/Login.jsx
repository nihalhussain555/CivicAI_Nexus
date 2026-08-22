import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

const roleHome = { citizen: "/citizen/dashboard", officer: "/officer/dashboard", admin: "/admin/dashboard" };

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      const from = location.state?.from?.pathname;
      navigate(from || roleHome[user.role] || "/", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    setEmail(`${role}@demo.com`);
    setPassword("Demo@123");
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <ShieldCheck size={22} color="var(--accent)" /> CivicAI Nexus
        </Link>
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Welcome back</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 24 }}>
          Log in to report or track civic grievances.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" required value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" required value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : "Log in"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 18 }}>
          Don't have an account? <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>Register</Link>
        </p>

        <div className="demo-hint">
          <strong>Demo accounts</strong> (password: Demo@123) —{" "}
          <button type="button" onClick={() => fillDemo("citizen")} style={{ background: "none", border: "none", textDecoration: "underline", color: "inherit", cursor: "pointer" }}>citizen</button>,{" "}
          <button type="button" onClick={() => fillDemo("officer")} style={{ background: "none", border: "none", textDecoration: "underline", color: "inherit", cursor: "pointer" }}>officer</button>,{" "}
          <button type="button" onClick={() => fillDemo("admin")} style={{ background: "none", border: "none", textDecoration: "underline", color: "inherit", cursor: "pointer" }}>admin</button>
        </div>
      </div>
    </div>
  );
};

export default Login;
