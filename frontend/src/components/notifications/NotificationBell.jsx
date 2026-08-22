import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { getNotifications, markAllRead } from "../../services/notificationService";
import { formatRelative } from "../../utils/helpers";
import { useAuth } from "../../hooks/useAuth";

const basePathFor = (role) => `/${role}/notifications`;

const NotificationBell = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef();

  const load = async () => {
    try {
      const res = await getNotifications({ limit: 6 });
      setItems(res.data.items);
      setUnread(res.data.unread_count);
    } catch {
      // notification bell failures are non-blocking
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="icon-button" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell size={17} />
        {unread > 0 && <span className="icon-button-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "absolute", right: 0, top: 46, width: 320, padding: 0,
            boxShadow: "var(--shadow-md)", zIndex: 100,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <strong style={{ fontSize: 13.5 }}>Notifications</strong>
            {unread > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: "2px 8px" }}
                onClick={async () => { await markAllRead(); load(); }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {items.length === 0 ? (
              <p style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>You're all caught up.</p>
            ) : (
              items.map((n) => (
                <div key={n._id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: n.read ? "transparent" : "var(--accent-soft)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0" }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{formatRelative(n.created_at)}</div>
                </div>
              ))
            )}
          </div>
          <Link
            to={basePathFor(user?.role)}
            onClick={() => setOpen(false)}
            style={{ display: "block", textAlign: "center", padding: 10, fontSize: 12.5, color: "var(--accent)", borderTop: "1px solid var(--border)" }}
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
