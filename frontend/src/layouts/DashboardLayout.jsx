import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Navbar";
import { NAV_BY_ROLE } from "../components/layout/navConfig";
import { useAuth } from "../hooks/useAuth";

const DashboardLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const items = NAV_BY_ROLE[user?.role] || [];
  const current = items.find((i) => location.pathname.startsWith(i.to));

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar title={current?.label || "CivicAI Nexus"} />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
