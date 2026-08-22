import { STATUS_LABELS } from "../../utils/constants";

const STATUS_STYLE = {
  CLOSED: "badge-success",
  ESCALATED: "badge-danger",
  REOPENED: "badge-danger",
  CITIZEN_VERIFICATION: "badge-status",
  IN_PROGRESS: "badge-status",
};

const StatusBadge = ({ status }) => (
  <span className={`badge ${STATUS_STYLE[status] || "badge-neutral"}`}>
    {STATUS_LABELS[status] || status}
  </span>
);

export default StatusBadge;
