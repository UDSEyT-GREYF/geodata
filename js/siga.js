/* global L */
(() => {
  "use strict";

const params = new URLSearchParams(window.location.search);
const EMBED_MODE = params.get("embed") === "1";
const MINI_MODE = params.get("mini") === "1";
const URL_AIRPORT = (params.get("airport") || "").trim().toUpperCase();
const URL_FOCUS = params.get("focus") === "1";

if (EMBED_MODE) document.body.classList.add("embed");
if (MINI_MODE) document.body.classList.add("mini");

  const AIRPORTS_SOURCE = "fuentes/Datos_aeropuertos.geojson";

  const DEFAULT_CENTER = [-38.4, -63.6];
  const DEFAULT_ZOOM = 4;

  const FIELD_IATA_CANDIDATES = [
    "IATA", "iata", "iata_code", "cod_iata", "COD_IATA", "codigo_iata", "Código IATA"
  ];

  const SIGA_COLORS = {
    azulOrsna: "#306fb0",
    azulOscuro: "#002855",
    azulMedio: "#2a5fa0",
    azulLink: "#0072bb",
    azulClaro: "#4fa3ff",
    celesteCab: "#75AADB",
    verdeLima: "#8DE000",
    violeta: "#6b2f82",
    rojoTerminal: "#b22222",
    rojoSuave: "#ffdede",
    grisPista: "#222222",
    amarilloPista: "#ffff00",
    grisContexto: "#b0b0b0",
    grisFondo: "#f5f5f5",
    grisChip: "#b3b3b3",
    verdeInternacional: "#16c41e",
    amarilloSeleccion: "#FFD700"
  };

  const BASEMAP_CONFIGS = [
    {
      id: "argenmap",
      name: "Argenmap",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 19,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#bfe6fb"
    },
    {
      id: "argenmap_gris",
      name: "Argenmap gris",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 19,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#d5d8dc"
    },
    {
      id: "argenmap_oscuro",
      name: "Argenmap oscuro",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/argenmap_oscuro@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 19,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#23272d"
    },
    {
      id: "argenmap_topografico",
      name: "Argenmap topográfico",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_topo@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 13,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#cfe8d0"
    },
    {
      id: "osm",
      name: "OpenStreetMap",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors",
      swatch: "#d8edf7"
    },
    {
      id: "osm_humanitario",
      name: "OpenStreetMap humanitario",
      url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors, Humanitarian OpenStreetMap Team",
      swatch: "#f2e1d6"
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
      id: "carto_voyager",
      name: "Carto Voyager",
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors © CARTO",
      swatch: "#e7f0ef"
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
      id: "opentopo",
      name: "OpenTopoMap",
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      maxZoom: 17,
      attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap",
      swatch: "#e9dcc1"
    },
    {
      id: "esri_imagery",
      name: "Imágenes satelitales Esri",
      url: "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19,
      attribution: "Imágenes satelitales © Esri",
      swatchImage: "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/0/0/0"
    },
    {
      id: "google_imagery",
      name: "Imágenes satelitales Google",
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      minZoom: 3,
      maxZoom: 21,
      attribution: "Imágenes satelitales © Google",
      swatchImage: "https://mt1.google.com/vt/lyrs=s&x=0&y=0&z=0"
    },
    {
      id: "esri_calles",
      name: "Mapa Esri calles",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 20,
      attribution: "Tiles © Esri",
      swatch: "#ece2d0"
    },
    {
      id: "esri_topografico",
      name: "Mapa topográfico Esri",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 20,
      attribution: "Mapa topográfico © Esri",
      swatch: "#c4d7ef"
    },
    {
      id: "esri_gris",
      name: "Mapa Esri gris claro",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 16,
      attribution: "Tiles © Esri",
      swatch: "#d7dce2"
    },
    {
      id: "esri_oceanico",
      name: "Mapa Esri Fondo Oceánico",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
      minZoom: 3,
      maxZoom: 10,
      attribution: "Tiles © Esri — Fuente: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ y Esri",
      swatchImage: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/0/0/0"
    }
  ];

  const DEFAULT_BASEMAP_ID = "argenmap";
  const AIRPORT_BASEMAP_ID = "esri_imagery";

  const LAYER_CONFIGS = [
    {
      id: "provincias",
      group: "Contexto territorial",
      name: "Provincias",
      url: "fuentes/provincias.geojson",
      active: true,
      opacity: 0.9,
      color: SIGA_COLORS.grisContexto,
      style: {
        color: SIGA_COLORS.grisContexto,
        weight: 1,
        fillColor: "transparent",
        fillOpacity: 0
      }
    },
    {
      id: "predios",
      group: "Explotación",
      name: "Predios aeroportuarios",
      url: "fuentes/poligonos_aeropuertos.geojson",
      active: true,
      opacity: 0.95,
      color: SIGA_COLORS.azulLink,
      style: {
        color: SIGA_COLORS.azulLink,
        weight: 2.2,
        fillColor: SIGA_COLORS.azulClaro,
        fillOpacity: 0.18
      }
    },
    {
      id: "pistas",
      group: "Área de movimiento",
      name: "Pistas",
      url: "fuentes/pistas.geojson",
      active: true,
      opacity: 1,
      color: SIGA_COLORS.grisPista,
      style: {
        color: SIGA_COLORS.grisPista,
        weight: 2,
        fillColor: SIGA_COLORS.amarilloPista,
        fillOpacity: 0.16
      }
    },
    {
      id: "cabeceras",
      group: "Área de movimiento",
      name: "Cabeceras de pista",
      url: "fuentes/Cabeceras2026.geojson",
      active: true,
      opacity: 1,
      color: SIGA_COLORS.azulMedio,
      style: {
        color: SIGA_COLORS.azulOscuro,
        weight: 1.8,
        fillColor: SIGA_COLORS.azulMedio,
        fillOpacity: 0.36
      }
    },
    {
      id: "plataformas",
      group: "Área de movimiento",
      name: "Plataformas",
      url: "fuentes/Plataformas2026.geojson",
      active: true,
      opacity: 0.92,
      color: SIGA_COLORS.celesteCab,
      style: {
        color: SIGA_COLORS.azulLink,
        weight: 1.5,
        fillColor: SIGA_COLORS.celesteCab,
        fillOpacity: 0.42
      }
    },
    {
      id: "psn",
      group: "Área de movimiento",
      name: "Posiciones aeronaves",
      url: "fuentes/psn_posiciones.geojson",
      active: true,
      opacity: 1,
      color: SIGA_COLORS.violeta,
      point: {
        radius: 2.2,
        color: "#000000",
        fillColor: SIGA_COLORS.violeta,
        fillOpacity: 0.5
      }
    },
    {
      id: "terminales2026",
      group: "Edificios e infraestructura",
      name: "Terminales",
      url: "fuentes/Terminales2026.geojson",
      active: true,
      opacity: 0.94,
      color: SIGA_COLORS.rojoTerminal,
      style: {
        color: SIGA_COLORS.rojoTerminal,
        weight: 1.2,
        fillColor: SIGA_COLORS.rojoSuave,
        fillOpacity: 0.45
      }
    },
    {
      id: "torres",
      group: "Edificios e infraestructura",
      name: "Torres de control",
      url: "fuentes/Torres_control_2026.geojson",
      active: true,
      opacity: 1,
      color: SIGA_COLORS.azulOscuro,
      point: {
        radius: 6,
        color: SIGA_COLORS.azulOscuro,
        fillColor: SIGA_COLORS.azulMedio,
        fillOpacity: 0.95
      }
    },
    {
      id: "hangares",
      group: "Edificios e infraestructura",
      name: "Hangares",
      url: "fuentes/Hangares2026.geojson",
      active: false,
      opacity: 0.9,
      color: "#8a5a35",
      style: {
        color: "#6f4627",
        weight: 1.1,
        fillColor: "#b5835a",
        fillOpacity: 0.38
      }
    },
    {
      id: "otros",
      group: "Edificios e infraestructura",
      name: "Otros edificios",
      url: "fuentes/Otros_edificios2026.geojson",
      active: false,
      opacity: 0.9,
      color: "#6c757d",
      style: {
        color: "#555555",
        weight: 1.1,
        fillColor: "#b3b3b3",
        fillOpacity: 0.38
      }
    },
    {
      id: "estacionamientos",
      group: "Edificios e infraestructura",
      name: "Estacionamientos vehiculares",
      url: "fuentes/Estacionamientos_vehiculares2026.geojson",
      active: false,
      opacity: 0.9,
      color: SIGA_COLORS.grisChip,
      style: {
        color: "#777777",
        weight: 1.1,
        fillColor: SIGA_COLORS.grisChip,
        fillOpacity: 0.48
      }
    },
    {
      id: "paradasapp",
      group: "Servicios y apoyo",
      name: "Paradas transporte público",
      url: "fuentes/paradasapp.geojson",
      active: false,
      opacity: 1,
      color: SIGA_COLORS.verdeInternacional,
      point: {
        radius: 4.8,
        color: "#1a7a3e",
        fillColor: SIGA_COLORS.verdeInternacional,
        fillOpacity: 0.9
      }
    },
    {
      id: "smn",
      group: "Servicios y apoyo",
      name: "Estaciones meteorológicas SMN",
      url: "fuentes/smn_estaciones_meteorologicas2026.geojson",
      active: false,
      opacity: 1,
      color: SIGA_COLORS.azulLink,
      point: {
        radius: 5.2,
        color: SIGA_COLORS.azulOscuro,
        fillColor: SIGA_COLORS.azulLink,
        fillOpacity: 0.92
      }
    }
  ];
const LAYER_GROUP_ORDER = [
  "Explotación",
  "Edificios e infraestructura",
  "Área de movimiento",
  "Servicios y apoyo",
  "Contexto territorial"
];
  const state = {
    map: null,
    baseLayers: {},
    baseLayerConfigs: new Map(),
    activeBaseLayerId: "",
    userChangedBaseLayer: false,
    autoSwitchingBaseLayer: false,
    layerDefs: new Map(),
    airports: [],
    airportIndex: new Map(),
    selectedAirport: "",
    airportLabelLayer: null,
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


  function getDetailLabelValue(cfg, feature) {
    const props = feature?.properties || {};
    const byLayer = {
      cabeceras: ["Cabecera", "cabecera", "CABECERA", "etiqueta", "ETIQUETA"],
      pistas: ["tipo", "Tipo", "TIPO"],
      psn: ["posicion", "Posicion", "posición", "Posición", "POSICION"],
      terminales2026: ["tipo", "Tipo", "TIPO"]
    };

    const candidates = byLayer[cfg.id];
    if (!candidates) return "";

    return clean(getFirstProp(props, candidates));
  }

function getAirportShortName(airport) {
  const p = airport?.properties || {};

  return clean(
    p.Aeropuerto ||
    p.aeropuerto ||
    airport?.nombre ||
    airport?.iata
  ) || "Aeropuerto";
}

  function getPredioBoundsForAirport(iata) {
    const pred = state.layerDefs.get("predios")?.geojson;
    if (!pred?.features?.length) return null;
    const feats = pred.features.filter((f) => getFeatureIata(f) === iata && hasGeometry(f));
    if (!feats.length) return null;
    const layer = L.geoJSON(feats);
    const b = layer.getBounds();
    return b.isValid() ? b : null;
  }

  function makeBaseLayer(cfg) {
    return L.tileLayer(cfg.url, {
      minZoom: cfg.minZoom ?? 0,
      maxZoom: cfg.maxZoom ?? 20,
      maxNativeZoom: cfg.nativeMaxZoom,
      minNativeZoom: cfg.nativeMinZoom,
      tms: !!cfg.tms,
      attribution: cfg.attribution || ""
    });
  }

  function createMap() {
    const map = L.map("sigaMap", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        wheelPxPerZoomLevel: 150,
      preferCanvas: true,
      fullscreenControl: !!L.Control.FullScreen
    });

    BASEMAP_CONFIGS.forEach((cfg) => {
      const layer = makeBaseLayer(cfg);
      state.baseLayers[cfg.name] = layer;
      state.baseLayerConfigs.set(cfg.id, { ...cfg, layer });
    });

    state.map = map;
    setBaseLayer(DEFAULT_BASEMAP_ID, { auto: true, silent: true });

    map.on("baselayerchange", (e) => {
      if (state.autoSwitchingBaseLayer) return;
      const found = BASEMAP_CONFIGS.find((cfg) => cfg.name === e.name);
      if (!found) return;
      state.activeBaseLayerId = found.id;
      state.userChangedBaseLayer = true;
      renderBaseLayerTree();
    });

    L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);

    addOptionalControls(map);
  }

  function addOptionalControls(map) {
    try {
      if (L.control.locate) L.control.locate({ position: "topleft", flyTo: true, strings: { title: "Mostrar mi ubicación" } }).addTo(map);
    } catch (e) { console.warn("Locate plugin no disponible", e); }

    try {
      if (L.Control.geocoder) L.Control.geocoder({ position: "topleft", defaultMarkGeocode: true, placeholder: "Buscar lugar…" }).addTo(map);
    } catch (e) { console.warn("Geocoder plugin no disponible", e); }

    try {
      if (L.control.measure) L.control.measure({ position: "topleft", primaryLengthUnit: "meters", primaryAreaUnit: "sqmeters", activeColor: SIGA_COLORS.azulMedio, completedColor: SIGA_COLORS.violeta }).addTo(map);
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


  function createAirportLabels() {
    if (!state.map) return;

    if (state.airportLabelLayer) {
      state.map.removeLayer(state.airportLabelLayer);
      state.airportLabelLayer = null;
    }

    const group = L.layerGroup();

    state.airports.forEach((airport) => {
      const bounds = getPredioBoundsForAirport(airport.iata);
      const center = bounds?.getCenter() || getAirportCenterFromFeature(airport.feature, airport.properties);
      if (!center) return;

      const shortName = getAirportShortName(airport);
      const html = `
        <div class="siga-airport-center-icon" aria-hidden="true">✈</div>
        <div class="siga-airport-floating-text">${escapeHtml(shortName)} (${escapeHtml(airport.iata)})</div>
      `;

      const marker = L.marker(center, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "siga-airport-label-marker",
          html,
          iconSize: [1, 1],
          iconAnchor: [0, 0]
        })
      });

      group.addLayer(marker);
    });

    state.airportLabelLayer = group;
    updateZoomDependentLabels();
  }

  function updateZoomDependentLabels() {
    if (!state.map) return;

    const z = state.map.getZoom();
    const showAirportLabels = z <= 7;
    const showDetailLabels = z >= 15;

    if (state.airportLabelLayer) {
      if (showAirportLabels && !state.map.hasLayer(state.airportLabelLayer)) {
        state.airportLabelLayer.addTo(state.map);
      } else if (!showAirportLabels && state.map.hasLayer(state.airportLabelLayer)) {
        state.map.removeLayer(state.airportLabelLayer);
      }
    }

    state.map.getContainer().classList.toggle("siga-show-detail-labels", showDetailLabels);
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

    const detailLabel = getDetailLabelValue(cfg, feature);

    if (detailLabel) {
      layer.bindTooltip(detailLabel, {
        permanent: true,
        direction: cfg.id === "psn" ? "top" : "center",
        className: `siga-tooltip siga-label-detail siga-label-detail-${cfg.id}`
      });
    } else if (title || iata) {
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

    renderBaseLayerTree();
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

  function setBaseLayer(id, opts = {}) {
    const { auto = false, silent = false } = opts;
    const def = state.baseLayerConfigs.get(id);
    if (!def || !def.layer) return;

    if (!auto && !silent) state.userChangedBaseLayer = true;

    Object.values(state.baseLayers).forEach((layer) => {
      if (state.map?.hasLayer(layer)) state.map.removeLayer(layer);
    });

    state.autoSwitchingBaseLayer = true;
    def.layer.addTo(state.map);
    state.activeBaseLayerId = id;
    state.autoSwitchingBaseLayer = false;

    renderBaseLayerTree();
  }

  function maybeSwitchBaseLayerForAirport() {
    if (!state.userChangedBaseLayer) {
      setBaseLayer(AIRPORT_BASEMAP_ID, { auto: true });
    }
  }

  function maybeSwitchBaseLayerForArgentina() {
    if (!state.userChangedBaseLayer) {
      setBaseLayer(DEFAULT_BASEMAP_ID, { auto: true });
    }
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
          <input type="radio" name="sigaBaseMap" value="${escapeHtml(cfg.id)}" ${checked}>
          <span class="basemap-thumb" style="${swatchStyle}"></span>
          <span class="basemap-name">${escapeHtml(cfg.name)}</span>
        </label>
      `;
    }).join("");

    root.querySelectorAll('input[name="sigaBaseMap"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        setBaseLayer(e.target.value, { auto: false });
      });
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

  const orderedGroups = [
    ...LAYER_GROUP_ORDER.filter((groupName) => groups.has(groupName)),
    ...Array.from(groups.keys()).filter((groupName) => !LAYER_GROUP_ORDER.includes(groupName))
  ];

  root.innerHTML = "";
  orderedGroups.forEach((groupName) => {
    const items = groups.get(groupName);
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
    maybeSwitchBaseLayerForArgentina();
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
    maybeSwitchBaseLayerForAirport();

    const bounds = findAirportBounds(code);
    if (bounds && bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 17 });
      // No dibujamos polígono de predio seleccionado: entorpece la lectura de capas internas.
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
    ["predios", "pistas", "plataformas", "terminales2026"].forEach((id) => {
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
    // Desactivado a pedido: no se dibuja un polígono de predio seleccionado,
    // para no tapar ni competir visualmente con las capas internas del aeropuerto.
  }

  function clearAirportHighlight() {
    // Sin resaltado persistente de predio.
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
    renderBaseLayerTree();

    try {
      await loadAirports();
      await loadConfiguredLayers();
      createAirportLabels();
      state.map.on("zoomend", updateZoomDependentLabels);
      updateZoomDependentLabels();

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
