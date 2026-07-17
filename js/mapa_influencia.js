/* =============================
   VARIABLES GLOBALES
   ============================= */
let mapInfluencia;
let tiemposLayer = null;
let influenciaLayer = null;
let influenciaMarker = null;
let localidadesFeatures = [];
let localidadesLayer = null;
let influenciaLegend = null;

let aeropuertos = [];
let aeropuertosPoligonos = [];
let areasInfluenciaFeatures = [];

const urlParams = new URLSearchParams(window.location.search);
const IATA_PARAM = (urlParams.get("airport") || "").toUpperCase();
const EMBED_MODE = urlParams.get("embed") === "1";

const airportIcon = L.icon({
  iconUrl: "img/icons/AeropuertosSNA.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  tooltipAnchor: [0, -18]
});

function clean(text) {
  if (text === null || text === undefined) return "";
  return String(text).trim();
}
function getInfluenceAreaCode(props) {
  return String(
    props?.Areas2022 ||
    props?.areas2022 ||
    props?.AREAS2022 ||
    props?.IATA ||
    props?.iata ||
    props?.iata_code ||
    props?.IATA_CODE ||
    ""
  )
    .trim()
    .toUpperCase();
}
/* =============================
   MAPA BASE
   ============================= */
function initMapInfluencia() {
  mapInfluencia = L.map("map").setView([-38, -64], 4);
   mapInfluencia.createPane("pane_localidades");
mapInfluencia.getPane("pane_localidades").style.zIndex = 440;

  L.tileLayer(
    "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
    {
      maxZoom: 14,
      tms: true,
      attribution: "© IGN Argentina - Argenmap"
    }
  ).addTo(mapInfluencia);
}

/* =============================
   CENTRO DEL AEROPUERTO
   ============================= */
function getAirportCenterLatLng(a) {
  if (!a) return null;
  const iataCode = a.IATA;

  if (Array.isArray(aeropuertosPoligonos) && aeropuertosPoligonos.length) {
    const feats = aeropuertosPoligonos.filter(f => {
      const p = f.properties || {};
      return String(p.IATA).toUpperCase() === String(iataCode).toUpperCase();
    });

    if (feats.length > 0) {
      const layer = L.geoJSON(feats);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        const c = bounds.getCenter();
        return [c.lat, c.lng];
      }
    }
  }

  let lat = a["Lat"] || a["LAT"];
  let lon = a["Lon"] || a["LON"] || a["Long"];

  if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
    return [Number(lat), Number(lon)];
  }

  return null;
}

/* =============================
   ACTUALIZAR MAPA
   ============================= */
function updateInfluenciaMapForAirport(a) {
  if (!mapInfluencia) return;

  if (tiemposLayer) {
    mapInfluencia.removeLayer(tiemposLayer);
    tiemposLayer = null;
  }
  if (influenciaLayer) {
    mapInfluencia.removeLayer(influenciaLayer);
    influenciaLayer = null;
  }
   if (localidadesLayer) {
  mapInfluencia.removeLayer(localidadesLayer);
  localidadesLayer = null;
}
  if (influenciaMarker) {
    mapInfluencia.removeLayer(influenciaMarker);
    influenciaMarker = null;
  }
if (influenciaLegend) {
  mapInfluencia.removeControl(influenciaLegend);
  influenciaLegend = null;
}
  const iataUpper = a.IATA ? String(a.IATA).trim().toUpperCase() : "";
  if (!iataUpper) return;

  /* ----------- 1) Anillos de tiempo ----------- */
  const tiemposPath = `img/Tiempos/Tiempos_${iataUpper}.geojson`;

  fetch(tiemposPath)
    .then(resp => (resp.ok ? resp.json() : null))
    .then(gj => {
if (!gj || !gj.features || !gj.features.length) {
  drawLocalidadesLayer(a);
  drawInfluenciaLegend(Boolean(influenciaLayer), Boolean(localidadesLayer));
  ajustarVista(a);
  return;
}

      tiemposLayer = L.geoJSON(gj, {
        style: (feature) => {
          const props = feature.properties || {};
          const to = Number(props.ToBreak);
          let color;

          if (to === 60) color = "#08306b";
          else if (to === 120) color = "#2171b5";
          else if (to === 180) color = "#6baed6";
          else color = "#9ecae1";

          return {
            color,
            weight: 1,
            fillColor: color,
            fillOpacity: 0.35
          };
        }
      }).addTo(mapInfluencia);
       
drawLocalidadesLayer(a);
ajustarVista(a);
return;
    })
.catch(() => {
  console.warn("No se pudo cargar tiempos de viaje:", tiemposPath);
  drawLocalidadesLayer(a);
  drawInfluenciaLegend(Boolean(influenciaLayer), Boolean(localidadesLayer));
  ajustarVista(a);
});

/* ----------- 2) Área de influencia ----------- */
if (Array.isArray(areasInfluenciaFeatures) && areasInfluenciaFeatures.length) {
  const featsInfl = areasInfluenciaFeatures.filter(f => {
    const props = f.properties || {};
    const code = getInfluenceAreaCode(props);
    return code === iataUpper;
  });

  if (featsInfl.length) {
    influenciaLayer = L.geoJSON(featsInfl, {
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
    }).addTo(mapInfluencia);

    influenciaLayer.bringToFront();
     ajustarVista(a);
  } else {
    console.warn(
      `No se encontró área de influencia para ${iataUpper}. Campos disponibles:`,
      areasInfluenciaFeatures[0]?.properties
    );
  }
}

  /* ----------- 3) Punto del aeropuerto ----------- */
  const center = getAirportCenterLatLng(a);
  if (center) {
    influenciaMarker = L.marker(center, {
  icon: airportIcon,
  zIndexOffset: 1000
}).addTo(mapInfluencia);

    const iataLabel = a["IATA"] ? String(a["IATA"]).toUpperCase() : "";
    if (iataLabel) {
      influenciaMarker.bindTooltip(iataLabel, {
        permanent: true,
        direction: "top",
        offset: [0, -4],
        className: "psn-tooltip"
      });
    }
  }
}

function drawLocalidadesLayer(a) {
  if (!mapInfluencia || !localidadesFeatures.length) return;

  const bounds = getCurrentMapDataBounds(a);
  if (!bounds || !bounds.isValid()) return;

  const paddedBounds = bounds.pad(0.08);

  const features = localidadesFeatures.filter(feature =>
    featureIntersectsBounds(feature, paddedBounds)
  );

  if (!features.length) return;

 
  localidadesLayer = L.geoJSON(features, {
    pane: "pane_localidades",
    interactive: true,

    pointToLayer: (feature, latlng) => {
      return L.circleMarker(latlng, {
        radius: 2.8,
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
      const label = getLocalidadLabel(feature.properties || "");

      if (label) {
layer.bindTooltip(label, {
  permanent: false,
  sticky: true,
  direction: "top",
  offset: [0, -3],
  className: "localidad-tooltip"
});
      }
    }
  }).addTo(mapInfluencia);
}

function getCurrentMapDataBounds(a) {
  let bounds = null;

  if (tiemposLayer) {
    const b = tiemposLayer.getBounds();
    if (b.isValid()) bounds = b;
  }

  if (influenciaLayer) {
    const b = influenciaLayer.getBounds();
    if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
  }

  if (influenciaMarker) {
    const p = influenciaMarker.getLatLng();
    const b = L.latLngBounds(p, p);
    bounds = bounds ? bounds.extend(b) : b;
  }

  if (!bounds) {
    const center = getAirportCenterLatLng(a);
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

function drawInfluenciaLegend(hasInfluenceArea, hasLocalidades) {
  if (influenciaLegend) {
    mapInfluencia.removeControl(influenciaLegend);
    influenciaLegend = null;
  }

  influenciaLegend = L.control({ position: "bottomleft" });

  influenciaLegend.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");

    div.style.background = "rgba(255, 255, 255, 0.96)";
    div.style.border = "1px solid #d0d7e2";
    div.style.borderRadius = "4px";
    div.style.padding = "5px 7px";
    div.style.fontSize = "11px";
    div.style.lineHeight = "1.35";
    div.style.color = "#111111";
    div.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.16)";

    div.innerHTML = `
      <div style="font-weight:800; margin-bottom:3px;">Tiempos de viaje</div>

      <div>
        <span style="display:inline-block;width:10px;height:10px;background:#08306b;margin-right:4px;border:1px solid #08306b;"></span>
        Hasta 1 h
      </div>

      <div>
        <span style="display:inline-block;width:10px;height:10px;background:#2171b5;margin-right:4px;border:1px solid #2171b5;"></span>
        Entre 1 y 2 h
      </div>

      <div>
        <span style="display:inline-block;width:10px;height:10px;background:#6baed6;margin-right:4px;border:1px solid #6baed6;"></span>
        Entre 2 y 3 h
      </div>

      ${hasInfluenceArea ? `
        <div style="margin-top:4px;">
          <span style="display:inline-block;width:18px;height:0;border-top:2px dashed #ffb000;margin-right:4px;vertical-align:middle;"></span>
          Área de influencia aeroportuaria
        </div>
      ` : ""}

      ${hasLocalidades ? `
        <div style="margin-top:4px;">
          <span style="display:inline-block;width:8px;height:8px;background:#ffffff;border:1.4px solid #1f2933;border-radius:50%;margin-right:6px;"></span>
          Localidades censales
        </div>
      ` : ""}
    `;

    return div;
  };

  influenciaLegend.addTo(mapInfluencia);
}

/* =============================
   AJUSTAR VISTA
   ============================= */
function ajustarVista(a) {
  if (!mapInfluencia) return;

  let bounds = null;

  if (tiemposLayer) {
    const b = tiemposLayer.getBounds();
    if (b.isValid()) bounds = b;
  }

  if (influenciaLayer) {
    const b = influenciaLayer.getBounds();
    if (b.isValid()) {
      bounds = bounds ? bounds.extend(b) : b;
    }
  }

  if (influenciaMarker) {
    const m = influenciaMarker.getLatLng();
    const b = L.latLngBounds(m, m);
    bounds = bounds ? bounds.extend(b) : b;
  }

  const fallbackCenter = getAirportCenterLatLng(a) || [-38, -64];

  if (bounds && bounds.isValid()) {
    setTimeout(() => {
      mapInfluencia.invalidateSize();
      mapInfluencia.fitBounds(bounds, { padding: [10, 10] });
    }, 0);
  } else {
    setTimeout(() => {
      mapInfluencia.invalidateSize();
      mapInfluencia.setView(fallbackCenter, 7);
    }, 0);
  }
}

/* =============================
   CARGA DE DATOS
   ============================= */
async function loadDataAndRender() {
  if (!IATA_PARAM) {
    document.getElementById("mapSubtitle").textContent =
      "No se indicó aeropuerto en la URL (?airport=IATA).";
    return;
  }

  try {
    const respAero = await fetch("fuentes/Datos_aeropuertos.geojson");
    const gjAero = await respAero.json();
    aeropuertos = (gjAero.features || []).map(f => f.properties || {});

    try {
      const respPol = await fetch("fuentes/poligonos_aeropuertos.geojson");
      const gjPol = await respPol.json();
      aeropuertosPoligonos = gjPol.features || [];
    } catch (e) {
      console.warn("No se pudieron cargar poligonos_aeropuertos.geojson:", e);
      aeropuertosPoligonos = [];
    }

    try {
      const respInf = await fetch("fuentes/Areasinfluencia39.geojson");
      const gjInf = await respInf.json();
      areasInfluenciaFeatures = gjInf.features || [];
    } catch (e) {
      console.warn("No se pudieron cargar Areasinfluencia39.geojson:", e);
      areasInfluenciaFeatures = [];
    }
try {
  const respLoc = await fetch("fuentes/INDEC/localidades_censales.geojson");
  const gjLoc = await respLoc.json();
  localidadesFeatures = gjLoc.features || [];
} catch (e) {
  console.warn("No se pudieron cargar localidades_censales.geojson:", e);
  localidadesFeatures = [];
}
    const a = aeropuertos.find(x =>
      String(x.IATA).toUpperCase() === IATA_PARAM
    );

    if (!a) {
      document.getElementById("mapSubtitle").textContent =
        `No se encontraron datos para el aeropuerto ${IATA_PARAM}.`;
      return;
    }

    const nombre = clean(a["Aeropuerto"]) || clean(a["Nombre del Aeropuerto"]) || IATA_PARAM;
    const anio = a["Año"] || "";

    document.getElementById("mapTitle").textContent =
      `Área de influencia – ${nombre} (${a.IATA})`;
    document.getElementById("mapSubtitle").textContent =
      `Tiempos de viaje por carretera y área de influencia aeroportuaria · Año ${anio}`;

    updateInfluenciaMapForAirport(a);

  } catch (err) {
    console.error("Error cargando datos:", err);
    document.getElementById("mapSubtitle").textContent =
      "Error al cargar los datos del aeropuerto o del área de influencia.";
  }
}

/* =============================
   INICIO
   ============================= */
document.addEventListener("DOMContentLoaded", () => {
  if (EMBED_MODE) {
    document.body.classList.add("is-embed");
  }

  initMapInfluencia();
  loadDataAndRender();
});
