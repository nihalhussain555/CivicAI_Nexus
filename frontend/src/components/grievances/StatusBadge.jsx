import { STATUS_LABELS } from "../../utils/constants";
import { toDisplayText } from "../../utils/helpers";

const STATUS_STYLE = {
  CLOSED: "badge-success",
  ESCALATED: "badge-danger",
  REOPENED: "badge-danger",
  CITIZEN_VERIFICATION: "badge-status",
  IN_PROGRESS: "badge-status",
};

const StatusBadge = ({ status }) => {
  const label = toDisplayText(status, "Unknown");
  return (
  <span className={`badge ${STATUS_STYLE[status] || "badge-neutral"}`}>
    {STATUS_LABELS[status] || label}
  </span>
  );
};

export default StatusBadge;
