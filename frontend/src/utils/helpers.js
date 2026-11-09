// Any timestamp string with no timezone marker (no "Z", no "+HH:MM") is
// ambiguous — `new Date(...)` silently treats it as the browser's local
// time instead of UTC, which is exactly what made timestamps across the
// app look wrong. The backend now always attaches "Z" explicitly, but
// this stays as a defensive second layer for any response that might not
// go through that path.
const toSafeDate = (value) => {
  if (typeof value === "string" && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return new Date(`${value}Z`);
  }
  return new Date(value);
};

export const formatDate = (value) => {
  if (!value) return "—";
  const date = toSafeDate(value);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = toSafeDate(value);
  return date.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export const formatRelative = (value) => {
  if (!value) return "—";
  const date = toSafeDate(value);
  const diffMs = date.getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (Math.abs(diffHours) < 1) return "just now";
  if (Math.abs(diffHours) < 24) {
    return diffHours < 0 ? `${Math.abs(diffHours)}h ago` : `in ${diffHours}h`;
  }
  const diffDays = Math.round(diffHours / 24);
  return diffDays < 0 ? `${Math.abs(diffDays)}d ago` : `in ${diffDays}d`;
};

export const titleCase = (value) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const getErrorMessage = (error) => {
  const data = error?.response?.data;

  // Our API's normal error envelope: { error: { code, message, details? } }.
  if (data?.error?.message) {
    return data.error.message;
  }

  // FastAPI 422 validation errors put an array of objects under `detail`.
  // Returning that array raw lets a toast try to render objects (a React
  // crash). Flatten it to readable field messages instead.
  const detail = data?.detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    const field = Array.isArray(first?.loc) ? first.loc.slice(1).join(".") : "";
    const msg = typeof first?.msg === "string" ? first.msg : "";
    const human = msg.replace(/^Value error,\s*/i, "");
    return field && human ? `${field}: ${human}` : human || "Validation failed.";
  }
  if (typeof detail === "string" && detail) {
    return detail;
  }

  // Network errors (timeout / connection refused) have no response — say so
  // explicitly so the user knows the backend was unreachable, not "wrong password".
  if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
    return "The server took too long to respond. It may be waking up — please try again.";
  }
  if (error?.message === "Network Error") {
    return "Cannot reach the server. Check your connection or that the backend is running.";
  }

  return error?.message || "Something went wrong. Please try again.";
};

// API and AI providers can return a value in a different shape while a request
// is in progress or when a provider falls back. Never pass those values straight
// to React: objects are not valid React children and would otherwise crash a page.
export const toDisplayText = (value, fallback = "Not available") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    const text = value.map((item) => toDisplayText(item, "")).filter(Boolean).join("\n");
    return text || fallback;
  }

  if (typeof value === "object") {
    const preferredText = value.description ?? value.summary ?? value.text ?? value.content ?? value.message;
    if (preferredText !== undefined) return toDisplayText(preferredText, fallback);
    try {
      return JSON.stringify(value) || fallback;
    } catch {
      return fallback;
    }
  }

  return fallback;
};