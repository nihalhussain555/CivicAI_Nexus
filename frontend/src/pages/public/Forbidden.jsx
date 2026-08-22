import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

const Forbidden = () => (
  <div className="auth-shell">
    <div style={{ textAlign: "center" }}>
      <ShieldAlert size={48} color="var(--danger)" style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>403 — Access denied</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 22 }}>You don't have permission to view this page.</p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </div>
  </div>
);

export default Forbidden;
