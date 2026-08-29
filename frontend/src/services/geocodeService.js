/**
 * Reverse geocoding via OpenStreetMap's free Nominatim API — converts
 * GPS coordinates into a human-readable place name. No API key required.
 * Same OpenStreetMap data source already used for the Leaflet map tiles
 * elsewhere in this app, so no new provider/account is introduced.
 *
 * Usage note: Nominatim's public instance is rate-limited (~1 req/sec) and
 * intended for light use — fine for this app's "use my current location"
 * button, which is an occasional, user-triggered action, not a bulk lookup.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
/**
 * Builds a short, readable label from Nominatim's address breakdown —
 * prefers neighborhood/suburb + city over the full formatted address,
 * which tends to be long (includes postcode, country, etc).
 */
const buildShortLabel = (address, fallbackDisplayName) => {
  if (!address) return fallbackDisplayName;

  const locality =
    address.suburb || address.neighbourhood || address.village ||
    address.town || address.city_district || address.road;

  const city = address.city || address.town || address.municipality || address.county;

  const parts = [locality, city].filter(Boolean);
  const unique = [...new Set(parts)];

  return unique.length ? unique.join(", ") : fallbackDisplayName;
};

export const reverseGeocode = async (latitude, longitude) => {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: latitude,
    lon: longitude,
    zoom: "16",
    addressdetails: "1",
  });

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed (${response.status})`);
  }

  const data = await response.json();
  return buildShortLabel(data.address, data.display_name);
};