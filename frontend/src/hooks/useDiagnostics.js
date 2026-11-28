import { useCallback } from "react";
import { diagnose } from "../utils/errorDiagnosis";
import { reportClientError } from "../services/diagnosticService";
import { useToast } from "../context/ToastContext";

/*
 * One call site for "something failed here": classify it, hand the caller a
 * renderable diagnosis, and let the telemetry go in the background.
 */

export function useDiagnostics() {
  /**
   * Classify and report. Use when the page renders its own error UI.
   */
  const capture = useCallback((error, options = {}) => {
    const diagnosis = diagnose(error, options);
    // Deliberately not awaited: a page should never wait on telemetry to show
    // the user what went wrong.
    reportClientError(diagnosis);
    return diagnosis;
  }, []);

  const diagnoseOnly = useCallback((error, options = {}) => diagnose(error, options), []);

  return { capture, diagnose: diagnoseOnly };
}

/**
 * Same, for failures that end in a toast instead of an error block.
 */
export function useErrorToast() {
  const toast = useToast();

  return useCallback(
    (error, options = {}) => {
      const { message, feature, onRetry, ...rest } = options;
      const diagnosis = diagnose(error, { feature, ...rest });
      reportClientError(diagnosis);
      toast.error(message || diagnosis.what, { diagnosis, onRetry });
      return diagnosis;
    },
    [toast]
  );
}

export default useDiagnostics;
