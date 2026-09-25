import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import ThemeToggle from "../common/ThemeToggle";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/about", label: "About" },
];

const PublicNavbar = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <Link to="/" className="logo" onClick={() => setMenuOpen(false)}>
        <div className="logo-icon"><img src="/logo.png" alt="CivicAI Nexus" /></div>
        <span>CivicAI Nexus</span>
      </Link>

      <div className="nav-links nav-links-desktop">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} style={{ color: location.pathname === l.to ? "var(--text)" : undefined, fontWeight: location.pathname === l.to ? 700 : 500 }}>
            {l.label}
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ThemeToggle />
        <div className="nav-links nav-links-desktop" style={{ gap: 14 }}>
          <Link to="/login">Login</Link>
          <Link to="/register" className="nav-button">Get Started</Link>
        </div>

        <button
          type="button"
          className="icon-button navbar-mobile-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className="navbar-mobile-menu">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className={location.pathname === l.to ? "active" : ""}
            >
              {l.label}
            </Link>
          ))}
          <div className="navbar-mobile-menu-divider" />
          <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
          <Link to="/register" className="nav-button" onClick={() => setMenuOpen(false)}>Get Started</Link>
        </div>
      )}
    </nav>
  );
};

export default PublicNavbar;