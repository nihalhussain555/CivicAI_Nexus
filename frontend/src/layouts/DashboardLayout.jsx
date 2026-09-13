import {
  Outlet,
  useLocation,
} from "react-router-dom";

import { useState } from "react";

import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Navbar";

import {
  getNavigationItems,
} from "../components/layout/navConfig";

import { useAuth } from "../hooks/useAuth";

const DashboardLayout = () => {
  const { user } = useAuth();
  const location = useLocation();

  const items = getNavigationItems(user);

  /*
   * Find the exact navigation item first.
   * This prevents /admin/district from matching
   * /admin/district/unassigned.
   */
  const exactCurrent = items.find(
    (item) =>
      location.pathname === item.to
  );

  /*
   * Fallback for deeper pages such as:
   * /admin/grievances/:id
   */
  const parentCurrent =
    exactCurrent ||
    items
      .filter((item) =>
        location.pathname.startsWith(
          `${item.to}/`
        )
      )
      .sort(
        (a, b) =>
          b.to.length - a.to.length
      )[0];

  const current = parentCurrent;

  const [menuOpen, setMenuOpen] =
    useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        open={menuOpen}
        onNavigate={() =>
          setMenuOpen(false)
        }
      />

      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() =>
            setMenuOpen(false)
          }
        />
      )}

      <div className="app-main">
        <Topbar
          title={
            current?.label ||
            (user?.district
              ? `${user.district} District`
              : "CivicAI Nexus")
          }
          onMenuToggle={() =>
            setMenuOpen(
              (open) => !open
            )
          }
        />

        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;