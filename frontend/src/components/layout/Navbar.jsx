import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Home,
  Info,
  Workflow,
  User,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "../common/ThemeToggle";
import NotificationBell from "../notifications/NotificationBell";
import Avatar from "../common/Avatar";

const Topbar = ({ title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const role = user?.role || "citizen";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close dropdown when pressing Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  const closeProfileMenu = () => {
    setProfileOpen(false);
  };

  return (
    <header className="topbar">
      {/* Page Title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span className="topbar-title">{title}</span>
      </div>

      {/* Topbar Actions */}
      <div className="topbar-actions">
        <ThemeToggle />

        <NotificationBell />

        {/* Profile */}
        <div
          ref={profileRef}
          style={{
            position: "relative",
          }}
        >
          <button
            type="button"
            className="user-chip"
            onClick={() => setProfileOpen((prev) => !prev)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="Open profile menu"
            style={{
              cursor: "pointer",
              border: "none",
              background: "transparent",
            }}
          >
            <Avatar user={user} size={28} />

            <div
              style={{
                lineHeight: 1.2,
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                {user?.name || "User"}
              </div>

              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--text-faint)",
                  textTransform: "capitalize",
                }}
              >
                {role}
              </div>
            </div>

            <ChevronDown
              size={15}
              style={{
                marginLeft: 2,
                transition: "transform 0.2s ease",
                transform: profileOpen
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
              }}
            />
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div
              className="profile-dropdown"
              role="menu"
              aria-label="Profile menu"
            >
              {/* User Information */}
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-user">
                  <Avatar user={user} size={40} />

                  <div>
                    <div className="profile-dropdown-name">
                      {user?.name || "User"}
                    </div>

                    <div className="profile-dropdown-email">
                      {user?.email || ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* Home */}
              <Link
                to={`/${role}/dashboard`}
                className="profile-menu-item"
                onClick={closeProfileMenu}
                role="menuitem"
              >
                <Home size={17} />
                <span>Home</span>
              </Link>

              {/* About */}
              <Link
                to="/about"
                className="profile-menu-item"
                onClick={closeProfileMenu}
                role="menuitem"
              >
                <Info size={17} />
                <span>About</span>
              </Link>

              {/* How It Works */}
              <Link
                to="/how-it-works"
                className="profile-menu-item"
                onClick={closeProfileMenu}
                role="menuitem"
              >
                <Workflow size={17} />
                <span>How it works</span>
              </Link>

              {/* Profile */}
              <Link
                to={`/${role}/profile`}
                className="profile-menu-item"
                onClick={closeProfileMenu}
                role="menuitem"
              >
                <User size={17} />
                <span>Profile</span>
              </Link>

              {/* Settings */}
              <Link
                to={`/${role}/settings`}
                className="profile-menu-item"
                onClick={closeProfileMenu}
                role="menuitem"
              >
                <Settings size={17} />
                <span>Settings</span>
              </Link>

              {/* Divider */}
              <div className="profile-menu-divider" />

              {/* Logout */}
              <button
                type="button"
                className="profile-menu-item profile-logout"
                onClick={handleLogout}
                role="menuitem"
              >
                <LogOut size={17} />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;