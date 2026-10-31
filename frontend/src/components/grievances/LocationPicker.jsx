import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Crosshair, Loader2, MapPin, Search, Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { searchPlaces } from "../../services/geocodeService";
import { SizeSync } from "../maps/mapKit";

// Custom pin built from inline SVG so we never depend on Leaflet's default
// marker image assets (which routinely break under bundlers like Vite).
const pinIcon = L.divIcon({
  className: "location-pin-icon",
  html: `
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="#4f46e5"/>
      <circle cx="16" cy="16" r="6.5" fill="white"/>
    </svg>`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
});

const EPSILON = 0.00002; // ~2m — below this, the map is already where it should be

const samePoint = (a, b) =>
  !!a && !!b && Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON;

/**
 * Moves the view only when the pin was placed by something the citizen
 * couldn't see — GPS, or a search result. A drag already left the viewport on
 * the pin, so echoing the new coordinate back into setView would yank the map
 * sideways the moment they let go of the marker.
 */
const FlyToExternalChange = ({ center, lastInternal }) => {
  const map = useMap();

  useEffect(() => {
    if (!center || samePoint(center, map.getCenter().wrap())) return;
    if (samePoint(center, lastInternal.current)) return;
    map.flyTo(center, Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [center, lastInternal, map]);

  return null;
};

const ClickToPlace = ({ onPick }) => {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng, "tap");
    },
  });
  return null;
};

const PlaceSearch = ({ near, onPick }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [failed, setFailed] = useState(false);
  const [answered, setAnswered] = useState(""); // the term `results` belong to
  const searching = query.trim().length >= 3 && answered !== query.trim();

  // The bias point is read when a lookup fires, not treated as a trigger:
  // placing a pin moves the view, and re-running the search for the same words
  // would burn another Nominatim call (rate-limited to ~1/sec) on every move.
  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  // Debounced so typing "Velachery" doesn't fire six Nominatim lookups.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) return undefined;

    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlaces(term, nearRef.current)
        .then((found) => { if (!cancelled) { setResults(found); setFailed(false); setAnswered(term); } })
        .catch(() => { if (!cancelled) { setResults([]); setFailed(true); setAnswered(term); } });
    }, 550);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const handleChange = (value) => {
    setQuery(value);
    if (value.trim().length < 3) {
      setResults([]);
      setFailed(false);
      setAnswered("");
    }
  };

  return (
    <div style={{ position: "relative", zIndex: 1000, padding: "8px 8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 10px" }}>
        <Search size={14} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
        <input
          className="input"
          style={{ border: "none", padding: 0, flex: 1, background: "transparent", fontSize: 13 }}
          placeholder="Search a street, area or landmark..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="Search for a place"
        />
        {searching && <Loader2 size={13} className="spin" style={{ color: "var(--text-faint)" }} />}
      </div>

      {(results.length > 0 || failed) && (
        <div style={{ position: "absolute", top: "100%", left: 8, right: 8, marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-md)", overflow: "hidden", maxHeight: 210, overflowY: "auto" }}>
          {failed && (
            <p style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
              Search is unavailable right now — drag the pin instead.
            </p>
          )}
          {results.map((r) => (
            <button
              key={`${r.latitude},${r.longitude},${r.label}`}
              type="button"
              onClick={() => { onPick(r.latitude, r.longitude, "search", r); setResults([]); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, color: "var(--text)" }}
            >
              <strong style={{ display: "block", fontSize: 13 }}>{r.label}</strong>
              <span style={{ color: "var(--text-faint)", fontSize: 11.5 }}>{r.fullAddress}</span>
              {/* The geocoder ranks names from all over India; a street that
                  exists only in another state still wins when there is no local
                  match. Saying how far away it is beats placing a silent pin. */}
              {r.distanceKm !== null && r.distanceKm > 20 && (
                <span style={{ display: "block", marginTop: 3, fontSize: 11.5, color: "var(--warning)" }}>
                  About {r.distanceKm >= 100 ? Math.round(r.distanceKm) : r.distanceKm} km from the area you are viewing — tap only if that is really where the problem is.
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Location picker for a new report.
 *
 * Deliberately usable with no GPS at all: the map is mounted from the start
 * (defaulting to the citizen's district centre), and the pin can be placed by
 * searching, by tapping the map, or by dragging — "Use my location" is a
 * shortcut, not a prerequisite. A browser that never answers the geolocation
 * request used to leave this component unrendered, which read as a broken map.
 *
 * `center` is [lat, lng]. `onPick(lat, lng, source, place)` fires for every
 * citizen-initiated move; `place` is only present for search results, which
 * already carry an address and can skip a reverse-geocode round trip.
 * `nearby` is the list of other open reports at this spot, plotted as faint
 * dots so a duplicate looks like a duplicate before it is filed.
 */
const LocationPicker = ({
  center,
  hasPin = true,
  nearby = [],
  onPick,
  onLocate,
  locating = false,
  locateError = null,
  busy = false,
  height = 260,
}) => {
  const markerRef = useRef(null);
  const lastInternal = useRef(center || null);

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (!marker) return;
      const { lat, lng } = marker.getLatLng();
      lastInternal.current = [lat, lng];
      onPick(lat, lng, "drag");
    },
  }), [onPick]);

  const handlePick = (lat, lng, source, place) => {
    lastInternal.current = [lat, lng];
    onPick(lat, lng, source, place);
  };

  return (
    <div className="location-picker" style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
      <PlaceSearch near={center} onPick={handlePick} />

      <MapContainer center={center} zoom={hasPin ? 16 : 11} style={{ height, width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {nearby.map((report) => (
          <CircleMarker
            key={report.grievance_id}
            center={report.position}
            radius={5}
            pathOptions={{ color: "#ffffff", weight: 1, fillColor: "#94a3b8", fillOpacity: 0.8 }}
          />
        ))}
        {hasPin && center && (
          <Marker
            position={center}
            icon={pinIcon}
            draggable
            eventHandlers={eventHandlers}
            ref={markerRef}
          />
        )}
        <ClickToPlace onPick={handlePick} />
        <FlyToExternalChange center={center} lastInternal={lastInternal} />
        <SizeSync />
      </MapContainer>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onLocate} disabled={locating}>
          {locating ? <Loader2 size={13} className="spin" /> : <Navigation size={13} />}
          {locating ? "Finding you..." : "Use my location"}
        </button>
        {busy && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-faint)" }}>
            <Loader2 size={12} className="spin" /> Resolving address...
          </span>
        )}
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-faint)", marginLeft: "auto" }}>
          <MapPin size={12} /> {hasPin ? "Tap or drag the pin to fine-tune" : "Tap the map where the problem is"}
        </span>
      </div>

      {locateError && (
        <p style={{ margin: 0, padding: "0 10px 10px", fontSize: 12, color: "var(--warning)", display: "flex", gap: 6, alignItems: "flex-start" }}>
          <Crosshair size={12} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{locateError} You can still search for your area, or tap the map where you are.</span>
        </p>
      )}
    </div>
  );
};

export default LocationPicker;
