import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

const NotFound = () => (
  <div className="auth-shell">
    <div style={{ textAlign: "center" }}>
      <Compass size={48} color="var(--text-faint)" style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>404 — Page not found</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 22 }}>The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </div>
  </div>
);

export default NotFound;
