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

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
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