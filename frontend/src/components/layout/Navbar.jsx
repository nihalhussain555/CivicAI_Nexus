import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "../common/ThemeToggle";
import NotificationBell from "../notifications/NotificationBell";

const Topbar = ({ title }) => {
  const { user } = useAuth();
  const initials = (user?.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="topbar-title">{title}</span>
      </div>
      <div className="topbar-actions">
        <ThemeToggle />
        <NotificationBell />
        <div className="user-chip">
          <div className="avatar">{initials}</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-faint)", textTransform: "capitalize" }}>{user?.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
