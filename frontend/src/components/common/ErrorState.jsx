import { AlertTriangle } from "lucide-react";

const ErrorState = ({ title = "Something went wrong", description, onRetry }) => (
  <div className="state-block">
    <AlertTriangle size={40} strokeWidth={1.5} color="var(--danger)" />
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {onRetry && (
      <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export default ErrorState;
