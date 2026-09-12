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

const STORAGE_KEY =
  "civicai_sidebar_collapsed";

const Sidebar = ({
  open,
  onNavigate,
}) => {
  const { user, logout } =
    useAuth();

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
          <ShieldCheck size={18} />
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
          }) => (
            <NavLink
              key={to}
              to={to}
              onClick={
                onNavigate
              }
              title={
                collapsed
                  ? label
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
                  {label}
                </span>
              )}
            </NavLink>
          )
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
              ? "Log out"
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
              Log out
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;