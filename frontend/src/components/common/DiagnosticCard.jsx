import { useState } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  Copy,
  RefreshCw,
  ServerCog,
  SignalHigh,
  WifiOff,
} from "lucide-react";
import IssueReportDialog from "./IssueReportDialog";

/*
 * The single shape every handled error takes: what broke, which feature it
 * broke, why, and what to do. Severity picks the chrome, not the content — a
 * minor issue reads the same in a toast as on a full page.
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

const DiagnosticCard = ({
  diagnosis,
  onRetry,
  variant = "card",
  allowReport = true,
  showTechnical = true,
  retryLabel = "Try again",
  children,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!diagnosis) return null;

  const severity = diagnosis.severity || "degraded";
  const Icon = CATEGORY_ICON[diagnosis.category] || SEVERITY_ICON[severity] || AlertTriangle;
  const technicalEntries = Object.entries(diagnosis.technical || {}).filter(
    ([, value]) => value !== "" && value !== null && value !== undefined
  );

  const copyDetails = async () => {
    const text = [
      `Error ref: ${diagnosis.errorRef || "not recorded"}`,
      `Category: ${diagnosis.categoryLabel}`,
      `Feature: ${diagnosis.featureLabel}`,
      `What: ${diagnosis.what}`,
      `Reason: ${diagnosis.reason}`,
      ...technicalEntries.map(([key, value]) => `${key}: ${value}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is itself a permission the browser can refuse; the
      // details remain readable on screen either way.
      setCopied(false);
    }
  };

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
              <span className="diagnosis-category">{diagnosis.categoryLabel}</span>
            </p>
          </div>
        </div>

        <div className="diagnosis-body">
          <p className="diagnosis-line">
            <span className="diagnosis-key">Why</span>
            <span className="diagnosis-value">{diagnosis.reason}</span>
          </p>
          <p className="diagnosis-line">
            <span className="diagnosis-key">What to do</span>
            <span className="diagnosis-value">{diagnosis.solution}</span>
          </p>
          {children}
        </div>

        {diagnosis.errorRef && (
          <p className="diagnosis-ref">
            Reference <code>{diagnosis.errorRef}</code>
          </p>
        )}

        {(onRetry || (allowReport && diagnosis.errorRef !== undefined)) && (
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
            {showTechnical && technicalEntries.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm diagnosis-toggle"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
              >
                <ChevronDown
                  size={14}
                  className={expanded ? "diagnosis-chevron-open" : ""}
                />
                {expanded ? "Hide details" : "Technical details"}
              </button>
            )}
          </div>
        )}

        {expanded && showTechnical && technicalEntries.length > 0 && (
          <div className="diagnosis-technical">
            <dl>
              {technicalEntries.map(([key, value]) => (
                <div key={key} className="diagnosis-technical-row">
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
            <button type="button" className="btn btn-ghost btn-xs" onClick={copyDetails}>
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy details"}
            </button>
            <p className="diagnosis-technical-note">
              Keys, tokens and passwords are removed from these details before they are shown.
            </p>
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
