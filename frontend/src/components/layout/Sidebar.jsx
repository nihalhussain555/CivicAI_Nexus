import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_BY_ROLE } from "./navConfig";
import { useAuth } from "../../hooks/useAuth";

const STORAGE_KEY = "civicai_sidebar_collapsed";

const Sidebar = ({ open, onNavigate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV_BY_ROLE[user?.role] || [];

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon"><ShieldCheck size={18} /></div>
        {!collapsed && <span>CivicAI Nexus</span>}
        <button
          className="sidebar-collapse-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            <Icon size={17} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="btn btn-ghost btn-block"
          onClick={handleLogout}
          title={collapsed ? "Log out" : undefined}
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <LogOut size={16} />
          {!collapsed && "Log out"}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;