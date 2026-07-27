const AIRCRAFT_GEOJSON_URL = "data/aircraft/latest.geojson";

const AIRPORT_GEOJSON_CANDIDATES = [
  "fuentes/poligonos_aeropuertos.geojson",
  "fuentes/Datos_aeropuertos.geojson",
  "data/aeropuertos.geojson",
  "data/aeropuertos_sna.geojson",
  "data/ResumenImpacto2025.geojson"
];

const AIRCRAFT_REFRESH_MS = 2 * 60 * 1000;

let map;
let aircraftLayer;
let airportLayer;
let routeLayer;

let aircraftGeojson = null;
let airports = [];
let aircraftMarkers = [];

function q(id) {
  return document.getElementById(id);
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function firstProp(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && clean(value) !== "") {
      return value;
    }
  }
  return "";
}

function formatNumber(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "s/d";

  return n.toLocaleString("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatDateTime(value) {
  if (!value) return "s/d";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "s/d";

  return date.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatUnixTime(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "s/d";

  return formatDateTime(new Date(n * 1000).toISOString());
}

function withCacheBust(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Date.now()}`;
}

async function fetchJsonNoCache(url) {
  const resp = await fetch(withCacheBust(url), {
    cache: "no-store"
  });

  if (!resp.ok) {
    throw new Error(`No se pudo cargar ${url}`);
  }

  return resp.json();
}

function normalizeIata(value) {
  const text = clean(value).toUpperCase();
  return /^[A-Z0-9]{3}$/.test(text) ? text : "";
}

function normalizeAirportName(name, iata) {
  let text = clean(name);

  if (iata) {
    text = text.replace(new RegExp(`\\s*\\(${iata}\\)\\s*$`, "i"), "").trim();
  }

  text = text.replace(/\s*\([A-Z0-9]{3}\)\s*$/i, "").trim();

  if (!text) {
    return iata || "Aeropuerto";
  }

  if (iata === "AEP") {
    return "Aeroparque Jorge Newbery";
  }

  if (/^aeropuerto\b/i.test(text) || /^aeroparque\b/i.test(text)) {
    return text;
  }

  return `Aeropuerto de ${text}`;
}

function getFeatureCoordinates(feature) {
  const geometry = feature?.geometry || {};
  const props = feature?.properties || {};

  // 1. Si la geometría es punto, usamos el punto directamente.
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    const lon = Number(geometry.coordinates[0]);
    const lat = Number(geometry.coordinates[1]);

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  // 2. Si la geometría es polígono o multipolígono,
  // usamos el centro del predio aeroportuario.
  // Esto evita depender de campos de coordenadas que pueden venir mal.
  if (
    geometry.type === "Polygon" ||
    geometry.type === "MultiPolygon" ||
    geometry.type === "LineString" ||
    geometry.type === "MultiLineString"
  ) {
    try {
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();

      if (bounds && bounds.isValid()) {
        const center = bounds.getCenter();

        return {
          lat: center.lat,
          lon: center.lng
        };
      }
    } catch (error) {
      console.warn("[SIGA Tránsito aéreo] No se pudo calcular centro de geometría", error);
    }
  }

  // 3. Fallback: campos de coordenadas en propiedades.
  const lat = Number(firstProp(props, [
    "lat",
    "latitude",
    "Latitud",
    "LATITUD",
    "Y",
    "y"
  ]));

  const lon = Number(firstProp(props, [
    "lon",
    "lng",
    "longitude",
    "Longitud",
    "LONGITUD",
    "X",
    "x"
  ]));

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }

  return null;
}

function normalizeAirportFeature(feature) {
  const props = feature?.properties || {};
  const coords = getFeatureCoordinates(feature);

  if (!coords) return null;

const iata = normalizeIata(firstProp(props, [
  "IATA",
  "iata",
  "iata_code",
  "codigo_iata",
  "Código IATA",
  "CODIGO_IATA",
  "cod_iata",
  "COD_IATA",
  "iata_siga",
  "IATA_SIGA"
]));

  if (!iata) return null;

const rawName = firstProp(props, [
  "Aeropuerto",
  "aeropuerto",
  "Nombre",
  "nombre",
  "Nombre del Aeropuerto",
  "NOMBRE",
  "airportName",
  "name",
  "denominacion",
  "Denominacion",
  "DENOMINACION",
  "nombre_aeropuerto",
  "NOMBRE_AEROPUERTO"
]);

  const city = firstProp(props, [
    "Ciudad",
    "ciudad",
    "Localidad",
    "localidad",
    "city",
    "municipio"
  ]);

  const name = normalizeAirportName(rawName || city || iata, iata);

  return {
    iata,
    name,
    city: clean(city),
    lat: coords.lat,
    lon: coords.lon,
    properties: props
  };
}

async function loadAirports() {
  for (const url of AIRPORT_GEOJSON_CANDIDATES) {
    try {
      const data = await fetchJsonNoCache(url);
      const features = Array.isArray(data?.features) ? data.features : [];

      const parsed = features
        .map(normalizeAirportFeature)
        .filter(Boolean);

      if (parsed.length) {
        airports = parsed;
        console.log(`[SIGA Tránsito aéreo] Aeropuertos cargados desde ${url}: ${parsed.length}`);
        return;
      }
    } catch (error) {
      console.warn(`[SIGA Tránsito aéreo] No se pudo cargar ${url}`, error);
    }
  }

  airports = [];
  console.warn("[SIGA Tránsito aéreo] No se pudo cargar una capa de aeropuertos.");
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestAirport(lat, lon) {
  if (!airports.length) return null;

  let best = null;

  for (const airport of airports) {
    const distanceKm = haversineKm(lat, lon, airport.lat, airport.lon);

    if (!best || distanceKm < best.distanceKm) {
      best = {
        ...airport,
        distanceKm
      };
    }
  }

  return best;
}

function airportByIata(iata) {
  const code = normalizeIata(iata);
  if (!code) return null;

  return airports.find(airport => airport.iata === code) || null;
}

function createAircraftIcon(track) {
  const rotation = Number.isFinite(Number(track)) ? Number(track) : 0;

  return L.divIcon({
    className: "siga-aircraft-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -10],
    html: `
      <div class="siga-aircraft-symbol" style="transform: rotate(${rotation}deg);">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 2 L21 29 L16 25 L11 29 Z"></path>
        </svg>
      </div>
    `
  });
}

function createAirportIcon(iata) {
  return L.divIcon({
    className: "siga-airport-marker",
    iconSize: [70, 18],
    iconAnchor: [6, 6],
    html: `
      <div style="display:flex;align-items:center;">
        <span class="siga-airport-dot"></span>
        <span class="siga-airport-label">${iata}</span>
      </div>
    `
  });
}

function buildAirportPopup(airport) {
  return `
    <div class="aircraft-popup-title">${airport.name} (${airport.iata})</div>
    <table class="aircraft-popup-table">
      <tr>
        <th>Latitud</th>
        <td>${formatNumber(airport.lat, 4)}</td>
      </tr>
      <tr>
        <th>Longitud</th>
        <td>${formatNumber(airport.lon, 4)}</td>
      </tr>
    </table>
  `;
}

function buildAircraftPopup(feature, nearestAirport) {
  const p = feature.properties || {};
  const coords = feature.geometry?.coordinates || [];
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);

  const callsign = clean(p.callsign) || clean(p.registration) || clean(p.icao24) || "Aeronave";
  const routeText = p.route_available && p.route_label
    ? p.route_label
    : "No disponible en la fuente actual";

  const nearestText = nearestAirport
    ? `${nearestAirport.name} (${nearestAirport.iata}) · ${formatNumber(nearestAirport.distanceKm, 1)} km`
    : "No disponible";

  const updateText =
    p.time_position
      ? formatUnixTime(p.time_position)
      : formatDateTime(aircraftGeojson?.updated_utc);

  return `
    <div class="aircraft-popup-title">${callsign}</div>
    <div class="aircraft-popup-subtitle">Tránsito aéreo observado</div>

    <table class="aircraft-popup-table">
      <tr>
        <th>Matrícula</th>
        <td>${clean(p.registration) || "s/d"}</td>
      </tr>
      <tr>
        <th>Tipo</th>
        <td>${clean(p.aircraft_type) || clean(p.category) || "s/d"}</td>
      </tr>
      <tr>
        <th>Altitud</th>
        <td>${formatNumber(p.baro_altitude_ft)} ft</td>
      </tr>
      <tr>
        <th>Velocidad</th>
        <td>${formatNumber(p.velocity_kmh, 1)} km/h</td>
      </tr>
      <tr>
        <th>Rumbo</th>
        <td>${formatNumber(p.true_track, 1)}°</td>
      </tr>
      <tr>
        <th>Ruta</th>
        <td>${routeText}</td>
      </tr>
      <tr>
        <th>Aeropuerto SNA más cercano</th>
        <td>${nearestText}</td>
      </tr>
      <tr>
        <th>Posición</th>
        <td>${formatNumber(lat, 4)}, ${formatNumber(lon, 4)}</td>
      </tr>
      <tr>
        <th>Actualización</th>
        <td>${updateText}</td>
      </tr>
    </table>

    <p class="aircraft-popup-note">
      Fuente: ${clean(aircraftGeojson?.source) || clean(p.source_type) || "s/d"}.
      Dato informativo, no operacional.
    </p>
  `;
}

function renderAirports() {
  airportLayer.clearLayers();

  for (const airport of airports) {
    const marker = L.marker([airport.lat, airport.lon], {
      icon: createAirportIcon(airport.iata),
      title: `${airport.name} (${airport.iata})`
    });

    marker.bindPopup(buildAirportPopup(airport));
    marker.addTo(airportLayer);
  }
}

function drawAvailableRoute(feature) {
  const p = feature.properties || {};

  if (!p.route_available || !p.origin_iata || !p.destination_iata) return;

  const origin = airportByIata(p.origin_iata);
  const destination = airportByIata(p.destination_iata);

  if (!origin || !destination) return;

  const line = L.polyline(
    [
      [origin.lat, origin.lon],
      [destination.lat, destination.lon]
    ],
    {
      color: "#0072bc",
      weight: 2,
      opacity: 0.55,
      dashArray: "5 5"
    }
  );

  line.bindTooltip(p.route_label || `${origin.iata} → ${destination.iata}`);
  line.addTo(routeLayer);
}

function featureMatchesSearch(feature, searchText) {
  if (!searchText) return true;

  const p = feature.properties || {};
  const haystack = [
    p.callsign,
    p.registration,
    p.aircraft_type,
    p.icao24,
    p.route_label
  ].map(clean).join(" ").toLowerCase();

  return haystack.includes(searchText.toLowerCase());
}

function renderAircraft() {
  aircraftLayer.clearLayers();
  routeLayer.clearLayers();
  aircraftMarkers = [];

  const features = aircraftGeojson?.features || [];
  const searchText = clean(q("aircraftSearch")?.value).toLowerCase();

  for (const feature of features) {
    const coords = feature.geometry?.coordinates || [];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const p = feature.properties || {};
    const nearestAirport = findNearestAirport(lat, lon);
    const visibleBySearch = featureMatchesSearch(feature, searchText);

    const marker = L.marker([lat, lon], {
      icon: createAircraftIcon(p.true_track),
      title: clean(p.callsign) || clean(p.registration) || clean(p.icao24) || "Aeronave"
    });

    marker.bindPopup(buildAircraftPopup(feature, nearestAirport));

    if (!visibleBySearch) {
      marker.options.opacity = 0.16;
    }

    marker.addTo(aircraftLayer);
    marker.getElement()?.classList.toggle("is-filtered-out", !visibleBySearch);

    aircraftMarkers.push({
      marker,
      feature,
      visibleBySearch
    });

    if (visibleBySearch) {
      drawAvailableRoute(feature);
    }
  }

  updatePanel();
}

function updatePanel() {
  const features = aircraftGeojson?.features || [];
  const totalWithRoute = Number(aircraftGeojson?.total_with_route || 0);

  if (q("aircraftCount")) {
    q("aircraftCount").textContent = formatNumber(features.length);
  }

  if (q("routeCount")) {
    q("routeCount").textContent = formatNumber(totalWithRoute);
  }

  if (q("aircraftUpdatedAt")) {
    q("aircraftUpdatedAt").textContent =
      `Última actualización: ${formatDateTime(aircraftGeojson?.updated_utc)}`;
  }

  if (q("aircraftSource")) {
    q("aircraftSource").textContent =
      `Fuente: ${clean(aircraftGeojson?.source) || "s/d"}`;
  }
}

async function loadAircraft() {
  try {
    const btn = q("refreshAircraftBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Actualizando...";
    }

    aircraftGeojson = await fetchJsonNoCache(AIRCRAFT_GEOJSON_URL);
    renderAircraft();

  } catch (error) {
    console.error("[SIGA Tránsito aéreo] Error cargando aeronaves", error);
  } finally {
    const btn = q("refreshAircraftBtn");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Actualizar";
    }
  }
}

function fitInitialView() {
  const bounds = L.latLngBounds();

for (const airport of airports) {
  // Solo incluimos aeropuertos dentro de Argentina y entorno regional.
  // Evita que una geometría mal cargada mande el mapa a otro continente.
  if (
    airport.lat >= -56.8 &&
    airport.lat <= -20.0 &&
    airport.lon >= -76.8 &&
    airport.lon <= -50.0
  ) {
    bounds.extend([airport.lat, airport.lon]);
  }
}

  const features = aircraftGeojson?.features || [];
  for (const feature of features) {
    const coords = feature.geometry?.coordinates || [];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      bounds.extend([lat, lon]);
    }
  }

  if (bounds.isValid()) {
    map.fitBounds(bounds, {
      padding: [24, 24]
    });
  } else {
    map.setView([-38.5, -63.5], 4);
  }
}

function initLayerToggles() {
  const toggleAircraft = q("toggleAircraft");
  const toggleAirports = q("toggleAirports");
  const toggleRoutes = q("toggleRoutes");

  toggleAircraft?.addEventListener("change", () => {
    if (toggleAircraft.checked) {
      aircraftLayer.addTo(map);
    } else {
      aircraftLayer.remove();
    }
  });

  toggleAirports?.addEventListener("change", () => {
    if (toggleAirports.checked) {
      airportLayer.addTo(map);
    } else {
      airportLayer.remove();
    }
  });

  toggleRoutes?.addEventListener("change", () => {
    if (toggleRoutes.checked) {
      routeLayer.addTo(map);
    } else {
      routeLayer.remove();
    }
  });
}

function initSearch() {
  const input = q("aircraftSearch");
  if (!input) return;

  input.addEventListener("input", () => {
    renderAircraft();
  });
}

function initMap() {
  map = L.map("sigaAirMap", {
    zoomControl: false,
    preferCanvas: true
  }).setView([-38.5, -63.5], 4);

  L.control.zoom({
    position: "bottomright"
  }).addTo(map);

  const baseOSM = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }
  );

  const baseLight = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap &copy; CARTO"
    }
  );

  baseLight.addTo(map);

  L.control.layers(
    {
      "Base clara": baseLight,
      "OpenStreetMap": baseOSM
    },
    {},
    {
      position: "bottomright",
      collapsed: true
    }
  ).addTo(map);

  routeLayer = L.layerGroup().addTo(map);
  airportLayer = L.layerGroup().addTo(map);
  aircraftLayer = L.layerGroup().addTo(map);
}

async function boot() {
  initMap();
  initLayerToggles();
  initSearch();

  await loadAirports();
  renderAirports();

  await loadAircraft();
  fitInitialView();

  q("refreshAircraftBtn")?.addEventListener("click", loadAircraft);

  setInterval(loadAircraft, AIRCRAFT_REFRESH_MS);
}

document.addEventListener("DOMContentLoaded", boot);
