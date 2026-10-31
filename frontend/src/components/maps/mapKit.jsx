import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CATEGORY_LABELS, STATUS_LABELS, STATE_CENTER } from "../../utils/constants";
import { formatRelative } from "../../utils/helpers";

/* ------------------------------------------------------------------ *
 * Shared plumbing for every Leaflet map in the app.
 * ------------------------------------------------------------------ */

/**
 * Keeps Leaflet's size in sync with the DOM.
 *
 * Leaflet measures its container once at mount. Inside a card that animates
 * in, a tab that was hidden, or a layout that reflows after data arrives, that
 * measurement is wrong — and the result is the familiar grey box with no
 * tiles, which looks like a dead tile server but never fixes itself.
 */
export const SizeSync = () => {
  const map = useMap();

  useEffect(() => {
    const node = map.getContainer();
    const sync = () => map.invalidateSize();
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(sync);
      observer.observe(node);
    }
    window.addEventListener("resize", sync);
    const timers = [setTimeout(sync, 120), setTimeout(sync, 600)];
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", sync);
      timers.forEach(clearTimeout);
    };
  }, [map]);

  return null;
};

/** Publishes the current zoom so the parent can re-cluster. */
export const ZoomBridge = ({ onZoom }) => {
  const map = useMap();
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) });

  useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
  return null;
};

/**
 * Frames the whole visible set once per `fitKey`, not on every data change —
 * otherwise zooming into a neighbourhood and then accepting a case would snap
 * the view back out to the city.
 */
export const FitBounds = ({ points, fitKey, minZoom = 9 }) => {
  const map = useMap();
  const lastKey = useRef(null);

  useEffect(() => {
    if (lastKey.current === fitKey) return;
    lastKey.current = fitKey;

    if (!points?.length) {
      map.setView(STATE_CENTER, minZoom);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15));
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
  }, [points, fitKey, map, minZoom]);

  return null;
};

/* ------------------------------------------------------------------ *
 * Grid clustering in Web Mercator pixels.
 *
 * Deliberately not a plugin: the dataset here is hundreds to a few
 * thousands of points, and a pixel-grid pass is exact enough for a human
 * triaging a map, with no new dependency and no extra bundle.
 * ------------------------------------------------------------------ */

const TILE = 256;

const toWorldPixels = (lat, lng, zoom) => {
  const scale = TILE * 2 ** zoom;
  const sinLat = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [
    ((lng + 180) / 360) * scale,
    ((0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale),
  ];
};

/**
 * @returns {{center:[number,number], items:object[], zoom:number}[]}
 *   groups of points that fall in the same `cellSize`-pixel box.
 */
export const clusterPoints = (points, zoom, cellSize = 64) => {
  if (!points.length) return [];

  const buckets = new Map();
  for (const point of points) {
    const [x, y] = toWorldPixels(point.position[0], point.position[1], zoom);
    const key = `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.items.push(point);
      bucket.sumLat += point.position[0];
      bucket.sumLng += point.position[1];
    } else {
      buckets.set(key, {
        items: [point], sumLat: point.position[0], sumLng: point.position[1],
      });
    }
  }

  return [...buckets.values()].map((bucket) => ({
    center: [bucket.sumLat / bucket.items.length, bucket.sumLng / bucket.items.length],
    items: bucket.items,
    zoom,
  }));
};

const clusterIcon = (count, worstColor) =>
  L.divIcon({
    className: "",
    html: `<div class="map-cluster" style="width:100%;height:100%;background:${worstColor}">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

/* ------------------------------------------------------------------ *
 * Colour modes
 * ------------------------------------------------------------------ */

const PRIORITY_COLOR = { LOW: "#16a34a", MEDIUM: "#d97706", HIGH: "#ea580c", CRITICAL: "#dc2626" };

const STATUS_GROUP = {
  SUBMITTED: "new", AI_ANALYZED: "new", DEPARTMENT_ASSIGNED: "new", REOPENED: "new",
  OFFICER_ACCEPTED: "active", IN_PROGRESS: "active", ESCALATED: "active",
  RESOLUTION_SUBMITTED: "verifying", CITIZEN_VERIFICATION: "verifying",
  CLOSED: "closed", WITHDRAWN: "hidden",
};

const GROUP_COLOR = { new: "#6366f1", active: "#0ea5e9", verifying: "#d97706", closed: "#16a34a", hidden: "#94a3b8" };

export const COLOR_MODES = {
  priority: {
    label: "Priority",
    legend: [
      { label: "Low", color: PRIORITY_COLOR.LOW },
      { label: "Medium", color: PRIORITY_COLOR.MEDIUM },
      { label: "High", color: PRIORITY_COLOR.HIGH },
      { label: "Critical", color: PRIORITY_COLOR.CRITICAL },
    ],
  },
  status: {
    label: "Stage",
    legend: [
      { label: "Awaiting a first response", color: GROUP_COLOR.new },
      { label: "Being worked", color: GROUP_COLOR.active },
      { label: "Awaiting your verification", color: GROUP_COLOR.verifying },
      { label: "Closed", color: GROUP_COLOR.closed },
    ],
  },
  age: {
    label: "How long it has waited",
    legend: [
      { label: "Under a day", color: "#16a34a" },
      { label: "1–7 days", color: "#d97706" },
      { label: "Over a week", color: "#dc2626" },
    ],
  },
};

const isOverdue = (grievance, now) =>
  !!grievance.sla_due_at &&
  new Date(grievance.sla_due_at).getTime() < now &&
  grievance.status !== "CLOSED" &&
  grievance.status !== "WITHDRAWN";

// One clock reading per render, shared by every marker's colour, ring and
// popup. Callers pass the snapshot's `generated_at` so a map that stays open
// for an hour doesn't quietly reclassify cases mid-glance.
export const resolveClock = (now) => {
  const parsed = now ? new Date(now).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
};

export const colorFor = (grievance, mode, now = Date.now()) => {
  if (mode === "status") return GROUP_COLOR[STATUS_GROUP[grievance.status]] || GROUP_COLOR.new;
  if (mode === "age") {
    const hours = (now - new Date(grievance.created_at).getTime()) / 3600000;
    if (hours < 24) return "#16a34a";
    if (hours < 24 * 7) return "#d97706";
    return "#dc2626";
  }
  return PRIORITY_COLOR[grievance.priority] || "#4f46e5";
};

const radiusFor = (grievance, mode) => {
  if (mode === "priority") {
    return { LOW: 5, MEDIUM: 6.5, HIGH: 8, CRITICAL: 9.5 }[grievance.priority] || 7;
  }
  return 7;
};

const MarkerPopup = ({ grievance, basePath, now }) => (
  <div style={{ minWidth: 190 }}>
    <strong style={{ fontSize: 13 }}>{grievance.title || "Untitled grievance"}</strong>
    <div style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "5px 0" }}>
      {CATEGORY_LABELS[grievance.category] || grievance.category}
      {" · "}{grievance.priority} priority
      {" · "}{STATUS_LABELS[grievance.status] || grievance.status}
    </div>
    {grievance.location?.address && (
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{grievance.location.address}</div>
    )}
    <div style={{ fontSize: 11, color: "var(--text-faint)", margin: "5px 0" }}>
      Reported {formatRelative(grievance.created_at)}
      {grievance.district ? ` · ${grievance.district}` : ""}
    </div>
    {isOverdue(grievance, now) && (
      <div style={{ fontSize: 11.5, color: "#dc2626", fontWeight: 700 }}>Past its SLA deadline</div>
    )}
    {grievance.flagged_invalid && (
      <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Flagged as false/misleading</div>
    )}
    {basePath && (
      <Link to={`${basePath}/${grievance.grievance_id}`} style={{ color: "#4f46e5", fontSize: 12, fontWeight: 700 }}>
        Open case →
      </Link>
    )}
  </div>
);

const MapShell = ({ mapRef, defaultCenter, height, onZoom, children }) => (
  <MapContainer
    ref={mapRef}
    center={defaultCenter}
    zoom={11}
    style={{ height, width: "100%" }}
    scrollWheelZoom
  >
    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <ZoomBridge onZoom={onZoom} />
    {children}
  </MapContainer>
);

const ClusterMarker = ({ position, icon, onClick }) => (
  <Marker position={position} icon={icon} eventHandlers={{ click: onClick }} />
);

/**
 * The grievance map: clustered points, optional incident rings, and a colour
 * mode that decides what the map is being used to read.
 *
 * Cluster counts are coloured by their most alarming member on purpose — a
 * grey "12" tells you nothing, but a red 12 tells you where to click first.
 */
const GrievanceMap = ({
  grievances = [],
  incidents = [],
  basePath,
  colorMode = "priority",
  height = 520,
  fitKey = "initial",
  focus = null,
  showIncidents = true,
  defaultCenter = STATE_CENTER,
  now = null,
}) => {
  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(11);
  const clock = resolveClock(now);

  const points = useMemo(
    () => grievances
      .filter((g) => g.location?.coordinates?.length === 2)
      .map((g) => ({ grievance: g, position: [g.location.coordinates[1], g.location.coordinates[0]] })),
    [grievances],
  );

  const clusters = useMemo(() => clusterPoints(points, zoom), [points, zoom]);
  const allPositions = useMemo(() => points.map((p) => p.position), [points]);

  // A focus request (from the results list) is the one case where moving the
  // view is always right, so it bypasses the fitKey throttle.
  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.flyTo([focus.latitude, focus.longitude], 17, { duration: 0.7 });
  }, [focus]);

  return (
    <div className="map-shell" style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
      <MapShell
        mapRef={mapRef}
        defaultCenter={defaultCenter}
        height={height}
        onZoom={setZoom}
      >
        <FitBounds points={allPositions} fitKey={fitKey} />
        <SizeSync />

        {clusters.map((cluster) => {
          if (cluster.items.length === 1) {
            const { grievance, position } = cluster.items[0];
            const color = colorFor(grievance, colorMode, clock);
            const overdue = isOverdue(grievance, clock);
            return (
              <CircleMarker
                key={grievance.grievance_id}
                center={position}
                radius={radiusFor(grievance, colorMode)}
                pathOptions={{
                  color: overdue ? "#7f1d1d" : "#ffffff",
                  weight: overdue ? 2.5 : 1.5,
                  fillColor: color,
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <MarkerPopup grievance={grievance} basePath={basePath} now={clock} />
                </Popup>
              </CircleMarker>
            );
          }

          const worst = cluster.items.reduce(
            (acc, item) => (
              item.grievance.created_at && new Date(item.grievance.created_at) < new Date(acc.grievance.created_at) ? item : acc
            ),
            cluster.items[0],
          );
          const icon = clusterIcon(cluster.items.length, colorFor(worst.grievance, colorMode, clock));
          return (
            <ClusterMarker
              key={`${cluster.center[0]},${cluster.center[1]}`}
              position={cluster.center}
              icon={icon}
              onClick={() => mapRef.current?.flyTo(cluster.center, Math.min(zoom + 2, 18), { duration: 0.5 })}
            />
          );
        })}

        {showIncidents && incidents
          .filter((incident) => incident.center?.coordinates?.length === 2)
          .map((incident) => {
            const [lng, lat] = incident.center.coordinates;
            return (
              <CircleMarker
                key={incident.incident_id}
                center={[lat, lng]}
                radius={14 + Math.min(incident.report_count || 0, 20)}
                pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.12, weight: 2, dashArray: "4" }}
              >
                <Popup>
                  <div>
                    <strong style={{ fontSize: 13 }}>{incident.title}</strong>
                    <div style={{ fontSize: 11.5, margin: "4px 0" }}>
                      Community incident · {incident.report_count} reports · {incident.risk_level} risk
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      Several citizens reported the same problem in this area independently.
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapShell>
    </div>
  );
};

export default GrievanceMap;

