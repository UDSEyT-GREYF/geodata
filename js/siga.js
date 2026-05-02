/* global L */
(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const EMBED_MODE = params.get("embed") === "1";
  const URL_AIRPORT = (params.get("airport") || "").trim().toUpperCase();
  const URL_FOCUS = params.get("focus") === "1";

  if (EMBED_MODE) document.body.classList.add("embed");

  const AIRPORTS_SOURCE = "fuentes/Datos_aeropuertos.geojson";

  const DEFAULT_CENTER = [-38.4, -63.6];
  const DEFAULT_ZOOM = 4;

  const FIELD_IATA_CANDIDATES = [
    "IATA", "iata", "iata_code", "cod_iata", "COD_IATA", "codigo_iata", "Código IATA"
  ];

  const LAYER_CONFIGS = [
    {
      id: "provincias",
      group: "Contexto territorial",
      name: "Provincias",
      url: "fuentes/provincias.geojson",
      active: true,
      opacity: 0.75,
      color: "#b8c0cc",
      style: { color: "#a8b1bd", weight: 1, fillColor: "#eef1f4", fillOpacity: 0.45 }
    },
    {
      id: "predios",
      group: "Contexto territorial",
      name: "Predios aeroportuarios",
      url: "fuentes/poligonos_aeropuertos.geojson",
      active: true,
      opacity: 0.9,
      color: "#8DE000",
      style: { color: "#7bd000", weight: 2.4, fillColor: "#bfff49", fillOpacity: 0.13 }
    },
    {
      id: "pistas",
      group: "Área de movimiento",
      name: "Pistas",
      url: "fuentes/pistas.geojson",
      active: true,
      opacity: 1,
      color: "#4b5563",
      style: { color: "#374151", weight: 2.2, fillColor: "#6b7280", fillOpacity: 0.34 }
    },
    {
      id: "cabeceras",
      group: "Área de movimiento",
      name: "Cabeceras 2026",
      url: "fuentes/Cabeceras2026.geojson",
      active: true,
      opacity: 1,
      color: "#1658a8",
      style: { color: "#1658a8", weight: 2, fillColor: "#2f80ed", fillOpacity: 0.35 }
    },
    {
      id: "plataformas",
      group: "Área de movimiento",
      name: "Plataformas 2026",
      url: "fuentes/Plataformas2026.geojson",
      active: true,
      opacity: 0.9,
      color: "#48a4d8",
      style: { color: "#1976a3", weight: 1.5, fillColor: "#75c5ed", fillOpacity: 0.45 }
    },
    {
      id: "psn",
      group: "Área de movimiento",
      name: "Posiciones PSN",
      url: "fuentes/psn_posiciones.geojson",
      active: true,
      opacity: 1,
      color: "#6b2f82",
      point: { radius: 4.3, color: "#4b1763", fillColor: "#6b2f82", fillOpacity: 0.9 }
    },
    {
      id: "terminales2026",
      group: "Edificios e infraestructura",
      name: "Terminales 2026",
      url: "fuentes/Terminales2026.geojson",
      active: true,
      opacity: 0.95,
      color: "#f97316",
      style: { color: "#c2410c", weight: 1.4, fillColor: "#fb923c", fillOpacity: 0.5 }
    },
    {
      id: "terminalpax",
      group: "Edificios e infraestructura",
      name: "Terminal pax",
      url: "fuentes/terminalpax.geojson",
      active: false,
      opacity: 0.95,
      color: "#ea580c",
      style: { color: "#9a3412", weight: 1.2, fillColor: "#fdba74", fillOpacity: 0.45 }
    },
    {
      id: "torres",
      group: "Edificios e infraestructura",
      name: "Torres de control 2026",
      url: "fuentes/Torres_control_2026.geojson",
      active: true,
      opacity: 1,
      color: "#dc2626",
      point: { radius: 6, color: "#991b1b", fillColor: "#ef4444", fillOpacity: 0.95 }
    },
    {
      id: "hangares",
      group: "Edificios e infraestructura",
      name: "Hangares 2026",
      url: "fuentes/Hangares2026.geojson",
      active: false,
      opacity: 0.9,
      color: "#92400e",
      style: { color: "#78350f", weight: 1.2, fillColor: "#b45309", fillOpacity: 0.45 }
    },
    {
      id: "otros",
      group: "Edificios e infraestructura",
      name: "Otros edificios 2026",
      url: "fuentes/Otros_edificios2026.geojson",
      active: false,
      opacity: 0.9,
      color: "#64748b",
      style: { color: "#475569", weight: 1.1, fillColor: "#94a3b8", fillOpacity: 0.38 }
    },
    {
      id: "estacionamientos",
      group: "Edificios e infraestructura",
      name: "Estacionamientos vehiculares 2026",
      url: "fuentes/Estacionamientos_vehiculares2026.geojson",
      active: false,
      opacity: 0.9,
      color: "#d9a200",
      style: { color: "#a16207", weight: 1.1, fillColor: "#facc15", fillOpacity: 0.45 }
    },
    {
      id: "paradasapp",
      group: "Servicios y apoyo",
      name: "Paradas APP",
      url: "fuentes/paradasapp.geojson",
      active: false,
      opacity: 1,
      color: "#16a34a",
      point: { radius: 4.8, color: "#166534", fillColor: "#22c55e", fillOpacity: 0.9 }
    },
    {
      id: "smn",
      group: "Servicios y apoyo",
      name: "Estaciones meteorológicas SMN 2026",
      url: "fuentes/smn_estaciones_meteorologicas2026.geojson",
      active: false,
      opacity: 1,
      color: "#0284c7",
      point: { radius: 5.2, color: "#075985", fillColor: "#0ea5e9", fillOpacity: 0.92 }
    }
  ];

  const state = {
    map: null,
    baseLayers: {},
    layerDefs: new Map(),
    airports: [],
    airportIndex: new Map(),
    selectedAirport: "",
    selectedHighlight: null,
    drawnItems: null
  };

  const q = (id) => document.getElementById(id);

  function clean(v) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  }

  function formatValue(v) {
    if (v === null || v === undefined || v === "") return "–";
    if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("es-AR") : v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
    return String(v);
  }

  function getFirstProp(props, names) {
    for (const n of names) {
      if (props && props[n] !== undefined && props[n] !== null && String(props[n]).trim() !== "") return props[n];
    }
    return "";
  }

  function getFeatureIata(feature) {
    const props = feature?.properties || {};
    return clean(getFirstProp(props, FIELD_IATA_CANDIDATES)).toUpperCase();
  }

  function featureTitle(feature, fallback) {
    const p = feature?.properties || {};
    return clean(getFirstProp(p, [
      "nombre", "Nombre", "NOMBRE", "name", "Name", "Aeropuerto", "aeropuerto",
      "etiqueta", "ETIQUETA", "tipo", "Tipo", "descripcion", "Descripción", "IATA", "iata"
    ])) || fallback || "Elemento";
  }

  function hasGeometry(feature) {
    return !!feature?.geometry;
  }

  function createMap() {
    const map = L.map("sigaMap", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      preferCanvas: true,
      fullscreenControl: !!L.Control.FullScreen
    });

    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "© OpenStreetMap"
    });

    const carto = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: "© OpenStreetMap © CARTO"
    });

    const esri = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 20,
      attribution: "Tiles © Esri"
    });

    const argenmap = L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      { maxZoom: 18, tms: true, attribution: "© IGN Argentina - Argenmap" }
    );

    carto.addTo(map);
    state.baseLayers = {
      "Carto claro": carto,
      "OpenStreetMap": osm,
      "Argenmap IGN": argenmap,
      "Esri satelital": esri
    };

    L.control.layers(state.baseLayers, null, { collapsed: true, position: "topright" }).addTo(map);
    L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);

    addOptionalControls(map, carto);

    state.map = map;
  }

  function addOptionalControls(map, minimapBase) {
    try {
      if (L.control.locate) L.control.locate({ position: "topleft", flyTo: true, strings: { title: "Mostrar mi ubicación" } }).addTo(map);
    } catch (e) { console.warn("Locate plugin no disponible", e); }

    try {
      if (L.Control.geocoder) L.Control.geocoder({ position: "topleft", defaultMarkGeocode: true, placeholder: "Buscar lugar…" }).addTo(map);
    } catch (e) { console.warn("Geocoder plugin no disponible", e); }

    try {
      if (L.control.measure) L.control.measure({ position: "topleft", primaryLengthUnit: "meters", primaryAreaUnit: "sqmeters", activeColor: "#1f5f9f", completedColor: "#6b2f82" }).addTo(map);
    } catch (e) { console.warn("Measure plugin no disponible", e); }

    try {
      state.drawnItems = new L.FeatureGroup();
      map.addLayer(state.drawnItems);
      if (L.Control.Draw) {
        const drawControl = new L.Control.Draw({
          position: "topleft",
          edit: { featureGroup: state.drawnItems },
          draw: { circle: false, circlemarker: false }
        });
        map.addControl(drawControl);
        map.on(L.Draw.Event.CREATED, (event) => state.drawnItems.addLayer(event.layer));
      }
    } catch (e) { console.warn("Draw plugin no disponible", e); }

    try {
      if (L.Control.MiniMap) {
        const miniLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 20 });
        new L.Control.MiniMap(miniLayer, { toggleDisplay: true, minimized: true, position: "bottomright" }).addTo(map);
      }
    } catch (e) { console.warn("MiniMap plugin no disponible", e); }

    try {
      if (L.control.mousePosition) L.control.mousePosition({ position: "bottomright", separator: " | ", prefix: "Lat/Lon" }).addTo(map);
    } catch (e) { console.warn("MousePosition plugin no disponible", e); }

    try {
      if (L.easyPrint) L.easyPrint({ title: "Imprimir mapa", position: "topleft", sizeModes: ["Current", "A4Landscape", "A4Portrait"] }).addTo(map);
    } catch (e) { console.warn("EasyPrint plugin no disponible", e); }
  }

  async function loadJson(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  }

  async function loadAirports() {
    const gj = await loadJson(AIRPORTS_SOURCE);
    state.airports = (gj.features || [])
      .map((f) => {
        const p = f.properties || {};
        const iata = clean(p.IATA || p.iata).toUpperCase();
        const nombre = clean(p.Aeropuerto || p["Nombre del Aeropuerto"] || p.nombre || p.name || iata);
        return { iata, nombre, properties: p, feature: f };
      })
      .filter((a) => a.iata)
      .sort((a, b) => a.iata.localeCompare(b.iata));

    state.airports.forEach((a) => state.airportIndex.set(a.iata, a));
    renderAirportSelects();
  }

  function renderAirportSelects() {
    const selects = [q("airportSelect"), q("airportSelectEmbed")].filter(Boolean);
    selects.forEach((select) => {
      select.innerHTML = `<option value="">Seleccionar aeropuerto…</option>`;
      state.airports.forEach((a) => {
        const opt = document.createElement("option");
        opt.value = a.iata;
        opt.textContent = `${a.nombre} (${a.iata})`;
        select.appendChild(opt);
      });
      if (URL_AIRPORT && state.airportIndex.has(URL_AIRPORT)) select.value = URL_AIRPORT;
      select.addEventListener("change", (e) => {
        state.selectedAirport = e.target.value;
        syncAirportSelects(state.selectedAirport);
        if (state.selectedAirport) zoomToAirport(state.selectedAirport);
        updateUrl(false);
      });
    });
  }

  function syncAirportSelects(iata) {
    [q("airportSelect"), q("airportSelectEmbed")].forEach((select) => {
      if (select && select.value !== iata) select.value = iata || "";
    });
  }

  function makeLayer(cfg, geojson) {
    const options = {
      pane: cfg.id === "provincias" ? "overlayPane" : "overlayPane",
      style: (feature) => featureStyle(cfg, feature),
      pointToLayer: (feature, latlng) => {
        const p = cfg.point || { radius: 4, color: cfg.color, fillColor: cfg.color, fillOpacity: 0.9 };
        return L.circleMarker(latlng, {
          radius: p.radius,
          color: p.color,
          weight: 1,
          fillColor: p.fillColor,
          fillOpacity: p.fillOpacity
        });
      },
      onEachFeature: (feature, layer) => bindFeature(cfg, feature, layer)
    };

    return L.geoJSON(geojson, options);
  }

  function featureStyle(cfg, feature) {
    const base = cfg.style || { color: cfg.color, weight: 1.5, fillColor: cfg.color, fillOpacity: 0.35 };
    return { ...base };
  }

  function bindFeature(cfg, feature, layer) {
    const title = featureTitle(feature, cfg.name);
    const iata = getFeatureIata(feature);

    if (title || iata) {
      layer.bindTooltip(iata ? `${iata} · ${title}` : title, {
        sticky: true,
        direction: "top",
        className: "siga-tooltip"
      });
    }

    layer.bindPopup(buildPopupHtml(cfg, feature), { className: "siga-popup", maxWidth: 360 });

    layer.on("click", () => setFeatureInfo(cfg, feature));

    layer.on("mouseover", () => {
      if (layer.setStyle && cfg.id !== "provincias") {
        layer.setStyle({ weight: Math.max(3, Number((cfg.style || {}).weight || 1.5) + 1.5), fillOpacity: Math.min(0.72, Number((cfg.style || {}).fillOpacity || 0.35) + 0.18) });
      }
    });

    layer.on("mouseout", () => {
      const def = state.layerDefs.get(cfg.id);
      if (layer.setStyle && def) layer.setStyle(featureStyle(cfg, feature));
    });
  }

  function getImportantProps(feature) {
    const props = feature?.properties || {};
    const preferred = [
      "IATA", "iata", "OACI", "oaci", "ANAC", "Aeropuerto", "nombre", "Nombre", "NOMBRE",
      "tipo", "Tipo", "etiqueta", "ETIQUETA", "orientacion", "Orientacion", "PistaOrientacion",
      "longitud", "Longitud", "dimensiones", "Dimensiones", "superficie", "Superficie", "metros2", "m2",
      "posicion", "Posicion", "clase", "Clase", "estado", "Estado"
    ];

    const out = [];
    preferred.forEach((key) => {
      if (props[key] !== undefined && props[key] !== null && String(props[key]).trim() !== "") {
        out.push([key, props[key]]);
      }
    });

    Object.keys(props).forEach((key) => {
      if (out.length >= 12) return;
      if (preferred.includes(key)) return;
      const val = props[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") out.push([key, val]);
    });

    return out.slice(0, 12);
  }

  function buildPopupHtml(cfg, feature) {
    const rows = getImportantProps(feature);
    const title = featureTitle(feature, cfg.name);
    return `
      <div class="siga-popup-title">${escapeHtml(cfg.name)} · ${escapeHtml(title)}</div>
      <table class="siga-popup-table">
        ${rows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(formatValue(v))}</td></tr>`).join("")}
      </table>
    `;
  }

  function setFeatureInfo(cfg, feature) {
    const el = q("featureInfo");
    if (!el) return;
    const title = featureTitle(feature, cfg.name);
    const rows = getImportantProps(feature);
    el.innerHTML = `
      <div class="feature-title">${escapeHtml(cfg.name)} · ${escapeHtml(title)}</div>
      <table class="feature-table">
        ${rows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(formatValue(v))}</td></tr>`).join("")}
      </table>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function loadConfiguredLayers() {
    const status = q("mapStatus");
    let loaded = 0;
    let failed = 0;

    for (const cfg of LAYER_CONFIGS) {
      try {
        const gj = await loadJson(cfg.url);
        const layer = makeLayer(cfg, gj);
        const def = { cfg, geojson: gj, layer, active: false, opacity: cfg.opacity ?? 1 };
        state.layerDefs.set(cfg.id, def);

        applyLayerOpacity(layer, def.opacity);
        if (cfg.active) setLayerActive(cfg.id, true);
        loaded += 1;
        if (status) status.textContent = `Capas cargadas: ${loaded}/${LAYER_CONFIGS.length}`;
      } catch (e) {
        console.warn(`No se pudo cargar ${cfg.url}`, e);
        state.layerDefs.set(cfg.id, { cfg, geojson: null, layer: null, active: false, error: true, opacity: cfg.opacity ?? 1 });
        failed += 1;
      }
    }

    renderLayerTree();
    renderLegend();
    if (status) status.textContent = failed ? `Capas cargadas: ${loaded}. No disponibles: ${failed}.` : `Capas cargadas: ${loaded}.`;
  }

  function setLayerActive(id, active) {
    const def = state.layerDefs.get(id);
    if (!def || !def.layer) return;
    def.active = !!active;
    if (active) {
      if (!state.map.hasLayer(def.layer)) def.layer.addTo(state.map);
    } else if (state.map.hasLayer(def.layer)) {
      state.map.removeLayer(def.layer);
    }
    renderLegend();
  }

  function applyLayerOpacity(layer, opacity) {
    if (!layer) return;
    layer.eachLayer?.((l) => {
      if (l.setStyle) {
        const style = {};
        if (l.options.fillOpacity !== undefined) style.fillOpacity = opacity * (l.options.fillOpacity || 0.5);
        if (l.options.opacity !== undefined) style.opacity = opacity;
        l.setStyle(style);
      }
      if (l.setOpacity) l.setOpacity(opacity);
    });
  }

  function renderLayerTree() {
    const root = q("layerTree");
    if (!root) return;

    const groups = new Map();
    LAYER_CONFIGS.forEach((cfg) => {
      if (!groups.has(cfg.group)) groups.set(cfg.group, []);
      groups.get(cfg.group).push(cfg);
    });

    root.innerHTML = "";
    groups.forEach((items, groupName) => {
      const groupEl = document.createElement("div");
      groupEl.className = "layer-group";
      groupEl.innerHTML = `<div class="layer-group-title">${escapeHtml(groupName)}</div>`;

      items.forEach((cfg) => {
        const def = state.layerDefs.get(cfg.id);
        const row = document.createElement("label");
        row.className = "layer-row";
        row.innerHTML = `
          <input type="checkbox" ${def?.active ? "checked" : ""} ${def?.error ? "disabled" : ""} data-layer-id="${cfg.id}">
          <span class="layer-swatch" style="background:${cfg.color};"></span>
          <span class="layer-name" title="${escapeHtml(cfg.name)}">${escapeHtml(cfg.name)}${def?.error ? " (no disponible)" : ""}</span>
          <input class="layer-opacity" type="range" min="0.1" max="1" step="0.05" value="${def?.opacity ?? cfg.opacity ?? 1}" data-opacity-id="${cfg.id}" ${def?.error ? "disabled" : ""}>
        `;
        groupEl.appendChild(row);
      });

      root.appendChild(groupEl);
    });

    root.querySelectorAll("input[type='checkbox'][data-layer-id]").forEach((input) => {
      input.addEventListener("change", (e) => setLayerActive(e.target.dataset.layerId, e.target.checked));
    });

    root.querySelectorAll("input[type='range'][data-opacity-id]").forEach((input) => {
      input.addEventListener("input", (e) => {
        const def = state.layerDefs.get(e.target.dataset.opacityId);
        if (!def) return;
        def.opacity = Number(e.target.value);
        applyLayerOpacity(def.layer, def.opacity);
      });
    });
  }

  function renderLegend() {
    const el = q("mapLegend");
    if (!el) return;
    const active = Array.from(state.layerDefs.values()).filter((def) => def.active && def.layer);
    if (!active.length) {
      el.innerHTML = `<div class="siga-hint">No hay capas activas.</div>`;
      return;
    }
    el.innerHTML = active
      .map((def) => `<div class="legend-item"><span class="legend-swatch" style="background:${def.cfg.color};"></span><span>${escapeHtml(def.cfg.name)}</span></div>`)
      .join("");
  }

  function setDefaultLayers() {
    LAYER_CONFIGS.forEach((cfg) => setLayerActive(cfg.id, !!cfg.active));
    renderLayerTree();
  }

  function setAllLayers(active) {
    LAYER_CONFIGS.forEach((cfg) => setLayerActive(cfg.id, !!active));
    renderLayerTree();
  }

  function zoomArgentina() {
    clearAirportHighlight();
    state.selectedAirport = "";
    syncAirportSelects("");

    const prov = state.layerDefs.get("provincias")?.layer;
    if (prov) {
      const b = prov.getBounds();
      if (b.isValid()) state.map.fitBounds(b, { padding: [20, 20] });
      return;
    }
    state.map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  function zoomToAirport(iata) {
    const code = clean(iata).toUpperCase();
    if (!code) return;
    state.selectedAirport = code;
    syncAirportSelects(code);

    const bounds = findAirportBounds(code);
    if (bounds && bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 17 });
      highlightAirport(code);
      const hint = q("airportHint");
      if (hint) hint.textContent = `Vista centrada en ${code}. Podés seguir explorando o volver a la vista nacional.`;
      updateUrl(true);
      return;
    }

    const airport = state.airportIndex.get(code);
    const center = getAirportCenterFromFeature(airport?.feature, airport?.properties);
    if (center) {
      state.map.setView(center, 14);
      updateUrl(true);
    }
  }

  function findAirportBounds(iata) {
    let bounds = null;
    ["predios", "pistas", "plataformas", "terminales2026", "terminalpax"].forEach((id) => {
      const def = state.layerDefs.get(id);
      if (!def?.geojson?.features?.length) return;
      const feats = def.geojson.features.filter((f) => getFeatureIata(f) === iata && hasGeometry(f));
      if (!feats.length) return;
      const layer = L.geoJSON(feats);
      const b = layer.getBounds();
      if (!b.isValid()) return;
      bounds = bounds ? bounds.extend(b) : b;
    });
    return bounds;
  }

  function getAirportCenterFromFeature(feature, props) {
    if (feature?.geometry) {
      try {
        const layer = L.geoJSON(feature);
        const b = layer.getBounds();
        if (b.isValid()) return b.getCenter();
      } catch (_) {}
    }
    const lat = Number(props?.Lat ?? props?.LAT ?? props?.latitud ?? props?.Latitud);
    const lon = Number(props?.Lon ?? props?.LON ?? props?.Long ?? props?.longitud ?? props?.Longitud);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return L.latLng(lat, lon);
    return null;
  }

  function highlightAirport(iata) {
    clearAirportHighlight();
    const pred = state.layerDefs.get("predios")?.geojson;
    if (!pred?.features?.length) return;
    const feats = pred.features.filter((f) => getFeatureIata(f) === iata && hasGeometry(f));
    if (!feats.length) return;
    state.selectedHighlight = L.geoJSON(feats, {
      style: { color: "#ff0000", weight: 3.5, fillColor: "#ff0000", fillOpacity: 0.05, dashArray: "8 5" }
    }).addTo(state.map);
  }

  function clearAirportHighlight() {
    if (state.selectedHighlight) {
      state.map.removeLayer(state.selectedHighlight);
      state.selectedHighlight = null;
    }
  }

  function updateUrl(focused) {
    const url = new URL(window.location.href);
    if (state.selectedAirport) url.searchParams.set("airport", state.selectedAirport);
    else url.searchParams.delete("airport");
    if (focused) url.searchParams.set("focus", "1");
    else url.searchParams.delete("focus");
    if (EMBED_MODE) url.searchParams.set("embed", "1");
    window.history.replaceState({}, "", url);
  }

  function wireUi() {
    q("btnZoomAirport")?.addEventListener("click", () => zoomToAirport(q("airportSelect")?.value));
    q("btnZoomAirportEmbed")?.addEventListener("click", () => zoomToAirport(q("airportSelectEmbed")?.value));
    q("btnArgentina")?.addEventListener("click", zoomArgentina);
    q("btnArgentinaTop")?.addEventListener("click", zoomArgentina);
    q("btnDefaultLayers")?.addEventListener("click", setDefaultLayers);
    q("btnAllLayers")?.addEventListener("click", () => setAllLayers(true));
    q("btnNoLayers")?.addEventListener("click", () => setAllLayers(false));

    const openFull = () => {
      const iata = state.selectedAirport || q("airportSelect")?.value || q("airportSelectEmbed")?.value || "";
      const url = new URL("siga.html", window.location.href);
      if (iata) {
        url.searchParams.set("airport", iata);
        url.searchParams.set("focus", "1");
      }
      window.open(url.toString(), "_blank");
    };
    q("btnOpenFull")?.addEventListener("click", openFull);
    q("btnOpenFullEmbed")?.addEventListener("click", openFull);
  }

  async function init() {
    createMap();
    wireUi();

    try {
      await loadAirports();
      await loadConfiguredLayers();

      setTimeout(() => state.map.invalidateSize(), 50);

      if (URL_AIRPORT && state.airportIndex.has(URL_AIRPORT)) {
        state.selectedAirport = URL_AIRPORT;
        syncAirportSelects(URL_AIRPORT);
        if (URL_FOCUS || EMBED_MODE) zoomToAirport(URL_AIRPORT);
        else zoomArgentina();
      } else {
        zoomArgentina();
      }
    } catch (e) {
      console.error("Error inicializando SIGA", e);
      const status = q("mapStatus");
      if (status) status.textContent = "Error al cargar el visor SIGA. Revisá la consola.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
