/*
 * Turns whatever the browser threw at us into something a person can read.
 *
 * The backend already classifies its own failures and sends a diagnosis with
 * the response (see backend/app/utils/error_catalog.py); that verdict wins
 * whenever it is available, because the server knows what actually broke.
 * Everything here covers the cases the server never sees: a blocked
 * microphone, a denied location prompt, a dead connection, a crashed render.
 */

export const SEVERITY = {
  BLOCKING: "blocking",
  DEGRADED: "degraded",
  MINOR: "minor",
};

export const CATEGORY_LABELS = {
  network: "Network / connectivity",
  database: "Database",
  ai_provider: "AI service",
  auth: "Authentication",
  permission: "Permissions",
  upload: "File upload",
  voice: "Voice & speech",
  location: "Location services",
  notification: "Notifications",
  validation: "Input validation",
  rate_limit: "Rate limiting",
  not_found: "Missing resource",
  config: "Configuration",
  client: "Browser / device",
  internal: "Platform",
  unknown: "Unknown",
};

const CATEGORY_SEVERITY = {
  network: SEVERITY.BLOCKING,
  database: SEVERITY.BLOCKING,
  ai_provider: SEVERITY.DEGRADED,
  auth: SEVERITY.BLOCKING,
  permission: SEVERITY.MINOR,
  upload: SEVERITY.DEGRADED,
  voice: SEVERITY.DEGRADED,
  location: SEVERITY.DEGRADED,
  notification: SEVERITY.MINOR,
  validation: SEVERITY.MINOR,
  rate_limit: SEVERITY.DEGRADED,
  not_found: SEVERITY.MINOR,
  config: SEVERITY.BLOCKING,
  client: SEVERITY.DEGRADED,
  internal: SEVERITY.BLOCKING,
  unknown: SEVERITY.DEGRADED,
};

export const FEATURE_LABELS = {
  voice_capture: "Voice recording",
  speech_recognition: "Voice dictation",
  text_to_speech: "Reading text aloud",
  file_upload: "Attaching files",
  location: "Sharing your location",
  geocode: "Address lookup",
  map: "Map view",
  network: "Connection to the server",
  ai_chat: "AI assistant",
  grievance_submit: "Filing a grievance",
  grievance_list: "Viewing grievances",
  grievance_detail: "Viewing a grievance",
  incident_list: "Community incidents",
  report_issue: "Reporting a problem",
  auth: "Signing in",
  register: "Creating your account",
  password_reset: "Resetting your password",
  profile: "Your profile",
  notifications: "Notifications",
  push: "Push notification setup",
  rewards: "Civic rewards",
  analytics: "Analytics",
  admin_list: "Administration",
  page_render: "Loading this page",
  unknown: "CivicAI Nexus",
};

// The demo accounts this platform ships with are blocked from mutating requests
// by middleware, which answers 403 without a diagnosis of its own. Left to the
// status code that reads "your role is not permitted", which is false and
// pointless — so the real reason is attached here instead.
const DEMO_MODE_DIAGNOSIS = {
  category: "permission",
  severity: "minor",
  what: "This demo account cannot make changes.",
  reason: "Demo logins are read-only on purpose, so nothing you click alters real data.",
  solution: "Explore freely, or sign in with your own account to save changes.",
  retryable: false,
};

const STATUS_DIAGNOSES = {
  400: {
    category: "validation",
    what: "We could not process that request.",
    reason: "Something in the request was not in the form the server expected.",
    solution: "Check what you entered and try again.",
    retryable: true,
  },
  401: {
    category: "auth",
    what: "We need you to sign in again.",
    reason: "Your session is missing or no longer valid.",
    solution: "Sign in again to continue.",
    retryable: false,
  },
  403: {
    category: "permission",
    what: "You do not have access to this.",
    reason: "Your role is not permitted to perform this action.",
    solution: "If you believe this is wrong, ask an administrator to check your role.",
    retryable: false,
  },
  404: {
    category: "not_found",
    what: "We could not find that.",
    reason: "The record was deleted, or the link is out of date.",
    solution: "Go back and pick it from a list, or check the identifier you entered.",
    retryable: false,
  },
  409: {
    category: "validation",
    what: "That change conflicts with the current state.",
    reason: "Someone else modified this record first.",
    solution: "Refresh to load the latest version, then try again.",
    retryable: true,
  },
  413: {
    category: "upload",
    what: "That file is too big to attach.",
    reason: "The upload exceeds the size the server accepts.",
    solution: "Attach a smaller file, or use fewer attachments.",
    retryable: false,
  },
  422: {
    category: "validation",
    what: "Some details need correcting.",
    reason: "One or more fields did not pass validation.",
    solution: "Correct the highlighted field and try again.",
    retryable: false,
  },
  429: {
    category: "rate_limit",
    what: "Too many requests at once.",
    reason: "You have hit the per-minute limit for this action.",
    solution: "Wait a minute, then try again.",
    retryable: true,
  },
  500: {
    category: "internal",
    what: "Something broke on our side.",
    reason: "An unexpected error occurred while the server handled your request.",
    solution: "Try again once. If it fails again, please report the issue.",
    retryable: true,
  },
  502: {
    category: "network",
    what: "A service we depend on is not responding.",
    reason: "An upstream service returned an invalid response.",
    solution: "Try again in a minute.",
    retryable: true,
  },
  503: {
    category: "network",
    what: "The platform is briefly unavailable.",
    reason: "The server is down for maintenance or is still waking up.",
    solution: "Try again in a moment.",
    retryable: true,
  },
  504: {
    category: "network",
    what: "A service we depend on timed out.",
    reason: "The upstream service did not answer before the gateway gave up.",
    solution: "Try again in a minute.",
    retryable: true,
  },
};

// Phrases in a message that pin the subsystem, checked before the status code.
const MESSAGE_RULES = [
  {
    needle: "insufficient_quota",
    category: "ai_provider",
    what: "The AI assistant is out of available credit.",
    reason: "The platform's AI provider account has run out of quota.",
    solution: "You can still file and track grievances normally. Try the assistant again later.",
    retryable: false,
  },
  {
    needle: "permission denied to access microphone",
    category: "voice",
    what: "The microphone is blocked for this site.",
    reason: "You dismissed the permission prompt, or your browser blocks microphones here.",
    solution: "Allow microphone access in your browser's address bar, or type your message instead.",
    retryable: true,
  },
  {
    needle: "geolocation",
    category: "location",
    what: "We could not read your location.",
    reason: "Location access was denied or is unavailable on this device.",
    solution: "Allow location access, or search for your area and drop the pin on the map.",
    retryable: true,
  },
  {
    // Browsers report a dead connection as a plain TypeError ("Failed to
    // fetch") or a text mention of timing out, with no HTTP status to read.
    needle: "failed to fetch",
    category: "network",
    what: "The app could not reach its server.",
    reason: "The connection dropped, or the backend is not running.",
    solution: "Check your internet connection and try again.",
    retryable: true,
  },
  {
    needle: "timeout",
    category: "network",
    what: "The server took too long to respond.",
    reason: "The backend is slow, still starting up, or the connection dropped mid-request.",
    solution: "Try again in a few seconds. If it keeps happening, report the issue.",
    retryable: true,
  },
];

/*
 * Named browser error shapes. `match` runs against a DOMException name, a
 * SpeechRecognition error code, or a PositionError code — the three places the
 * web gives us a machine-readable reason instead of prose.
 */
const BROWSER_RULES = [
  {
    match: (e) => e?.name === "NotAllowedError" || e?.name === "SecurityError",
    category: "client",
    severity: SEVERITY.DEGRADED,
    what: "Your browser blocked that.",
    reason: "The page asked for a permission (microphone, camera, clipboard, notifications) and it was refused.",
    solution: "Click the permission icon in the address bar, allow it, then try again. You can keep going without it.",
    retryable: true,
  },
  {
    match: (e) => e?.name === "NotFoundError",
    category: "client",
    what: "No microphone or device was found.",
    reason: "The browser cannot see the device you asked for — it may be unplugged or in use.",
    solution: "Connect a microphone, close any app that has taken it, and try again.",
    retryable: true,
  },
  {
    match: (e) => e?.name === "NotReadableError" || e?.name === "AbortError",
    category: "voice",
    what: "The device could not deliver the recording.",
    reason: "Another application is using the microphone, or the recording was interrupted.",
    solution: "Close other apps that use the microphone and record again — or type your message.",
    retryable: true,
  },
  {
    match: (e) => e?.name === "OverconstrainedError",
    category: "client",
    what: "This device cannot meet the requested settings.",
    reason: "The page asked for an audio or video mode this hardware does not support.",
    solution: "Try again, or use the text input instead.",
    retryable: true,
  },
  {
    match: (e) => e?.name === "QuotaExceededError",
    category: "client",
    what: "This device is out of storage space.",
    reason: "The browser refused to save more data for this site.",
    solution: "Free up space, or clear old offline data for this site and try again.",
    retryable: false,
  },
  {
    match: (e) => e?.code === 1 && e?.PERMISSION_DENIED === 1,
    category: "location",
    what: "Location access is blocked.",
    reason: "You dismissed the location prompt, or your browser blocks location for this site.",
    solution: "Allow location access in the address bar, or search for your area and drop the pin.",
    retryable: true,
  },
  {
    match: (e) => e?.code === 2 && e?.POSITION_UNAVAILABLE === 2,
    category: "location",
    what: "Your location is unavailable right now.",
    reason: "GPS or Wi-Fi positioning could not get a fix indoors or with location services off.",
    solution: "Move near a window, turn on location services, or search for your area instead.",
    retryable: true,
  },
  {
    match: (e) => e?.code === 3 && e?.TIMEOUT === 3,
    category: "location",
    what: "Getting your location took too long.",
    reason: "The device had no clear signal in the time allowed.",
    solution: "Try again, or search for your area and drop the pin on the map.",
    retryable: true,
  },
];

const SPEECH_RULES = {
  "not-allowed": {
    what: "The microphone is blocked for this site.",
    reason: "Your browser refused voice input.",
    solution: "Allow microphone access, or tap the mic icon again and type your message instead.",
  },
  "service-not-allowed": {
    what: "Voice dictation is not available in this browser.",
    reason: "The browser's speech service is disabled by policy.",
    solution: "Type your message instead, or open the page in Chrome or Edge.",
  },
  "audio-capture": {
    what: "No microphone was found.",
    reason: "There is no audio input device available to the browser.",
    solution: "Connect a microphone, or type your message instead.",
  },
  "no-speech": {
    what: "No speech was detected.",
    reason: "The recording was silent, too quiet, or too short.",
    solution: "Move closer to the microphone and speak for a few seconds, or type instead.",
  },
  network: {
    what: "Voice dictation lost its connection.",
    reason: "The browser's speech service could not be reached.",
    solution: "Check your connection and try again, or type your message.",
  },
  aborted: {
    what: "The recording was stopped.",
    reason: "Something interrupted the capture before it finished.",
    solution: "Try recording again.",
  },
};

// Per-category wording, mirrored from the backend catalog. Used when a caller
// knows which subsystem failed but no message rule matches: an unrecognised
// failure still gets a specific sentence rather than "Something went wrong".
const CATEGORY_FALLBACK = {
  network: ["The app could not reach its servers.", "Your connection dropped, or the backend is not running.", "Check your internet connection, then try again.", true],
  database: ["Our data service did not respond.", "The database behind CivicAI Nexus is unavailable or overloaded.", "Try again in a moment. If it persists, report the issue.", true],
  ai_provider: ["The AI assistant is unavailable right now.", "Our AI provider rejected or timed out on the request.", "Try again shortly, or continue without the assistant — the grievance form always works.", true],
  auth: ["We could not verify who you are.", "Your credentials were missing, rejected, or have expired.", "Sign in again and retry.", false],
  permission: ["You do not have access to this.", "Your role is not allowed to perform this action.", "Ask an administrator to review your role if this looks wrong.", false],
  upload: ["The attachment did not upload.", "The file was rejected by the server.", "Check the file type and size, then attach it again.", true],
  voice: ["Voice input is unavailable right now.", "Recording or transcription failed on this device or server.", "Type your message instead — nothing else you entered has been lost.", true],
  location: ["We could not read your location.", "Location access was denied, timed out, or is unavailable here.", "Allow location access, or search for your area and drop the pin on the map.", true],
  notification: ["We could not deliver that notification.", "The device's notification subscription is no longer valid.", "Re-enable notifications from the notifications panel.", false],
  validation: ["Some details need correcting.", "The request did not pass the server's checks.", "Correct the highlighted field and try again.", false],
  rate_limit: ["Too many requests at once.", "A protective limit was reached.", "Wait a minute, then try again.", true],
  not_found: ["We could not find that.", "It may have been removed, or the link is out of date.", "Go back and choose it from a list.", false],
  config: ["This feature is not set up on this deployment.", "A required service credential is missing on the server.", "Report the issue so an administrator can configure it.", false],
  client: ["Your browser could not complete this.", "A browser capability or a local resource limit got in the way.", "Try again, or reload the page.", true],
  internal: ["Something broke on our side.", "An unexpected error occurred while handling your request.", "Try again once; if it fails again, please report the issue.", true],
};

// The last-resort wording. Deliberately still tells the user three things,
// rather than the bare "Something went wrong" this used to show.
const UNKNOWN_DIAGNOSIS = {
  category: "unknown",
  what: "Something went wrong.",
  reason: "We could not identify the cause from the information available.",
  solution: "Try again. If it keeps happening, report the issue with the details below.",
  retryable: true,
};

function fallbackFor(category) {
  const entry = CATEGORY_FALLBACK[category];
  if (!entry) return { ...UNKNOWN_DIAGNOSIS };
  return {
    category,
    what: entry[0],
    reason: entry[1],
    solution: entry[2],
    retryable: entry[3],
  };
}

const SECRET_PATTERNS = [
  [/([a-z][a-z0-9+.-]*):\/\/([^/\s:@]+):([^@\s]+)@/gi, "$1://$2:******@"],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._-]{8,}/gi, "$1 [redacted]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g, "[redacted-jwt]"],
  [/\bsk-[A-Za-z0-9_-]{10,}\b/g, "[redacted-key]"],
  [/\bgsk_[A-Za-z0-9_-]{10,}\b/g, "[redacted-key]"],
  [/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[redacted-key]"],
  [/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|secret[_-]?key|password|passwd|pwd|token|authorization|cookie)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;&]+)/gi, "$1: [redacted]"],
  [/\bx-api-key\s*[:=]\s*[^\s,;&]+/gi, "x-api-key: [redacted]"],
  // Third-party errors (Leaflet workers, storage layer) quote absolute paths;
  // a path tells an attacker where to look and identifies the machine.
  [/((?:[A-Za-z]:)?\/(?:home|Users|var|opt|root)\/)[^\s'"]*/g, "[path]"],
];

const MAX_TECHNICAL_CHARS = 500;

/*
 * Technical details are expandable but never raw: an axios message can carry a
 * full request URL, and a URL is where a leaked token would live.
 */
export function scrub(value) {
  if (value === null || value === undefined) return "";
  let text = typeof value === "string" ? value : String(value?.message ?? value);
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text.trim().slice(0, MAX_TECHNICAL_CHARS);
}

function isAxiosError(error) {
  return Boolean(error?.isAxiosError || error?.response || error?.request);
}

function serverDiagnosis(error) {
  const diagnosis = error?.response?.data?.error?.diagnosis;
  if (!diagnosis || !diagnosis.what) return null;
  return diagnosis;
}

function messageRuleHit(message) {
  const lowered = (message || "").toLowerCase();
  return MESSAGE_RULES.find((rule) => lowered.includes(rule.needle)) || null;
}

function browserRuleHit(error) {
  return BROWSER_RULES.find((rule) => {
    try {
      return rule.match(error);
    } catch {
      return false;
    }
  }) || null;
}

function describeOffline() {
  return {
    category: "network",
    what: "You appear to be offline.",
    reason: "This device has no network connection right now, so nothing reached the server.",
    solution: "Reconnect to Wi-Fi or mobile data. Anything you have typed is still on this page.",
    retryable: true,
  };
}

function describeUnreachable(error) {
  const timedOut = error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "");
  if (timedOut) {
    return {
      category: "network",
      what: "The server took too long to respond.",
      reason: "The backend is slow, still starting up, or the connection dropped mid-request.",
      solution: "Try again in a few seconds. If it keeps happening, report the issue.",
      retryable: true,
    };
  }
  return {
    category: "network",
    what: "The app could not reach its server.",
    reason:
      "The backend is not running, is blocked by a browser extension, or refused the connection.",
    solution: "Check your connection and try again. If you run this instance, confirm the backend service is up.",
    retryable: true,
  };
}

function fromAxios(error, feature, category) {
  const response = error?.response;
  if (!response) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return describeOffline();
    return describeUnreachable(error);
  }

  const status = response.status;
  if (response.data?.demo_mode === true) return { ...DEMO_MODE_DIAGNOSIS };
  const message =
    response.data?.error?.message ||
    (typeof response.data?.detail === "string" ? response.data.detail : "");

  const byMessage = messageRuleHit(message);
  if (byMessage) return byMessage;

  const byStatus = STATUS_DIAGNOSES[status];
  if (byStatus) {
    if (status === 422) {
      const details = response.data?.error?.details;
      const field = Array.isArray(details) && details[0]?.field ? details[0].field : null;
      return {
        ...byStatus,
        reason: field ? `The "${field}" field was not accepted.` : byStatus.reason,
        solution: field
          ? `Correct "${field}" and submit again.`
          : byStatus.solution,
      };
    }
    return byStatus;
  }

  if (status >= 500) return { ...STATUS_DIAGNOSES[500] };
  // An unmapped status code still shouldn't read as "Something went wrong" when
  // the call site told us which subsystem was involved.
  return category && category !== "unknown"
    ? { ...fallbackFor(category), technicalStatus: status }
    : { ...UNKNOWN_DIAGNOSIS, technicalStatus: status };
}

/**
 * The one entry point. Accepts an axios error, a DOMException, a PositionError,
 * a SpeechRecognition event, a plain Error, or nothing at all, and always
 * returns a complete diagnosis object.
 */
/*
 * Which feature a failing request belonged to, read off its URL. Mirrors
 * feature_for_path() on the server so both halves of the platform name the same
 * feature for the same failure. This is what lets a call site stay a one-liner.
 */
const URL_FEATURES = [
  [/\/auth\/(login|social)/i, "auth"],
  [/\/auth\/(register|verify-otp)/i, "register"],
  [/\/auth\/(forgot|reset)/i, "password_reset"],
  [/\/auth\//i, "auth"],
  [/\/ai\/voice/i, "voice_capture"],
  [/\/ai\//i, "ai_chat"],
  [/\/uploads?/i, "file_upload"],
  // Before the id-shaped rule below: the server files integrity under the
  // grievance list, and a differing key splits one failure across two rows.
  [/\/grievances\/integrity/i, "grievance_list"],
  [/\/grievances\/[^/]+$/i, "grievance_detail"],
  [/\/grievances/i, "grievance_list"],
  [/\/incidents/i, "incident_list"],
  [/\/notifications/i, "notifications"],
  [/\/push/i, "push"],
  [/\/rewards/i, "rewards"],
  [/\/analytics|\/sla/i, "analytics"],
  [/\/users\/me/i, "profile"],
  [/\/departments|\/officers|\/admin|\/users/i, "admin_list"],
];

export function featureFromUrl(url) {
  if (!url) return null;
  for (const [pattern, feature] of URL_FEATURES) {
    if (pattern.test(url)) return feature;
  }
  return null;
}

export function diagnose(error, options = {}) {
  const featureKey =
    options.feature || featureFromUrl(error?.config?.url) || "unknown";
  const featureLabel = FEATURE_LABELS[featureKey] || FEATURE_LABELS.unknown;

  let base;

  const fromServer = isAxiosError(error) ? serverDiagnosis(error) : null;
  if (fromServer) {
    // The server already knows what broke; trust its words and its redaction.
    base = {
      category: fromServer.category,
      severity: fromServer.severity,
      what: fromServer.what,
      reason: fromServer.reason,
      solution: fromServer.solution,
      retryable: fromServer.retryable,
      errorRef: fromServer.error_ref || null,
      technical: fromServer.technical || {},
    };
  } else {
    const browserRule = error ? browserRuleHit(error) : null;
    const speechRule =
      options.speechError && SPEECH_RULES[options.speechError]
        ? { ...SPEECH_RULES[options.speechError], category: "voice", severity: SEVERITY.DEGRADED, retryable: true }
        : null;

    if (speechRule) {
      base = speechRule;
    } else if (browserRule) {
      base = {
        category: browserRule.category,
        severity: browserRule.severity,
        what: browserRule.what,
        reason: browserRule.reason,
        solution: browserRule.solution,
        retryable: browserRule.retryable,
      };
    } else if (isAxiosError(error)) {
      base = fromAxios(error, featureKey, options.category);
    } else {
      const message = error?.message || options.message || "";
      const byMessage = messageRuleHit(message);
      // No message matched: fall back on whatever the caller knows about the
      // subsystem, so the sentence is still specific to voice, uploads, etc.
      base = byMessage || fallbackFor(options.category);
    }
  }

  const category = options.category || base.category || "unknown";
  const technical = {
    ...(base.technical || {}),
    ...(options.technical || {}),
  };
  if (error) {
    if (error.name && !technical.name) technical.name = error.name;
    if (error.message) technical.message = scrub(error.message);
    if (error.code !== undefined && technical.code === undefined) technical.code = error.code;
    if (error.status && !technical.status) technical.status = error.status;
  }
  if (options.detail && !technical.message) technical.message = scrub(options.detail);
  if (typeof window !== "undefined" && window.location) technical.url = window.location.pathname;
  technical.online = typeof navigator === "undefined" ? true : navigator.onLine !== false;

  // Scrub every string: a technical block is user-visible once expanded.
  for (const key of Object.keys(technical)) {
    if (typeof technical[key] === "string") technical[key] = scrub(technical[key]);
    else if (technical[key] === undefined) delete technical[key];
  }

  return {
    category,
    categoryLabel: CATEGORY_LABELS[category] || CATEGORY_LABELS.unknown,
    severity: base.severity || CATEGORY_SEVERITY[category] || SEVERITY.DEGRADED,
    feature: featureKey,
    featureLabel,
    what: base.what,
    reason: base.reason,
    solution: base.solution,
    retryable: base.retryable !== false,
    errorRef: base.errorRef || options.errorRef || null,
    technical,
  };
}

/**
 * Stable identity for one distinct failure, so repeat occurrences can be
 * counted instead of each one being reported separately.
 */
export function fingerprint(diagnosis) {
  const basis = [
    diagnosis.category,
    diagnosis.feature,
    diagnosis.technical?.status ?? "",
    diagnosis.technical?.name ?? "",
    (diagnosis.technical?.message || "").replace(/\d+/g, "#").slice(0, 160),
  ].join("|");

  let hash = 0;
  for (let i = 0; i < basis.length; i += 1) {
    hash = (hash * 31 + basis.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export default diagnose;
