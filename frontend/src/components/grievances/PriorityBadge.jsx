const PriorityBadge = ({ priority }) => {
  const cls = `badge badge-${(priority || "low").toLowerCase()}`;
  return <span className={cls}>{priority || "LOW"}</span>;
};

export default PriorityBadge;
