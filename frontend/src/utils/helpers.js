export const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export const formatRelative = (value) => {
  if (!value) return "—";
  const date = new Date(value);
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
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.detail ||
    error?.message ||
    "Something went wrong. Please try again."
  );
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
