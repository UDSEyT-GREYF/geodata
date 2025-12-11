/* =============================
   VARIABLES GLOBALES
   ============================= */
let mapInfluencia;
let tiemposLayer = null;
let influenciaLayer = null;
let influenciaMarker = null;

let aeropuertos = [];
let aeropuertosPoligonos = [];
let areasInfluenciaFeatures = [];

const urlParams = new URLSearchParams(window.location.search);
const IATA_PARAM = (urlParams.get("airport") || "").toUpperCase();

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

/* =============================
   MAPA
   ============================= */
function initMapInfluencia() {
  mapInfluencia = L.map("map").setView([-38, -64], 4);

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
  if (influenciaMarker) {
    mapInfluencia.removeLayer(influenciaMarker);
    influenciaMarker = null;
  }

  const iataUpper = a.IATA ? String(a.IATA).trim().toUpperCase() : "";
  if (!iataUpper) return;

  /* TIEMPOS */
  const tiemposPath = `img/Tiempos/Tiempos_${iataUpper}.geojson`;

  fetch(tiemposPath)
    .then(resp => resp.ok ? resp.json() : null)
    .then(gj => {
      if (!gj || !gj.features || !gj.features.length) {
        ajustarVista(a);
        return;
      }

      tiemposLayer = L.geoJSON(gj, {
        style: (feature) => {
          const to = Number((feature.properties || {}).ToBreak);
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

      ajustarVista(a);
    })
    .catch(() => ajustarVista(a));

  /* ÁREA DE INFLUENCIA */
  if (Array.isArray(areasInfluenciaFeatures) && areasInfluenciaFeatures.length) {
    const featsInfl = areasInfluenciaFeatures.filter(f => {
      const code = String((f.properties || {}).IATA || "").toUpperCase();
      return code === iataUpper;
    });

    if (featsInfl.length) {
      influenciaLayer = L.geoJSON(featsInfl, {
        style: {
          color: "#FFD700",      // borde amarillo
          weight: 2,
          fillColor: "#FFD700",
          fillOpacity: 0.0       // transparente
        }
      }).addTo(mapInfluencia);
    }
  }

  /* MARKER */
  const center = getAirportCenterLatLng(a);
  if (center) {
    influenciaMarker = L.marker(center, { icon: airportIcon }).addTo(mapInfluencia);

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
    if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
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
    } catch {
      aeropuertosPoligonos = [];
    }

    try {
      const respInf = await fetch("fuentes/Areasinfluencia39.geojson");
      const gjInf = await respInf.json();
      areasInfluenciaFeatures = gjInf.features || [];
    } catch {
      areasInfluenciaFeatures = [];
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
  initMapInfluencia();
  loadDataAndRender();
});
