import { CheckCircle2 } from "lucide-react";
import { formatDateTime, toDisplayText } from "../../utils/helpers";
import { STATUS_LABELS } from "../../utils/constants";

const StatusTimeline = ({ history = [] }) => {
  if (!Array.isArray(history)) return null;
  if (!history.length) return null;

  return (
    <div>
      {history.map((item, index) => {
        const event = item && typeof item === "object" ? item : {};
        return (
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
              {toDisplayText(STATUS_LABELS[event.status] || event.status)}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "3px 0" }}>{toDisplayText(event.message)}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
              {formatDateTime(event.timestamp)} · {toDisplayText(event.actor_role)}
            </div>
          </div>
        </div>
      );
      })}
    </div>
  );
};

export default StatusTimeline;
