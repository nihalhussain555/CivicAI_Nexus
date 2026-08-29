import { toDisplayText } from "../../utils/helpers";

const PriorityBadge = ({ priority }) => {
  const label = toDisplayText(priority, "LOW").toUpperCase();
  const cls = `badge badge-${label.toLowerCase()}`;
  return <span className={cls}>{label}</span>;
};

export default PriorityBadge;
