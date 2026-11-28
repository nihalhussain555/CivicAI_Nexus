import api from "./api";
import { fingerprint } from "../utils/errorDiagnosis";

/*
 * Shipping diagnoses to the server.
 *
 * A page load that fails five parallel requests must not write five identical
 * events, and a reporting call that itself fails must never be reported (that
 * recursion would take the app down while it tries to complain). Both are
 * handled here rather than at every call site.
 */

const THROTTLE_WINDOW_MS = 60000;
const MAX_TRACKED = 200;
const recentlySent = new Map();

function shouldSend(key) {
  const now = Date.now();
  const last = recentlySent.get(key);
  if (last && now - last < THROTTLE_WINDOW_MS) return false;
  recentlySent.set(key, now);
  if (recentlySent.size > MAX_TRACKED) {
    const oldest = recentlySent.keys().next().value;
    recentlySent.delete(oldest);
  }
  return true;
}

// 2xx-or-nothing would throw into the caller's catch block, which is the block
// that called us. Accept any status: this call must be unable to fail loudly.
const QUIET = { validateStatus: () => true };

function payloadFor(diagnosis, extra = {}) {
  return {
    feature: diagnosis.feature,
    category: diagnosis.category,
    message: diagnosis.technical?.message || diagnosis.what,
    severity: diagnosis.severity,
    error_ref: diagnosis.errorRef || undefined,
    path: diagnosis.technical?.url || (typeof window !== "undefined" ? window.location.pathname : undefined),
    occurred_at: new Date().toISOString(),
    context: {
      categoryLabel: diagnosis.categoryLabel,
      what: diagnosis.what,
      reason: diagnosis.reason,
      solution: diagnosis.solution,
      status: diagnosis.technical?.status,
      name: diagnosis.technical?.name,
      online: diagnosis.technical?.online,
      ...extra.context,
    },
  };
}

/**
 * Record a browser-side failure. Fire-and-forget: returns the server's ref when
 * it lands, resolves null when throttled or unreachable. Never rejects.
 */
export async function reportClientError(diagnosis, extra = {}) {
  if (!diagnosis) return null;
  // The server already filed this one: an `errorRef` means a backend event
  // exists for this exact failure, so sending it again would count twice.
  if (diagnosis.errorRef) return null;
  if (!shouldSend(`err:${fingerprint(diagnosis)}`)) return null;
  try {
    const response = await api.post("/diagnostics/client-error", payloadFor(diagnosis, extra), QUIET);
    return response?.data?.data?.error_ref || null;
  } catch {
    // Nothing left to do: we are already the error path. It stays in the
    // browser console, which is where a dropped telemetry write belongs.
    if (typeof console !== "undefined") {
      console.warn("Could not send error report to the server.", diagnosis);
    }
    return null;
  }
}

/**
 * The user's own "Report Issue" submission. Unlike telemetry this must surface
 * failures, because the person is waiting on an answer.
 */
export async function submitIssueReport({ note, feature, diagnosis, steps }) {
  const base = diagnosis || {};
  const response = await api.post("/diagnostics/report", {
    note,
    feature: feature || base.feature || "unknown",
    category: base.category,
    message: base.technical?.message || base.what,
    error_ref: base.errorRef || undefined,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    steps: steps || [],
    context: {
      what: base.what,
      reason: base.reason,
      online: base.technical?.online,
      viewport:
        typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
    },
  });
  return response.data;
}

// --- Admin dashboard --------------------------------------------------------

export async function fetchErrorSummary(days = 7) {
  const response = await api.get("/diagnostics/summary", { params: { days } });
  return response.data?.data;
}

export async function fetchErrorGroups(filters = {}) {
  const response = await api.get("/diagnostics/groups", { params: filters });
  return response.data?.data;
}

export async function fetchErrorEvents(filters = {}) {
  const response = await api.get("/diagnostics/events", { params: filters });
  return response.data?.data?.items || [];
}

export async function fetchErrorEvent(eventId) {
  const response = await api.get(`/diagnostics/events/${eventId}`);
  return response.data?.data;
}

export async function updateErrorStatus({ eventIds, fingerprint: fp, status }) {
  const response = await api.patch("/diagnostics/events/status", {
    event_ids: eventIds,
    fingerprint: fp,
    status,
  });
  return response.data?.data;
}

/**
 * Global capture: an uncaught throw or a rejected promise is still an error the
 * platform should know about, even when no component caught it.
 */
export function installGlobalErrorCapture({ onError }) {
  let lastGlobal = 0;

  const handle = (error, label) => {
    // A render crash repeats on every retry; one event per second is plenty.
    const now = Date.now();
    if (now - lastGlobal < 1000) return;
    lastGlobal = now;
    onError(error, label);
  };

  const onErrorEvent = (event) => {
    handle(event.error || new Error(event.message || "Uncaught script error"), "window.onerror");
  };
  const onRejection = (event) => {
    handle(event.reason || new Error("Unhandled promise rejection"), "unhandledrejection");
  };

  window.addEventListener("error", onErrorEvent);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onErrorEvent);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

/**
 * Connectivity is the one failure the server can never report for us — when it
 * is about to fire, the request is already going nowhere.
 */
export function installConnectivityCapture({ onChange }) {
  const emit = () => onChange(navigator.onLine !== false);
  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);
  return () => {
    window.removeEventListener("online", emit);
    window.removeEventListener("offline", emit);
  };
}
