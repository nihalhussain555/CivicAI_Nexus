import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "../common/ThemeToggle";
import NotificationBell from "../notifications/NotificationBell";
import Avatar from "../common/Avatar";

const Topbar = ({ title }) => {
  const { user } = useAuth();

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="topbar-title">{title}</span>
      </div>
      <div className="topbar-actions">
        <ThemeToggle />
        <NotificationBell />
        <Link to={`/${user?.role}/profile`} className="user-chip" style={{ cursor: "pointer" }}>
          <Avatar user={user} size={28} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-faint)", textTransform: "capitalize" }}>{user?.role}</div>
          </div>
        </Link>
      </div>
    </header>
  );
};

export default Topbar;