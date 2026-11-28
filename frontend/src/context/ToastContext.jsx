import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";

const ToastContext = createContext(null);

const TOAST_DURATION_MS = 5000;
// An error worth reading gets longer than a "Saved" confirmation.
const ERROR_DURATION_MS = 9000;
let idCounter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const schedule = useCallback((id, ms) => {
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(id, setTimeout(() => remove(id), ms));
  }, [remove]);

  useEffect(() => {
    const store = timers.current;
    return () => store.forEach((timer) => clearTimeout(timer));
  }, []);

  const push = useCallback((toastInput) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev.slice(-4), { id, ...toastInput }]);
    schedule(id, toastInput.duration || (toastInput.type === "error" ? ERROR_DURATION_MS : TOAST_DURATION_MS));
    return id;
  }, [schedule]);

  const toast = {
    success: (msg) => push({ type: "success", message: msg }),
    info: (msg) => push({ type: "info", message: msg }),
    /*
     * Still accepts a bare string, because every existing call site passes one.
     * Pass { diagnosis } to get the reason/solution breakdown, an inline
     * expander, and a retry affordance. Display only — whoever built the
     * diagnosis is responsible for reporting it, so a count means one failure.
     */
    error: (msg, options = {}) => {
      const diagnosis = options.diagnosis;
      return push({
        type: "error",
        message: msg || diagnosis?.what || "Something went wrong.",
        diagnosis,
        onRetry: options.onRetry,
        duration: options.duration,
      });
    },
    diagnosis: (diagnosis, options = {}) =>
      toast.error(diagnosis?.what, { ...options, diagnosis }),
  };

  const icons = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            Icon={icons[t.type] || AlertTriangle}
            onDismiss={() => remove(t.id)}
            onToggle={(expanded) => {
              // Holding a toast open while it is being read is the difference
              // between a message and an ignored flicker.
              if (expanded) {
                const timer = timers.current.get(t.id);
                if (timer) clearTimeout(timer);
                timers.current.delete(t.id);
              } else {
                schedule(t.id, ERROR_DURATION_MS);
              }
            }}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, Icon, onDismiss, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDiagnosis = Boolean(toast.diagnosis);
  const detail = toast.diagnosis;

  return (
    <div className={`toast toast-${toast.type}${hasDiagnosis ? " toast-rich" : ""}`}>
      <div className="toast-icon-wrap">
        <Icon size={16} />
      </div>

      <div className="toast-main">
        <span className="toast-message">{toast.message}</span>
        {expanded && hasDiagnosis && (
          <div className="toast-detail">
            <p>
              <strong>{detail.featureLabel}</strong>
            </p>
            <p>
              <span className="toast-detail-key">Why</span>
              {detail.reason}
            </p>
            <p>
              <span className="toast-detail-key">How to fix it</span>
              {detail.solution}
            </p>
          </div>
        )}
      </div>

      {hasDiagnosis && (
        <button
          className="toast-close"
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            onToggle(next);
          }}
          aria-expanded={expanded}
        >
          <ChevronDown size={13} className={expanded ? "toast-chevron-open" : ""} />
        </button>
      )}

      {toast.onRetry && (
        <button
          className="toast-retry"
          onClick={() => {
            toast.onRetry();
            onDismiss();
          }}
        >
          <RefreshCw size={12} /> Retry
        </button>
      )}

      <button className="toast-close" onClick={onDismiss} aria-label="Dismiss notification">
        <X size={13} />
      </button>

      {!expanded && (
        <div
          className="toast-progress"
          style={{ animationDuration: `${toast.duration || (toast.type === "error" ? ERROR_DURATION_MS : TOAST_DURATION_MS)}ms` }}
        />
      )}
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Components outside the provider would otherwise throw a confusing
    // "toast.error is not a function" on the very path that shows an error.
    return {
      success: () => {},
      error: () => {},
      info: () => {},
      diagnosis: () => {},
    };
  }
  return context;
};

export default ToastContext;
