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
 * Extracts the administrative district from Nominatim's address breakdown.
 * Indian districts typically show up as "state_district" (or "county" as
 * a fallback in some regions/OSM data). Used to auto-tag a citizen's
 * report with its jurisdiction, so it routes to officers based in that
 * district — independent of the citizen's own home address.
 */
const extractDistrict = (address) => {
  if (!address) return null;
  return address.state_district || address.county || address.city || null;
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
    district: extractDistrict(data.address),
  };
};