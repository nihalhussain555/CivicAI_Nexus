import { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { formatRelative, formatDateTime, toDisplayText } from "../../utils/helpers";

const overrideReason = (override) => {
  if (!override?.reason) return "";
  const text = toDisplayText(override.reason, "");
  return text === "Not available" ? "" : text;
};

// The citizen's progress ladder.
//
// Deliberately fed by the API's `stages` array rather than deriving anything
// from `status` here: the ladder is one of the things the backend promises to
// get right (see tracking_service.build_stages), and a second copy of that
// judgement in the UI is exactly how a page ends up showing a stage the
// department has not actually reached.
const DOT = {
  done: { className: "timeline-step-done", icon: <Check size={11} /> },
  current: { className: "timeline-step-active", icon: null },
  pending: { className: "timeline-step-pending", icon: null },
  blocked: { className: "timeline-step-blocked", icon: <AlertTriangle size={11} /> },
};

const TrackingTimeline = ({ stages = [], override }) => {
  const [open, setOpen] = useState(null);

  if (!Array.isArray(stages) || !stages.length) return null;

  return (
    <div className="complaint-timeline">
      {stages.map((stage, index) => {
        const tone = DOT[stage.state] || DOT.pending;
        const isOpen = open === index;
        const detail = toDisplayText(stage.message, "");

        return (
          <div key={stage.key} className={`timeline-step ${tone.className}`}>
            <div className="timeline-step-rail">
              <button
                type="button"
                className="timeline-step-dot"
                onClick={() => detail && setOpen(isOpen ? null : index)}
                aria-label={stage.label}
              >
                {tone.icon}
              </button>
              {index < stages.length - 1 && <span className="timeline-step-line" />}
            </div>

            <div className="timeline-step-body">
              <button
                type="button"
                className="timeline-step-label"
                onClick={() => detail && setOpen(isOpen ? null : index)}
                style={{ cursor: detail ? "pointer" : "default" }}
              >
                {toDisplayText(stage.label, "Stage")}
              </button>

              <div className="timeline-step-meta">
                {stage.at ? formatRelative(stage.at) : stage.description}
              </div>

              {isOpen && detail && (
                <div className="timeline-step-details">
                  <div className="timeline-step-detail-row">
                    <span>{detail}</span>
                    <span className="timeline-step-detail-time">
                      {formatDateTime(stage.at)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {override && (
        <div className="track-override-note">
          <AlertTriangle size={14} />
          <div>
            <strong>{toDisplayText(override.label)}</strong>
            <p>
              {overrideReason(override) ||
                "This case is off the normal path. The reason is in your updates."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackingTimeline;
