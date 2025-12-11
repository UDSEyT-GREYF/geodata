const urlParams = new URLSearchParams(window.location.search);
const IATA_PARAM = (urlParams.get("airport") || "").toUpperCase();

let mapBig;
let paradasFeatures = [];
let terminalFeatures = [];
let aeropuertos = [];
let transportePorIATA = {};

function clean(text) {
  if (text === null || text === undefined) return "";
  return String(text).trim();
}

// Igual que en datos-clave, pero tolerando "Parada" o "ParadaAEP"
function parseTransporteCSV(text) {
  const result = {};
  if (!text) return result;

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return result;

  const headerLine = lines[0];
  const sep = headerLine.indexOf(";") !== -1 ? ";" : ",";
  const headers = headerLine.split(sep).map(h => h.trim().toUpperCase());

  const idxIATA  = headers.indexOf("IATA");
  const idxLINEA = headers.indexOf("LINEA");
  const idxPARADA = headers.findIndex(h => h === "PARADA" || h === "PARADAAEP");

  if (idxIATA === -1) return result;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(sep);
    const rawIata = (cols[idxIATA] || "").trim();
    if (!rawIata) continue;

    const iata = rawIata.toUpperCase();
    if (!result[iata]) result[iata] = [];

    const linea  = idxLINEA  !== -1 ? (cols[idxLINEA]  || "").trim() : "";
    const parada = idxPARADA !== -1 ? (cols[idxPARADA] || "").trim() : "";

    result[iata].push({ LINEA: linea, Parada: parada });
  }

  return result;
}

function getAirportCenterLatLng(aero) {
  if (!aero) return null;
  let lat = aero["Lat"] || aero["LAT"];
  let lon = aero["Lon"] || aero["LON"] || aero["Long"];

  if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
    return [Number(lat), Number(lon)];
  }
  return null;
}

function initBigMap() {
  mapBig = L.map("mapBig").setView([-34.6, -58.4], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapBig);
}

async function loadDataAndRender() {
  if (!IATA_PARAM) {
    document.getElementById("infoLineas").textContent =
      "No se indicó aeropuerto en la URL (?airport=IATA).";
    return;
  }

  try {
    // 1) CSV de líneas por aeropuerto
    try {
      const respTransp = await fetch("fuentes/Paradasapp.csv");
      const textTransp = await respTransp.text();
      transportePorIATA = parseTransporteCSV(textTransp);
    } catch (e) {
      console.warn("No se pudieron cargar las líneas de transporte:", e);
      transportePorIATA = {};
    }

    // 2) GeoJSON de paradas
    try {
      const respParadas = await fetch("fuentes/paradasapp.geojson");
      const gjParadas = await respParadas.json();
      paradasFeatures = gjParadas.features || [];
    } catch (e) {
      console.warn("No se pudieron cargar las paradas de transporte:", e);
      paradasFeatures = [];
    }

    // 3) GeoJSON de terminales
    try {
      const respTerm = await fetch("fuentes/terminalpax.geojson");
      const gjTerm = await respTerm.json();
      terminalFeatures = gjTerm.features || [];
    } catch (e) {
      console.warn("No se pudieron cargar las terminales:", e);
      terminalFeatures = [];
    }

    // 4) GeoJSON de aeropuertos (para centro / título)
    try {
      const respAerop = await fetch("fuentes/Datos_aeropuertos.geojson");
      const gjAerop = await respAerop.json();
      aeropuertos = (gjAerop.features || []).map(f => f.properties || {});
    } catch (e) {
      console.warn("No se pudieron cargar los aeropuertos:", e);
      aeropuertos = [];
    }

    // Render
    renderBigMapForIATA(IATA_PARAM);

  } catch (err) {
    console.error("Error cargando datos:", err);
    document.getElementById("infoLineas").textContent =
      "Error al cargar datos de transporte.";
  }
}

function renderBigMapForIATA(iataCode) {
  const airport = aeropuertos.find(a => String(a.IATA).toUpperCase() === iataCode);

  const nombre = airport
    ? (clean(airport["Aeropuerto"]) || clean(airport["Nombre del Aeropuerto"]) || iataCode)
    : iataCode;

  document.getElementById("mapTitle").textContent =
    `Mapa de transporte público – ${nombre} (${iataCode})`;

  // 1) Filtrar paradas para este aeropuerto
  const paradasIATA = (paradasFeatures || []).filter(f => {
    const p = f.properties || {};
    return String(p.IATA || "").toUpperCase() === iataCode;
  });

  // 2) Filtrar terminales para este aeropuerto
  const terminalesIATA = (terminalFeatures || []).filter(f => {
    const p = f.properties || {};
    const code = p.iata || p.IATA;
    return String(code || "").toUpperCase() === iataCode;
  });

  // 3) Dibujar terminales (polígonos) – bajo las paradas
  let terminalLayer = null;
  if (terminalesIATA.length) {
    terminalLayer = L.geoJSON(terminalesIATA, {
      style: {
        color: "#004b80",
        weight: 1,
        fillColor: "#cfe5ff",
        fillOpacity: 0.4
      },
      onEachFeature: (feature, layer) => {
        const etiqueta = feature.properties && (feature.properties.etiqueta || feature.properties.ETIQUETA);
        if (etiqueta) {
          layer.bindTooltip(etiqueta, {
            permanent: true,
            direction: "center",
            className: "psn-tooltip"
          });
        }
      }
    }).addTo(mapBig);
  }

  // 4) Dibujar paradas por encima
  let paradasLayer = null;
  if (paradasIATA.length) {
    paradasLayer = L.geoJSON(paradasIATA, {
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 6,
          color: "#1f2937",
          weight: 1,
          fillColor: "#f97316",
          fillOpacity: 0.95
        });
      },
      onEachFeature: (feature, layer) => {
        const nombreParada = feature.properties && feature.properties.name;
        if (nombreParada) {
          layer.bindTooltip(nombreParada, {
            permanent: true,
            direction: "top",
            offset: [0, -6],
            className: "psn-tooltip"
          });
        }
      }
    }).addTo(mapBig);
  }

  // 5) Ajustar vista (bounds terminal + paradas; si no, centro del aeropuerto)
  let bounds = null;
  if (terminalLayer) {
    const b1 = terminalLayer.getBounds();
    if (b1.isValid()) bounds = b1;
  }
  if (paradasLayer) {
    const b2 = paradasLayer.getBounds();
    if (b2.isValid()) {
      if (bounds) bounds.extend(b2);
      else bounds = b2;
    }
  }

  if (bounds && bounds.isValid()) {
    mapBig.fitBounds(bounds, { padding: [20, 20] });
  } else {
    const center = airport ? getAirportCenterLatLng(airport) : null;
    if (center) {
      mapBig.setView(center, 14);
    } else {
      mapBig.setView([-34.6, -58.4], 5);
    }
  }

  // 6) Info de líneas en el panel lateral
  const infoEl = document.getElementById("infoLineas");
  const dataLineas = transportePorIATA[iataCode] || [];

  if (!dataLineas.length) {
    infoEl.textContent = "No hay información de transporte público cargada para este aeropuerto.";
    return;
  }

  infoEl.innerHTML = dataLineas
    .map((t, idx) => {
      const linea  = t.LINEA ? `Línea ${t.LINEA}` : "Línea (sin dato)";
      const parada = t.Parada ? t.Parada : "";
      return `
        <div class="linea-item">
          <strong>${idx + 1}) ${linea}</strong><br>
          <span>${parada}</span>
        </div>
      `;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  initBigMap();
  loadDataAndRender();
});
