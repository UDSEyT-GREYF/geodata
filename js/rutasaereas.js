(() => {
  "use strict";

  // =========================================================
  // RUTAS AÉREAS ANIMADAS
  // 24 horas de operación simuladas en 1 minuto de animación.
  // Para usar datos reales, activar LOAD_EXTERNAL_DATA y crear:
  // fuentes/rutasaereas.json
  // =========================================================

  const CONFIG = {
    dayStart: "2025-01-01T00:00:00-03:00",
    simulatedDayMs: 24 * 60 * 60 * 1000,
    realDurationMs: 60 * 1000,
    loadExternalData: false,
    dataSource: "fuentes/rutasaereas.json",
    mapCenter: [-38.5, -63.5],
    mapZoom: 4,
    mapMinZoom: 3,
    mapMaxZoom: 10,
    argentinaBounds: [
      [-56.5, -76.5],
      [-20.0, -48.0]
    ],
    trailSteps: 34,
    routeOpacity: 0.18,
    trailOpacity: 0.82
  };

  const DAY_START = new Date(CONFIG.dayStart).getTime();
  const SPEED_FACTOR = CONFIG.simulatedDayMs / CONFIG.realDurationMs;

  const DOM = {
    map: document.getElementById("map"),
    btnPlay: document.getElementById("btnPlay"),
    btnRestart: document.getElementById("btnRestart"),
    clock: document.getElementById("clock"),
    timeRange: document.getElementById("timeRange"),
    activeCount: document.getElementById("activeCount"),
    speedLabel: document.getElementById("speedLabel"),
    mapStatus: document.getElementById("mapStatus")
  };

  const SAMPLE_FLIGHTS = [
    {
      id: "AR1400",
      airline: "AR",
      origin: "AEP",
      destination: "MDZ",
      dep: "2025-01-01T06:05:00-03:00",
      arr: "2025-01-01T07:55:00-03:00",
      from: [-34.5592, -58.4156],
      to: [-32.8317, -68.7929]
    },
    {
      id: "FO5220",
      airline: "FO",
      origin: "AEP",
      destination: "BRC",
      dep: "2025-01-01T08:30:00-03:00",
      arr: "2025-01-01T10:45:00-03:00",
      from: [-34.5592, -58.4156],
      to: [-41.1512, -71.1575]
    },
    {
      id: "AR1508",
      airline: "AR",
      origin: "COR",
      destination: "SLA",
      dep: "2025-01-01T11:15:00-03:00",
      arr: "2025-01-01T12:40:00-03:00",
      from: [-31.3236, -64.2080],
      to: [-24.8560, -65.4862]
    },
    {
      id: "JA3840",
      airline: "JA",
      origin: "EZE",
      destination: "IGR",
      dep: "2025-01-01T14:20:00-03:00",
      arr: "2025-01-01T16:05:00-03:00",
      from: [-34.8222, -58.5358],
      to: [-25.7373, -54.4734]
    },
    {
      id: "AR1882",
      airline: "AR",
      origin: "AEP",
      destination: "USH",
      dep: "2025-01-01T19:10:00-03:00",
      arr: "2025-01-01T22:45:00-03:00",
      from: [-34.5592, -58.4156],
      to: [-54.8433, -68.2958]
    },
    {
      id: "FO5016",
      airline: "FO",
      origin: "COR",
      destination: "NQN",
      dep: "2025-01-01T20:20:00-03:00",
      arr: "2025-01-01T22:05:00-03:00",
      from: [-31.3236, -64.2080],
      to: [-38.9490, -68.1557]
    }
  ];

  let map;
  let routeRenderer;
  let flightRenderer;
  let routesLayer;
  let flightsLayer;
  let processedFlights = [];
  let activeFlights = new Map();
  let playing = true;
  let simTime = 0;
  let lastFrame = performance.now();

  function initMap() {
    map = L.map("map", {
      center: CONFIG.mapCenter,
      zoom: CONFIG.mapZoom,
      minZoom: CONFIG.mapMinZoom,
      maxZoom: CONFIG.mapMaxZoom,
      preferCanvas: true,
      renderer: L.canvas({ padding: 0.5 }),
      maxBounds: CONFIG.argentinaBounds,
      maxBoundsViscosity: 0.8,
      zoomControl: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    map.createPane("routesPane");
    map.getPane("routesPane").style.zIndex = 410;

    map.createPane("trailsPane");
    map.getPane("trailsPane").style.zIndex = 560;

    map.createPane("flightsPane");
    map.getPane("flightsPane").style.zIndex = 620;

    routeRenderer = L.canvas({ padding: 0.5 });
    flightRenderer = L.canvas({ padding: 0.5 });

    routesLayer = L.layerGroup().addTo(map);
    flightsLayer = L.layerGroup().addTo(map);
  }

  async function loadFlights() {
    if (!CONFIG.loadExternalData) {
      return SAMPLE_FLIGHTS;
    }

    try {
      const response = await fetch(CONFIG.dataSource, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return Array.isArray(data) ? data : data.flights || [];
    } catch (error) {
      console.warn("No se pudo cargar la fuente externa. Se usan vuelos de ejemplo.", error);
      setStatus("No se pudo cargar fuentes/rutasaereas.json. Se muestran vuelos de ejemplo.");
      return SAMPLE_FLIGHTS;
    }
  }

  function preprocessFlights(flights) {
    return flights
      .map(normalizeFlight)
      .filter(Boolean)
      .sort((a, b) => a.depOffset - b.depOffset);
  }

  function normalizeFlight(flight, index) {
    const id = String(flight.id || flight.flight || `VU${index + 1}`).trim();
    const depTime = parseFlightDate(flight.dep || flight.departure || flight.salida);
    const arrTime = parseFlightDate(flight.arr || flight.arrival || flight.llegada);
    const from = normalizeLatLng(flight.from || flight.origenCoords || [flight.fromLat, flight.fromLng]);
    const to = normalizeLatLng(flight.to || flight.destinoCoords || [flight.toLat, flight.toLng]);

    if (!depTime || !arrTime || !from || !to) {
      console.warn("Vuelo omitido por datos incompletos", flight);
      return null;
    }

    let depOffset = depTime - DAY_START;
    let arrOffset = arrTime - DAY_START;

    if (arrOffset < depOffset) {
      arrOffset += CONFIG.simulatedDayMs;
    }

    return {
      id,
      airline: String(flight.airline || flight.aerolinea || "OT").trim(),
      origin: String(flight.origin || flight.origen || "ORI").trim(),
      destination: String(flight.destination || flight.destino || "DES").trim(),
      dep: flight.dep || flight.departure || flight.salida,
      arr: flight.arr || flight.arrival || flight.llegada,
      from,
      to,
      depOffset,
      arrOffset,
      duration: Math.max(1, arrOffset - depOffset)
    };
  }

  function parseFlightDate(value) {
    if (!value) return null;

    const raw = String(value).trim();

    if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
      const seconds = raw.length === 5 ? ":00" : "";
      return new Date(`${CONFIG.dayStart.slice(0, 10)}T${raw}${seconds}-03:00`).getTime();
    }

    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeLatLng(value) {
    if (!Array.isArray(value) || value.length < 2) return null;

    const lat = Number(value[0]);
    const lng = Number(value[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }

  function drawBaseRoutes() {
    routesLayer.clearLayers();

    processedFlights.forEach(flight => {
      L.polyline(getFullRouteLatLngs(flight), {
        pane: "routesPane",
        renderer: routeRenderer,
        color: getFlightColor(flight),
        weight: 1.1,
        opacity: CONFIG.routeOpacity,
        interactive: false
      }).addTo(routesLayer);
    });
  }

  function updateFlights(currentTime) {
    let activeCount = 0;

    processedFlights.forEach(flight => {
      const visibleUntil = Math.min(flight.arrOffset, CONFIG.simulatedDayMs);
      const isActive = currentTime >= flight.depOffset && currentTime <= visibleUntil;

      if (!isActive) {
        removeActiveFlight(flight.id);
        return;
      }

      activeCount++;

      const progress = clamp((currentTime - flight.depOffset) / flight.duration, 0, 1);
      const position = interpolateCurved(flight.from, flight.to, progress);
      const bearing = getBearingAtProgress(flight, progress);
      const color = getFlightColor(flight);
      let active = activeFlights.get(flight.id);

      if (!active) {
        const trail = L.polyline(getTrailLatLngs(flight, progress), {
          pane: "trailsPane",
          renderer: flightRenderer,
          color,
          weight: 2.6,
          opacity: CONFIG.trailOpacity,
          interactive: false,
          lineCap: "round",
          lineJoin: "round"
        }).addTo(flightsLayer);

        const marker = L.marker(position, {
          pane: "flightsPane",
          icon: createPlaneIcon(color),
          interactive: true,
          keyboard: false
        });

        marker.bindTooltip(getTooltipHtml(flight), {
          direction: "top",
          opacity: 0.96,
          className: "ra-tooltip"
        });

        marker.addTo(flightsLayer);

        active = { marker, trail };
        activeFlights.set(flight.id, active);
      } else {
        active.marker.setLatLng(position);
        active.trail.setLatLngs(getTrailLatLngs(flight, progress));
      }

      rotatePlane(active.marker, bearing);
    });

    updateUi(currentTime, activeCount);
  }

  function removeActiveFlight(id) {
    const active = activeFlights.get(id);
    if (!active) return;

    flightsLayer.removeLayer(active.marker);
    flightsLayer.removeLayer(active.trail);
    activeFlights.delete(id);
  }

  function clearActiveFlights() {
    activeFlights.forEach(active => {
      flightsLayer.removeLayer(active.marker);
      flightsLayer.removeLayer(active.trail);
    });
    activeFlights.clear();
  }

  function getTooltipHtml(flight) {
    return `
      <strong>${escapeHtml(flight.id)}</strong> | ${escapeHtml(flight.origin)} → ${escapeHtml(flight.destination)}<br>
      ${formatTimeLabel(flight.dep)} - ${formatTimeLabel(flight.arr)}
    `;
  }

  function createPlaneIcon(color = "#ffffff") {
    return L.divIcon({
      className: "plane-marker",
      html: `<div class="plane-icon" style="color:${color};">✈</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  function rotatePlane(marker, angle) {
    const element = marker.getElement();
    if (!element) return;

    const icon = element.querySelector(".plane-icon");
    if (!icon) return;

    // El carácter ✈ requiere una pequeña corrección visual.
    icon.style.transform = `rotate(${angle + 45}deg)`;
  }

  function getBearingAtProgress(flight, progress) {
    const beforeP = clamp(progress - 0.01, 0, 1);
    const afterP = clamp(progress + 0.01, 0, 1);
    const before = interpolateCurved(flight.from, flight.to, beforeP);
    const after = interpolateCurved(flight.from, flight.to, afterP);

    return calculateBearing(before, after);
  }

  function calculateBearing(from, to) {
    if (!from || !to || (from[0] === to[0] && from[1] === to[1])) return 0;

    const lat1 = degreesToRadians(from[0]);
    const lat2 = degreesToRadians(to[0]);
    const dLng = degreesToRadians(to[1] - from[1]);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    return (radiansToDegrees(Math.atan2(y, x)) + 360) % 360;
  }

  function getFullRouteLatLngs(flight) {
    const points = [];
    for (let i = 0; i <= CONFIG.trailSteps; i++) {
      points.push(interpolateCurved(flight.from, flight.to, i / CONFIG.trailSteps));
    }
    return points;
  }

  function getTrailLatLngs(flight, progress) {
    const points = [];
    const totalSteps = Math.max(2, Math.ceil(CONFIG.trailSteps * Math.max(progress, 0.03)));

    for (let i = 0; i <= totalSteps; i++) {
      const t = progress * (i / totalSteps);
      points.push(interpolateCurved(flight.from, flight.to, t));
    }

    return points;
  }

  function interpolateCurved(from, to, progress) {
    const p = clamp(progress, 0, 1);
    const lat1 = from[0];
    const lng1 = from[1];
    const lat2 = to[0];
    const lng2 = to[1];

    const lat = lat1 + (lat2 - lat1) * p;
    const lng = lng1 + (lng2 - lng1) * p;

    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const len = Math.sqrt(dLat * dLat + dLng * dLng) || 1;

    // Curva estética simple. No reemplaza una geodésica real.
    const curveSize = Math.min(2.4, len * 0.08);
    const curve = Math.sin(Math.PI * p) * curveSize;

    const offsetLat = (-dLng / len) * curve;
    const offsetLng = (dLat / len) * curve;

    return [lat + offsetLat, lng + offsetLng];
  }

  function animate(now) {
    const delta = now - lastFrame;
    lastFrame = now;

    if (playing) {
      simTime += delta * SPEED_FACTOR;

      if (simTime > CONFIG.simulatedDayMs) {
        simTime = 0;
        clearActiveFlights();
      }

      updateFlights(simTime);
    }

    requestAnimationFrame(animate);
  }

  function bindEvents() {
    DOM.btnPlay.addEventListener("click", () => {
      playing = !playing;
      DOM.btnPlay.textContent = playing ? "Pausar" : "Reproducir";
    });

    DOM.btnRestart.addEventListener("click", () => {
      simTime = 0;
      clearActiveFlights();
      updateFlights(simTime);
      if (!playing) {
        playing = true;
        DOM.btnPlay.textContent = "Pausar";
      }
    });

    DOM.timeRange.addEventListener("input", event => {
      simTime = Number(event.target.value);
      updateFlights(simTime);
    });
  }

  function updateUi(currentTime, activeCount) {
    DOM.clock.textContent = formatClock(currentTime);
    DOM.activeCount.textContent = `${activeCount} ${activeCount === 1 ? "vuelo" : "vuelos"}`;
    DOM.timeRange.value = Math.floor(currentTime);
  }

  function setStatus(message) {
    DOM.mapStatus.textContent = message;
  }

  function formatClock(ms) {
    const totalMinutes = Math.floor(ms / 60000) % 1440;
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function formatTimeLabel(value) {
    if (!value) return "--:--";
    const raw = String(value);
    const match = raw.match(/T(\d{2}:\d{2})/) || raw.match(/^(\d{2}:\d{2})/);
    return match ? match[1] : raw;
  }

  function getFlightColor(flight) {
    const airline = String(flight.airline || "").toUpperCase();

    if (airline === "AR") return "#ffffff";
    if (airline === "FO") return "#ffcc66";
    if (airline === "JA") return "#ff7777";
    if (airline === "WJ") return "#a9ff68";

    return "#66ffcc";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  function radiansToDegrees(radians) {
    return radians * 180 / Math.PI;
  }

  async function init() {
    if (!DOM.map) return;

    DOM.speedLabel.textContent = `24 h → ${Math.round(CONFIG.realDurationMs / 1000)} s`;

    initMap();
    bindEvents();

    const flights = await loadFlights();
    processedFlights = preprocessFlights(flights);

    drawBaseRoutes();
    updateFlights(0);

    setStatus(`${processedFlights.length} vuelos cargados. Reproducción: 1 segundo real = 24 minutos simulados.`);

    requestAnimationFrame(animate);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
