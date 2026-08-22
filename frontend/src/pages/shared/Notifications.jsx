import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { getNotifications, markRead, markAllRead } from "../../services/notificationService";
import { useAuth } from "../../hooks/useAuth";
import { formatDateTime } from "../../utils/helpers";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Pagination from "../../components/common/Pagination";

const TYPE_COLOR = {
  SUCCESS: "badge-success", STATUS_CHANGE: "badge-status",
  SLA_RISK: "badge-critical", INCIDENT: "badge-medium", INFO: "badge-neutral",
};

const Notifications = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getNotifications({ page, limit: 15 }).then((res) => setData(res.data)).finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const basePath = `/${user.role}/grievances`;

  return (
    <div>
      <div className="page-header">
        <div><h1>Notifications</h1><p>Updates on your grievances, delivered as they happen.</p></div>
        {data?.unread_count > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={async () => { await markAllRead(); load(); }}>
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonList rows={6} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You'll see updates here as your grievances progress." />
      ) : (
        <>
          {data.items.map((n) => (
            <Link
              key={n._id}
              to={n.related_grievance_id ? `${basePath}/${n.related_grievance_id}` : "#"}
              onClick={() => !n.read && markRead(n._id)}
              className="list-row"
              style={{ background: n.read ? undefined : "var(--accent-soft)", alignItems: "flex-start" }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontSize: 13.5 }}>{n.title}</strong>
                  <span className={`badge ${TYPE_COLOR[n.type] || "badge-neutral"}`}>{n.type.replace("_", " ")}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{n.message}</p>
              </div>
              <span style={{ fontSize: 11.5, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{formatDateTime(n.created_at)}</span>
            </Link>
          ))}
          <Pagination page={data.page} totalPages={Math.ceil(data.total / data.limit)} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default Notifications;
