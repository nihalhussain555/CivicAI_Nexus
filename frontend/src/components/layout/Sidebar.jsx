import { Fragment, useState } from "react";
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
  NAV_LABEL_KEY,
} from "./navConfig";

import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../context/LanguageContext";

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

  // Each group change gets a section header. Derived up front so the JSX walk
  // over navItems stays free of render-phase mutation.
  const navItems = [];
  let previousGroup = null;

  for (const item of items) {
    navItems.push({ ...item, showHeader: item.group !== previousGroup });
    previousGroup = item.group;
  }

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
        {navItems.map(
          ({
            to,
            label,
            icon: Icon,
            group,
            showHeader,
          }) => {
            const translatedLabel = NAV_LABEL_KEY[to] ? t(NAV_LABEL_KEY[to]) : label;
            return (
            <Fragment key={to}>
              {showHeader && (
                collapsed ? (
                  <div className="sidebar-section-rail" />
                ) : (
                  <div className="sidebar-section">
                    {t(group)}
                  </div>
                )
              )}

              <NavLink
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
            </Fragment>
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