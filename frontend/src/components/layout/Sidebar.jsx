import { NavLink, useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut } from "lucide-react";
import { NAV_BY_ROLE } from "./navConfig";
import { useAuth } from "../../hooks/useAuth";

const Sidebar = ({ open, onNavigate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV_BY_ROLE[user?.role] || [];

  const handleLogout = () => {
    logout();
    // Navigate immediately so no protected route is left mounted to
    // capture a stale "return to this page" redirect target on its way
    // out — avoids ever landing back on a page the next login's role
    // isn't allowed to see.
    navigate("/login", { replace: true });
  };

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon"><ShieldCheck size={18} /></div>
        <span>CivicAI Nexus</span>
      </div>
      <nav className="sidebar-nav">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="btn btn-ghost btn-block" onClick={handleLogout} style={{ justifyContent: "flex-start" }}>
          <LogOut size={16} /> Log out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;