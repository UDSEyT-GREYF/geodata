/* global L */
(() => {
  "use strict";

  const DATA_SOURCE = "fuentes/rutasaereas.json";
  const DEFAULT_CENTER = [-38.4, -63.6];
  const DEFAULT_ZOOM = 4;
  const SIM_DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_REAL_DURATION_MS = 60 * 1000;

  const FIELD_ALIASES = {
    id: ["id", "vuelo", "flight", "flight_id", "nro_vuelo", "numero_vuelo", "Nro Vuelo", "Vuelo"],
    airline: ["airline", "aerolinea", "linea_aerea", "empresa", "carrier", "Aerolínea", "Aerolinea", "Empresa"],
    origin: ["origin", "origen", "origen_iata", "Origen IATA", "Origen", "IATA_ORIGEN"],
    destination: ["destination", "destino", "destino_iata", "Destino IATA", "Destino", "IATA_DESTINO"],
    dep: ["dep", "departure", "salida", "hora_salida", "fecha_hora_salida", "FechaHoraSalida", "STD"],
    arr: ["arr", "arrival", "llegada", "hora_llegada", "fecha_hora_llegada", "FechaHoraLlegada", "STA"],
    passengers: ["passengers", "pasajeros", "Pax", "PAX", "Pasajeros"],
    seats: ["seats", "asientos", "Asientos"]
  };

  const AIRPORT_CATALOG = {
    AEP: { name: "Aeroparque Jorge Newbery", lat: -34.5592, lon: -58.4156 },
    EZE: { name: "Ministro Pistarini", lat: -34.8222, lon: -58.5358 },
    EPA: { name: "El Palomar", lat: -34.6099, lon: -58.6126 },
    COR: { name: "Córdoba", lat: -31.3236, lon: -64.2080 },
    MDZ: { name: "Mendoza", lat: -32.8317, lon: -68.7929 },
    BRC: { name: "Bariloche", lat: -41.1512, lon: -71.1575 },
    SLA: { name: "Salta", lat: -24.8560, lon: -65.4862 },
    IGR: { name: "Iguazú", lat: -25.7373, lon: -54.4734 },
    USH: { name: "Ushuaia", lat: -54.8433, lon: -68.2958 },
    FTE: { name: "El Calafate", lat: -50.2803, lon: -72.0531 },
    NQN: { name: "Neuquén", lat: -38.9490, lon: -68.1557 },
    REL: { name: "Trelew", lat: -43.2105, lon: -65.2703 },
    CRD: { name: "Comodoro Rivadavia", lat: -45.7853, lon: -67.4655 },
    ROS: { name: "Rosario", lat: -32.9036, lon: -60.7850 },
    TUC: { name: "Tucumán", lat: -26.8409, lon: -65.1049 },
    JUJ: { name: "Jujuy", lat: -24.3928, lon: -65.0978 },
    RGA: { name: "Río Grande", lat: -53.7777, lon: -67.7494 },
    RSA: { name: "Santa Rosa", lat: -36.5883, lon: -64.2757 },
    CPC: { name: "San Martín de los Andes", lat: -40.0754, lon: -71.1373 },
    UAQ: { name: "San Juan", lat: -31.5715, lon: -68.4182 },
    LUQ: { name: "San Luis", lat: -33.2732, lon: -66.3564 },
    RGL: { name: "Río Gallegos", lat: -51.6089, lon: -69.3126 },
    CNQ: { name: "Corrientes", lat: -27.4455, lon: -58.7619 },
    RES: { name: "Resistencia", lat: -27.4499, lon: -59.0561 },
    FMA: { name: "Formosa", lat: -26.2127, lon: -58.2281 },
    PSS: { name: "Posadas", lat: -27.3858, lon: -55.9707 },
    MDQ: { name: "Mar del Plata", lat: -37.9342, lon: -57.5733 },
    BHI: { name: "Bahía Blanca", lat: -38.7250, lon: -62.1693 },
    RCU: { name: "Río Cuarto", lat: -33.0851, lon: -64.2613 },
    SFN: { name: "Santa Fe", lat: -31.7117, lon: -60.8117 },
    PRA: { name: "Paraná", lat: -31.7948, lon: -60.4804 }
  };

  const BASEMAP_CONFIGS = [
    {
      id: "argenmap",
      name: "Argenmap IGN",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 19,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#bfe6fb"
    },
    {
      id: "argenmap_gris",
      name: "Argenmap IGN gris",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 19,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#d5d8dc"
    },
    {
      id: "carto_claro",
      name: "Carto claro",
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors © CARTO",
      swatch: "#edf2f6"
    },
    {
      id: "carto_oscuro",
      name: "Carto oscuro",
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors © CARTO",
      swatch: "#242a31"
    },
    {
      id: "esri_imagery",
      name: "Esri satelital",
      url: "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19,
      attribution: "Imágenes satelitales © Esri",
      swatchImage: "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/0/0/0"
    }
  ];

  const state = {
    map: null,
    baseLayers: new Map(),
    activeBaseLayerId: "argenmap",
    flightsRaw: [],
    flights: [],
    airports: new Map(),
    routesLayer: L.layerGroup(),
    trailsLayer: L.layerGroup(),
    planesLayer: L.layerGroup(),
    airportsLayer: L.layerGroup(),
    activeFlights: new Map(),
    playing: true,
    simTime: 0,
    lastFrame: performance.now(),
    realDurationMs: DEFAULT_REAL_DURATION_MS,
    showRoutes: true,
    showTrails: true,
    showAirports: true
  };

  const q = (id) => document.getElementById(id);

  function clean(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getFirst(obj, keys) {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null && clean(obj[key]) !== "") return obj[key];
    }
    return "";
  }

  function makeBaseLayer(cfg) {
    return L.tileLayer(cfg.url, {
      minZoom: cfg.minZoom ?? 0,
      maxZoom: cfg.maxZoom ?? 20,
      tms: !!cfg.tms,
      attribution: cfg.attribution || ""
    });
  }

  function createMap() {
    state.map = L.map("rutasMap", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 3,
      maxZoom: 20,
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      wheelPxPerZoomLevel: 150,
      preferCanvas: true,
      maxBounds: [[-56.8, -77.8], [-20.0, -47.0]],
      maxBoundsViscosity: 0.65
    });

    state.map.createPane("rutasBasePane");
    state.map.getPane("rutasBasePane").style.zIndex = 410;
    state.map.createPane("rutasTrailPane");
    state.map.getPane("rutasTrailPane").style.zIndex = 520;
    state.map.createPane("rutasAirportPane");
    state.map.getPane("rutasAirportPane").style.zIndex = 560;
    state.map.createPane("rutasPlanePane");
    state.map.getPane("rutasPlanePane").style.zIndex = 650;

    BASEMAP_CONFIGS.forEach((cfg) => state.baseLayers.set(cfg.id, { cfg, layer: makeBaseLayer(cfg) }));
    setBaseLayer("argenmap");

    state.routesLayer.addTo(state.map);
    state.trailsLayer.addTo(state.map);
    state.airportsLayer.addTo(state.map);
    state.planesLayer.addTo(state.map);

    L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(state.map);
    const zoomIndicator = L.control({ position: "bottomleft" });
    zoomIndicator.onAdd = function () {
      const div = L.DomUtil.create("div", "siga-zoom-indicator");
      div.textContent = `Zoom: ${state.map.getZoom().toFixed(2)}`;
      return div;
    };
    zoomIndicator.addTo(state.map);
    state.map.on("zoomend", () => {
      const el = document.querySelector(".siga-zoom-indicator");
      if (el) el.textContent = `Zoom: ${state.map.getZoom().toFixed(2)}`;
    });

    renderBaseLayerTree();
  }

  function setBaseLayer(id) {
    const next = state.baseLayers.get(id);
    if (!next || !state.map) return;
    state.baseLayers.forEach(({ layer }) => {
      if (state.map.hasLayer(layer)) state.map.removeLayer(layer);
    });
    next.layer.addTo(state.map);
    state.activeBaseLayerId = id;
    renderBaseLayerTree();
  }

  function renderBaseLayerTree() {
    const root = q("baseLayerTree");
    if (!root) return;
    root.innerHTML = BASEMAP_CONFIGS.map((cfg) => {
      const checked = state.activeBaseLayerId === cfg.id ? "checked" : "";
      const swatchStyle = cfg.swatchImage
        ? `background-image:url('${cfg.swatchImage}'); background-size:cover; background-position:center;`
        : `background:${cfg.swatch || "#d0d7e2"};`;
      return `
        <label class="basemap-row" title="${escapeHtml(cfg.name)}">
          <input type="radio" name="rutasBaseMap" value="${escapeHtml(cfg.id)}" ${checked}>
          <span class="basemap-thumb" style="${swatchStyle}"></span>
          <span class="basemap-name">${escapeHtml(cfg.name)}</span>
        </label>`;
    }).join("");

    root.querySelectorAll('input[name="rutasBaseMap"]').forEach((input) => {
      input.addEventListener("change", (e) => setBaseLayer(e.target.value));
    });
  }

  async function loadJson(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  }

  async function loadFlights() {
    const dataStatus = q("dataStatus");
    const mapStatus = q("mapStatus");
    try {
      const data = await loadJson(DATA_SOURCE);
      state.flightsRaw = Array.isArray(data) ? data : (data.flights || []);
      const sourceText = data.source || data.fuente || DATA_SOURCE;
      const dateText = data.date || data.fecha || "";
      if (dataStatus) {
        dataStatus.innerHTML = `Archivo cargado: <code>${escapeHtml(DATA_SOURCE)}</code><br>Fuente: ${escapeHtml(sourceText)}${dateText ? `<br>Fecha: ${escapeHtml(dateText)}` : ""}`;
      }
    } catch (err) {
      console.warn("No se pudo cargar el JSON externo; se usa demo embebida.", err);
      state.flightsRaw = DEMO_FLIGHTS;
      if (dataStatus) dataStatus.innerHTML = `No se pudo cargar <code>${escapeHtml(DATA_SOURCE)}</code>.<br>Se usa una muestra interna para probar la animación.`;
    }

    state.flights = normalizeFlights(state.flightsRaw);
    buildAirportIndex();
    renderStaticLayers();
    updateKpis();
    updateFlights(0);
    if (mapStatus) mapStatus.textContent = state.flights.length ? `Vuelos cargados: ${state.flights.length}.` : "No hay vuelos válidos para animar.";
  }

  function normalizeFlights(rows) {
    const normalized = [];
    rows.forEach((row, index) => {
      const origin = clean(getFirst(row, FIELD_ALIASES.origin)).toUpperCase();
      const destination = clean(getFirst(row, FIELD_ALIASES.destination)).toUpperCase();
      if (!origin || !destination || origin === destination) return;
      const from = getLatLngFromRow(row, "from", "origin", origin);
      const to = getLatLngFromRow(row, "to", "destination", destination);
      if (!from || !to) return;
      const dep = normalizeDateTime(getFirst(row, FIELD_ALIASES.dep), row.date || row.fecha || "2025-01-01");
      const arr = normalizeDateTime(getFirst(row, FIELD_ALIASES.arr), row.date || row.fecha || "2025-01-01");
      if (!dep || !arr) return;
      const dayStart = getDayStart(dep);
      let depOffset = dep.getTime() - dayStart.getTime();
      let arrOffset = arr.getTime() - dayStart.getTime();
      if (arrOffset < depOffset) arrOffset += SIM_DAY_MS;
      const id = clean(getFirst(row, FIELD_ALIASES.id)) || `${origin}-${destination}-${index + 1}`;
      const airline = clean(getFirst(row, FIELD_ALIASES.airline)) || "Sin dato";
      normalized.push({
        id, airline, origin, destination, dep, arr, depOffset, arrOffset,
        duration: Math.max(1, arrOffset - depOffset), from, to,
        passengers: Number(getFirst(row, FIELD_ALIASES.passengers)) || null,
        seats: Number(getFirst(row, FIELD_ALIASES.seats)) || null
      });
    });
    return normalized.sort((a, b) => a.depOffset - b.depOffset);
  }

  function getLatLngFromRow(row, pairKey, role, iata) {
    if (Array.isArray(row[pairKey]) && row[pairKey].length >= 2) {
      const lat = Number(row[pairKey][0]);
      const lon = Number(row[pairKey][1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    }
    const latCandidates = role === "origin" ? ["origin_lat", "origen_lat", "lat_origen", "OrigenLat", "latitud_origen"] : ["destination_lat", "destino_lat", "lat_destino", "DestinoLat", "latitud_destino"];
    const lonCandidates = role === "origin" ? ["origin_lon", "origen_lon", "lon_origen", "long_origen", "OrigenLon", "longitud_origen"] : ["destination_lon", "destino_lon", "lon_destino", "long_destino", "DestinoLon", "longitud_destino"];
    const lat = Number(getFirst(row, latCandidates));
    const lon = Number(getFirst(row, lonCandidates));
    if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    const airport = AIRPORT_CATALOG[iata];
    if (airport) return [airport.lat, airport.lon];
    return null;
  }

  function normalizeDateTime(value, fallbackDate) {
    const text = clean(value);
    if (!text) return null;
    let candidate = text;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) candidate = `${fallbackDate}T${text.length === 5 ? `${text}:00` : text}-03:00`;
    if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(candidate)) candidate = candidate.replace(" ", "T");
    const d = new Date(candidate);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function getDayStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function buildAirportIndex() {
    state.airports.clear();
    state.flights.forEach((f) => {
      addAirport(f.origin, f.from);
      addAirport(f.destination, f.to);
    });
  }

  function addAirport(iata, latlng) {
    if (!iata || state.airports.has(iata)) return;
    state.airports.set(iata, { iata, name: AIRPORT_CATALOG[iata]?.name || iata, latlng });
  }

  function renderStaticLayers() {
    state.routesLayer.clearLayers();
    state.airportsLayer.clearLayers();
    const renderedRoutes = new Set();
    state.flights.forEach((f) => {
      const key = [f.origin, f.destination].sort().join("-");
      if (renderedRoutes.has(key)) return;
      renderedRoutes.add(key);
      L.polyline(getArcLatLngs(f.from, f.to, 36), {
        pane: "rutasBasePane",
        color: "#306fb0",
        weight: 1.4,
        opacity: 0.22,
        interactive: false
      }).addTo(state.routesLayer);
    });
    state.airports.forEach((airport) => {
      const html = `<div class="rutas-airport-center-icon" aria-hidden="true">✈</div><div class="rutas-airport-floating-text"><span>${escapeHtml(airport.iata)}</span><span>${escapeHtml(airport.name)}</span></div>`;
      L.marker(airport.latlng, {
        pane: "rutasAirportPane",
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: "rutas-airport-label-marker", html, iconSize: [1, 1], iconAnchor: [0, 0] })
      }).addTo(state.airportsLayer);
    });
    applyLayerVisibility();
  }

  function updateKpis() {
    const routeSet = new Set();
    const airlineSet = new Set();
    state.flights.forEach((f) => {
      routeSet.add(`${f.origin}-${f.destination}`);
      airlineSet.add(f.airline);
    });
    q("kpiTotalFlights").textContent = state.flights.length.toLocaleString("es-AR");
    q("kpiRoutes").textContent = routeSet.size.toLocaleString("es-AR");
    q("kpiAirlines").textContent = airlineSet.size.toLocaleString("es-AR");
  }

  function getFlightColor(f) {
    const airline = clean(f.airline).toUpperCase();
    if (airline.includes("AR") || airline.includes("AEROL")) return "#004b80";
    if (airline.includes("FO") || airline.includes("FLY")) return "#7a4e00";
    if (airline.includes("JA") || airline.includes("JET")) return "#b22222";
    if (airline.includes("WJ") || airline.includes("FB")) return "#6b2f82";
    return "#0072bb";
  }

  function interpolateCurved(from, to, p) {
    const lat1 = from[0], lng1 = from[1], lat2 = to[0], lng2 = to[1];
    const lat = lat1 + (lat2 - lat1) * p;
    const lng = lng1 + (lng2 - lng1) * p;
    const dLat = lat2 - lat1, dLng = lng2 - lng1;
    const len = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
    const curveSize = Math.min(2.4, len * 0.075);
    const curve = Math.sin(Math.PI * p) * curveSize;
    const offsetLat = (-dLng / len) * curve;
    const offsetLng = (dLat / len) * curve;
    return [lat + offsetLat, lng + offsetLng];
  }

  function getArcLatLngs(from, to, steps = 32, endP = 1) {
    const points = [];
    const safeEnd = Math.max(0, Math.min(1, endP));
    const n = Math.max(2, Math.ceil(steps * safeEnd));
    for (let i = 0; i <= n; i++) points.push(interpolateCurved(from, to, safeEnd * (i / n)));
    return points;
  }

  function calculateBearing(from, to) {
    const lat1 = from[0] * Math.PI / 180;
    const lat2 = to[0] * Math.PI / 180;
    const dLng = (to[1] - from[1]) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function createPlaneIcon(color) {
    return L.divIcon({
      className: "rutas-plane-marker",
      html: `<span class="rutas-plane-icon" style="color:${escapeHtml(color)};"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 2.3c1.2 0 2.1 1 2.1 2.4v7.6l10.1 6.4c.7.4 1.1 1.2 1 2l-.2 2.1-10.9-3.4v5.3l3.1 2.5-.3 1.8L16 27.5 11.1 29l-.3-1.8 3.1-2.5v-5.3L3 22.8l-.2-2.1c-.1-.8.3-1.6 1-2l10.1-6.4V4.7c0-1.4.9-2.4 2.1-2.4Z" fill="currentColor" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/></svg></span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function rotatePlane(marker, bearing) {
    const el = marker.getElement();
    if (!el) return;
    const icon = el.querySelector(".rutas-plane-icon");
    if (!icon) return;
    icon.style.transform = `rotate(${bearing}deg)`;
  }

  function updateFlights(currentTime) {
    let activeCount = 0;
    state.flights.forEach((f) => {
      const visibleUntil = Math.min(f.arrOffset, SIM_DAY_MS);
      const isActive = currentTime >= f.depOffset && currentTime <= visibleUntil;
      if (!isActive) {
        removeActiveFlight(f.id);
        return;
      }
      activeCount++;
      const p = Math.max(0, Math.min(1, (currentTime - f.depOffset) / f.duration));
      const position = interpolateCurved(f.from, f.to, p);
      const nextP = Math.min(1, p + 0.01);
      const previousP = Math.max(0, p - 0.01);
      const refA = p >= 0.99 ? interpolateCurved(f.from, f.to, previousP) : position;
      const refB = p >= 0.99 ? position : interpolateCurved(f.from, f.to, nextP);
      const bearing = calculateBearing(refA, refB);
      const color = getFlightColor(f);
      let active = state.activeFlights.get(f.id);
      if (!active) {
        const trail = L.polyline(getArcLatLngs(f.from, f.to, 30, p), {
          pane: "rutasTrailPane",
          color,
          weight: 2.4,
          opacity: 0.72,
          interactive: false,
          className: "rutas-flight-trail"
        });
        if (state.showTrails) trail.addTo(state.trailsLayer);
        const marker = L.marker(position, {
          pane: "rutasPlanePane",
          icon: createPlaneIcon(color),
          interactive: true,
          keyboard: false,
          title: `${f.id} | ${f.origin} → ${f.destination}`
        });
        marker.bindTooltip(buildFlightTooltip(f), { direction: "top", opacity: 1, className: "rutas-tooltip" });
        marker.on("mouseover", () => setFeatureInfo(f));
        marker.on("click", () => setFeatureInfo(f));
        marker.addTo(state.planesLayer);
        active = { marker, trail };
        state.activeFlights.set(f.id, active);
      } else {
        active.marker.setLatLng(position);
        active.trail.setLatLngs(getArcLatLngs(f.from, f.to, 30, p));
        if (state.showTrails && !state.trailsLayer.hasLayer(active.trail)) active.trail.addTo(state.trailsLayer);
        else if (!state.showTrails && state.trailsLayer.hasLayer(active.trail)) state.trailsLayer.removeLayer(active.trail);
      }
      rotatePlane(active.marker, bearing);
    });
    q("clock").textContent = formatClock(currentTime);
    q("kpiActiveFlights").textContent = activeCount.toLocaleString("es-AR");
    q("timeRange").value = Math.floor(currentTime);
  }

  function removeActiveFlight(id) {
    const active = state.activeFlights.get(id);
    if (!active) return;
    state.planesLayer.removeLayer(active.marker);
    state.trailsLayer.removeLayer(active.trail);
    state.activeFlights.delete(id);
  }

  function buildFlightTooltip(f) {
    return `<div class="rutas-tooltip-title">${escapeHtml(f.id)}</div><div>${escapeHtml(f.origin)} → ${escapeHtml(f.destination)}</div><div class="rutas-tooltip-muted">${formatTime(f.dep)} - ${formatTime(f.arr)}</div>`;
  }

  function setFeatureInfo(f) {
    const el = q("featureInfo");
    if (!el) return;
    el.innerHTML = `<div class="feature-title">${escapeHtml(f.id)} · ${escapeHtml(f.origin)} → ${escapeHtml(f.destination)}</div><table class="feature-table"><tr><td>Aerolínea</td><td>${escapeHtml(f.airline)}</td></tr><tr><td>Salida</td><td>${escapeHtml(formatTime(f.dep))}</td></tr><tr><td>Llegada</td><td>${escapeHtml(formatTime(f.arr))}</td></tr>${f.passengers ? `<tr><td>Pasajeros</td><td>${f.passengers.toLocaleString("es-AR")}</td></tr>` : ""}${f.seats ? `<tr><td>Asientos</td><td>${f.seats.toLocaleString("es-AR")}</td></tr>` : ""}</table>`;
  }

  function formatTime(date) {
    return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function formatClock(ms) {
    const totalMinutes = Math.floor(ms / 60000) % 1440;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }

  function animate(now) {
    const delta = now - state.lastFrame;
    state.lastFrame = now;
    if (state.playing && state.flights.length) {
      const speedFactor = SIM_DAY_MS / state.realDurationMs;
      state.simTime += delta * speedFactor;
      if (state.simTime > SIM_DAY_MS) {
        state.simTime = 0;
        clearActiveFlights();
      }
      updateFlights(state.simTime);
    }
    requestAnimationFrame(animate);
  }

  function clearActiveFlights() {
    Array.from(state.activeFlights.keys()).forEach(removeActiveFlight);
  }

  function zoomArgentina() {
    state.map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  function resetAnimation() {
    state.simTime = 0;
    clearActiveFlights();
    updateFlights(0);
  }

  function toggleSpeed() {
    if (state.realDurationMs === 60 * 1000) {
      state.realDurationMs = 2 * 60 * 1000;
      q("btnSpeed").textContent = "2 min/día";
    } else if (state.realDurationMs === 2 * 60 * 1000) {
      state.realDurationMs = 30 * 1000;
      q("btnSpeed").textContent = "30 s/día";
    } else {
      state.realDurationMs = 60 * 1000;
      q("btnSpeed").textContent = "1 min/día";
    }
  }

  function applyLayerVisibility() {
    if (!state.map) return;
    toggleMapLayer(state.routesLayer, state.showRoutes);
    toggleMapLayer(state.airportsLayer, state.showAirports);
    state.activeFlights.forEach((active) => {
      if (state.showTrails && !state.trailsLayer.hasLayer(active.trail)) active.trail.addTo(state.trailsLayer);
      else if (!state.showTrails && state.trailsLayer.hasLayer(active.trail)) state.trailsLayer.removeLayer(active.trail);
    });
  }

  function toggleMapLayer(layer, visible) {
    const has = state.map.hasLayer(layer);
    if (visible && !has) layer.addTo(state.map);
    else if (!visible && has) state.map.removeLayer(layer);
  }

  function wireUi() {
    q("btnPlay")?.addEventListener("click", () => {
      state.playing = !state.playing;
      q("btnPlay").textContent = state.playing ? "Pausar" : "Reproducir";
    });
    q("btnReset")?.addEventListener("click", resetAnimation);
    q("btnResetTop")?.addEventListener("click", resetAnimation);
    q("btnArgentinaTop")?.addEventListener("click", zoomArgentina);
    q("btnSpeed")?.addEventListener("click", toggleSpeed);
    q("timeRange")?.addEventListener("input", (e) => {
      state.simTime = Number(e.target.value);
      updateFlights(state.simTime);
    });
    q("chkRoutes")?.addEventListener("change", (e) => { state.showRoutes = e.target.checked; applyLayerVisibility(); });
    q("chkTrails")?.addEventListener("change", (e) => { state.showTrails = e.target.checked; applyLayerVisibility(); });
    q("chkAirports")?.addEventListener("change", (e) => { state.showAirports = e.target.checked; applyLayerVisibility(); });
  }

  async function init() {
    createMap();
    wireUi();
    await loadFlights();
    setTimeout(() => state.map.invalidateSize(), 50);
    requestAnimationFrame(animate);
  }

  document.addEventListener("DOMContentLoaded", init);

  const DEMO_FLIGHTS = [
    { id: "AR1400", airline: "AR", origin: "AEP", destination: "MDZ", dep: "2025-01-01T06:05:00-03:00", arr: "2025-01-01T07:55:00-03:00", passengers: 143, seats: 170 },
    { id: "FO5220", airline: "FO", origin: "AEP", destination: "BRC", dep: "2025-01-01T08:30:00-03:00", arr: "2025-01-01T10:45:00-03:00", passengers: 176, seats: 189 },
    { id: "AR1508", airline: "AR", origin: "COR", destination: "SLA", dep: "2025-01-01T11:15:00-03:00", arr: "2025-01-01T12:40:00-03:00", passengers: 91, seats: 128 },
    { id: "JA3840", airline: "JA", origin: "EZE", destination: "IGR", dep: "2025-01-01T14:20:00-03:00", arr: "2025-01-01T16:05:00-03:00", passengers: 155, seats: 186 },
    { id: "AR1882", airline: "AR", origin: "AEP", destination: "USH", dep: "2025-01-01T19:10:00-03:00", arr: "2025-01-01T22:45:00-03:00", passengers: 161, seats: 170 }
  ];
})();
