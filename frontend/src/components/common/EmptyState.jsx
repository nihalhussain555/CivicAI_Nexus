import { Inbox } from "lucide-react";

const EmptyState = ({ icon: Icon = Inbox, title = "Nothing here yet", description, action }) => (
  <div className="state-block">
    <Icon size={40} strokeWidth={1.5} />
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);

export default EmptyState;
