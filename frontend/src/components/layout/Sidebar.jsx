import { useState } from "react";
import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  ShieldCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
} from "lucide-react";

import {
  getNavigationItems,
} from "./navConfig";

import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../context/LanguageContext";

// Maps each nav path to its translation key — kept here rather than in
// navConfig.js so navConfig stays framework-agnostic (no hook access).
const NAV_LABEL_KEY = {
  "/citizen/dashboard": "nav.dashboard", "/officer/dashboard": "nav.dashboard", "/admin/dashboard": "nav.dashboard",
  "/citizen/report": "nav.report",
  "/citizen/grievances": "nav.grievances", "/officer/grievances": "nav.grievances", "/admin/grievances": "nav.grievances",
  "/citizen/rewards": "nav.rewards",
  "/citizen/incidents": "nav.incidents", "/officer/incidents": "nav.incidents", "/admin/incidents": "nav.incidents",
  "/citizen/assistant": "nav.assistant", "/admin/assistant": "nav.assistant",
  "/officer/copilot": "nav.copilot",
  "/officer/analytics": "nav.analytics", "/admin/analytics": "nav.analytics",
  "/citizen/notifications": "nav.notifications", "/officer/notifications": "nav.notifications", "/admin/notifications": "nav.notifications",
  "/citizen/profile": "nav.profile", "/officer/profile": "nav.profile", "/admin/profile": "nav.profile",
  "/citizen/settings": "nav.settings", "/officer/settings": "nav.settings", "/admin/settings": "nav.settings",
  "/admin/departments": "nav.departments",
  "/admin/officers": "nav.officers",
  "/admin/admins": "nav.admins",
  "/admin/map": "nav.map",
  "/admin/ai-insights": "nav.aiInsights",
  "/admin/district": "nav.district",
  "/admin/district/unassigned": "nav.unassigned",
};

const STORAGE_KEY =
  "civicai_sidebar_collapsed";

const Sidebar = ({
  open,
  onNavigate,
}) => {
  const { user, logout } =
    useAuth();

  const { t } = useTranslation();

  const navigate = useNavigate();

  const items =
    getNavigationItems(user);

  const [collapsed, setCollapsed] =
    useState(() => {
      return (
        localStorage.getItem(
          STORAGE_KEY
        ) === "true"
      );
    });

  const toggleCollapsed = () => {
    setCollapsed(
      (previous) => {
        const next = !previous;

        localStorage.setItem(
          STORAGE_KEY,
          String(next)
        );

        return next;
      }
    );
  };

  const handleLogout = () => {
    logout();

    navigate("/login", {
      replace: true,
    });
  };

  const isDistrictAdmin =
    user?.role === "admin" &&
    Boolean(user?.district);

  const isSuperAdmin =
    user?.role === "admin" &&
    !user?.district;

  return (
    <aside
      className={`sidebar ${
        open ? "open" : ""
      } ${
        collapsed
          ? "collapsed"
          : ""
      }`}
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <img src="/logo.png" alt="CivicAI Nexus" />
        </div>

        {!collapsed && (
          <span>
            CivicAI Nexus
          </span>
        )}

        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={
            toggleCollapsed
          }
          aria-label={
            collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
          title={
            collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          {collapsed ? (
            <PanelLeftOpen
              size={16}
            />
          ) : (
            <PanelLeftClose
              size={16}
            />
          )}
        </button>
      </div>

      {!collapsed &&
        isDistrictAdmin && (
          <div
            style={{
              margin: "8px 12px 12px",
              padding:
                "10px 12px",
              borderRadius: 10,
              background:
                "var(--accent-soft)",
              color:
                "var(--accent)",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <MapPin size={14} />

            <span>
              {user.district}
            </span>
          </div>
        )}

      {!collapsed &&
        isSuperAdmin && (
          <div
            style={{
              margin: "8px 12px 12px",
              padding:
                "10px 12px",
              borderRadius: 10,
              background:
                "var(--accent-soft)",
              color:
                "var(--accent)",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <ShieldCheck
              size={14}
            />

            <span>
              Super Admin
            </span>
          </div>
        )}

      <nav className="sidebar-nav">
        {items.map(
          ({
            to,
            label,
            icon: Icon,
          }) => {
            const translatedLabel = NAV_LABEL_KEY[to] ? t(NAV_LABEL_KEY[to]) : label;
            return (
            <NavLink
              key={to}
              to={to}
              end
              onClick={
                onNavigate
              }
              title={
                collapsed
                  ? translatedLabel
                  : undefined
              }
              className={({
                isActive,
              }) =>
                `sidebar-link ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >
              <Icon size={17} />

              {!collapsed && (
                <span>
                  {translatedLabel}
                </span>
              )}
            </NavLink>
            );
          }
        )}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="btn btn-block sidebar-logout-btn"
          onClick={
            handleLogout
          }
          title={
            collapsed
              ? t("nav.logout")
              : undefined
          }
          style={{
            justifyContent:
              collapsed
                ? "center"
                : "flex-start",
          }}
        >
          <LogOut size={16} />

          {!collapsed && (
            <span>
              {t("nav.logout")}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;