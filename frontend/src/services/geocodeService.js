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

// Nominatim's public instance can stall rather than fail. A stalled geocoder
// is worse than a failed one — the pin just never appears — so every call is
// abandoned after a few seconds and the caller falls back to manual placement.
const withTimeout = (url, options = {}, ms = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
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

  const response = await withTimeout(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error(`Place search failed (${response.status})`);

  return (await response.json()).map((item) => {
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    return {
      label: buildShortLabel(item.address, item.display_name),
      fullAddress: item.display_name,
      latitude,
      longitude,
      district: guessDistrict(item.address),
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

  const response = await withTimeout(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed (${response.status})`);
  }

  const data = await response.json();
  return {
    label: buildShortLabel(data.address, data.display_name),
    fullAddress: data.display_name,
    district: guessDistrict(data.address), // canonical DISTRICTS value, or null
  };
};