import { useState } from "react";
import {
  AlertTriangle,
  Bug,
  RefreshCw,
  ServerCog,
  SignalHigh,
  WifiOff,
} from "lucide-react";
import IssueReportDialog from "./IssueReportDialog";

/*
 * The single shape every handled error takes: what broke, and what to do about
 * it. Deliberately no status codes, paths or reference ids — this card is read
 * by a citizen in the middle of a problem, and the same details reach the team
 * through the diagnostics dashboard instead.
 */

const SEVERITY_ICON = {
  blocking: AlertTriangle,
  degraded: ServerCog,
  minor: AlertTriangle,
};

const CATEGORY_ICON = {
  network: WifiOff,
  ai_provider: ServerCog,
  voice: SignalHigh,
  upload: ServerCog,
  location: SignalHigh,
};

const DiagnosticCard = ({ diagnosis, onRetry, variant = "card", allowReport = true, retryLabel = "Try again", children }) => {
  const [reportOpen, setReportOpen] = useState(false);

  if (!diagnosis) return null;

  const severity = diagnosis.severity || "degraded";
  const Icon = CATEGORY_ICON[diagnosis.category] || SEVERITY_ICON[severity] || AlertTriangle;

  return (
    <>
      <div className={`diagnosis diagnosis-${severity} diagnosis-${variant}`}>
        <div className="diagnosis-head">
          <span className="diagnosis-icon">
            <Icon size={18} />
          </span>
          <div className="diagnosis-head-text">
            <h3 className="diagnosis-what">{diagnosis.what}</h3>
            <p className="diagnosis-where">
              Affects: <strong>{diagnosis.featureLabel}</strong>
            </p>
          </div>
        </div>

        <div className="diagnosis-body">
          <p className="diagnosis-line">
            <span className="diagnosis-key">Why</span>
            <span className="diagnosis-value">{diagnosis.reason}</span>
          </p>
          <p className="diagnosis-line">
            <span className="diagnosis-key">How to fix it</span>
            <span className="diagnosis-value">{diagnosis.solution}</span>
          </p>
          {children}
        </div>

        {(onRetry || allowReport) && (
          <div className="diagnosis-actions">
            {onRetry && diagnosis.retryable !== false && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
                <RefreshCw size={14} /> {retryLabel}
              </button>
            )}
            {allowReport && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setReportOpen(true)}
              >
                <Bug size={14} /> Report issue
              </button>
            )}
          </div>
        )}
      </div>

      {reportOpen && (
        <IssueReportDialog
          open={reportOpen}
          diagnosis={diagnosis}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
};

export default DiagnosticCard;
