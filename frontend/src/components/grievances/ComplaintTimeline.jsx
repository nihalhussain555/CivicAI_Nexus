import { useState } from "react";
import { Check } from "lucide-react";
import { formatRelative } from "../../utils/helpers";

// Fixed, conceptual stages a grievance moves through. Multiple real
// statuses can map to the same visual stage (e.g. OFFICER_ACCEPTED and
// IN_PROGRESS both read as "Officer Working") since the citizen cares
// about the phase, not the exact internal state name.
const STAGES = [
  { key: "SUBMITTED", label: "Complaint Submitted", statuses: ["SUBMITTED"] },
  { key: "AI_ANALYZED", label: "AI Analysis Completed", statuses: ["AI_ANALYZED"] },
  { key: "DEPARTMENT_ASSIGNED", label: "Department Assigned", statuses: ["DEPARTMENT_ASSIGNED", "REOPENED"] },
  { key: "OFFICER_WORKING", label: "Officer Working", statuses: ["OFFICER_ACCEPTED", "IN_PROGRESS", "ESCALATED"] },
  { key: "RESOLUTION", label: "Resolution", statuses: ["RESOLUTION_SUBMITTED", "CITIZEN_VERIFICATION"] },
  { key: "CONFIRMATION", label: "Citizen Confirmation", statuses: ["CLOSED"] },
];

const stageIndexForStatus = (status) => {
  const i = STAGES.findIndex((s) => s.statuses.includes(status));
  return i === -1 ? 0 : i;
};

const ComplaintTimeline = ({ status, history = [] }) => {
  const currentIndex = stageIndexForStatus(status);
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="complaint-timeline">
      {STAGES.map((stage, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
        const matches = history.filter((h) => stage.statuses.includes(h.status));
        const isOpen = openIndex === i;

        return (
          <div key={stage.key} className={`timeline-step timeline-step-${state}`}>
            <div className="timeline-step-rail">
              <button
                type="button"
                className="timeline-step-dot"
                onClick={() => matches.length && setOpenIndex(isOpen ? null : i)}
                aria-label={stage.label}
              >
                {state === "done" ? <Check size={11} /> : null}
              </button>
              {i < STAGES.length - 1 && <span className="timeline-step-line" />}
            </div>

            <div className="timeline-step-body">
              <button
                type="button"
                className="timeline-step-label"
                onClick={() => matches.length && setOpenIndex(isOpen ? null : i)}
                style={{ cursor: matches.length ? "pointer" : "default" }}
              >
                {stage.label}
              </button>

              {isOpen && matches.length > 0 && (
                <div className="timeline-step-details">
                  {matches.map((h, idx) => (
                    <div key={idx} className="timeline-step-detail-row">
                      <span>{h.message}</span>
                      <span className="timeline-step-detail-time">{formatRelative(h.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ComplaintTimeline;