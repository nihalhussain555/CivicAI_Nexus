"""Turns a raw failure into something a citizen can act on.

Every error the platform shows is built here: which subsystem broke, which
feature the user was using, what likely caused it, and what to do next. The
same classification feeds the stored error events, so the admin dashboard and
the user's screen always agree about what went wrong.
"""

import hashlib
import re

# --- Categories -------------------------------------------------------------
# Kept as an ordered list of (name, detector, template) rather than one giant
# if/elif so a new integration only needs a row here.

CATEGORY_LABELS = {
    "network": "Network / connectivity",
    "database": "Database",
    "ai_provider": "AI service",
    "auth": "Authentication",
    "permission": "Permissions",
    "upload": "File upload",
    "voice": "Voice & speech",
    "location": "Location services",
    "notification": "Notifications",
    "validation": "Input validation",
    "rate_limit": "Rate limiting",
    "not_found": "Missing resource",
    "config": "Configuration",
    "client": "Browser / device",
    "internal": "Platform",
    "unknown": "Unknown",
}

# severity -> UI treatment in the frontend (see utils/errorDiagnosis.js)
CATEGORY_SEVERITY = {
    "network": "blocking",
    "database": "blocking",
    "ai_provider": "degraded",
    "auth": "blocking",
    "permission": "minor",
    "upload": "degraded",
    "voice": "degraded",
    "location": "degraded",
    "notification": "minor",
    "validation": "minor",
    "rate_limit": "degraded",
    "not_found": "minor",
    "config": "blocking",
    "client": "degraded",
    "internal": "blocking",
    "unknown": "degraded",
}

# Buckets that carry no subsystem information, so a message rule is allowed to
# refine them into a real category.
GENERIC_CATEGORIES = ("internal", "unknown", "client")

# Categories that mean a piece of the platform broke, as opposed to the user
# sending something the platform legitimately rejected.
SUBSYSTEM_CATEGORIES = (
    "database", "ai_provider", "network", "upload", "voice",
    "location", "notification", "config", "internal", "client",
)

# 401/403 wording that signals a broken session rather than a wrong password.
SESSION_MESSAGE_MARKERS = (
    "token", "expired", "not authenticated", "deactivated", "session",
)

# (category, needle) -> diagnosis. Needles are matched against the lowercased
# raw message, most specific first. `retryable` is a recommendation, not a
# guarantee: a retried request is always safe here because every affected
# handler is either a read or idempotent.
MESSAGE_RULES = [
    # --- database ---
    ("database", "serverselectiontimeout", "Our servers are busy and the database did not answer in time.",
     "The database behind CivicAI Nexus is unreachable or still starting up.",
     "Wait about 30 seconds and try again. If it keeps happening, the platform is likely having an outage.",
     True),
    ("database", "authentication failed", "Our servers could not verify their database credentials.",
     "The database login on the server is misconfigured or its password expired.",
     "This needs an administrator — report the issue and we will pick it up from the error log.",
     False),
    ("database", "tls", "A secure connection to our database could not be established.",
     "The certificate or network path between the app and the database was rejected.",
     "Try again in a minute. If it persists, report the issue.",
     True),
    ("database", "not primary", "Our database briefly changed roles and refused the write.",
     "A replication failover was in progress when the request arrived.",
     "Try again — the new primary should accept it now.",
     True),
    ("database", "writeconflict", "Two changes to the same record collided.",
     "Someone else updated this record while you were working on it.",
     "Reload the page to pick up the newest version, then try again.",
     True),
    # --- ai provider ---
    ("ai_provider", "insufficient_quota", "The AI assistant is out of available credit.",
     "The platform's AI provider account has run out of quota.",
     "You can still file and track grievances normally. Try the assistant again later, or report the issue.",
     False),
    ("ai_provider", "rate limit", "The AI assistant is receiving too many requests right now.",
     "The AI provider is throttling our account.",
     "Wait a minute and try again.",
     True),
    ("ai_provider", "content_filter", "The assistant declined to process that request.",
     "The provider's safety filters matched something in the text.",
     "Rephrase your message, or file the grievance using the written form instead.",
     False),
    ("ai_provider", "invalid_api_key", "The AI assistant is not configured correctly.",
     "The API key the platform uses for its AI provider was rejected.",
     "This needs an administrator. Use the written grievance form meanwhile, and report the issue.",
     False),
    ("ai_provider", "model", "The AI assistant could not reach its language model.",
     "The requested model is unavailable or was renamed on the provider side.",
     "Try again shortly. If it persists, file your grievance using the form.",
     True),
    ("ai_provider", "connection", "The AI assistant could not reach its provider.",
     "The network path between our server and the AI provider failed.",
     "Try again in a moment.",
     True),
    # --- upload ---
    ("upload", "too large", "That file is too big to attach.",
     "The file exceeds the maximum attachment size the server accepts.",
     "Use a smaller or more compressed image, or attach fewer files.",
     False),
    ("upload", "unsupported media type", "That file type cannot be attached.",
     "The file is not one of the accepted image or audio formats.",
     "Attach a JPEG, PNG, WebP image, or an M4A/WEBM/WAV recording.",
     False),
    ("upload", "empty", "The uploaded file arrived empty.",
     "The read was interrupted before the whole file reached us.",
     "Re-attach the file and try again.",
     True),
    # --- voice ---
    ("voice", "no speech", "No speech was detected in that recording.",
     "The recording was silent, too quiet, or too short to transcribe.",
     "Move closer to the microphone and record a few seconds of clear speech, or type your message instead.",
     True),
    ("voice", "audio", "The recording could not be turned into text.",
     "The audio format was not accepted, or the speech service is unavailable.",
     "Try recording again, or type your message instead — nothing you said has been lost.",
     True),
    # --- auth ---
    ("auth", "invalid email or password", "We could not sign you in.",
     "The email address and password do not match an account.",
     "Re-check your email address, or use the forgotten-password link.",
     False),
    ("auth", "expired", "Your session has ended.",
     "You have been signed out for security after a period of inactivity.",
     "Sign in again to continue. Your unsaved draft may still be on this page.",
     False),
    ("auth", "not authenticated", "We need you to sign in again.",
     "The request reached us without valid credentials.",
     "Sign in and try again.",
     False),
    ("auth", "deactivated", "This account has been deactivated.",
     "An administrator disabled this account.",
     "Contact the platform administrator to ask why and request reinstatement.",
     False),
    # --- notification / push ---
    ("notification", "expired subscription", "Push notifications are no longer reaching this device.",
     "The browser invalidated the stored subscription, usually after you cleared site data.",
     "Turn notifications back on from the notifications panel.",
     False),
    # --- config ---
    ("config", "not configured", "A required service is not set up on this deployment.",
     "The server is missing an environment variable that this feature needs.",
     "Report the issue — an administrator needs to set the missing value.",
     False),
    # --- network ---
    ("network", "timed out", "The server took too long to answer.",
     "The backend is slow, cold-starting, or the connection dropped mid-request.",
     "Check your connection and try again.",
     True),
    ("network", "connection refused", "The app could not reach its server.",
     "The backend is not running, or its address is wrong.",
     "Try again in a moment. If you run this instance yourself, confirm the backend service is up.",
     True),
]

STATUS_RULES = {
    400: ("validation", "We could not process that request.",
          "Something in the request was not in the form the server expected.",
          "Check what you entered and try again.", True),
    401: ("auth", "We need you to sign in again.",
          "Your session is missing or no longer valid.",
          "Sign in again to continue.", False),
    403: ("permission", "You do not have access to this.",
          "Your role is not permitted to perform this action.",
          "If you believe this is wrong, ask an administrator to check your role.", False),
    404: ("not_found", "We could not find that.",
          "The record was deleted, or the link is out of date.",
          "Go back and pick it from a list, or check the identifier you entered.", False),
    409: ("validation", "That change conflicts with the current state.",
          "Someone else modified this record first.",
          "Refresh to load the latest version, then try again.", True),
    413: ("upload", "That file is too big to attach.",
          "The upload exceeds the size the server accepts.",
          "Attach a smaller file.", False),
    422: ("validation", "Some details need correcting.",
          "One or more fields did not pass validation.",
          "Correct the highlighted field and try again.", False),
    429: ("rate_limit", "Too many requests at once.",
          "You have hit the per-minute limit for this action.",
          "Wait a minute, then try again.", True),
    500: ("internal", "Something broke on our side.",
          "An unexpected error occurred while the server handled your request.",
          "Try again once. If it fails again, please report the issue so we can fix it.", True),
    502: ("network", "A service we depend on is not responding.",
          "An upstream service returned an invalid response.",
          "Try again in a minute.", True),
    503: ("network", "The platform is briefly unavailable.",
          "The server is down for maintenance or is warming up.",
          "Try again in a moment.", True),
    504: ("network", "A service we depend on timed out.",
          "The upstream service did not answer before the gateway gave up.",
          "Try again in a minute.", True),
}

# Path segment -> the feature name shown to the user. Order matters: the
# longest matching prefix wins.
# (path prefix, feature key, label). The keys are deliberately the same
# vocabulary the browser uses in src/utils/errorDiagnosis.js: a failure the
# client also saw must land on one dashboard row, not two, so both halves have
# to name the feature identically. Order matters — longest prefix first.
FEATURE_ROUTES = [
    ("/api/auth", "auth", "Signing in and account access"),
    ("/api/grievances/integrity", "grievance_list", "Integrity review"),
    ("/api/grievances", "grievance_list", "Filing and tracking grievances"),
    ("/api/ai/voice", "voice_capture", "Voice transcription"),
    ("/api/ai", "ai_chat", "AI assistant"),
    ("/api/uploads", "file_upload", "File upload"),
    ("/api/incidents", "incident_list", "Community incidents"),
    ("/api/notifications", "notifications", "Notifications"),
    ("/api/push", "push", "Push notification setup"),
    ("/api/rewards", "rewards", "Civic rewards"),
    ("/api/sla", "analytics", "SLA monitoring"),
    ("/api/analytics", "analytics", "Analytics"),
    ("/api/departments", "admin_list", "Department directory"),
    ("/api/officers", "admin_list", "Officer assignments"),
    ("/api/admin", "admin_list", "Administration"),
    # Before the bare /api/users entry: your own record is the profile feature,
    # while the collection behind it is an administration screen.
    ("/api/users/me", "profile", "Your profile"),
    ("/api/users", "admin_list", "User directory"),
    ("/health", "unknown", "Platform health check"),
]

CLIENT_FEATURE_LABELS = {
    "voice_capture": "Voice recording",
    "speech_recognition": "Voice dictation",
    "text_to_speech": "Reading text aloud",
    "file_upload": "Attaching files",
    "location": "Sharing your location",
    "geocode": "Address lookup",
    "map": "Map view",
    "network": "Connection to the server",
    "ai_chat": "AI assistant",
    "grievance_submit": "Filing a grievance",
    "grievance_list": "Viewing grievances",
    "grievance_detail": "Viewing a grievance",
    "incident_list": "Community incidents",
    "report_issue": "Reporting a problem",
    "auth": "Signing in",
    "register": "Creating your account",
    "password_reset": "Resetting your password",
    "profile": "Your profile",
    "notifications": "Notifications",
    "push": "Push notification setup",
    "rewards": "Civic rewards",
    "analytics": "Analytics",
    "admin_list": "Administration",
    "page_render": "Loading this page",
    "unknown": "CivicAI Nexus",
}

# Exception class names (unqualified) that identify a subsystem regardless of
# the message text.
CLASS_HINTS = {
    "ServerSelectionTimeoutError": "database",
    "ConnectionFailure": "database",
    "AutoReconnect": "database",
    "ExecutionTimeout": "database",
    "OperationFailure": "database",
    "WriteConflict": "database",
    "ConfigurationError": "database",
    "PyMongoError": "database",
    "DatabaseError": "database",
    "AuthenticationError": "auth",
    "ExpiredSignatureError": "auth",
    "InvalidTokenError": "auth",
    "JWTError": "auth",
    "ConnectionError": "network",
    "ConnectionResetError": "network",
    "TimeoutError": "network",
    "ReadTimeout": "network",
    "ConnectTimeout": "network",
    "ChunkedEncodingError": "network",
    "SSLError": "network",
    "MaxRetryError": "network",
    "OpenAIError": "ai_provider",
    "APIConnectionError": "ai_provider",
    "APIStatusError": "ai_provider",
    "APIError": "ai_provider",
    "RateLimitError": "ai_provider",
    "BadRequestError": "ai_provider",
    "InternalServerError": "ai_provider",
    "APIUnavailableError": "ai_provider",
    "GenerationError": "ai_provider",
    "ClientError": "ai_provider",
    "WebPushException": "notification",
}

# Message needles that force a subsystem, checked before generic rules.
CLASS_MESSAGE_HINTS = [
    ("pymongo", "database"),
    ("mongodb", "database"),
    ("serverselection", "database"),
    ("openai", "ai_provider"),
    ("groq", "ai_provider"),
    ("generativelanguage", "ai_provider"),
    ("gemini", "ai_provider"),
    ("litellm", "ai_provider"),
    ("resend", "notification"),
    ("webpush", "notification"),
    ("geopy", "location"),
]


def feature_for_path(path, method="GET"):
    """Which user-facing feature was in use, from the request path."""
    if not path:
        return "unknown"
    normalized = path if path.startswith("/") else f"/{path}"
    for prefix, key, _label in FEATURE_ROUTES:
        if normalized.startswith(prefix):
            if key == "grievance_list" and method in ("POST", "PUT", "PATCH") and normalized.rstrip("/") == "/api/grievances":
                return "grievance_submit"
            # /api/grievances/<id> is one case on screen, not the list — the
            # browser names it the same way, and a differing key here would
            # split one failure across two dashboard rows.
            if key == "grievance_list" and normalized.rstrip("/").startswith("/api/grievances/"):
                tail = normalized.rstrip("/")[len("/api/grievances/"):].split("/")
                if tail and tail[0] != "integrity":
                    return "grievance_detail"
            return key
    return "unknown"


def feature_label(path, method="GET"):
    key = feature_for_path(path, method)
    if key in CLIENT_FEATURE_LABELS:
        return CLIENT_FEATURE_LABELS[key]
    for _prefix, route_key, label in FEATURE_ROUTES:
        if key == route_key:
            return label
    return "CivicAI Nexus"


# --- Redaction --------------------------------------------------------------
# Technical details are genuinely useful for debugging, and raw driver/SDK
# exceptions are where credentials show up: a Mongo server-selection error
# quotes the full URI including its password, and an OpenAI auth error quotes
# the key. So details are scrubbed before they are stored or displayed.

_SECRET_PATTERNS = [
    # scheme://user:password@host — credentials in any URI
    (re.compile(r"(?P<scheme>[a-z][a-z0-9+.\-]*)://(?P<user>[^\s:@/]+)(?::(?P<secret>[^\s@/]+))?@"),
     lambda m: f"{m.group('scheme')}://{m.group('user')}:******@"),
    # Authorization: Bearer <token>
    (re.compile(r"(?i)\b(authorization\s*[:=]\s*(?:bearer|basic)\s+)[^\s,;]+"),
     lambda m: f"{m.group(1)}[redacted]"),
    (re.compile(r"(?i)\b(bearer\s+)[a-z0-9._\-]{8,}"),
     lambda m: f"{m.group(1)}[redacted]"),
    # JSON Web Tokens
    (re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\b"),
     lambda m: "[redacted-jwt]"),
    # Well-known provider key shapes
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{10,}\b"), lambda m: "[redacted-key]"),
    (re.compile(r"\bgsk_[A-Za-z0-9_\-]{10,}\b"), lambda m: "[redacted-key]"),
    (re.compile(r"\bAIza[0-9A-Za-z_\-]{20,}\b"), lambda m: "[redacted-key]"),
    (re.compile(r"\bx-api-key\s*[:=]\s*[^\s,;]+", re.I), lambda m: "x-api-key: [redacted]"),
    # key=value for anything that smells like a credential
    (re.compile(
        r"(?i)\b(api[_\-]?key|apikey|access[_\-]?token|refresh[_\-]?token|secret[_\-]?key|"
        r"client[_\-]?secret|password|passwd|pwd|token|authorization|cookie|vapid[_\-]?private[_\-]?key)"
        r"(\s*[:=]\s*)(&quot;|\"|')?([^\s,;'\"]+)(&quot;|\"|')?"
     ), lambda m: f"{m.group(1)}{m.group(2)}[redacted]"),
    # Bare host:port with embedded credentials is covered above; drop file paths
    # that leak usernames and internal layout. No leading \b here — the char in
    # front of "/" is usually a space, which is a non-word character, so a word
    # boundary would make this pattern never match at all.
    (re.compile(r"(?i)((?:[A-Za-z]:)?/(?:home|Users|var|opt|root)/)[^\s'\"]*"),
     lambda m: "[path]"),
]

MAX_MESSAGE_CHARS = 500


def redact(text):
    """Strip credentials and host paths from anything that may be shown or stored."""
    if text is None:
        return ""
    value = str(text)
    for pattern, replacer in _SECRET_PATTERNS:
        value = pattern.sub(replacer, value)
    return value.strip()[:MAX_MESSAGE_CHARS]


def _match_category(category, message, exc, status_code):
    if category:
        return category
    lowered = (message or "").lower()
    for needle, forced in CLASS_MESSAGE_HINTS:
        if needle in lowered:
            return forced
    # Specific message rules win over the status code: a 500 whose text says
    # "insufficient_quota" is an AI-provider outage, not a platform bug, and
    # the citizen needs the first answer.
    for cat, needle, *_ in MESSAGE_RULES:
        if needle in lowered:
            return cat
    if status_code in STATUS_RULES:
        return STATUS_RULES[status_code][0]
    if status_code and status_code >= 500:
        return "internal"
    if exc is None and not message:
        return "unknown"
    return None


def _rule_for(category, message):
    lowered = (message or "").lower()
    for cat, needle, what, reason, solution, retryable in MESSAGE_RULES:
        if cat == category and needle in lowered:
            return what, reason, solution, retryable
    return None


def _rule_for_any(message):
    """Find a message rule regardless of category, so an explicit category does
    not lose a more specific explanation."""
    lowered = (message or "").lower()
    for cat, needle, what, reason, solution, retryable in MESSAGE_RULES:
        if needle in lowered:
            return cat, (what, reason, solution, retryable)
    return None, None


def build_diagnosis(exc=None, status_code=None, message=None, category=None,
                    path=None, method="GET", feature=None, technical=None):
    """Build the user-facing diagnosis plus redacted technical detail."""
    raw_message = message or (str(exc) if exc is not None else "")
    clean_message = redact(raw_message)

    if category is None and exc is not None:
        category = CLASS_HINTS.get(type(exc).__name__)

    resolved = _match_category(category, clean_message, exc, status_code) or "unknown"

    rule = _rule_for(resolved, clean_message)
    if rule is None and resolved in GENERIC_CATEGORIES:
        # A generic bucket (bare 500, unknown subsystem) can still hide a more
        # specific message rule — "insufficient_quota" inside a 500. Subsystems
        # already pinned by a caller must not be reassigned by a stray word in
        # the message.
        alt_category, alt_rule = _rule_for_any(clean_message)
        if alt_rule is not None:
            resolved, rule = alt_category, alt_rule
    if rule is None and status_code in STATUS_RULES:
        _, what, reason, solution, retryable = STATUS_RULES[status_code]
        rule = (what, reason, solution, retryable)
    if rule is None:
        rule = _fallback_text(resolved)
    what, reason, solution, retryable = rule

    feature_key = feature or feature_for_path(path, method)
    feature_name = (CLIENT_FEATURE_LABELS.get(feature_key)
                    or feature_label(path, method)
                    or "CivicAI Nexus")

    details = dict(technical or {})
    details.setdefault("status", status_code)
    details.setdefault("path", path)
    details.setdefault("method", method)
    if exc is not None:
        details["exception"] = type(exc).__name__
    if clean_message:
        details["message"] = clean_message
    details = {k: (redact(v) if isinstance(v, str) else v)
               for k, v in details.items() if v not in (None, "", [])}

    return {
        "category": resolved,
        "category_label": CATEGORY_LABELS.get(resolved, "Unknown"),
        "severity": CATEGORY_SEVERITY.get(resolved, "degraded"),
        "feature": feature_key,
        "feature_label": feature_name,
        "what": what,
        "reason": reason,
        "solution": solution,
        "retryable": bool(retryable),
        "technical": details,
    }


def _fallback_text(category):
    generic = {
        "network": ("The app could not reach its servers.",
                    "Your connection dropped, or the backend is not running.",
                    "Check your internet connection, then try again.", True),
        "database": ("Our data service did not respond.",
                     "The database behind CivicAI Nexus is unavailable or overloaded.",
                     "Try again in a moment. If it persists, report the issue.", True),
        "ai_provider": ("The AI assistant is unavailable right now.",
                        "Our AI provider rejected or timed out on the request.",
                        "Try again shortly, or continue without the assistant — the grievance form always works.", True),
        "auth": ("We could not verify who you are.",
                 "Your credentials were missing, rejected, or have expired.",
                 "Sign in again and retry.", False),
        "permission": ("You do not have access to this.",
                       "Your role is not allowed to perform this action.",
                       "Ask an administrator to review your role if this looks wrong.", False),
        "upload": ("The attachment did not upload.",
                   "The file was rejected by the server.",
                   "Check the file type and size, then attach it again.", True),
        "voice": ("Voice input is unavailable right now.",
                  "Recording or transcription failed on this device or server.",
                  "Type your message instead — nothing else you entered has been lost.", True),
        "location": ("We could not read your location.",
                     "Location access was denied, timed out, or is unavailable here.",
                     "Allow location access, or search for your area and drop the pin on the map.", True),
        "notification": ("We could not deliver that notification.",
                         "The device's notification subscription is no longer valid.",
                         "Re-enable notifications from the notifications panel.", False),
        "validation": ("Some details need correcting.",
                       "The request did not pass the server's checks.",
                       "Correct the highlighted field and try again.", False),
        "rate_limit": ("Too many requests at once.",
                       "A protective limit was reached.",
                       "Wait a minute, then try again.", True),
        "not_found": ("We could not find that.",
                      "It may have been removed, or the link is out of date.",
                      "Go back and choose it from a list.", False),
        "config": ("This feature is not set up on this deployment.",
                   "A required service credential is missing on the server.",
                   "Report the issue so an administrator can configure it.", False),
        "client": ("Your browser could not complete this.",
                   "A browser capability or a local resource limit got in the way.",
                   "Try again, or reload the page.", True),
        "internal": ("Something broke on our side.",
                     "An unexpected error occurred while handling your request.",
                     "Try again once; if it fails again, please report the issue.", True),
        "unknown": ("Something went wrong.",
                    "We could not identify the cause from the information available.",
                    "Try again. If it keeps happening, report the issue with the details below.", True),
    }
    return generic.get(category, generic["unknown"])


def default_fingerprint(diagnosis, message=None):
    """Groups repeat failures so the dashboard can show an occurrence count
    instead of one row per request."""
    technical = diagnosis.get("technical") or {}
    basis = "|".join([
        str(diagnosis.get("category") or ""),
        str(diagnosis.get("feature") or ""),
        str(technical.get("status") or ""),
        str(technical.get("exception") or ""),
        re.sub(r"\d+", "#", redact(message or technical.get("message") or ""))[:160],
    ])
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:24]
