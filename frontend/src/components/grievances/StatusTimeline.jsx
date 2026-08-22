import { CheckCircle2 } from "lucide-react";
import { formatDateTime } from "../../utils/helpers";
import { STATUS_LABELS } from "../../utils/constants";

const StatusTimeline = ({ history = [] }) => {
  if (!history.length) return null;

  return (
    <div>
      {history.map((item, index) => (
        <div key={index} style={{ display: "flex", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 26, height: 26, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--accent-soft)", color: "var(--accent)", flexShrink: 0,
              }}
            >
              <CheckCircle2 size={15} />
            </div>
            {index < history.length - 1 && (
              <div style={{ width: 2, flex: 1, background: "var(--border)", minHeight: 24 }} />
            )}
          </div>
          <div style={{ paddingBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>
              {STATUS_LABELS[item.status] || item.status}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "3px 0" }}>{item.message}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
              {formatDateTime(item.timestamp)} · {item.actor_role}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatusTimeline;
