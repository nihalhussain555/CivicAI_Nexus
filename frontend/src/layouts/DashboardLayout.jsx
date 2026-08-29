import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Navbar";
import { NAV_BY_ROLE } from "../components/layout/navConfig";
import { useAuth } from "../hooks/useAuth";

const DashboardLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const items = NAV_BY_ROLE[user?.role] || [];
  const current = items.find((i) => location.pathname.startsWith(i.to));
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <div className="app-main">
        <Topbar title={current?.label || "CivicAI Nexus"} onMenuToggle={() => setMenuOpen((open) => !open)} />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
