import { Link, useLocation } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import ThemeToggle from "../common/ThemeToggle";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/about", label: "About" },
];

const PublicNavbar = () => {
  const location = useLocation();

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        <div className="logo-icon"><ShieldCheck size={20} /></div>
        <span>CivicAI Nexus</span>
      </Link>

      <div className="nav-links">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} style={{ color: location.pathname === l.to ? "var(--text)" : undefined, fontWeight: location.pathname === l.to ? 700 : 500 }}>
            {l.label}
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ThemeToggle />
        <div className="nav-links" style={{ gap: 14 }}>
          <Link to="/login">Login</Link>
          <Link to="/register" className="nav-button">Get Started</Link>
        </div>
      </div>
    </nav>
  );
};

export default PublicNavbar;
