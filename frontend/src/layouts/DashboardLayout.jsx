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
import OnboardingTour from "../components/onboarding/OnboardingTour";
import { hasTourBeenSeen, markTourSeen } from "../components/onboarding/tourStorage";
import ErrorBoundary from "../components/common/ErrorBoundary";

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

  // Whichever account is currently logged in — set server-side at login
  // for the pre-seeded demo accounts (see main.py's demo_mode_guard).
  // Real accounts are never affected, whoever else is using the site.
  const isDemoAccount = !!user?.is_demo;

  const [showTour, setShowTour] = useState(
    () => !!user && !hasTourBeenSeen(user.id)
  );

  const finishTour = () => {
    if (user) markTourSeen(user.id);
    setShowTour(false);
  };

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

        {isDemoAccount && (
          <div className="demo-mode-banner">
            🔒 Demo account — actions are turned off. Feel free to explore every page; nothing you click changes real data.
          </div>
        )}

        <div className="app-content">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>

      {showTour && user && (
        <OnboardingTour role={user.role} onFinish={finishTour} />
      )}
    </div>
  );
};

export default DashboardLayout;