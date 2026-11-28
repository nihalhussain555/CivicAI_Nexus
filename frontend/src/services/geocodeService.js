import { DISTRICTS } from "../utils/constants";

/**
 * Reverse geocoding via OpenStreetMap's free Nominatim API — converts
 * GPS coordinates into a human-readable place name. No API key required.
 * Same OpenStreetMap data source already used for the Leaflet map tiles
 * elsewhere in this app, so no new provider/account is introduced.
 *
 * Usage note: Nominatim's public instance is rate-limited (~1 req/sec) and
 * intended for light use — fine for this app's "use my current location"
 * button and map-pin dragging, which are occasional, user-triggered
 * actions, not bulk lookups.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/*
 * One lookup can fail for four unrelated reasons — the device is offline, the
 * provider is down, the request stalled, or the coordinates simply have no
 * address mapped to them. Only the first three are platform failures, so each
 * carries a `code` the caller branches on instead of a shared `null`.
 */
export const GEOCODE_CODES = {
  offline: "offline",
  unreachable: "unreachable",
  timeout: "timeout",
  provider: "provider",
  no_address: "no_address",
};

export class GeocodeError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "GeocodeError";
    this.code = code;
    if (detail) this.detail = String(detail).slice(0, 200);
  }
}

/** Whether a lookup failure is worth a diagnostics row (a real outage) or is
 * the citizen's own situation (no connection, or an unaddressed pin). */
export const isGeocodePlatformFailure = (error) =>
  error?.code === GEOCODE_CODES.unreachable ||
  error?.code === GEOCODE_CODES.timeout ||
  error?.code === GEOCODE_CODES.provider;

// Nominatim's public instance can stall rather than fail. A stalled geocoder
// is worse than a failed one — the pin just never appears — so every call is
// abandoned after a few seconds and the caller falls back to manual placement.
const withTimeout = (url, options = {}, ms = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const describeStatus = (status) => {
  if (status === 404)
    return new GeocodeError(
      GEOCODE_CODES.no_address,
      "Nothing is mapped to those coordinates, so there is no address to show.",
    );
  if (status === 403)
    return new GeocodeError(
      GEOCODE_CODES.provider,
      "The address provider refused the lookup — its public service is blocking this browser.",
      `HTTP ${status}`,
    );
  if (status === 429)
    return new GeocodeError(
      GEOCODE_CODES.provider,
      "The address provider is rate-limiting lookups right now.",
      `HTTP ${status}`,
    );
  if (status >= 500)
    return new GeocodeError(
      GEOCODE_CODES.provider,
      "The address provider (OpenStreetMap) is not responding correctly.",
      `HTTP ${status}`,
    );
  return new GeocodeError(
    GEOCODE_CODES.provider,
    "The address provider returned an unexpected response.",
    `HTTP ${status}`,
  );
};

/**
 * Fetch + JSON for the two Nominatim calls, translating every raw browser
 * failure shape into a coded GeocodeError.
 */
const geocodeFetchJson = async (url, options) => {
  let response;
  try {
    response = await withTimeout(url, options);
  } catch (error) {
    if (typeof navigator !== "undefined" && navigator.onLine === false)
      throw new GeocodeError(
        GEOCODE_CODES.offline,
        "This device has no internet connection, so the lookup never reached OpenStreetMap.",
      );
    if (error?.name === "AbortError")
      throw new GeocodeError(
        GEOCODE_CODES.timeout,
        "The address provider did not answer in time.",
        "abandoned after 8s",
      );
    throw new GeocodeError(
      GEOCODE_CODES.unreachable,
      "The address provider could not be reached at all.",
      error?.message,
    );
  }

  if (!response.ok) throw describeStatus(response.status);

  try {
    return await response.json();
  } catch (error) {
    throw new GeocodeError(
      GEOCODE_CODES.provider,
      "The address provider sent a response that could not be read.",
      error?.message,
    );
  }
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Free-text place search ("Velachery bypass road") → candidate pins.
 * `near` biases results toward a spot the citizen is already looking at, but
 * doesn't exclude the rest of India, because people do report issues in a
 * place they are visiting rather than where they live.
 *
 * A bias can only rank, not invent: when a street name exists only 900 km
 * away, that remote result still comes back. Each hit therefore carries
 * `distanceKm` from `near` so the picker can say so instead of letting the
 * citizen drop a pin in another state believing it was their own road.
 */
export const searchPlaces = async (query, near = null) => {
  const trimmed = (query || "").trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "6",
    addressdetails: "1",
    countrycodes: "in",
  });

  if (near) {
    const [lat, lng] = near;
    // ~50km window around the current view. `preferViewbox` is what actually
    // applies it: `viewbox` alone only filters the candidate pool, so a
    // "Peel Road" search from Coimbatore still returned a road in Goa.
    // Bounded stays off so a name with no local match isn't silently empty.
    params.set("viewbox", `${lng - 0.45},${lat + 0.45},${lng + 0.45},${lat - 0.45}`);
    params.set("preferViewbox", "1");
  }

  const items = await geocodeFetchJson(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!Array.isArray(items)) {
    throw new GeocodeError(
      GEOCODE_CODES.provider,
      "The address provider returned a shape the app could not use.",
    );
  }

  return items.map((item) => {
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    return {
      label: buildShortLabel(item.address, item.display_name),
      fullAddress: item.display_name,
      latitude,
      longitude,
      district: guessDistrict(item.address),
      city: item.address?.city || item.address?.town || item.address?.village ||
        item.address?.suburb || item.address?.municipality || null,
      state: item.address?.state || null,
      pincode: item.address?.postcode || null,
      distanceKm: near ? Math.round(haversineKm(near[0], near[1], latitude, longitude)) : null,
    };
  });
};

/**
 * Builds a precise, readable label — prefers house number + road (the
 * most "exact" description Nominatim can give) and falls back to
 * neighborhood/city as those get less specific.
 */
const buildShortLabel = (address, fallbackDisplayName) => {
  if (!address) return fallbackDisplayName;

  const streetLevel = [address.house_number, address.road].filter(Boolean).join(" ");
  const locality =
    address.suburb || address.neighbourhood || address.village ||
    address.town || address.city_district;
  const city = address.city || address.town || address.municipality || address.county;

  const parts = [streetLevel || locality, city].filter(Boolean);
  const unique = [...new Set(parts)];

  return unique.length ? unique.join(", ") : fallbackDisplayName;
};

/**
 * Nominatim's free-text address breakdown (state_district / county / city
 * / etc — field presence varies a lot by region) is NOT guaranteed to
 * exactly match our fixed DISTRICTS list used for officer routing. This
 * scans every candidate address field and returns the first one that
 * matches (case-insensitively, substring-tolerant) a canonical district
 * name — or null if nothing lines up, so the UI can ask the citizen to
 * confirm manually instead of silently sending an unroutable value.
 */
export const guessDistrict = (address) => {
  if (!address) return null;

  const candidates = [
    address.state_district, address.county, address.city_district,
    address.city, address.town, address.municipality,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    const match = DISTRICTS.find(
      (district) =>
        normalized.includes(district.toLowerCase()) || district.toLowerCase().includes(normalized)
    );
    if (match) return match;
  }

  return null;
};

export const reverseGeocode = async (latitude, longitude) => {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: latitude,
    lon: longitude,
    zoom: "18", // building/street level, not just neighborhood
    addressdetails: "1",
  });

  const data = await geocodeFetchJson(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  // An empty result is not an outage: open ground, a new road or a rural track
  // legitimately has no address. Saying so lets the picker keep the pin and
  // ask for the area instead of reporting a failure that never happened.
  if (!data?.display_name && !data?.address) {
    throw new GeocodeError(
      GEOCODE_CODES.no_address,
      "Nothing is mapped to those coordinates, so there is no address to show.",
    );
  }

  return {
    label: buildShortLabel(data.address, data.display_name),
    fullAddress: data.display_name,
    district: guessDistrict(data.address), // canonical DISTRICTS value, or null
    city: data.address?.city || data.address?.town || data.address?.village ||
      data.address?.suburb || data.address?.municipality || null,
    state: data.address?.state || null,
    pincode: data.address?.postcode || null,
  };
};