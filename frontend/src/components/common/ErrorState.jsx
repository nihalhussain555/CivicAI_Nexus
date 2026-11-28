import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import DiagnosticCard from "./DiagnosticCard";
import { diagnose } from "../../utils/errorDiagnosis";

/*
 * Keeps its original (title, description, onRetry) shape so the pages already
 * using it stay word-for-word correct, and upgrades itself to a full diagnosis
 * when handed an error or a diagnosis object.
 */

const ErrorState = ({
  title,
  description,
  onRetry,
  diagnosis,
  error,
  feature,
  allowReport = true,
  children,
}) => {
  const built = useMemo(() => {
    if (diagnosis) return diagnosis;
    if (error) return diagnose(error, { feature });
    return null;
  }, [diagnosis, error, feature]);

  if (!built && !title && !description) {
    // No information at all is itself a bug — render the old generic block
    // rather than an empty diagnosis card with blank rows.
    return (
      <div className="state-block">
        <AlertTriangle size={40} strokeWidth={1.5} color="var(--danger)" />
        <h3>Something went wrong</h3>
        {onRetry && (
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!built) {
    return (
      <div className="state-block">
        <AlertTriangle size={40} strokeWidth={1.5} color="var(--danger)" />
        {title && <h3>{title}</h3>}
        {description && <p>{description}</p>}
        {onRetry && (
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  // A page's own wording ("Couldn't load your grievances") beats the generic
  // catalog line, so it overrides `what` while the diagnosis supplies the rest.
  const merged = {
    ...built,
    what: title || built.what,
    solution: description || built.solution,
  };

  return (
    <div className="error-state-wrap">
      <DiagnosticCard diagnosis={merged} onRetry={onRetry} allowReport={allowReport}>
        {children}
      </DiagnosticCard>
    </div>
  );
};

export default ErrorState;
