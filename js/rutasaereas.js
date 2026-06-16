/* global L */
(() => {
  "use strict";

  const DATA_SOURCE = "fuentes/rutasaereas/Vuelos_semana_28_07_2025.csv";
  const SNA_AIRPORTS_SOURCE = "fuentes/Datos_aeropuertos.geojson";
  const OURAIRPORTS_SOURCE = "fuentes/ourairports.csv";

  const DEFAULT_CENTER = [-38.4, -63.6];
  const DEFAULT_ZOOM = 4;
  const SIM_DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_REAL_DURATION_MS = 60 * 1000;

  // El SVG del avión está dibujado con la nariz hacia arriba/norte.
  // El bearing calculado también usa 0° = norte, así que no necesita compensación.
  const PLANE_ROTATION_OFFSET_DEG = 0;

  const FIELD_ALIASES = {
    id: ["id", "vuelo", "flight", "flight_id", "nro_vuelo", "numero_vuelo", "Nro Vuelo", "Vuelo", "Nº Vuelo", "N° Vuelo", "Callsign", "callsign"],
    airline: ["airline", "aerolinea", "aerolínea", "linea_aerea", "empresa", "carrier", "Aerolínea", "Aerolinea", "Empresa", "Línea Aérea", "Aerolinea Nombre", "aerolinea_nombre"],
    origin: ["origin", "origen", "origen_iata", "Origen IATA", "Origen", "IATA_ORIGEN", "Origen_IATA", "origin_iata"],
    destination: ["destination", "destino", "destino_iata", "Destino IATA", "Destino", "IATA_DESTINO", "Destino_IATA", "destination_iata"],
    dep: ["dep", "departure", "salida", "hora_salida", "fecha_hora_salida", "FechaHoraSalida", "STD", "Salida", "Hora Salida", "Fecha Hora Salida", "FechaHora_Local", "fechahora_local"],
    arr: ["arr", "arrival", "llegada", "hora_llegada", "fecha_hora_llegada", "FechaHoraLlegada", "STA", "Llegada", "Hora Llegada", "Fecha Hora Llegada", "9 FechaHora_Llegada_Estimada", "9_fechahora_llegada_estimada"],
    date: ["date", "fecha", "Fecha", "Fecha Local", "Fecha_Local", "Día", "Dia", "FechaHora_Local", "fechahora_local"],
    passengers: ["passengers", "pasajeros", "Pax", "PAX", "Pasajeros", "pax"],
    seats: ["seats", "asientos", "Asientos", "Capacidad", "Asientos_Pax", "asientos_pax"],
    route: ["RutaCompleta", "rutacompleta", "route", "ruta"],
    weekday: ["DíaSemana", "DiaSemana", "dia_semana", "diasemana"],
    movementType: ["Tipo de Movimiento", "tipo_de_movimiento"],
    flightClass: ["Clase de vuelo regular o no regular y av. gral", "clase_de_vuelo_regular_o_no_regular_y_av_gral"],
    aircraft: ["9 Modelo aeronave matricula AA2000", "9_modelo_aeronave_matricula_aa2000", "modelo_aeronave", "aircraft"],
    distanceKm: ["DistanciaKM", "distanciakm", "distancia_km"],
    durationMinutes: ["9 Tiempo_Vuelo_Estimado_Min", "9_tiempo_vuelo_estimado_min", "tiempo_vuelo_estimado_min", "duration_minutes"]
  };

  // Respaldo mínimo para que el demo funcione si todavía no están los catálogos del proyecto.
  // En producción, las coordenadas salen de fuentes/ourairports.csv.
  const AIRPORT_CATALOG_FALLBACK = {
    AEP: { name: "Aeroparque Jorge Newbery", latitude: -34.5592, longitude: -58.4156, countryCode: "AR" },
    EZE: { name: "Ministro Pistarini", latitude: -34.8222, longitude: -58.5358, countryCode: "AR" },
    EPA: { name: "El Palomar", latitude: -34.6099, longitude: -58.6126, countryCode: "AR" },
    FDO: { name: "San Fernando", latitude: -34.4532, longitude: -58.5896, countryCode: "AR" },
    COR: { name: "Córdoba", latitude: -31.3236, longitude: -64.2080, countryCode: "AR" },
    MDZ: { name: "Mendoza", latitude: -32.8317, longitude: -68.7929, countryCode: "AR" },
    BRC: { name: "Bariloche", latitude: -41.1512, longitude: -71.1575, countryCode: "AR" },
    SLA: { name: "Salta", latitude: -24.8560, longitude: -65.4862, countryCode: "AR" },
    IGR: { name: "Iguazú", latitude: -25.7373, longitude: -54.4734, countryCode: "AR" },
    USH: { name: "Ushuaia", latitude: -54.8433, longitude: -68.2958, countryCode: "AR" },
    FTE: { name: "El Calafate", latitude: -50.2803, longitude: -72.0531, countryCode: "AR" },
    NQN: { name: "Neuquén", latitude: -38.9490, longitude: -68.1557, countryCode: "AR" },
    TUC: { name: "Tucumán", latitude: -26.8409, longitude: -65.1049, countryCode: "AR" },
    BHI: { name: "Bahía Blanca", latitude: -38.7250, longitude: -62.1693, countryCode: "AR" },
    GRU: { name: "São Paulo Guarulhos", latitude: -23.4356, longitude: -46.4731, countryCode: "BR" },
    SCL: { name: "Santiago de Chile", latitude: -33.3930, longitude: -70.7858, countryCode: "CL" },
    MVD: { name: "Montevideo", latitude: -34.8384, longitude: -56.0308, countryCode: "UY" }
  };
const AIRPORT_COORD_OVERRIDES = {
  AMS: {
    name: "Amsterdam Schiphol",
    latitude: 52.308601,
    longitude: 4.76389,
    countryCode: "NL",
    continent: "EU",
    municipality: "Amsterdam"
  },
  RAI: {
    name: "Praia Nelson Mandela",
    latitude: 14.941126,
    longitude: -23.484728,
    countryCode: "CV",
    continent: "AF",
    municipality: "Praia"
  }
};
  const AIRLINE_COLOR_RULES = [
  {
    label: "Aerolíneas Argentinas / Austral",
    color: "#004B80",
    names: ["AEROLINEAS ARGENTINAS", "AUSTRAL"],
    exact: ["AR"]
  },
  {
    label: "JetSMART Airlines",
    color: "#B22222",
    names: ["JETSMART", "JETSMART AIRLINES", "JA"]
  },
  {
    label: "Flybondi",
    color: "#F6C500",
    names: ["FLYBONDI", "FB", "FO"]
  },
  {
    label: "Gol Transportes Aéreos",
    color: "#F37021",
    names: ["GOL", "GOL TRANSPORTES AEREOS"]
  },
  {
    label: "LATAM",
    color: "#5A2D82",
    names: ["LATAM"]
  },
  {
    label: "Copa Airlines",
    color: "#003DA6",
    names: ["COPA", "COPA AIRLINES"]
  },
  {
    label: "Iberia Airlines",
    color: "#C60C30",
    names: ["IBERIA", "IBERIA AIRLINES"]
  },
  {
    label: "LATAM Perú",
    color: "#C2185B",
    names: ["LATAM PERU", "LATAM PERÚ"]
  },
  {
    label: "TAM Linhas Aéreas",
    color: "#E30613",
    names: ["TAM", "TAM LINHAS AEREAS", "TAM LINHAS AÉREAS"]
  },
  {
    label: "American Airlines",
    color: "#0078D2",
    names: ["AMERICAN", "AMERICAN AIRLINES"]
  },
  {
    label: "Avianca",
    color: "#D50032",
    names: ["AVIANCA"]
  },
  {
    label: "Sky Airline",
    color: "#E6007E",
    names: ["SKY", "SKY AIRLINE"]
  },
  {
    label: "Air Europa",
    color: "#183A8D",
    names: ["AIR EUROPA"]
  },
  {
    label: "KLM",
    color: "#00AEEF",
    names: ["KLM"]
  },
  {
    label: "ITA Airways",
    color: "#0066CC",
    names: ["ITA", "ITA AIRWAYS"]
  },
  {
    label: "Delta Air Lines",
    color: "#862633",
    names: ["DELTA", "DELTA AIR LINES"]
  },
  {
    label: "United Airlines",
    color: "#005DAA",
    names: ["UNITED", "UNITED AIRLINES"]
  },
  {
    label: "Lufthansa",
    color: "#05164D",
    names: ["LUFTHANSA"]
  },
  {
    label: "Andes Líneas Aéreas",
    color: "#2E7D32",
    names: ["ANDES", "ANDES LINEAS AEREAS", "ANDES LÍNEAS AÉREAS"]
  },
  {
    label: "Aeroméxico",
    color: "#003B5C",
    names: ["AEROMEXICO", "AEROMÉXICO"]
  },
  {
    label: "Air France",
    color: "#002157",
    names: ["AIR FRANCE"]
  },
  {
    label: "Boliviana de Aviación",
    color: "#009739",
    names: ["BOLIVIANA", "BOLIVIANA DE AVIACION", "BOLIVIANA DE AVIACIÓN", "BOA"]
  },
  {
    label: "Turkish Airlines",
    color: "#C70A0C",
    names: ["TURKISH", "TURKISH AIRLINES"]
  },
  {
    label: "Arajet",
    color: "#25B7A0",
    names: ["ARAJET"]
  },
  {
    label: "British Airways",
    color: "#2E5AAC",
    names: ["BRITISH", "BRITISH AIRWAYS"]
  },
  {
    label: "Ethiopian Airlines",
    color: "#078930",
    names: ["ETHIOPIAN", "ETHIOPIAN AIRLINES"]
  },
  {
    label: "Emirates Airlines",
    color: "#B8860B",
    names: ["EMIRATES", "EMIRATES AIRLINES"]
  },
  {
    label: "Air Canada",
    color: "#E31B23",
    names: ["AIR CANADA"]
  }
];

const DEFAULT_FLIGHT_COLOR = "#FFFFFF";
  
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
    ourAirportsIndex: {},
    snaAirports: new Map(),
    flightsRaw: [],
    flightsAll: [],
    flights: [],
availableDays: [],
selectedDay: "",
selectedDayFromIdx: 0,
selectedDayToIdx: 0,
simStartDate: null,
    simEndDate: null,
    simPeriodMs: SIM_DAY_MS,
    staticRoutes: [],
    airports: new Map(),
    routesLayer: null,
trailsLayer: null,
completedFlightsLayer: null,
planesLayer: null,
airportsLayer: null,
activeFlights: new Map(),
completedFlights: new Map(),
    playing: true,
    simTime: 0,
    lastFrame: performance.now(),
    realDurationMs: DEFAULT_REAL_DURATION_MS,
    showRoutes: false,
    showTrails: true,
    showAirports: true,
    skippedRows: 0,
    catalogWarnings: []
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

  function normalizeHeader(v) {
    return clean(v)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function getFirst(obj, keys) {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null && clean(obj[key]) !== "") return obj[key];
    }
    return "";
  }

  function firstNonEmpty(obj, keys, fallback = "") {
    for (const key of keys) {
      if (!obj) continue;
      const value = obj[key];
      if (value !== undefined && value !== null && clean(value) !== "") return value;
    }
    return fallback;
  }

  function toNumberOrNull(value) {
    const n = parseNumber(value);
    return Number.isFinite(n) ? n : null;
  }

  function parseNumber(value) {
    if (value === null || value === undefined) return NaN;
    let s = String(value).trim();
    if (!s) return NaN;
    s = s.replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
    if (!s) return NaN;
    const commaCount = (s.match(/,/g) || []).length;
    const dotCount = (s.match(/\./g) || []).length;
    if (commaCount && dotCount) {
      s = s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
    } else if (commaCount) {
      s = s.replace(",", ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function detectSep(headerLine) {
    if (headerLine.includes("\t")) return "\t";
    if (headerLine.includes(";")) return ";";
    return ",";
  }

  function splitDelimitedLine(line, sep) {
    const cols = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === sep && !inQuotes) {
        cols.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    cols.push(current);
    return cols;
  }

  function parseCSV(text) {
    if (!text) return [];
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");
    if (lines.length < 2) return [];
    const sep = detectSep(lines[0]);
    const headers = splitDelimitedLine(lines[0], sep).map(normalizeHeader);
    return lines.slice(1).map((line) => {
      const cols = splitDelimitedLine(line, sep);
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });
      return row;
    });
  }

  async function readTextSmart(response) {
    const buffer = await response.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    return text;
  }

  async function loadJson(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  }

  async function loadText(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return readTextSmart(resp);
  }

  async function loadFlightDataSource(url) {
    const lower = clean(url).toLowerCase();

    if (lower.endsWith(".csv")) {
      const text = await loadText(url);
      return {
        rows: parseCSV(text),
        sourceText: url,
        dateText: "",
        kindText: "Archivo CSV de vuelos reales"
      };
    }

    const data = await loadJson(url);
    return {
      rows: Array.isArray(data) ? data : (data.flights || []),
      sourceText: data.source || data.fuente || url,
      dateText: data.date || data.fecha || "",
      kindText: data.data_kind === "demo" ? "Muestra de prueba" : "Archivo de vuelos"
    };
  }

  function getRouteCodesFromRow(row) {
    const route = clean(getFirst(row, FIELD_ALIASES.route));
    if (!route) return { origin: "", destination: "" };

    const parts = route
      .split(/\s*[-–—>→]+\s*/g)
      .map(v => clean(v).toUpperCase())
      .filter(Boolean);

    if (parts.length < 2) return { origin: "", destination: "" };

    return {
      origin: parts[0],
      destination: parts[parts.length - 1]
    };
  }

  function getLocalDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
function formatDaySelectLabel(date) {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function buildWeekSelectLabel(days) {
  if (!days || !days.length) return "";

  const first = days[0].date;
  const last = days[days.length - 1].date;

  const firstTxt = first.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "numeric"
  });

  const lastTxt = last.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  return `${firstTxt} al ${lastTxt}`;
}
  function getDateFromKey(key) {
    const m = clean(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  }
function formatWeekdayTick(date) {
  const days = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  return days[date.getDay()] || "";
}
  function formatDayLong(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

function formatPeriodLabel() {
  const r = getSelectedDayRange();
  if (!r.from || !r.to) return "";

  if (r.isFull && state.availableDays.length > 1) {
    return "Semana completa";
  }

  if (r.isSingle) {
    return "";
  }

  const count = r.toIdx - r.fromIdx + 1;
  return `${count} días seleccionados`;
}

  function setTimeRangeMax() {
    const range = q("timeRange");
    if (!range) return;
    const max = Math.max(1, Math.floor(state.simPeriodMs || SIM_DAY_MS));
    range.max = String(max);
    range.step = max > SIM_DAY_MS ? "300000" : "60000";
    range.value = String(Math.max(0, Math.min(max, Math.floor(state.simTime || 0))));
  }

  function parseCoordinateNumber(value, type = "lat", context = {}) {
    if (value === null || value === undefined) return NaN;
    const raw = String(value)
      .trim()
      .replace(/^'+/, "")
      .replace(/'+$/, "")
      .replace(/\s+/g, "");
    if (!raw) return NaN;

    const countryCode = clean(context.countryCode).toUpperCase();
    const continent = clean(context.continent).toUpperCase();

    const COUNTRY_COORD_BOUNDS = {
      AR: { lat: [-56, -21], lon: [-74, -52] },
      UY: { lat: [-36, -30], lon: [-59, -53] },
      PY: { lat: [-28, -19], lon: [-63, -54] },
      BR: { lat: [-35, 6], lon: [-75, -32] },
      CL: { lat: [-56, -17], lon: [-76, -66] },
      PE: { lat: [-19, 1], lon: [-82, -68] },
      BO: { lat: [-23, -9], lon: [-70, -57] },
      CO: { lat: [-5, 14], lon: [-82, -66] },
      EC: { lat: [-6, 2], lon: [-82, -75] },
      VE: { lat: [0, 13], lon: [-74, -59] },
      US: { lat: [18, 72], lon: [-170, -60] },
      MX: { lat: [14, 33], lon: [-119, -86] },
      PA: { lat: [7, 10], lon: [-83, -77] },
      ES: { lat: [35, 44.5], lon: [-10, 5] },
      // Correcciones para evitar errores de decimal en ourairports.csv
      NL: { lat: [50, 54], lon: [3, 8] },
      CV: { lat: [14, 18], lon: [-26, -22] }
    };

    const CONTINENT_COORD_BOUNDS = {
      SA: { lat: [-60, 15], lon: [-90, -30] },
      NA: { lat: [5, 85], lon: [-170, -50] },
      EU: { lat: [34, 72], lon: [-25, 60] },
      AF: { lat: [-40, 38], lon: [-20, 55] },
      AS: { lat: [-10, 80], lon: [25, 180] },
      OC: { lat: [-50, 10], lon: [110, 180] },
      AN: { lat: [-90, -60], lon: [-180, 180] }
    };

    const preferredBounds = COUNTRY_COORD_BOUNDS[countryCode] || CONTINENT_COORD_BOUNDS[continent] || null;
    const maxAbs = type === "lon" ? 180 : 90;

    function isGlobalValid(n) {
      return Number.isFinite(n) && Math.abs(n) <= maxAbs;
    }

    function isPreferredValid(n) {
      if (!preferredBounds || !isGlobalValid(n)) return false;
      const range = preferredBounds[type === "lon" ? "lon" : "lat"];
      return n >= range[0] && n <= range[1];
    }

    const normalized = raw.replace(",", ".").replace(/[^0-9.-]/g, "");
    const sign = normalized.trim().startsWith("-") ? -1 : 1;
    const candidates = new Set();
    const direct = Number(normalized);
    if (Number.isFinite(direct)) candidates.add(direct);

    const digits = normalized.replace(/[^0-9]/g, "");
    if (digits) {
      const base = Number(digits);
      if (Number.isFinite(base)) {
        const maxDecimals = Math.min(digits.length, 16);
        for (let decimals = 0; decimals <= maxDecimals; decimals++) {
          candidates.add(sign * (base / Math.pow(10, decimals)));
        }
      }
    }

    const list = Array.from(candidates);
    const preferred = list.find(isPreferredValid);
    if (Number.isFinite(preferred)) return preferred;
    const global = list.find(isGlobalValid);
    return Number.isFinite(global) ? global : NaN;
  }

  function parseOurAirportsCSV(text) {
    const rows = parseCSV(text);
    const index = {};

    rows.forEach((row) => {
      const iata = clean(firstNonEmpty(row, ["iata", "iata_code", "iata_code_"])).toUpperCase();
      const oaci = clean(firstNonEmpty(row, ["oaci", "icao", "icao_code"])).toUpperCase();
      const continent = clean(firstNonEmpty(row, ["continent"])).toUpperCase();
      const countryCode = clean(firstNonEmpty(row, ["country", "country_code", "iso_country", "pais_codigo"])).toUpperCase();

      const meta = {
        iata,
        oaci,
        continent,
        countryCode,
        municipality: clean(firstNonEmpty(row, ["municipality", "ciudad", "city"])),
        name: clean(firstNonEmpty(row, ["name", "airport_name", "nombre"])),
        latitude: parseCoordinateNumber(firstNonEmpty(row, ["latitude", "latitude_deg", "lat"]), "lat", { continent, countryCode }),
        longitude: parseCoordinateNumber(firstNonEmpty(row, ["longitude", "longitude_deg", "lon", "lng"]), "lon", { continent, countryCode })
      };

      if (iata) index[iata] = meta;
      if (oaci) index[oaci] = meta;
    });

    return index;
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
      renderer: L.canvas({ padding: 0.5 }),
      maxBounds: [[-60.0, -180.0], [75.0, 40.0]],
      maxBoundsViscosity: 0.55
    });

    state.map.createPane("rutasBasePane");
    state.map.getPane("rutasBasePane").style.zIndex = 410;
state.map.createPane("rutasCompletedPane");
state.map.getPane("rutasCompletedPane").style.zIndex = 505;

state.map.createPane("rutasTrailPane");
state.map.getPane("rutasTrailPane").style.zIndex = 520;
    state.map.createPane("rutasAirportPane");
    state.map.getPane("rutasAirportPane").style.zIndex = 560;
    state.map.createPane("rutasPlanePane");
    state.map.getPane("rutasPlanePane").style.zIndex = 650;

state.routesLayer = L.layerGroup().addTo(state.map);
state.completedFlightsLayer = L.layerGroup().addTo(state.map);
state.trailsLayer = L.layerGroup().addTo(state.map);
state.airportsLayer = L.layerGroup().addTo(state.map);
state.planesLayer = L.layerGroup().addTo(state.map);

    BASEMAP_CONFIGS.forEach((cfg) => state.baseLayers.set(cfg.id, { cfg, layer: makeBaseLayer(cfg) }));
    setBaseLayer("argenmap");

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

  async function loadCatalogs() {
    let snaCount = 0;
    let ourCount = 0;

    try {
      const gj = await loadJson(SNA_AIRPORTS_SOURCE);
      const features = Array.isArray(gj.features) ? gj.features : [];
      features.forEach((feature) => {
        const p = feature.properties || {};
        const iata = clean(firstNonEmpty(p, ["IATA", "iata", "iata_code", "cod_iata", "COD_IATA", "codigo_iata", "Código IATA"])).toUpperCase();
        if (!iata) return;
        const name = clean(firstNonEmpty(p, ["Aeropuerto", "aeropuerto", "Nombre del Aeropuerto", "nombre", "name", "Ciudad", "Localidad"], iata));
        state.snaAirports.set(iata, { iata, name, properties: p });
      });
      snaCount = state.snaAirports.size;
    } catch (err) {
      console.warn("No se pudo cargar Datos_aeropuertos.geojson; se dibujarán solo endpoints disponibles.", err);
    }

    try {
      const text = await loadText(OURAIRPORTS_SOURCE);
      state.ourAirportsIndex = parseOurAirportsCSV(text);
      ourCount = Object.keys(state.ourAirportsIndex).length;
    } catch (err) {
      console.warn("No se pudo cargar ourairports.csv; se usa respaldo mínimo para demo.", err);
      state.ourAirportsIndex = { ...AIRPORT_CATALOG_FALLBACK };
    }

    return { snaCount, ourCount };
  }

function getAirportMeta(code) {
  const key = clean(code).toUpperCase();
  if (!key) return null;
  return AIRPORT_COORD_OVERRIDES[key] || state.ourAirportsIndex[key] || AIRPORT_CATALOG_FALLBACK[key] || null;
}

  function getAirportLatLngByCode(code) {
    const key = clean(code).toUpperCase();
    const meta = getAirportMeta(key);

    if (
      meta &&
      Number.isFinite(Number(meta.latitude)) &&
      Number.isFinite(Number(meta.longitude))
    ) {
      return [Number(meta.latitude), Number(meta.longitude)];
    }

    if (!state.catalogWarnings.includes(key)) {
      state.catalogWarnings.push(key);
      console.warn("No se encontraron coordenadas en ourairports.csv para:", key);
    }
    return null;
  }

  function getCountryCode(code) {
    return clean(getAirportMeta(code)?.countryCode).toUpperCase();
  }

  function isArgentinaAirport(code) {
    const c = getCountryCode(code);
    return c === "AR" || c === "ARG" || c === "ARGENTINA";
  }

  function resolveSpecialAirportCode(code, otherCode) {
    const key = clean(code).toUpperCase();
    if (key !== "BUE") return key;

    // BUE es un nodo agregado. Para cabotaje se ubica en AEP y para internacional en EZE.
    return isArgentinaAirport(otherCode) || state.snaAirports.has(clean(otherCode).toUpperCase()) ? "AEP" : "EZE";
  }

  async function loadFlights() {
    const dataStatus = q("dataStatus");
    const catalogs = await loadCatalogs();

    try {
      const loaded = await loadFlightDataSource(DATA_SOURCE);
      state.flightsRaw = loaded.rows;
      if (dataStatus) {
        dataStatus.innerHTML = `
          ${escapeHtml(loaded.kindText)} cargado: <code>${escapeHtml(DATA_SOURCE)}</code><br>
          Fuente: ${escapeHtml(loaded.sourceText)}${loaded.dateText ? `<br>Fecha: ${escapeHtml(loaded.dateText)}` : ""}<br>
          Registros leídos: ${state.flightsRaw.length.toLocaleString("es-AR")}<br>
          SNA: ${catalogs.snaCount.toLocaleString("es-AR")} aeropuertos · ourairports: ${catalogs.ourCount.toLocaleString("es-AR")} códigos
        `;
      }
    } catch (err) {
      console.warn("No se pudo cargar el archivo externo; se usa demo embebida.", err);
      state.flightsRaw = DEMO_FLIGHTS;
      if (dataStatus) {
        dataStatus.innerHTML = `No se pudo cargar <code>${escapeHtml(DATA_SOURCE)}</code>.<br>Se usa una muestra interna para probar la animación.<br>SNA: ${catalogs.snaCount.toLocaleString("es-AR")} aeropuertos · ourairports: ${catalogs.ourCount.toLocaleString("es-AR")} códigos`;
      }
    }

state.flightsAll = normalizeFlights(state.flightsRaw);

const days = buildAvailableDays();
state.availableDays = Array.isArray(days) ? days : (state.availableDays || []);

// Al entrar al mapa, arranca en el primer día disponible.
// En tu caso debería ser lunes.
state.selectedDayFromIdx = 0;
state.selectedDayToIdx = 0;
state.selectedDay = state.availableDays[0]?.key || "";

renderDayTimeline();
applyDayFilter({ keepPlaying: true });
  }

  function normalizeFlights(rows) {
    state.skippedRows = 0;
    state.catalogWarnings = [];
    const normalized = [];

    rows.forEach((row, index) => {
      const routeCodes = getRouteCodesFromRow(row);

      let rawOrigin = clean(getFirst(row, FIELD_ALIASES.origin)).toUpperCase();
      let rawDestination = clean(getFirst(row, FIELD_ALIASES.destination)).toUpperCase();

      if (!rawOrigin && routeCodes.origin) rawOrigin = routeCodes.origin;
      if (!rawDestination && routeCodes.destination) rawDestination = routeCodes.destination;

      // Si RutaCompleta contiene dos códigos y uno coincide con el origen conocido,
      // usamos el otro como destino. Esto ayuda en registros con Destino IATA vacío.
      if ((!rawDestination || rawDestination === rawOrigin) && routeCodes.origin && routeCodes.destination) {
        if (routeCodes.origin === rawOrigin && routeCodes.destination !== rawOrigin) rawDestination = routeCodes.destination;
        else if (routeCodes.destination === rawOrigin && routeCodes.origin !== rawOrigin) rawDestination = routeCodes.origin;
      }

      if (!rawOrigin || !rawDestination || rawOrigin === rawDestination) {
        state.skippedRows += 1;
        return;
      }

const origin = resolveSpecialAirportCode(rawOrigin, rawDestination);
const destination = resolveSpecialAirportCode(rawDestination, rawOrigin);

// No dibujar rutas base con mismo origen y destino.
if (!origin || !destination || origin === destination) return;

const from = getLatLngFromRow(row, "from", "origin", origin);
const to = getLatLngFromRow(row, "to", "destination", destination);
      if (!from || !to) {
        state.skippedRows += 1;
        console.warn("Vuelo omitido por falta de coordenadas:", row);
        return;
      }

      const fallbackDate = clean(getFirst(row, FIELD_ALIASES.date)) || "2025-01-01";
      const dep = normalizeDateTime(getFirst(row, FIELD_ALIASES.dep), fallbackDate);

      let arr = normalizeDateTime(getFirst(row, FIELD_ALIASES.arr), fallbackDate);
      if (!arr && dep) {
        const durationMinutes = parseNumber(getFirst(row, FIELD_ALIASES.durationMinutes));
        if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
          arr = new Date(dep.getTime() + durationMinutes * 60 * 1000);
        }
      }

      if (!dep || !arr) {
        state.skippedRows += 1;
        console.warn("Vuelo omitido por falta de horarios:", row);
        return;
      }

      const displayId = clean(getFirst(row, FIELD_ALIASES.id)) || `${origin}-${destination}`;
      const id = `${displayId}-${index + 1}`;
      const airline = clean(getFirst(row, FIELD_ALIASES.airline)) || "Sin dato";

      normalized.push({
        id,
        displayId,
        airline,
        origin,
        destination,
        rawOrigin,
        rawDestination,
        dep,
        arr,
        depOffset: 0,
        arrOffset: 0,
        duration: Math.max(1, arr.getTime() - dep.getTime()),
        from,
        to,
        passengers: toNumberOrNull(getFirst(row, FIELD_ALIASES.passengers)),
        seats: toNumberOrNull(getFirst(row, FIELD_ALIASES.seats)),
        route: clean(getFirst(row, FIELD_ALIASES.route)) || `${rawOrigin} - ${rawDestination}`,
        weekday: clean(getFirst(row, FIELD_ALIASES.weekday)),
        movementType: clean(getFirst(row, FIELD_ALIASES.movementType)),
        flightClass: clean(getFirst(row, FIELD_ALIASES.flightClass)),
        aircraft: clean(getFirst(row, FIELD_ALIASES.aircraft)),
        distanceKm: toNumberOrNull(getFirst(row, FIELD_ALIASES.distanceKm))
      });
    });

    return normalized.sort((a, b) => a.dep - b.dep);
  }

function buildStaticRoutesFromRaw(rows) {
  const routes = [];
  const rendered = new Set();

  (rows || []).forEach((row) => {
const rawOrigin = clean(getFirst(row, FIELD_ALIASES.origin)).toUpperCase();
const rawDestination = clean(getFirst(row, FIELD_ALIASES.destination)).toUpperCase();

if (!rawOrigin || !rawDestination || rawOrigin === rawDestination) {
  state.skippedRows += 1;
  return;
}

const origin = resolveSpecialAirportCode(rawOrigin, rawDestination);
const destination = resolveSpecialAirportCode(rawDestination, rawOrigin);

// Excluye también casos que quedan iguales después de resolver códigos agregados,
// por ejemplo BUE → AEP/EZE.
if (!origin || !destination || origin === destination) {
  state.skippedRows += 1;
  return;
}

    const from = getLatLngFromRow(row, "from", "origin", origin);
    const to = getLatLngFromRow(row, "to", "destination", destination);

    if (!from || !to) {
      console.warn("Ruta base omitida por falta de coordenadas:", {
        origin,
        destination,
        rawOrigin,
        rawDestination,
        row
      });
      return;
    }

    const key = [origin, destination].sort().join("-");
    if (rendered.has(key)) return;

    rendered.add(key);

    routes.push({
      origin,
      destination,
      rawOrigin,
      rawDestination,
      from,
      to
    });
  });

  return routes;
}
  function getLatLngFromRow(row, pairKey, role, iata) {
    if (Array.isArray(row[pairKey]) && row[pairKey].length >= 2) {
      const lat = Number(row[pairKey][0]);
      const lon = Number(row[pairKey][1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    }

    const latCandidates = role === "origin"
      ? ["origin_lat", "origen_lat", "lat_origen", "OrigenLat", "latitud_origen", "Lat Origen", "Y Origen"]
      : ["destination_lat", "destino_lat", "lat_destino", "DestinoLat", "latitud_destino", "Lat Destino", "Y Destino"];

    const lonCandidates = role === "origin"
      ? ["origin_lon", "origen_lon", "lon_origen", "long_origen", "OrigenLon", "longitud_origen", "Lon Origen", "X Origen"]
      : ["destination_lon", "destino_lon", "lon_destino", "long_destino", "DestinoLon", "longitud_destino", "Lon Destino", "X Destino"];

    const lat = parseNumber(getFirst(row, latCandidates));
    const lon = parseNumber(getFirst(row, lonCandidates));
    if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];

    return getAirportLatLngByCode(iata);
  }

  function normalizeDateTime(value, fallbackDate) {
    const text = clean(value);
    if (!text) return null;
    let candidate = text;

    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
      candidate = `${fallbackDate}T${text.length === 5 ? `${text}:00` : text}-03:00`;
    }
    if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(candidate)) {
      candidate = candidate.replace(" ", "T");
    }

    const slashMatch = candidate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2}(:\d{2})?)$/);
    if (slashMatch) {
      const [, dd, mm, yyyy, hhmm] = slashMatch;
      candidate = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hhmm.length === 5 ? `${hhmm}:00` : hhmm}-03:00`;
    }

    const d = new Date(candidate);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function getDayStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function buildStaticRoutesFromFlights(flights) {
    const routes = [];
    const rendered = new Set();

    (flights || []).forEach((f) => {
      if (!f.origin || !f.destination || !f.from || !f.to) return;
      const key = [f.origin, f.destination].sort().join("-");
      if (rendered.has(key)) return;
      rendered.add(key);

      routes.push({
        origin: f.origin,
        destination: f.destination,
        rawOrigin: f.rawOrigin,
        rawDestination: f.rawDestination,
        from: f.from,
        to: f.to
      });
    });

    return routes;
  }

function buildAvailableDays() {
  const map = new Map();

  (state.flightsAll || []).forEach(f => {
    const key = getLocalDateKey(f.dep);

    if (!map.has(key)) {
      const d = new Date(f.dep);
      d.setHours(0, 0, 0, 0);

      map.set(key, {
        key,
        date: d,
        count: 0
      });
    }

    map.get(key).count += 1;
  });

  const days = Array.from(map.values()).sort((a, b) => a.date - b.date);

  state.availableDays = days;
  return days;
}

function clampDayIndex(idx) {
  const days = state.availableDays || [];
  const max = Math.max(0, days.length - 1);
  const n = Number(idx);

  return Math.max(0, Math.min(max, Number.isFinite(n) ? Math.round(n) : 0));
}

function getSelectedDayRange() {
  const days = state.availableDays || [];

  if (!days.length) {
    return {
      fromIdx: 0,
      toIdx: 0,
      from: null,
      to: null,
      isSingle: true,
      isFull: false
    };
  }

  let fromIdx = clampDayIndex(state.selectedDayFromIdx);
  let toIdx = clampDayIndex(state.selectedDayToIdx);

  if (fromIdx > toIdx) {
    const aux = fromIdx;
    fromIdx = toIdx;
    toIdx = aux;
  }

  return {
    fromIdx,
    toIdx,
    from: days[fromIdx],
    to: days[toIdx],
    isSingle: fromIdx === toIdx,
    isFull: fromIdx === 0 && toIdx === days.length - 1
  };
}

function formatDayCompact(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).replace(".", "");
}

function formatDayRangeLabelFromState() {
  const r = getSelectedDayRange();

  if (!r.from || !r.to) return "Sin fechas disponibles";

  if (r.isFull && state.availableDays.length > 1) {
    return `Semana completa · ${formatDayCompact(r.from.date)} — ${formatDayCompact(r.to.date)}`;
  }

  if (r.isSingle) {
    return formatDayLong(r.from.date);
  }

  return `${formatDayCompact(r.from.date)} — ${formatDayCompact(r.to.date)}`;
}

function updateDayTimelineOverlay() {
  const days = state.availableDays || [];
  const label = q("dayRangeLabel");
  const shadeL = q("dayTlShadeL");
  const shadeR = q("dayTlShadeR");
  const win = q("dayTlWindow");
  const handleL = q("dayTlHandleL");
  const handleR = q("dayTlHandleR");

  if (label) label.textContent = formatDayRangeLabelFromState();

  if (!days.length || !shadeL || !shadeR || !win || !handleL || !handleR) return;

  const r = getSelectedDayRange();
  const denom = Math.max(1, days.length - 1);

  const leftPct = days.length === 1 ? 0 : (r.fromIdx / denom) * 100;
  const rightPct = days.length === 1 ? 100 : (r.toIdx / denom) * 100;

  shadeL.style.left = "0";
  shadeL.style.width = `${leftPct}%`;

  win.style.left = `${leftPct}%`;
  win.style.width = `${Math.max(0, rightPct - leftPct)}%`;

  shadeR.style.left = `${rightPct}%`;
  shadeR.style.width = `${Math.max(0, 100 - rightPct)}%`;

  handleL.style.left = `${leftPct}%`;
  handleR.style.left = `${rightPct}%`;
  
  updateDayTimelinePlayhead();
}
function updateDayTimelinePlayhead() {
  const playhead = q("dayTlPlayhead");
  const days = state.availableDays || [];

  if (!playhead || !days.length || !state.simStartDate) {
    if (playhead) playhead.style.display = "none";
    return;
  }

  const simMs = Math.max(0, Math.min(state.simPeriodMs || 0, Number(state.simTime || 0)));
  const current = new Date(state.simStartDate.getTime() + simMs);

  const r = getSelectedDayRange();
  if (!r.from || !r.to) {
    playhead.style.display = "none";
    return;
  }

  const msOfDay =
    (current.getHours() * 60 * 60 * 1000) +
    (current.getMinutes() * 60 * 1000) +
    (current.getSeconds() * 1000) +
    current.getMilliseconds();

  const dayProgress = Math.max(0, Math.min(0.9999, msOfDay / SIM_DAY_MS));
  const slotWidth = 100 / days.length;

  let leftPct = 0;

  if (r.isSingle) {
    // Un solo día: avanza solamente dentro del espacio de ese día.
    leftPct = (r.fromIdx * slotWidth) + (dayProgress * slotWidth);
  } else {
    // Semana completa o rango: avanza desde el inicio hasta el fin del período seleccionado.
    const currentKey = getLocalDateKey(current);
    let dayIndex = days.findIndex(d => d.key === currentKey);
    if (dayIndex < 0) dayIndex = r.fromIdx;

    dayIndex = Math.max(r.fromIdx, Math.min(r.toIdx, dayIndex));
    leftPct = (dayIndex * slotWidth) + (dayProgress * slotWidth);
  }

  playhead.style.display = "block";
  playhead.style.left = `${leftPct}%`;
}
function setSelectedDayRange(fromIdx, toIdx, opts = {}) {
  const { keepPlaying = false } = opts;
  const days = state.availableDays || [];
  if (!days.length) return;

  let f = clampDayIndex(fromIdx);
  let t = clampDayIndex(toIdx);

  if (f > t) {
    const aux = f;
    f = t;
    t = aux;
  }

  state.selectedDayFromIdx = f;
  state.selectedDayToIdx = t;

  state.selectedDay = f === t
    ? days[f].key
    : `${days[f].key}_${days[t].key}`;

  updateDayTimelineOverlay();
  applyDayFilter({ keepPlaying });
}

function shiftSelectedDayRange(delta) {
  const days = state.availableDays || [];
  if (!days.length) return;

  const r = getSelectedDayRange();
  const span = r.toIdx - r.fromIdx;
  let nextFrom = r.fromIdx + delta;

  nextFrom = Math.max(0, Math.min(days.length - 1 - span, nextFrom));

  setSelectedDayRange(nextFrom, nextFrom + span, { keepPlaying: false });
}

function renderDayTimeline() {
  const wrap = q("dayTimelineWrap");
  const svg = q("dayTimelineSvg");
  if (!wrap || !svg) return;

  const days = state.availableDays || buildAvailableDays();

  if (!days.length) {
    svg.innerHTML = "";
    updateDayTimelineOverlay();
    return;
  }

  const W = 300;
  const H = 64;
  const padX = 12;
  const padTop = 8;
  const padBottom = 16;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const maxCount = Math.max(...days.map(d => Number(d.count) || 0), 1);

  const x = (idx) => {
    if (days.length === 1) return W / 2;
    return padX + innerW * (idx / (days.length - 1));
  };

  let bars = "";
  let labels = "";

  days.forEach((day, idx) => {
    const cx = x(idx);
    const h = Math.max(4, innerH * ((Number(day.count) || 0) / maxCount));
    const y = padTop + innerH - h;
    const barW = Math.max(8, Math.min(22, innerW / Math.max(1, days.length) * 0.55));

    bars += `
      <rect x="${cx - barW / 2}" y="${y}" width="${barW}" height="${h}" rx="2"
        class="rutas-day-bar">
        <title>${escapeHtml(formatDayLong(day.date))} · ${day.count.toLocaleString("es-AR")} vuelos</title>
      </rect>
    `;

labels += `
  <text x="${cx}" y="${H - 4}" text-anchor="middle" class="rutas-day-label">
    ${escapeHtml(formatWeekdayTick(day.date))}
  </text>
`;
  });

  svg.innerHTML = `
    <line x1="${padX}" y1="${padTop + innerH}" x2="${W - padX}" y2="${padTop + innerH}" class="rutas-day-axis"/>
    ${bars}
    ${labels}
  `;

  updateDayTimelineOverlay();

  if (wrap.dataset.bound === "1") return;
  wrap.dataset.bound = "1";

  let dragMode = null;

  function clientXToDayIdx(clientX) {
    const rect = wrap.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(pct * Math.max(0, (state.availableDays || []).length - 1));
  }

  function onMove(e) {
    if (!dragMode) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const idx = clientXToDayIdx(clientX);
    const r = getSelectedDayRange();

    if (dragMode === "left") {
      setSelectedDayRange(idx, r.toIdx, { keepPlaying: false });
    } else if (dragMode === "right") {
      setSelectedDayRange(r.fromIdx, idx, { keepPlaying: false });
    }
  }

  function onUp() {
    dragMode = null;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("touchmove", onMove);
  }

  q("dayTlHandleL")?.addEventListener("mousedown", e => {
    e.preventDefault();
    dragMode = "left";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp, { once: true });
  });

  q("dayTlHandleR")?.addEventListener("mousedown", e => {
    e.preventDefault();
    dragMode = "right";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp, { once: true });
  });

  q("dayTlHandleL")?.addEventListener("touchstart", e => {
    e.preventDefault();
    dragMode = "left";
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp, { once: true });
  }, { passive: false });

  q("dayTlHandleR")?.addEventListener("touchstart", e => {
    e.preventDefault();
    dragMode = "right";
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp, { once: true });
  }, { passive: false });

  wrap.addEventListener("click", e => {
    if (e.target && e.target.classList.contains("rutas-day-handle")) return;

    const idx = clientXToDayIdx(e.clientX);
    setSelectedDayRange(idx, idx, { keepPlaying: false });
  });

  q("btnDayRangePrev")?.addEventListener("click", () => shiftSelectedDayRange(-1));
  q("btnDayRangeNext")?.addEventListener("click", () => shiftSelectedDayRange(1));
}

function applyDayFilter(opts = {}) {
  const { keepPlaying = false } = opts;

  const days = state.availableDays || [];
  const r = getSelectedDayRange();

  if (!days.length || !r.from || !r.to) {
    state.flights = [];
  } else {
    const fromKey = r.from.key;
    const toKey = r.to.key;

    state.flights = state.flightsAll.filter(f => {
      const key = getLocalDateKey(f.dep);
      return key >= fromKey && key <= toKey;
    });
  }

  rebuildSimulationWindow();

  state.staticRoutes = buildStaticRoutesFromFlights(state.flights);
  buildAirportIndex();
  renderStaticLayers();
  updateKpis();
  renderAirlineLegend();
  updateDayTimelineOverlay();
  updatePeriodUi();

  clearActiveFlights();
  clearCompletedFlights();

  if (state.flights.length) {
    goToFirstFlight({ keepPlaying });
  } else {
    resetAnimation();
  }

  updateMapStatus();
}

function rebuildSimulationWindow() {
  if (!state.flights.length) {
    state.simStartDate = null;
    state.simEndDate = null;
    state.simPeriodMs = SIM_DAY_MS;
    state.simTime = 0;
    setTimeRangeMax();
    return;
  }

  const r = getSelectedDayRange();

  if (r.isSingle && r.from) {
    const start = new Date(r.from.date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    state.simStartDate = start;
    state.simEndDate = end;
  } else if (r.from && r.to) {
    const start = new Date(r.from.date);
    start.setHours(0, 0, 0, 0);

    const maxArr = new Date(Math.max(...state.flights.map(f => f.arr.getTime())));

    state.simStartDate = start;
    state.simEndDate = maxArr;
  } else {
    const minDep = new Date(Math.min(...state.flights.map(f => f.dep.getTime())));
    const maxArr = new Date(Math.max(...state.flights.map(f => f.arr.getTime())));

    const start = new Date(minDep);
    start.setHours(0, 0, 0, 0);

    state.simStartDate = start;
    state.simEndDate = maxArr;
  }

  state.simPeriodMs = Math.max(1, state.simEndDate.getTime() - state.simStartDate.getTime());

  state.flights.forEach((f) => {
    f.depOffset = f.dep.getTime() - state.simStartDate.getTime();
    f.arrOffset = f.arr.getTime() - state.simStartDate.getTime();
    f.duration = Math.max(1, f.arrOffset - f.depOffset);
  });

  state.flights.sort((a, b) => a.depOffset - b.depOffset);
  setTimeRangeMax();
}

function updatePeriodUi() {
  const r = getSelectedDayRange();

  const periodLabel = q("periodLabel");
  if (periodLabel) {
    const txt = formatPeriodLabel();
    periodLabel.textContent = txt;
    periodLabel.style.display = txt ? "" : "none";
  }

  const rangeLabel = q("timeRangeLabel");
  if (rangeLabel) {
    if (r.isFull) {
      rangeLabel.textContent = "Recorrido de la semana completa";
    } else if (r.isSingle) {
      rangeLabel.textContent = "Recorrido del día";
    } else {
      rangeLabel.textContent = "Recorrido del período seleccionado";
    }
  }

  const speedBtn = q("btnSpeed");
  if (speedBtn) speedBtn.textContent = speedLabel();
}

  function updateMapStatus() {
    const mapStatus = q("mapStatus");
    if (!mapStatus) return;

    const skipped = state.skippedRows ? ` Registros omitidos: ${state.skippedRows}.` : "";
    const missing = state.catalogWarnings.length ? ` Sin coordenadas: ${state.catalogWarnings.join(", ")}.` : "";
    const period = formatPeriodLabel();

    mapStatus.textContent = state.flights.length
      ? `${period}. Vuelos cargados: ${state.flights.length}.${skipped}${missing}`
      : `${period}. No hay vuelos válidos para animar.${skipped}${missing}`;
  }

  function buildAirportIndex() {
    state.airports.clear();

    // 1) Siempre dibuja los aeropuertos del SNA definidos en Datos_aeropuertos.geojson.
    state.snaAirports.forEach((sna, iata) => {
      const latlng = getAirportLatLngByCode(iata);
      if (!latlng) return;
      state.airports.set(iata, buildAirportItem(iata, latlng, "sna"));
    });

    // 2) Además dibuja los endpoints reales del día, sean nacionales fuera del SNA o internacionales.
// 2) Además dibuja todos los endpoints presentes en el archivo del día,
// aunque el vuelo no haya podido animarse por problemas de horario.
state.staticRoutes.forEach((r) => {
  addAirportEndpoint(r.origin, r.from);
  addAirportEndpoint(r.destination, r.to);
});
  }

  function addAirportEndpoint(iata, latlng) {
    if (!iata || state.airports.has(iata)) return;
    const category = state.snaAirports.has(iata)
      ? "sna"
      : isArgentinaAirport(iata) ? "national" : "international";
    state.airports.set(iata, buildAirportItem(iata, latlng, category));
  }

  function buildAirportItem(iata, latlng, category) {
    const sna = state.snaAirports.get(iata);
    const meta = getAirportMeta(iata) || {};
    return {
      iata,
      category,
      latlng,
      name: sna?.name || meta.name || meta.municipality || iata,
      municipality: meta.municipality || "",
      countryCode: meta.countryCode || "",
      continent: meta.continent || ""
    };
  }

  function renderStaticLayers() {
    state.routesLayer.clearLayers();
    state.airportsLayer.clearLayers();

state.staticRoutes.forEach((r) => {
  L.polyline(getArcLatLngs(r.from, r.to, 44), {
    pane: "rutasBasePane",
    color: getRouteColorByEndpoints(r),
    weight: 2.1,
    opacity: 0.58,
    interactive: false,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(state.routesLayer);
});

    state.airports.forEach((airport) => {
      const marker = L.marker(airport.latlng, {
        pane: "rutasAirportPane",
        interactive: true,
        keyboard: false,
        icon: L.divIcon({
          className: "rutas-airport-label-marker rutas-airport-marker-interactive",
          html: buildAirportMarkerHtml(airport),
          iconSize: [1, 1],
          iconAnchor: [0, 0]
        })
      });

      marker.bindTooltip(buildAirportTooltip(airport), { direction: "top", opacity: 1, className: "rutas-tooltip" });
      marker.on("mouseover", () => setAirportInfo(airport));
      marker.on("click", () => setAirportInfo(airport));
      marker.addTo(state.airportsLayer);
    });

    applyLayerVisibility();
  }

  function buildAirportMarkerHtml(airport) {
    const categoryClass = airport.category === "sna" ? "is-sna" : airport.category === "national" ? "is-national" : "is-international";
    const symbol = airport.category === "sna" ? "✈" : airport.category === "national" ? "N" : "I";
    const label = airport.category === "sna" ? airport.iata : `${airport.iata}`;

    return `
      <div class="rutas-airport-center-icon ${categoryClass}" aria-hidden="true">${symbol}</div>
      <div class="rutas-airport-floating-text ${categoryClass}">
        <span>${escapeHtml(label)}</span>
      </div>`;
  }

  function buildAirportTooltip(airport) {
    const category = airport.category === "sna"
      ? "Aeropuerto del SNA"
      : airport.category === "national"
        ? "Aeropuerto nacional fuera del SNA"
        : "Aeropuerto internacional";
    return `<div class="rutas-tooltip-title">${escapeHtml(airport.iata)} · ${escapeHtml(category)}</div><div>${escapeHtml(airport.name || airport.municipality || airport.iata)}</div>${airport.countryCode ? `<div class="rutas-tooltip-muted">País: ${escapeHtml(airport.countryCode)}</div>` : ""}`;
  }

  function setAirportInfo(airport) {
    const el = q("featureInfo");
    if (!el) return;
    const category = airport.category === "sna"
      ? "Aeropuerto del SNA"
      : airport.category === "national"
        ? "Otro aeropuerto nacional"
        : "Aeropuerto internacional";
el.innerHTML = `
  <div class="feature-title">${escapeHtml(airport.iata)} · ${escapeHtml(category)}</div>
  <table class="feature-table">
    <tr><td>Nombre</td><td>${escapeHtml(airport.name || "–")}</td></tr>
    <tr><td>Municipio</td><td>${escapeHtml(airport.municipality || "–")}</td></tr>
    <tr><td>País</td><td>${escapeHtml(airport.countryCode || "–")}</td></tr>
  </table>`;
  }

  function getRouteColorByEndpoints(f) {
    if (!isArgentinaAirport(f.origin) || !isArgentinaAirport(f.destination)) return "#16c41e";
    if (state.snaAirports.has(f.origin) && state.snaAirports.has(f.destination)) return "#0072bb";
    return "#6f7d8c";
  }

  function buildAirportLabel(name) {
    const text = clean(name);
    if (!text) return "";
    return text.length > 26 ? `${text.slice(0, 24)}…` : text;
  }
function renderAirlineLegend() {
  const root = q("airlineLegend");
  if (!root) return;

  const used = new Map();
  let hasOther = false;

  (state.flights || []).forEach(f => {
    const rule = getAirlineColorRule(f.airline);

    if (rule) {
      used.set(rule.label, rule);
    } else if (clean(f.airline)) {
      hasOther = true;
    }
  });

  const items = AIRLINE_COLOR_RULES.filter(rule => used.has(rule.label));

  if (hasOther) {
    items.push({
      label: "Otras / sin clasificar",
      color: DEFAULT_FLIGHT_COLOR
    });
  }

  if (!items.length) {
    root.innerHTML = `<div class="siga-hint">Sin aerolíneas identificadas para el período seleccionado.</div>`;
    return;
  }

root.innerHTML = items.map(item => `
  <div class="rutas-airline-row">
    <span class="rutas-airline-plane" style="color:${escapeHtml(item.color)}">
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M16 2.3c1.2 0 2.1 1 2.1 2.4v7.6l10.1 6.4c.7.4 1.1 1.2 1 2l-.2 2.1-10.9-3.4v5.3l3.1 2.5-.3 1.8L16 27.5 11.1 29l-.3-1.8 3.1-2.5v-5.3L3 22.8l-.2-2.1c-.1-.8.3-1.6 1-2l10.1-6.4V4.7c0-1.4.9-2.4 2.1-2.4Z"
          fill="currentColor"
          stroke="#ffffff"
          stroke-width="1.4"
          stroke-linejoin="round"/>
      </svg>
    </span>
    <span class="rutas-airline-name">${escapeHtml(item.label)}</span>
  </div>
`).join("");
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

  function normalizeAirlineText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function getAirlineColorRule(airlineName) {
  const airline = normalizeAirlineText(airlineName);
  if (!airline) return null;

  return AIRLINE_COLOR_RULES.find(rule => {
    const exact = Array.isArray(rule.exact) ? rule.exact : [];
    const names = Array.isArray(rule.names) ? rule.names : [];

    if (exact.some(code => airline === normalizeAirlineText(code))) return true;

    return names.some(name => {
      const key = normalizeAirlineText(name);
      return key && airline.includes(key);
    });
  }) || null;
}
function getFlightColor(f) {
  const rule = getAirlineColorRule(f.airline);
  return rule ? rule.color : DEFAULT_FLIGHT_COLOR;
}

  function interpolateCurved(from, to, p) {
    const lat1 = from[0];
    const lng1 = from[1];
    const lat2 = to[0];
    const lng2 = to[1];
    const lat = lat1 + (lat2 - lat1) * p;
    const lng = lng1 + (lng2 - lng1) * p;
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
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
    for (let i = 0; i <= n; i++) {
      points.push(interpolateCurved(from, to, safeEnd * (i / n)));
    }
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
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  function rotatePlane(marker, bearing) {
    const el = marker.getElement();
    if (!el) return;
    const icon = el.querySelector(".rutas-plane-icon");
    if (!icon) return;
    icon.style.transform = `rotate(${bearing + PLANE_ROTATION_OFFSET_DEG}deg)`;
  }

  function updateFlights(currentTime) {
    let activeCount = 0;
    const periodEnd = state.simPeriodMs || SIM_DAY_MS;

    state.flights.forEach((f) => {
      const visibleUntil = Math.min(f.arrOffset, periodEnd);
      const isActive = currentTime >= f.depOffset && currentTime <= visibleUntil;

      if (!isActive) {
        removeActiveFlight(f.id);
        return;
      }

      activeCount += 1;
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
        const trail = L.polyline(getArcLatLngs(f.from, f.to, 36, p), {
          pane: "rutasTrailPane",
          color,
          weight: 3.0,
          opacity: 0.82,
          interactive: true,
          lineCap: "round",
          lineJoin: "round",
          className: "rutas-flight-trail"
        });
        trail.bindTooltip(buildFlightTooltip(f), {
  direction: "top",
  opacity: 1,
  className: "rutas-tooltip"
});

trail.on("mouseover", () => setFeatureInfo(f));
trail.on("click", () => setFeatureInfo(f));
        
        if (state.showTrails) trail.addTo(state.trailsLayer);

        const marker = L.marker(position, {
          pane: "rutasPlanePane",
          icon: createPlaneIcon(color),
          interactive: true,
          keyboard: false,
          title: `${f.displayId || f.id} | ${f.origin} → ${f.destination}`
        });

        marker.bindTooltip(buildFlightTooltip(f), { direction: "top", opacity: 1, className: "rutas-tooltip" });
        marker.on("mouseover", () => setFeatureInfo(f));
        marker.on("click", () => setFeatureInfo(f));
        marker.addTo(state.planesLayer);

        active = { marker, trail };
        state.activeFlights.set(f.id, active);
      } else {
        active.marker.setLatLng(position);
        active.trail.setLatLngs(getArcLatLngs(f.from, f.to, 36, p));
        if (state.showTrails && !state.trailsLayer.hasLayer(active.trail)) active.trail.addTo(state.trailsLayer);
        else if (!state.showTrails && state.trailsLayer.hasLayer(active.trail)) state.trailsLayer.removeLayer(active.trail);
      }

      rotatePlane(active.marker, bearing);
    });

    syncCompletedFlights(currentTime);

    const clock = q("clock");
    if (clock) clock.textContent = formatClock(currentTime);

    const activeKpi = q("kpiActiveFlights");
    if (activeKpi) activeKpi.textContent = activeCount.toLocaleString("es-AR");

const range = q("timeRange");
if (range) {
  const max = Math.max(1, Math.floor(state.simPeriodMs || SIM_DAY_MS));
  range.max = String(max);
  range.value = String(Math.max(0, Math.min(max, Math.floor(currentTime || 0))));
  }
    updateDayTimelinePlayhead();
  }
  function removeActiveFlight(id) {
    const active = state.activeFlights.get(id);
    if (!active) return;
    state.planesLayer.removeLayer(active.marker);
    state.trailsLayer.removeLayer(active.trail);
    state.activeFlights.delete(id);
  }
function syncCompletedFlights(currentTime) {
  state.flights.forEach((f) => {
    const completedInsidePeriod = f.arrOffset <= (state.simPeriodMs || SIM_DAY_MS);
    const shouldBeCompleted = completedInsidePeriod && currentTime > f.arrOffset;

    if (shouldBeCompleted) {
      addCompletedFlight(f);
    } else {
      removeCompletedFlight(f.id);
    }
  });
}

function addCompletedFlight(f) {
  if (state.completedFlights.has(f.id)) return;

  const color = getFlightColor(f);

  const trail = L.polyline(getArcLatLngs(f.from, f.to, 44, 1), {
    pane: "rutasCompletedPane",
    color,
    weight: 2.1,
    opacity: 0.30,
    interactive: false,
    lineCap: "round",
    lineJoin: "round",
    className: "rutas-flight-trail-completed"
  });

  const marker = L.marker(f.to, {
    pane: "rutasCompletedPane",
    icon: createPlaneIcon(color),
    interactive: true,
    keyboard: false,
    title: `${f.displayId || f.id} completado | ${f.origin} → ${f.destination}`,
    opacity: 0.55
  });

const completedFlightId = clean(f.displayId || f.id);
const completedAirline = clean(f.airline);
const completedTitle = completedAirline && completedAirline !== "Sin dato"
  ? `${completedFlightId} · ${completedAirline} · vuelo completado`
  : `${completedFlightId} · vuelo completado`;

marker.bindTooltip(
  `<div class="rutas-tooltip-title">${escapeHtml(completedTitle)}</div>
   <div>${escapeHtml(f.origin)} → ${escapeHtml(f.destination)}</div>
   <div class="rutas-tooltip-muted">${formatDateTimeBrief(f.dep)} - ${formatDateTimeBrief(f.arr)}</div>`,
  { direction: "top", opacity: 1, className: "rutas-tooltip" }
);

  marker.on("mouseover", () => setFeatureInfo(f));
  marker.on("click", () => setFeatureInfo(f));

  trail.addTo(state.completedFlightsLayer);
  marker.addTo(state.completedFlightsLayer);

  const bearing = calculateBearing(
    interpolateCurved(f.from, f.to, 0.98),
    interpolateCurved(f.from, f.to, 1)
  );

  // Espera a que Leaflet inserte el elemento del marcador en el DOM.
  setTimeout(() => rotatePlane(marker, bearing), 0);

  state.completedFlights.set(f.id, { trail, marker });
}

function removeCompletedFlight(id) {
  const completed = state.completedFlights.get(id);
  if (!completed) return;

  state.completedFlightsLayer.removeLayer(completed.trail);
  state.completedFlightsLayer.removeLayer(completed.marker);
  state.completedFlights.delete(id);
}

function clearCompletedFlights() {
  Array.from(state.completedFlights.keys()).forEach(removeCompletedFlight);
}
function buildFlightTooltip(f) {
  const flightId = clean(f.displayId || f.id);
  const airline = clean(f.airline);
  const title = airline && airline !== "Sin dato"
    ? `${flightId} · ${airline}`
    : flightId;

  return `
    <div class="rutas-tooltip-title">${escapeHtml(title)}</div>
    <div>${escapeHtml(f.origin)} → ${escapeHtml(f.destination)}</div>
    <div class="rutas-tooltip-muted">${formatDateTimeBrief(f.dep)} - ${formatDateTimeBrief(f.arr)}</div>
  `;
}

  function setFeatureInfo(f) {
    const el = q("featureInfo");
    if (!el) return;
    el.innerHTML = `
      <div class="feature-title">${escapeHtml(f.displayId || f.id)} · ${escapeHtml(f.origin)} → ${escapeHtml(f.destination)}</div>
      <table class="feature-table">
        <tr><td>Aerolínea</td><td>${escapeHtml(f.airline)}</td></tr>
        <tr><td>Salida</td><td>${escapeHtml(formatDateTimeBrief(f.dep))}</td></tr>
        <tr><td>Llegada est.</td><td>${escapeHtml(formatDateTimeBrief(f.arr))}</td></tr>
        ${f.weekday ? `<tr><td>Día informado</td><td>${escapeHtml(f.weekday)}</td></tr>` : ""}
        ${f.flightClass ? `<tr><td>Clase</td><td>${escapeHtml(f.flightClass)}</td></tr>` : ""}
        ${f.aircraft ? `<tr><td>Aeronave</td><td>${escapeHtml(f.aircraft)}</td></tr>` : ""}
        ${f.distanceKm ? `<tr><td>Distancia</td><td>${f.distanceKm.toLocaleString("es-AR")} km</td></tr>` : ""}
        ${f.passengers !== null ? `<tr><td>Pasajeros</td><td>${f.passengers.toLocaleString("es-AR")}</td></tr>` : ""}
        ${f.seats !== null ? `<tr><td>Asientos</td><td>${f.seats.toLocaleString("es-AR")}</td></tr>` : ""}
      </table>`;
  }

  function formatTime(date) {
    return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function formatDateTimeBrief(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "–";
    return date.toLocaleString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace(",", " ·");
  }

  function formatClock(ms) {
    if (!state.simStartDate) {
      const totalMinutes = Math.floor(ms / 60000) % 1440;
      return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
    }

    const d = new Date(state.simStartDate.getTime() + Number(ms || 0));

    return d.toLocaleString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace(",", " ·");
  }

  function animate(now) {
    const delta = now - state.lastFrame;
    state.lastFrame = now;

    if (state.playing && state.flights.length) {
      const periodMs = state.simPeriodMs || SIM_DAY_MS;
      const speedFactor = periodMs / state.realDurationMs;
      state.simTime += delta * speedFactor;

      if (state.simTime >= periodMs) {
        state.simTime = periodMs;
        state.playing = false;

        const btnPlay = q("btnPlay");
        if (btnPlay) btnPlay.textContent = "Reproducir";

        updateFlights(state.simTime);
        requestAnimationFrame(animate);
        return;
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
  state.playing = false;

  clearActiveFlights();
  clearCompletedFlights();

  updateFlights(0);

  const btnPlay = q("btnPlay");
  if (btnPlay) btnPlay.textContent = "Reproducir";
}

  function goToFirstFlight(opts = {}) {
    const { keepPlaying = false } = opts;
    if (!state.flights.length) {
      resetAnimation();
      return;
    }

    const periodMs = state.simPeriodMs || SIM_DAY_MS;
    state.simTime = Math.max(0, Math.min(periodMs, state.flights[0].depOffset));

    clearActiveFlights();
    clearCompletedFlights();
    updateFlights(state.simTime);

    state.playing = !!keepPlaying;
    const btnPlay = q("btnPlay");
    if (btnPlay) btnPlay.textContent = state.playing ? "Pausar" : "Reproducir";
  }

  function speedLabel() {
    if (state.realDurationMs === 60 * 1000) return "Velocidad de reproducción 1 min";
    if (state.realDurationMs === 2 * 60 * 1000) return "Velocidad de reproducción 2 min";
    return "Velocidad de reproducción 30 segundos";
  }

  function toggleSpeed() {
    if (state.realDurationMs === 60 * 1000) {
      state.realDurationMs = 2 * 60 * 1000;
    } else if (state.realDurationMs === 2 * 60 * 1000) {
      state.realDurationMs = 30 * 1000;
    } else {
      state.realDurationMs = 60 * 1000;
    }

    const btn = q("btnSpeed");
    if (btn) btn.textContent = speedLabel();
  }

function applyLayerVisibility() {
  if (!state.map) return;

  toggleMapLayer(state.routesLayer, state.showRoutes);
  toggleMapLayer(state.airportsLayer, state.showAirports);
  toggleMapLayer(state.trailsLayer, state.showTrails);
  toggleMapLayer(state.completedFlightsLayer, state.showTrails);
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
    q("btnFirstFlight")?.addEventListener("click", () => goToFirstFlight());
    q("btnFirstFlightTop")?.addEventListener("click", () => goToFirstFlight());
    q("btnSpeed")?.addEventListener("click", toggleSpeed);

    q("timeRange")?.addEventListener("input", (e) => {
      state.simTime = Number(e.target.value);
      updateFlights(state.simTime);
    });

    q("chkRoutes")?.addEventListener("change", (e) => {
      state.showRoutes = e.target.checked;
      applyLayerVisibility();
    });
    q("chkTrails")?.addEventListener("change", (e) => {
      state.showTrails = e.target.checked;
      applyLayerVisibility();
    });
    q("chkAirports")?.addEventListener("change", (e) => {
      state.showAirports = e.target.checked;
      applyLayerVisibility();
    });
  }

  async function init() {
    try {
      createMap();
      wireUi();
      await loadFlights();
      setTimeout(() => state.map.invalidateSize(), 50);
      requestAnimationFrame(animate);
    } catch (err) {
      console.error("Error inicializando rutas aéreas", err);
      const status = q("mapStatus");
      if (status) status.textContent = "Error al inicializar el mapa. Revisá la consola.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  const DEMO_FLIGHTS = [
    { id: "AR1400", airline: "AR", origin: "AEP", destination: "MDZ", dep: "2025-01-01T06:05:00-03:00", arr: "2025-01-01T07:55:00-03:00", passengers: 143, seats: 170 },
    { id: "FO5220", airline: "FO", origin: "AEP", destination: "BRC", dep: "2025-01-01T08:30:00-03:00", arr: "2025-01-01T10:45:00-03:00", passengers: 176, seats: 189 },
    { id: "AR1508", airline: "AR", origin: "COR", destination: "SLA", dep: "2025-01-01T11:15:00-03:00", arr: "2025-01-01T12:40:00-03:00", passengers: 91, seats: 128 },
    { id: "JA3840", airline: "JA", origin: "EZE", destination: "IGR", dep: "2025-01-01T14:20:00-03:00", arr: "2025-01-01T16:05:00-03:00", passengers: 155, seats: 186 },
    { id: "AR1882", airline: "AR", origin: "AEP", destination: "USH", dep: "2025-01-01T19:10:00-03:00", arr: "2025-01-01T22:45:00-03:00", passengers: 161, seats: 170 },
    { id: "AR1301", airline: "AR", origin: "AEP", destination: "GRU", dep: "2025-01-01T09:20:00-03:00", arr: "2025-01-01T12:10:00-03:00", passengers: 152, seats: 170 },
    { id: "AR1288", airline: "AR", origin: "SCL", destination: "AEP", dep: "2025-01-01T16:40:00-03:00", arr: "2025-01-01T18:35:00-03:00", passengers: 141, seats: 170 }
  ];
})();
