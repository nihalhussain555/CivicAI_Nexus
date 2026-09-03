import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

const RecenterOnChange = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom() < 15 ? 16 : map.getZoom());
  }, [position, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

const ClickToMove = ({ onMove }) => {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

/**
 * Draggable-pin location picker. GPS alone can place a citizen's report a
 * few meters off (or across the street) — this lets them drag the marker
 * (or click elsewhere on the map) to the exact spot before submitting.
 *
 * `center` is [lat, lng]. `onMove(lat, lng)` fires on drag-end or map
 * click so the parent can re-run reverse geocoding for the new point.
 */
const LocationPicker = ({ center, onMove, height = 240 }) => {
  const markerRef = useRef(null);

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const { lat, lng } = marker.getLatLng();
        onMove(lat, lng);
      }
    },
  }), [onMove]);

  if (!center) return null;

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
      <MapContainer center={center} zoom={16} style={{ height, width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={center}
          icon={pinIcon}
          draggable
          eventHandlers={eventHandlers}
          ref={markerRef}
        />
        <ClickToMove onMove={onMove} />
        <RecenterOnChange position={center} />
      </MapContainer>
      <p style={{ fontSize: 11.5, color: "var(--text-faint)", padding: "8px 10px 0" }}>
        Drag the pin or tap the map to fine-tune the exact spot.
      </p>
    </div>
  );
};

export default LocationPicker;