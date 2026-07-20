/* global L */

(() => {
  "use strict";

  const PARTIAL_URL = "partials/alcance-territorial-body.html";

  const AIRPORTS_URL = "fuentes/Datos_aeropuertos.geojson";
  const AIRPORT_POLYGONS_URL = "fuentes/poligonos_aeropuertos.geojson";
  const AREAS_URL = "fuentes/Areasinfluencia39.geojson";
  const LOCALIDADES_URL = "fuentes/INDEC/localidades_censales.geojson";
  const POBLACION_1H_URL = "fuentes/PoblacionDentro1hora.geojson";
  
  let aeropuertos = [];
  let aeropuertosPoligonos = [];
  let areasInfluenciaFeatures = [];
  let localidadesFeatures = [];
  let localidadesLayer = null;
  let poblacionUnaHoraPorIATA = {};

  let map = null;
  let tiemposLayer = null;
  let influenciaLayer = null;
  let airportMarker = null;
  let legendControl = null;
  let staticLegendEl = null;

  let currentIata = "";
  let airportSelect = null;
  let initializationPromise = null;
  
  const airportIcon = L.icon({
    iconUrl: "img/icons/AeropuertosSNA.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    tooltipAnchor: [0, -18]
  });

 const IS_REPORT_MODE = document.body?.classList.contains("page-informe-impacto");

document.addEventListener("DOMContentLoaded", () => {
  // En la página independiente, el propio JS carga el partial.
  // Dentro del informe, espera a que informe-impacto.js monte el partial.
  if (!IS_REPORT_MODE) {
    init();
  }
});

document.addEventListener("alcance:mounted", () => {
  initializationPromise = null;

  // Si el informe vuelve a montar el partial, el contenedor del mapa anterior
  // queda descartado. Hay que destruir el mapa Leaflet antes de recrearlo.
  if (map) {
    map.remove();
    map = null;
  }

  tiemposLayer = null;
  influenciaLayer = null;
  localidadesLayer = null;
  airportMarker = null;
  legendControl = null;

  init();
});

document.addEventListener("report:airport-changed", async (event) => {
  const iata = String(event.detail?.iata || event.detail?.airport || "").trim().toUpperCase();
  if (!iata) return;

  window.REPORT_AIRPORT_IATA = iata;

  await init();
  await renderAirport(iata);
});

async function init() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    await loadPartial();

    airportSelect = document.getElementById("alcanceAirportSelect");

    await loadData();

    fillAirportSelect();

    if (!map) {
      initMap();
    }

    const initialIata = getInitialAirport();

    if (initialIata && airportSelect) {
      airportSelect.value = initialIata;
    }

    await renderAirport(initialIata);

    if (airportSelect && airportSelect.dataset.bound !== "1") {
      airportSelect.dataset.bound = "1";

      airportSelect.addEventListener("change", () => {
        const iata = String(airportSelect.value || "").trim().toUpperCase();
        if (!iata) return;

        window.REPORT_AIRPORT_IATA = iata;

        renderAirport(iata);

        const url = new URL(window.location.href);
        url.searchParams.set("airport", iata);
        window.history.replaceState({}, "", url);
      });
    }
  })().catch((error) => {
    console.error("[Alcance territorial] Error de inicialización:", error);
    initializationPromise = null;
  });

  return initializationPromise;
}

async function loadPartial() {
  const mount = document.getElementById("alcanceTerritorialMount");
  if (!mount) return;

  // Si el partial ya fue montado por informe-impacto.js,
  // no lo volvemos a pedir ni lo pisamos.
  if (mount.querySelector("#alcanceTerritorialMap")) {
    return;
  }

  const response = await fetch(PARTIAL_URL);

  if (!response.ok) {
    mount.innerHTML = "<p>No se pudo cargar el contenido de alcance territorial.</p>";
    throw new Error(`No se pudo cargar ${PARTIAL_URL}`);
  }

  mount.innerHTML = await response.text();
}

  async function loadData() {
const [airports, polygons, areas, localidades, pob1hora] = await Promise.all([
  fetchJson(AIRPORTS_URL),
  fetchJsonSafe(AIRPORT_POLYGONS_URL),
  fetchJsonSafe(AREAS_URL),
  fetchJsonSafe(LOCALIDADES_URL),
  fetchJsonSafe(POBLACION_1H_URL)
]);

aeropuertos = (airports.features || [])
  .map(feature => feature.properties || {})
  .filter(props => props.IATA)
  .sort((a, b) => getAirportLabel(a).localeCompare(getAirportLabel(b), "es"));

aeropuertosPoligonos = polygons?.features || [];
areasInfluenciaFeatures = areas?.features || [];
localidadesFeatures = localidades?.features || [];
poblacionUnaHoraPorIATA = parsePoblacionUnaHora(pob1hora);
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${url}: ${response.status}`);
    }
    return await response.json();
  }

  async function fetchJsonSafe(url) {
    try {
      return await fetchJson(url);
    } catch (error) {
      console.warn(error);
      return { features: [] };
    }
  }

  function fillAirportSelect() {
    if (!airportSelect) return;

    airportSelect.innerHTML = "";

    aeropuertos.forEach(a => {
      const option = document.createElement("option");
      option.value = String(a.IATA || "").trim().toUpperCase();
      option.textContent = getAirportLabel(a);
      airportSelect.appendChild(option);
    });
  }

  function getInitialAirport() {
const params = new URLSearchParams(window.location.search);

const fromReport = String(
  window.REPORT_AIRPORT_IATA ||
  document.querySelector("#airportSelect")?.value ||
  ""
).trim().toUpperCase();

if (fromReport && aeropuertos.some(a => getAirportIata(a) === fromReport)) {
  return fromReport;
}

const fromUrl = String(params.get("airport") || "").trim().toUpperCase();

if (fromUrl && aeropuertos.some(a => getAirportIata(a) === fromUrl)) {
  return fromUrl;
}

    if (aeropuertos.some(a => getAirportIata(a) === "AEP")) {
      return "AEP";
    }

    return getAirportIata(aeropuertos[0]);
  }

function initMap() {
  const mapEl = document.getElementById("alcanceTerritorialMap");
  if (!mapEl) return;

  if (map) {
    map.remove();
    map = null;
  }

map = L.map(mapEl, {
  zoomControl: false,
  attributionControl: false,
  scrollWheelZoom: false,
  dragging: false,
  touchZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false
}).setView([-38, -64], 4);

mapEl.classList.add("is-clickable-map");
map.on("click", openFullInfluenceMap);

    map.createPane("pane_tiempos");
    map.getPane("pane_tiempos").style.zIndex = 410;

    map.createPane("pane_influencia");
    map.getPane("pane_influencia").style.zIndex = 430;

    map.createPane("pane_localidades");
    map.getPane("pane_localidades").style.zIndex = 440;

    map.createPane("pane_aeropuerto");
    map.getPane("pane_aeropuerto").style.zIndex = 450;

    L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      {
        maxZoom: 14,
        tms: true,
        attribution: "© IGN Argentina - Argenmap"
      }
    ).addTo(map);
  }

  function openFullInfluenceMap() {
  if (!currentIata) return;

  const url = `mapa_influencia.html?airport=${encodeURIComponent(currentIata)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
  
async function renderAirport(iata) {
  if (!map || !iata) return;

  currentIata = String(iata || "").trim().toUpperCase();

  const airport = aeropuertos.find(a => getAirportIata(a) === currentIata);
    if (!airport) return;

    clearMapLayers();

    const airportLabel = getAirportLabel(airport);
    setBind("airportLine", airportLabel);
renderTerritorialKpis(airport, currentIata);

await drawTravelTimeLayer(currentIata);
drawInfluenceAreaLayer(currentIata);
    drawAirportMarker(airport);
    drawLocalidadesLayer(airport);
    drawLegend(Boolean(influenciaLayer), Boolean(localidadesLayer));
    fitMapToLayers(airport);

    setTimeout(() => {
      map.invalidateSize();
      fitMapToLayers(airport);
    }, 250);
  }

  function clearMapLayers() {
    if (tiemposLayer) {
      map.removeLayer(tiemposLayer);
      tiemposLayer = null;
    }

    if (influenciaLayer) {
      map.removeLayer(influenciaLayer);
      influenciaLayer = null;
    }
    
if (localidadesLayer) {
  map.removeLayer(localidadesLayer);
  localidadesLayer = null;
}
    if (airportMarker) {
      map.removeLayer(airportMarker);
      airportMarker = null;
    }

    if (legendControl) {
      map.removeControl(legendControl);
      legendControl = null;
    }
    if (staticLegendEl) {
  staticLegendEl.remove();
  staticLegendEl = null;
}
  }

  async function drawTravelTimeLayer(iata) {
    const tiemposUrl = `img/Tiempos/Tiempos_${iata}.geojson`;

    try {
      const gj = await fetchJson(tiemposUrl);

      if (!gj?.features?.length) return;

      tiemposLayer = L.geoJSON(gj, {
        pane: "pane_tiempos",
        interactive: false,
        style: feature => {
          const props = feature.properties || {};
          const to = Number(
            props.ToBreak ??
            props.tobreak ??
            props.TOBREAK ??
            props.to_break ??
            props.TO_BREAK
          );

          let color = "#9ecae1";

          if (to === 60) color = "#08306b";
          else if (to === 120) color = "#2171b5";
          else if (to === 180) color = "#6baed6";

          return {
            color,
            weight: 1,
            fillColor: color,
            fillOpacity: 0.35
          };
        }
      }).addTo(map);
    } catch (error) {
      console.warn(`No se pudo cargar tiempos de viaje para ${iata}:`, error);
    }
  }

  function drawInfluenceAreaLayer(iata) {
let features = (areasInfluenciaFeatures || []).filter(feature => {
  const code = getInfluenceAreaCode(feature.properties || {});
  return code === iata;
});

if (!features.length) {
  console.warn(`No se encontró área de influencia para ${iata}.`);
  return;
}

const airport = aeropuertos.find(a => getAirportIata(a) === iata);
features = filterInfluenceFeaturesForDisplay(features, iata, airport);

if (!features.length) {
  console.warn(`No quedaron geometrías válidas para el área de influencia de ${iata}.`);
  return;
}

influenciaLayer = L.geoJSON(features, {
      pane: "pane_influencia",
      interactive: false,
      style: {
        color: "#ffb000",
        opacity: 1,
        weight: 3,
        dashArray: "8 5",
        lineCap: "round",
        lineJoin: "round",
        fill: false,
        fillOpacity: 0
      }
    }).addTo(map);

    influenciaLayer.bringToFront();
  }

  function drawAirportMarker(airport) {
    const center = getAirportCenterLatLng(airport);
    if (!center) return;

    const iata = getAirportIata(airport);

    airportMarker = L.marker(center, {
      icon: airportIcon,
      pane: "pane_aeropuerto",
      zIndexOffset: 1000
    }).addTo(map);

    airportMarker.bindTooltip(iata, {
      permanent: true,
      direction: "top",
      offset: [0, -4],
      className: "psn-tooltip"
    });
  }

function renderTerritorialKpis(airport, iata) {
  const poblacionRaw = airport?.["Población del Área de Influencia (Censo 2022)"];
  const poblacion = parseNumberFlexible(poblacionRaw);

  setBind(
    "poblacionInfluencia",
    Number.isFinite(poblacion) ? formatNumber(poblacion) : "–"
  );

  setBind(
    "poblacionUnaHoraPct",
    poblacionUnaHoraPorIATA[iata] || "–"
  );
}

function parsePoblacionUnaHora(geojson) {
  const result = {};

  (geojson?.features || []).forEach(feature => {
    const props = feature.properties || {};
    const iata = String(props.IATA || props.iata || "").trim().toUpperCase();

    if (!iata) return;

    result[iata] = String(props.Pob1hora || props.pob1hora || "–").trim();
  });

  return result;
}

function drawLocalidadesLayer(airport) {
  if (!map || !localidadesFeatures.length) return;

  const bounds = getCurrentMapDataBounds(airport);
  if (!bounds || !bounds.isValid()) return;

  const paddedBounds = bounds.pad(0.22);

  const features = localidadesFeatures.filter(feature =>
    featureIntersectsBounds(feature, paddedBounds)
  );

  if (!features.length) return;

  localidadesLayer = L.geoJSON(features, {
    pane: "pane_localidades",
    interactive: true,

    pointToLayer: (feature, latlng) => {
      return L.circleMarker(latlng, {
        radius: 2.6,
        color: "#1f2933",
        weight: 1,
        fillColor: "#ffffff",
        fillOpacity: 0.95
      });
    },

    style: {
      color: "#1f2933",
      weight: 0.8,
      fillColor: "#ffffff",
      fillOpacity: 0.65
    },

    onEachFeature: (feature, layer) => {
      const label = getLocalidadLabel(feature.properties || {});

      if (label) {
layer.bindTooltip(label, {
  permanent: false,
  sticky: true,
  direction: "top",
  offset: [0, -3],
  className: "localidad-tooltip"
});

layer.on("click", openFullInfluenceMap);
      }
    }
  }).addTo(map);
}

function getCurrentMapDataBounds(airport) {
  let bounds = null;

  if (tiemposLayer) {
    const b = tiemposLayer.getBounds();
    if (b.isValid()) bounds = b;
  }

  if (influenciaLayer) {
    const b = influenciaLayer.getBounds();
    if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
  }

  if (airportMarker) {
    const p = airportMarker.getLatLng();
    const b = L.latLngBounds(p, p);
    bounds = bounds ? bounds.extend(b) : b;
  }

  if (!bounds) {
    const center = getAirportCenterLatLng(airport);
    if (center) bounds = L.latLngBounds(center, center);
  }

  return bounds;
}

function featureIntersectsBounds(feature, bounds) {
  try {
    const tempLayer = L.geoJSON(feature);
    const featureBounds = tempLayer.getBounds();

    if (!featureBounds || !featureBounds.isValid()) return false;

    return bounds.intersects(featureBounds);
  } catch (error) {
    return false;
  }
}

function getLocalidadLabel(props) {
  return clean(
    props.nam ||
    props.NAM ||
    props.nombre ||
    props.NOMBRE ||
    props.localidad ||
    props.LOCALIDAD ||
    props.nomloc ||
    props.NOMLOC ||
    props.name ||
    props.NAME ||
    ""
  );
}

function parseNumberFlexible(value) {
  if (value === null || value === undefined || value === "") return NaN;

  if (typeof value === "number") return value;

  const cleanValue = String(value)
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();

  const number = Number(cleanValue);

  return Number.isFinite(number) ? number : NaN;
}
function isFuegianAirport(iata) {
  return iata === "USH" || iata === "RGA";
}

function getFuegianFocusBounds() {
  return L.latLngBounds(
    [-55.7, -70.4],  // sudoeste: Isla Grande de Tierra del Fuego
    [-49.8, -55.2]   // noreste: Islas Malvinas con aire
  );
}

function getSpecialFocusBounds(iata, airport) {
  if (!isFuegianAirport(iata)) return null;

  const bounds = getFuegianFocusBounds();

  const airportCenter = getAirportCenterLatLng(airport);

  if (airportCenter) {
    bounds.extend([
      airportCenter[0] - 0.25,
      airportCenter[1] - 0.35
    ]);

    bounds.extend([
      airportCenter[0] + 0.25,
      airportCenter[1] + 0.35
    ]);
  }

  if (tiemposLayer) {
    const tb = tiemposLayer.getBounds();
    if (tb.isValid()) bounds.extend(tb);
  }

  if (influenciaLayer) {
    const ib = influenciaLayer.getBounds();
    if (ib.isValid()) bounds.extend(ib);
  }

  return bounds;
}

function filterInfluenceFeaturesForDisplay(features, iata, airport) {
  if (!isFuegianAirport(iata)) return features;

  const specialBounds = getSpecialFocusBounds(iata, airport);
  if (!specialBounds) return features;

  return features
    .map(feature => filterFeatureToBounds(feature, specialBounds.pad(0.15)))
    .filter(Boolean);
}

function filterFeatureToBounds(feature, bounds) {
  if (!feature?.geometry) return null;

  const geom = feature.geometry;

  if (geom.type === "Polygon") {
    const temp = {
      type: "Feature",
      properties: feature.properties || {},
      geometry: {
        type: "Polygon",
        coordinates: geom.coordinates
      }
    };

    const b = L.geoJSON(temp).getBounds();
    return b.isValid() && bounds.intersects(b) ? temp : null;
  }

  if (geom.type === "MultiPolygon") {
    const kept = (geom.coordinates || []).filter(coords => {
      const temp = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: coords
        }
      };

      const b = L.geoJSON(temp).getBounds();
      return b.isValid() && bounds.intersects(b);
    });

    if (!kept.length) return null;

    return {
      type: "Feature",
      properties: feature.properties || {},
      geometry: {
        type: "MultiPolygon",
        coordinates: kept
      }
    };
  }

  return feature;
}
function formatNumber(value) {
  if (!Number.isFinite(Number(value))) return "–";

  return Number(value).toLocaleString("es-AR", {
    maximumFractionDigits: 0
  });
}
  
function buildTerritorialLegendHtml(hasInfluenceArea, hasLocalidades) {
  return `
    <div class="impacto-territorial-legend-title">Tiempos de viaje</div>

    <div class="impacto-territorial-legend-row">
      <span style="background:#08306b;border-color:#08306b;"></span>
      Hasta 1 h
    </div>

    <div class="impacto-territorial-legend-row">
      <span style="background:#2171b5;border-color:#2171b5;"></span>
      Entre 1 y 2 h
    </div>

    <div class="impacto-territorial-legend-row">
      <span style="background:#6baed6;border-color:#6baed6;"></span>
      Entre 2 y 3 h
    </div>

    ${hasInfluenceArea ? `
      <div class="impacto-territorial-legend-row impacto-territorial-legend-line">
        <span></span>
        Área de influencia aeroportuaria
      </div>
    ` : ""}

    ${hasLocalidades ? `
      <div class="impacto-territorial-legend-row impacto-territorial-legend-dot">
        <span></span>
        Localidades censales
      </div>
    ` : ""}
  `;
}

function drawStaticLegend(hasInfluenceArea, hasLocalidades) {
  if (staticLegendEl) {
    staticLegendEl.remove();
    staticLegendEl = null;
  }

  const mapCard = document.querySelector("#alcanceTerritorialMount .impacto-territorial-map-card");
  if (!mapCard) return;

  staticLegendEl = document.createElement("div");
  staticLegendEl.className = "impacto-territorial-static-legend";
  staticLegendEl.innerHTML = buildTerritorialLegendHtml(hasInfluenceArea, hasLocalidades);

  mapCard.appendChild(staticLegendEl);
}

function drawLegend(hasInfluenceArea, hasLocalidades) {
  if (IS_REPORT_MODE) {
    drawStaticLegend(hasInfluenceArea, hasLocalidades);
    return;
  }

  if (legendControl) {
    map.removeControl(legendControl);
    legendControl = null;
  }

  legendControl = L.control({ position: "bottomleft" });

  legendControl.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");
    div.innerHTML = buildTerritorialLegendHtml(hasInfluenceArea, hasLocalidades);
    return div;
  };

  legendControl.addTo(map);
}

function fitMapToLayers(airport) {
  if (!map) return;

  const iata = getAirportIata(airport);
  const specialBounds = getSpecialFocusBounds(iata, airport);

  if (specialBounds && specialBounds.isValid()) {
    map.fitBounds(specialBounds, {
      padding: [8, 8],
      maxZoom: 6
    });
    return;
  }

  let bounds = null;

  if (tiemposLayer) {
    const b = tiemposLayer.getBounds();
    if (b.isValid()) {
      bounds = b;
    }
  }

  if (influenciaLayer) {
    const b = influenciaLayer.getBounds();
    if (b.isValid()) {
      bounds = bounds ? bounds.extend(b) : b;
    }
  }

  if (airportMarker) {
    const p = airportMarker.getLatLng();
    const b = L.latLngBounds(p, p);
    bounds = bounds ? bounds.extend(b) : b;
  }

  if (bounds && bounds.isValid()) {
    map.fitBounds(bounds, {
      padding: [14, 14],
      maxZoom: 9
    });
    return;
  }

  const center = getAirportCenterLatLng(airport) || [-38, -64];
  map.setView(center, 7);
}

  function getAirportCenterLatLng(airport) {
    const iata = getAirportIata(airport);

    const polygonFeatures = (aeropuertosPoligonos || []).filter(feature => {
      const props = feature.properties || {};
      const code = String(
        props.IATA ||
        props.iata ||
        props.iata_code ||
        props.IATA_CODE ||
        ""
      ).trim().toUpperCase();

      return code === iata;
    });

    if (polygonFeatures.length) {
      const layer = L.geoJSON(polygonFeatures);
      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        const center = bounds.getCenter();
        return [center.lat, center.lng];
      }
    }

    const lat = airport["Lat"] || airport["LAT"];
    const lon = airport["Lon"] || airport["LON"] || airport["Long"];

    if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      return [Number(lat), Number(lon)];
    }

    return null;
  }

  function getInfluenceAreaCode(props) {
    return String(
      props.Areas2022 ||
      props.areas2022 ||
      props.AREAS2022 ||
      props.IATA ||
      props.iata ||
      props.iata_code ||
      props.IATA_CODE ||
      ""
    ).trim().toUpperCase();
  }

  function getAirportIata(airport) {
    return String(airport?.IATA || "").trim().toUpperCase();
  }

  function getAirportLabel(airport) {
    const iata = getAirportIata(airport);

    let name =
      clean(airport?.["Aeropuerto"]) ||
      clean(airport?.["Nombre del Aeropuerto"]) ||
      iata;

    if (iata === "AEP") {
      name = "Aeroparque Jorge Newbery";
    }

    return `${name} (${iata})`;
  }

  function clean(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

function setBind(name, value) {
  const scope = document.getElementById("alcanceTerritorialMount") || document;

  scope.querySelectorAll(`[data-bind="${name}"]`).forEach(el => {
    el.textContent = value ?? "–";
  });
}
})();
