/* global Chart */
(() => {
  "use strict";

  /* ============================================================
     CONFIG
     ============================================================ */
  const YEAR_REF = 2025;

  // Si tu archivo no se llama así, cambia SOLO esta línea
  const RUTAS_CSV_PATH = "fuentes/rutasaereas.csv";
  const RUTAS_KM_CSV_PATH = "fuentes/km rutasaereas.csv";
  const AEROPUERTOS_GEOJSON_PATH = "fuentes/Datos_aeropuertos.geojson";
  const IATA_MUNDO_CSV_PATH = "fuentes/ListadoIATAmundo.csv";
  const AIRLINE_ALIAS_CSV_PATH = "fuentes/aerolineas_alias.csv";

  /* ============================================================
     ESTADO
     ============================================================ */
  let aeropuertos = [];
  let rutasOfertaRows = [];
  let iataWorldIndex = {};
  let routeCodeIndex = {};
  let currentIATA = "";
  let rutasKmRows = [];
  let rutasKmIndex = new Map();
  let airlineAliasIndex = {};

  const DEST_OVERRIDES = {
    BUE: { ciudad: "Buenos Aires AEP+EZE", pais: "Argentina" },
    GRU: { ciudad: "São Paulo", pais: "Brasil" },
    GIG: { ciudad: "Río de Janeiro", pais: "Brasil" },
    FLN: { ciudad: "Florianópolis", pais: "Brasil" },
    LIM: { ciudad: "Lima", pais: "Perú" },
    SCL: { ciudad: "Santiago", pais: "Chile" }
  };

  /* ============================================================
     HELPERS
     ============================================================ */
  const q = id => document.getElementById(id);

  function clean(v) {
    return v === null || v === undefined ? "" : String(v).trim();
  }

  function normalizeHeader(v) {
    return clean(v)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function firstNonEmpty(obj, keys, fallback = "") {
    for (const key of keys) {
      if (!obj) continue;
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  }

  function parseNumber(v) {
    if (v === null || v === undefined) return NaN;
    let s = String(v).trim();
    if (!s) return NaN;

    s = s.replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
    if (!s) return NaN;

    const commaCount = (s.match(/,/g) || []).length;
    const dotCount = (s.match(/\./g) || []).length;

    if (commaCount && dotCount) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (commaCount) {
      if (commaCount > 1) {
        const lastComma = s.lastIndexOf(",");
        const decimals = s.length - lastComma - 1;
        if (decimals !== 3) {
          const parts = s.split(",");
          const dec = parts.pop();
          s = parts.join("") + "." + dec;
        } else {
          s = s.replace(/,/g, "");
        }
      } else {
        const decimals = s.length - s.indexOf(",") - 1;
        s = decimals === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
      }
    } else if (dotCount) {
      if (dotCount > 1) {
        const lastDot = s.lastIndexOf(".");
        const decimals = s.length - lastDot - 1;
        if (decimals !== 3) {
          const parts = s.split(".");
          const dec = parts.pop();
          s = parts.join("") + "." + dec;
        } else {
          s = s.replace(/\./g, "");
        }
      } else {
        const decimals = s.length - s.indexOf(".") - 1;
        if (decimals === 3) s = s.replace(".", "");
      }
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function normalizeTextKey(v) {
  return clean(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCityPairKey(v) {
  return clean(v).toUpperCase().replace(/\s+/g, " ").trim();
}

function buildRouteFullKey(cityPair, airline, clasificacion, tipoOperacion) {
  return [
    normalizeCityPairKey(cityPair),
    normalizeTextKey(airline),
    normalizeTextKey(clasificacion),
    normalizeTextKey(tipoOperacion)
  ].join("|");
}

function buildRouteSimpleKey(cityPair) {
  return normalizeCityPairKey(cityPair);
}
  
  function formatNumber(n) {
    if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("es-AR");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function detectSep(headerLine) {
    if (headerLine.includes("\t")) return "\t";
    if (headerLine.includes(";")) return ";";
    return ",";
  }

  function parseCSV(text) {
    if (!text) return [];
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const sep = detectSep(lines[0]);
    const headers = lines[0].split(sep).map(normalizeHeader);

    return lines.slice(1).map(line => {
      const cols = line.split(sep);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] ?? "";
      });
      return row;
    });
  }

  async function readTextSmart(response) {
    const buffer = await response.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    return text;
  }

  function parseFechaFlexible(raw) {
    if (!raw) return null;
    const s = String(raw).trim();

    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

    m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function normalizeAirlineKey(name) {
    return clean(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function isUnnamedAirline(name) {
    const key = normalizeAirlineKey(name);
    return !key || key === "sindato" || key === "na" || key === "n_a";
  }

  function getAirlineDisplayName(name) {
  const raw = clean(name);

  if (isUnnamedAirline(raw)) {
    return "Aviación general / privada";
  }

  const normalized = normalizeTextKey(raw);
  return airlineAliasIndex[normalized] || raw;
}
  function setText(id, value) {
    const el = q(id);
    if (el) el.textContent = value;
  }

  function setHTML(id, value) {
    const el = q(id);
    if (el) el.innerHTML = value;
  }

function getAirportDisplayName(a) {
  const iata = clean(firstNonEmpty(a, ["IATA"])).toUpperCase();

  let ciudad = clean(firstNonEmpty(a, [
    "Ciudad",
    "Localidad",
    "Municipio",
    "Ciudad / Localidad"
  ]));

  ciudad = ciudad
    .replace(/\s*\([A-Z]{3}\)\s*$/g, "")
    .replace(/^Aeropuerto\s+de\s+/i, "")
    .replace(/\s+[–-]\s+.*$/g, "")
    .trim();

  if (iata === "AEP") return "Aeroparque Jorge Newbery (AEP)";
  if (ciudad) return `Aeropuerto de ${ciudad} (${iata})`;
  return `Aeropuerto (${iata})`;
}
function getAirportBaseRouteName(iata) {
  const key = clean(iata).toUpperCase();
  const a = aeropuertos.find(x => clean(firstNonEmpty(x, ["IATA"])).toUpperCase() === key);
  if (!a) return key;

  return clean(firstNonEmpty(a, [
    "Aeropuerto",
    "Nombre del Aeropuerto",
    "Ciudad",
    "Localidad"
  ])) || key;
}

function formatShareShort(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

function formatMonthShort(anioMes) {
  const d = parseFechaFlexible(anioMes);
  if (!d) return anioMes;
  return d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
}

function hexToRgba(hex, alpha = 0.22) {
  const raw = clean(hex).replace("#", "");
  const full = raw.length === 3
    ? raw.split("").map(ch => ch + ch).join("")
    : raw;

  const int = parseInt(full, 16);
  if (!Number.isFinite(int)) return `rgba(42, 111, 176, ${alpha})`;

  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function getRouteAirlinesLegend(route) {
  const totals = new Map();

  (route.monthly || []).forEach(m => {
    Object.entries(m.airlines || {}).forEach(([name, vals]) => {
      if (!totals.has(name)) totals.set(name, 0);
      totals.set(name, totals.get(name) + (vals.pax || 0));
    });
  });

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => ({
      name,
      color: getAirlineColor(name)
    }));
}
function getAirlineColor(name) {
  const key = normalizeTextKey(name);

const fixed = {
  "aerolineas": "#1F5AA6",
  "aerolineas argentinas": "#1F5AA6",

  "jetsmart": "#F28C28",
  "jetsmart airlines": "#F28C28",

  "flybondi": "#D4A000",

  "gol": "#2CA25F",
  "gol linhas aereas": "#2CA25F",

  "american": "#7A7F87",
  "american airlines": "#7A7F87",

  "latam": "#7B61C9",
  "latam peru": "#7B61C9",

  "andes": "#8C6D5A",
  "avianca": "#C62828",
  "american jet": "#E76F00",
  "sky airline": "#19A7A0",
  "paranair": "#C2185B",
  "copa": "#0077B6",

  "aviacion general / privada": "#8A8F98"
};

  if (fixed[key]) return fixed[key];

const fallback = [
  "#9AA3AD",
  "#B0B7BF",
  "#8F98A3",
  "#A6ADB5",
  "#7F8A96"
];

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }

  return fallback[Math.abs(hash) % fallback.length];
}
  /* ============================================================
     LOOKUP DE DESTINOS / RUTAS
     ============================================================ */
  function parseIATAMundoCSV(text) {
    const rows = parseCSV(text);

    const byIata = {};
    const byCode = {};

    rows.forEach(r => {
      const iata = clean(firstNonEmpty(r, ["iata"])).toUpperCase();
      const oaci = clean(firstNonEmpty(r, ["oaci", "icao"])).toUpperCase();

      const meta = {
        iata,
        oaci,
        ciudad: clean(firstNonEmpty(r, ["ciudad", "city"])),
        pais: clean(firstNonEmpty(r, ["pais", "país", "country"]))
      };

      if (iata) byIata[iata] = meta;
      if (iata) byCode[iata] = meta;
      if (oaci) byCode[oaci] = meta;
    });

    return { byIata, byCode };
  }
function parseAirlineAliasCSV(text) {
  const rows = parseCSV(text);
  const index = {};

  rows.forEach(r => {
    const fullName = clean(firstNonEmpty(r, [
      "aerolinea_nombre",
      "aerolinea",
      "nombre",
      "airline_name"
    ]));

    const shortName = clean(firstNonEmpty(r, [
      "nombre_corto",
      "alias",
      "short_name",
      "nombrecorto"
    ]));

    if (!fullName) return;

    index[normalizeTextKey(fullName)] = shortName || fullName;
  });

  return index;
}
  function getRouteMeta(code) {
    const key = clean(code).toUpperCase();
    if (!key) return null;
    return routeCodeIndex[key] || iataWorldIndex[key] || null;
  }

  function getEquivalentDestinationCode(selectedIata, otherCode) {
    const sel = clean(selectedIata).toUpperCase();
    const other = clean(otherCode).toUpperCase();

    const selectedIsBA = sel === "AEP" || sel === "EZE";
    const otherIsBA = other === "AEP" || other === "EZE";

    if (!selectedIsBA && otherIsBA) return "BUE";
    return other;
  }

  function getDestinationLabel(code, isInternational) {
    const key = clean(code).toUpperCase();

    if (DEST_OVERRIDES[key]) {
      return {
        ciudad: DEST_OVERRIDES[key].ciudad,
        pais: isInternational ? DEST_OVERRIDES[key].pais : ""
      };
    }

    const meta = getRouteMeta(key) || {};
    const ciudad = clean(meta.ciudad) || key;
    const pais = clean(meta.pais);

    return {
      ciudad,
      pais: isInternational ? pais : ""
    };
  }

function parseRutasOfertaCSV(text) {
  return parseCSV(text).map(r => {
    const anioMesRaw = clean(firstNonEmpty(r, [
      "anomes", "ano_mes", "año_mes", "fecha"
    ]));

    const date = parseFechaFlexible(anioMesRaw);
    const yearNum = parseNumber(firstNonEmpty(r, ["anio", "ano", "year", "año"]));

    const cityPair = clean(firstNonEmpty(r, ["citypair_iata"])).toUpperCase();

    let endpointA = "";
    let endpointB = "";

    if (cityPair.includes("-")) {
      const parts = cityPair.split("-").map(s => s.trim().toUpperCase());
      endpointA = parts[0] || "";
      endpointB = parts[1] || "";
    }

    return {
      anioMes: anioMesRaw,
      date,
      year: Number.isFinite(yearNum) ? Number(yearNum) : (date ? date.getFullYear() : NaN),

      cityPair,
      endpointA,
      endpointB,

      airline: clean(firstNonEmpty(r, [
        "aerolinea_nombre",
        "aerolinea",
        "airline",
        "compania"
      ])),

      clasificacion: clean(firstNonEmpty(r, ["clasificacion"])),
      tipoOperacion: clean(firstNonEmpty(r, [
        "comercial_av_gral",
        "tipo_operacion",
        "operacion"
      ])),

      pax: parseNumber(firstNonEmpty(r, [
        "totalpasajeros",
        "pax",
        "pasajeros",
        "valor_pax"
      ])),

      asientos: parseNumber(firstNonEmpty(r, [
        "asientos_pax",
        "asientos"
      ])),

      vuelos: parseNumber(firstNonEmpty(r, [
        "vuelos",
        "cantidad_vuelos",
        "movimientos"
      ])),

      frecuenciaSemanal: parseNumber(firstNonEmpty(r, [
        "frecuencia_semanal",
        "frecuencias"
      ])),

      distanciaKm: NaN
    };
  }).filter(r =>
    r.endpointA &&
    r.endpointB &&
    Number.isFinite(r.year)
  );
}
function parseRutasKmCSV(text) {
  return parseCSV(text).map(r => ({
    cityPair: clean(firstNonEmpty(r, ["citypair_iata"])).toUpperCase(),
    airline: clean(firstNonEmpty(r, [
      "aerolinea_nombre",
      "aerolinea",
      "airline",
      "compania"
    ])),
    clasificacion: clean(firstNonEmpty(r, ["clasificacion"])),
    tipoOperacion: clean(firstNonEmpty(r, [
      "comercial_av_gral",
      "tipo_operacion",
      "operacion"
    ])),
    distanciaKm: parseNumber(firstNonEmpty(r, [
      "distanciakm",
      "distancia_km"
    ]))
  })).filter(r =>
    r.cityPair &&
    Number.isFinite(r.distanciaKm)
  );
}

function buildRutasKmIndex(rows) {
  const idx = new Map();

  rows.forEach(r => {
    const fullKey = buildRouteFullKey(
      r.cityPair,
      r.airline,
      r.clasificacion,
      r.tipoOperacion
    );

    const simpleKey = buildRouteSimpleKey(r.cityPair);

    if (!idx.has(fullKey)) idx.set(fullKey, r.distanciaKm);
    if (!idx.has(simpleKey)) idx.set(simpleKey, r.distanciaKm);
  });

  return idx;
}

function getDistanciaForRuta(row) {
  const fullKey = buildRouteFullKey(
    row.cityPair,
    row.airline,
    row.clasificacion,
    row.tipoOperacion
  );

  const simpleKey = buildRouteSimpleKey(row.cityPair);

  if (rutasKmIndex.has(fullKey)) return rutasKmIndex.get(fullKey);
  if (rutasKmIndex.has(simpleKey)) return rutasKmIndex.get(simpleKey);

  return NaN;
}
  /* ============================================================
     AGREGACIÓN
     ============================================================ */
  function getOfertaDemandaSummary(iata, year = YEAR_REF, opts = {}) {
    const {
      soloComercial = true,
      minValueToShow = 1
    } = opts;

    const selected = clean(iata).toUpperCase();

    let rows = rutasOfertaRows.filter(r =>
      (r.endpointA === selected || r.endpointB === selected) &&
      r.year === year
    );

if (soloComercial) {
  rows = rows.filter(r => clean(r.tipoOperacion).toLowerCase().includes("comercial"));
}

    if (!rows.length) {
      return {
        totalPax: 0,
        totalAsientos: 0,
        totalVuelos: 0,
        totalFrecuenciaSemanal: 0,
        totalASK: 0,
        totalRPK: 0,
        loadFactor: null,
        loadFactorWeighted: null,
        routeDistanceAvgBySeats: null,
        airlinesCount: 0,
        destinos: [],
        airlines: [],
        monthly: [],
        mainRoutes: []
      };
    }

    const destinosMap = new Map();
    const airlinesMap = new Map();
    const monthlyMap = new Map();
    const mainRoutesMap = new Map();
    const countableAirlines = new Set();

let totalPax = 0;
let totalAsientos = 0;
let totalVuelos = 0;
let totalASK = 0;
let totalRPK = 0;
let weightedDistSeats = 0;
let seatsForWeightedDist = 0;

const freqByRouteAirline = new Map();
let totalFrecuenciaSemanal = 0;

    rows.forEach(r => {
      const otherCodeRaw = (r.endpointA === selected) ? r.endpointB : r.endpointA;
      if (!otherCodeRaw || otherCodeRaw === selected) return;

      const otherMeta = getRouteMeta(otherCodeRaw);
      const otherNormalizedCode = clean(otherMeta?.iata || otherCodeRaw).toUpperCase();
      const destinationCode = getEquivalentDestinationCode(selected, otherNormalizedCode);

      if (!destinationCode || destinationCode === selected) return;

      const isInternational = clean(r.clasificacion).toLowerCase() === "internacional";
      const label = getDestinationLabel(destinationCode, isInternational);

      if (!destinosMap.has(destinationCode)) {
        destinosMap.set(destinationCode, {
          code: destinationCode,
          ciudad: label.ciudad || destinationCode,
          pais: label.pais || "",
          clasificacion: r.clasificacion || "",
          pax: 0,
          asientos: 0,
          vuelos: 0,
          frecuenciaSemanal: 0,
          distanciaKm: Number.isFinite(r.distanciaKm) ? r.distanciaKm : null,
          ask: 0,
          rpk: 0
        });
      }

      const d = destinosMap.get(destinationCode);

      const pax = Number.isFinite(r.pax) ? r.pax : 0;
      const asientos = Number.isFinite(r.asientos) ? r.asientos : 0;
      const vuelos = Number.isFinite(r.vuelos) ? r.vuelos : 0;
      const freq = Number.isFinite(r.frecuenciaSemanal) ? r.frecuenciaSemanal : NaN;
      const dist = Number.isFinite(r.distanciaKm) ? r.distanciaKm : null;

      d.pax += pax;
      d.asientos += asientos;
      d.vuelos += vuelos;
      d.frecuenciaSemanal += Number.isFinite(freq) ? freq : 0;

      if (dist !== null) {
        d.distanciaKm = dist;
        d.ask += asientos * dist;
        d.rpk += pax * dist;
      }

const airlineRaw = clean(r.airline);
const airlineLabel = getAirlineDisplayName(airlineRaw);
const routeKey = [
  normalizeTextKey(label.ciudad || destinationCode),
  normalizeTextKey(label.pais || ""),
  normalizeTextKey(r.clasificacion || "")
].join("|");

if (!mainRoutesMap.has(routeKey)) {
  mainRoutesMap.set(routeKey, {
    key: routeKey,
    ciudad: label.ciudad || destinationCode,
    pais: label.pais || "",
    clasificacion: clean(r.clasificacion),
    airportCodes: new Set(),
    totalPax: 0,
    totalAsientos: 0,
    totalVuelos: 0,
    monthlyMap: new Map()
  });
}

const routeAgg = mainRoutesMap.get(routeKey);

if (otherNormalizedCode) {
  routeAgg.airportCodes.add(otherNormalizedCode);
}

routeAgg.totalPax += pax;
routeAgg.totalAsientos += asientos;
routeAgg.totalVuelos += vuelos;

if (r.anioMes) {
  if (!routeAgg.monthlyMap.has(r.anioMes)) {
    routeAgg.monthlyMap.set(r.anioMes, {
      anioMes: r.anioMes,
      totalPax: 0,
      totalAsientos: 0,
      totalVuelos: 0,
      airlines: {}
    });
  }

  const routeMonth = routeAgg.monthlyMap.get(r.anioMes);
  routeMonth.totalPax += pax;
  routeMonth.totalAsientos += asientos;
  routeMonth.totalVuelos += vuelos;

  if (!routeMonth.airlines[airlineLabel]) {
    routeMonth.airlines[airlineLabel] = {
      pax: 0,
      asientos: 0,
      vuelos: 0
    };
  }

  routeMonth.airlines[airlineLabel].pax += pax;
  routeMonth.airlines[airlineLabel].asientos += asientos;
  routeMonth.airlines[airlineLabel].vuelos += vuelos;
}
if (!airlinesMap.has(airlineLabel)) {
  airlinesMap.set(airlineLabel, {
    name: airlineLabel,
    paxCab: 0,
    paxInt: 0,
    paxTotal: 0,
    asientosCab: 0,
    asientosInt: 0,
    asientosTotal: 0,
    vuelosCab: 0,
    vuelosInt: 0,
    vuelosTotal: 0
  });
}

const a = airlinesMap.get(airlineLabel);
const airlineMarketKey = isInternational ? "Int" : "Cab";

a.paxTotal += pax;
a.asientosTotal += asientos;
a.vuelosTotal += vuelos;

a[`pax${airlineMarketKey}`] += pax;
a[`asientos${airlineMarketKey}`] += asientos;
a[`vuelos${airlineMarketKey}`] += vuelos;

if (!isUnnamedAirline(airlineRaw)) {
  countableAirlines.add(airlineLabel);
}
const freqKey = [
  normalizeCityPairKey(r.cityPair),
  normalizeTextKey(airlineLabel || r.airline || "sin_dato")
].join("|");

if (Number.isFinite(freq)) {
  if (!freqByRouteAirline.has(freqKey)) {
    freqByRouteAirline.set(freqKey, {
      sum: 0,
      count: 0
    });
  }

  const freqAcc = freqByRouteAirline.get(freqKey);
  freqAcc.sum += freq;
  freqAcc.count += 1;
}
if (r.anioMes) {
  if (!monthlyMap.has(r.anioMes)) {
    monthlyMap.set(r.anioMes, {
      anioMes: r.anioMes,
      paxCab: 0,
      paxInt: 0,
      paxTotal: 0,
      asientosCab: 0,
      asientosInt: 0,
      asientosTotal: 0,
      vuelosCab: 0,
      vuelosInt: 0,
      vuelosTotal: 0
    });
  }

  const m = monthlyMap.get(r.anioMes);
const monthlyMarketKey = isInternational ? "Int" : "Cab";

m.paxTotal += pax;
m.asientosTotal += asientos;
m.vuelosTotal += vuelos;

m[`pax${monthlyMarketKey}`] += pax;
m[`asientos${monthlyMarketKey}`] += asientos;
m[`vuelos${monthlyMarketKey}`] += vuelos;
}

      totalPax += pax;
      totalAsientos += asientos;
      totalVuelos += vuelos;

      if (dist !== null) {
        totalASK += asientos * dist;
        totalRPK += pax * dist;
        weightedDistSeats += asientos * dist;
        seatsForWeightedDist += asientos;
      }
    });
totalFrecuenciaSemanal = Array.from(freqByRouteAirline.values())
  .reduce((acc, item) => {
    if (!item.count) return acc;
    return acc + (item.sum / item.count);
  }, 0);
    const destinos = Array.from(destinosMap.values())
      .filter(d => (d.pax > 0 || d.asientos > 0 || d.vuelos > 0))
      .sort((a, b) => b.pax - a.pax);

const airlines = Array.from(airlinesMap.values())
  .filter(a =>
    (a.paxTotal > minValueToShow || a.asientosTotal > minValueToShow || a.vuelosTotal > minValueToShow)
  )
  .sort((a, b) => b.asientosTotal - a.asientosTotal);

    const monthly = Array.from(monthlyMap.values()).sort((a, b) => {
      const da = parseFechaFlexible(a.anioMes);
      const db = parseFechaFlexible(b.anioMes);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });
const originRouteName = getAirportBaseRouteName(selected);

const mainRoutes = Array.from(mainRoutesMap.values())
  .filter(r => (r.totalPax > 0 || r.totalAsientos > 0))
  .sort((a, b) => b.totalPax - a.totalPax)
  .slice(0, 6)
  .map(route => {
    const codes = Array.from(route.airportCodes).sort((a, b) => a.localeCompare(b, "es"));
    const codesLabel = codes.join("+");

    const cityAlreadyHasCodes =
      codesLabel &&
      clean(route.ciudad).toUpperCase().includes(codesLabel);

    const destinationDisplay = codesLabel && !cityAlreadyHasCodes
      ? `${route.ciudad} ${codesLabel}`
      : route.ciudad;

    const monthly = Array.from(route.monthlyMap.values()).sort((a, b) => {
      const da = parseFechaFlexible(a.anioMes);
      const db = parseFechaFlexible(b.anioMes);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });

    return {
      key: route.key,
      title: `${originRouteName} - ${destinationDisplay}`,
      ciudad: route.ciudad,
      pais: route.pais,
      codesLabel,
      totalPax: route.totalPax,
      totalAsientos: route.totalAsientos,
      totalVuelos: route.totalVuelos,
      sharePaxPct: totalPax > 0 ? (route.totalPax / totalPax) * 100 : 0,
      shareSeatsPct: totalAsientos > 0 ? (route.totalAsientos / totalAsientos) * 100 : 0,
      monthly
    };
  });
    return {
      totalPax,
      totalAsientos,
      totalVuelos,
      totalFrecuenciaSemanal,
      totalASK,
      totalRPK,
      loadFactor: totalAsientos > 0 ? totalPax / totalAsientos : null,
      loadFactorWeighted: totalASK > 0 ? totalRPK / totalASK : null,
      routeDistanceAvgBySeats: seatsForWeightedDist > 0 ? weightedDistSeats / seatsForWeightedDist : null,
      airlinesCount: Array.from(countableAirlines).length,
      destinos,
      airlines,
      monthly,
      mainRoutes
    };
  }
  function getSNAPassengerRanking(selectedIata, year = YEAR_REF) {
  const rankingRows = (aeropuertos || []).map(a => {
    const iata = clean(firstNonEmpty(a, ["IATA"])).toUpperCase();
    const summary = getOfertaDemandaSummary(iata, year, { soloComercial: true });

    return {
      iata,
      totalPax: Number(summary.totalPax || 0)
    };
  });

  rankingRows.sort((a, b) => b.totalPax - a.totalPax);

  const rank = rankingRows.findIndex(r => r.iata === clean(selectedIata).toUpperCase()) + 1;
  const totalAirports = rankingRows.length;

  return {
    rank: rank > 0 ? rank : null,
    totalAirports
  };
}
function buildExtremaPlugin(pluginId, series) {
  return {
    id: pluginId,
    afterDatasetsDraw(chart) {
      const values = (series || []).map(v => Number(v || 0));
      const positive = values.filter(v => v > 0);

      if (!positive.length) return;

      const maxVal = Math.max(...positive);
      const minVal = Math.min(...positive);

      const maxIdx = values.findIndex(v => v === maxVal);
      const minIdx = values.findIndex(v => v === minVal);

      const { ctx, chartArea, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;

      if (!xScale || !yScale) return;

      function drawArrow(index, value, arrow, color, offsetY) {
        if (index < 0 || !Number.isFinite(value)) return;

        const x = xScale.getPixelForValue(index);
        let y = yScale.getPixelForValue(value) + offsetY;

        // evita que se recorten arriba o abajo
        y = Math.max(chartArea.top + 10, Math.min(chartArea.bottom - 10, y));

        ctx.save();
        ctx.font = "700 12px Roboto, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // halo blanco para que se vea bien sobre barras/líneas
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(arrow, x, y);

        ctx.fillStyle = color;
        ctx.fillText(arrow, x, y);
        ctx.restore();
      }

      if (minIdx === maxIdx) {
        // caso raro: mismo mes para mín y máx
        drawArrow(maxIdx, maxVal, "▲", "#2ca24f", -16); // verde
        drawArrow(minIdx, minVal, "▼", "#f28c28", 14);  // naranja
      } else {
        drawArrow(maxIdx, maxVal, "▲", "#2ca24f", -16); // verde
        drawArrow(minIdx, minVal, "▼", "#f28c28", 14);  // naranja
      }
    }
  };
}

function getSNAPassengerRanking(selectedIata, year = YEAR_REF) {
  const rankingRows = (aeropuertos || []).map(a => {
    const iata = clean(firstNonEmpty(a, ["IATA"])).toUpperCase();
    const summary = getOfertaDemandaSummary(iata, year, { soloComercial: true });

    return {
      iata,
      totalPax: Number(summary.totalPax || 0)
    };
  });

  rankingRows.sort((a, b) => b.totalPax - a.totalPax);

  const rank = rankingRows.findIndex(r => r.iata === clean(selectedIata).toUpperCase()) + 1;
  const totalAirports = rankingRows.length;

  return {
    rank: rank > 0 ? rank : null,
    totalAirports
  };
}
  /* ============================================================
     RENDER
     ============================================================ */
function renderOfertaDemandaMonthlyChart(rows) {
  const canvas = q("odMonthlyChart");
  if (!canvas || typeof Chart === "undefined") return;

  if (canvas._chart) {
    canvas._chart.destroy();
    canvas._chart = null;
  }

  const dataRows = (rows || [])
    .slice()
    .sort((a, b) => a.anioMes.localeCompare(b.anioMes));

  if (!dataRows.length) return;

const labels = dataRows.map(r => formatMonthShort(r.anioMes));
  
  const paxCab = dataRows.map(r => Math.round(r.paxCab || 0));
  const paxInt = dataRows.map(r => Math.round(r.paxInt || 0));
  const asientosCab = dataRows.map(r => Math.round(r.asientosCab || 0));
  const asientosInt = dataRows.map(r => Math.round(r.asientosInt || 0));

  const hasPaxInt = paxInt.some(v => v > 0);
  const hasAsientosInt = asientosInt.some(v => v > 0);

  const subtitleEl = q("odMonthlySubtitle");
  if (subtitleEl) {
    subtitleEl.innerHTML =
      `Asientos ofrecidos <span class="od-sub-asientos-cab">cabotaje</span>` +
      (hasAsientosInt ? ` e <span class="od-sub-asientos-int">internacional</span>` : ``) +
      ` y pasajeros transportados <span class="od-sub-pax-cab">cabotaje</span>` +
      (hasPaxInt ? ` e <span class="od-sub-pax-int">internacional</span>` : ``);
  }

  const datasets = [
    {
      type: "bar",
      label: "Pasajeros cabotaje",
      data: paxCab,
      backgroundColor: "rgba(117, 170, 219, 0.35)",
      borderColor: "#75AADB",
      borderWidth: 1.1,
      order: 3,
      barPercentage: 0.34,
      categoryPercentage: 0.82
    },
    {
      type: "line",
      label: "Asientos cabotaje",
      data: asientosCab,
      borderColor: "#2A6FB0",
      backgroundColor: "rgba(42, 111, 176, 0)",
      pointBackgroundColor: "#2A6FB0",
      pointBorderColor: "#2A6FB0",
      pointRadius: 2,
      pointHoverRadius: 3,
      borderWidth: 2,
      tension: 0.22,
      fill: false,
      order: 1
    }
  ];

  if (hasPaxInt) {
    datasets.push({
      type: "bar",
      label: "Pasajeros internacional",
      data: paxInt,
      backgroundColor: "rgba(62, 209, 4, 0.18)",
      borderColor: "#3ed104",
      borderWidth: 1.1,
      order: 4,
      barPercentage: 0.34,
      categoryPercentage: 0.82
    });
  }

  if (hasAsientosInt) {
    datasets.push({
      type: "line",
      label: "Asientos internacional",
      data: asientosInt,
      borderColor: "#1C7C1B",
      backgroundColor: "rgba(28, 124, 27, 0)",
      pointBackgroundColor: "#1C7C1B",
      pointBorderColor: "#1C7C1B",
      pointRadius: 2,
      pointHoverRadius: 3,
      borderWidth: 2,
      tension: 0.22,
      fill: false,
      order: 2
    });
  }

  const totalPaxSeries = dataRows.map(r => Math.round((r.paxCab || 0) + (r.paxInt || 0)));
  const extremaPlugin = buildExtremaPlugin("monthlyExtrema", totalPaxSeries);
 
  canvas._chart = new Chart(canvas, {
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 22,
          bottom: 4
        }
      },
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
tooltip: {
  displayColors: true,
  padding: 8,
  boxWidth: 10,
  boxHeight: 10,
  titleFont: {
    size: 10,
    weight: "600"
  },
  bodyFont: {
    size: 9
  },
  callbacks: {
title: items => {
  const idx = items[0]?.dataIndex ?? 0;
  const row = dataRows[idx];
  if (!row) return "";

  const d = parseFechaFlexible(row.anioMes);
  const mes = d
    ? d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")
    : row.anioMes;
  const anio = d ? d.getFullYear() : "";

  const totalPaxMes = Number(row.paxCab || 0) + Number(row.paxInt || 0);
  const totalAsientosMes = Number(row.asientosCab || 0) + Number(row.asientosInt || 0);

  return `${mes} ${anio} · ${totalPaxMes.toLocaleString("es-AR")} pasajeros · ${totalAsientosMes.toLocaleString("es-AR")} asientos`;
},
    label: ctx => {
      // mostramos una sola línea por mercado, usando el dataset de línea
      if (ctx.dataset.type !== "line") return null;

      const isInternational = /internacional/i.test(String(ctx.dataset.label || ""));
      const mercado = isInternational ? "Internacional" : "Cabotaje";
      const idx = ctx.dataIndex;

      const dsAsientos = ctx.chart.data.datasets.find(ds =>
        ds.label === `Asientos ${isInternational ? "internacional" : "cabotaje"}`
      );
      const dsPax = ctx.chart.data.datasets.find(ds =>
        ds.label === `Pasajeros ${isInternational ? "internacional" : "cabotaje"}`
      );

      const asientos = Number(dsAsientos?.data?.[idx] || 0);
      const pasajeros = Number(dsPax?.data?.[idx] || 0);

      if (asientos === 0 && pasajeros === 0) return null;

      return `${mercado}: ${pasajeros.toLocaleString("es-AR")} pasajeros · ${asientos.toLocaleString("es-AR")} asientos`;
    },
    labelColor: ctx => {
      const color = ctx.dataset.borderColor || "#2A6FB0";
      return {
        borderColor: color,
        backgroundColor: color
      };
    }
  },
  filter: ctx => {
    // filtra para que no duplique por barra + línea
    if (ctx.dataset.type !== "line") return false;

    const isInternational = /internacional/i.test(String(ctx.dataset.label || ""));
    const idx = ctx.dataIndex;

    const dsAsientos = ctx.chart.data.datasets.find(ds =>
      ds.label === `Asientos ${isInternational ? "internacional" : "cabotaje"}`
    );
    const dsPax = ctx.chart.data.datasets.find(ds =>
      ds.label === `Pasajeros ${isInternational ? "internacional" : "cabotaje"}`
    );

    const asientos = Number(dsAsientos?.data?.[idx] || 0);
    const pasajeros = Number(dsPax?.data?.[idx] || 0);

    return asientos > 0 || pasajeros > 0;
  }
}
      },
      scales: {
        x: {
          stacked: false,
          grid: {
            color: "#e6edf4"
          },
          ticks: {
            color: "#6f7d8c",
            font: {
              size: 9
            },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          stacked: false,
          beginAtZero: true,
          grid: {
            color: "#e6edf4"
          },
          ticks: {
            color: "#6f7d8c",
            font: {
              size: 9
            },
            callback: value => Number(value).toLocaleString("es-AR")
          }
        }
      }
    },
    plugins: [extremaPlugin]
  });
}
 
function splitLabelTwoLines(text, maxLen = 12) {
  const raw = clean(text);
  if (!raw) return [""];

  if (raw.length <= maxLen) return [raw];

  const words = raw.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (test.length <= maxLen && lines.length === 0) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  if (lines.length === 1) return lines;
  if (lines.length === 2) return lines;

  return [lines[0], lines.slice(1).join(" ")];
}

function renderAirlinesChart(rows) {
  const canvas = q("odAirlinesChart");
  if (!canvas || typeof Chart === "undefined") return;

  if (canvas._chart) {
    canvas._chart.destroy();
    canvas._chart = null;
  }

  const allRows = (rows || [])
    .filter(r => (r.asientosTotal || 0) > 0)
    .sort((a, b) => (b.asientosTotal || 0) - (a.asientosTotal || 0));

  const dataRows = allRows.slice(0, 6);
  if (!dataRows.length) return;

  const totalSeatsAll = allRows.reduce((acc, r) => acc + (r.asientosTotal || 0), 0);

  const fullLabels = dataRows.map(r => r.name);
  const labels = fullLabels.map(name => splitLabelTwoLines(name, 12));

  const cabValues = dataRows.map(r => Math.round(r.asientosCab || 0));
  const intValues = dataRows.map(r => Math.round(r.asientosInt || 0));
  const totalValues = dataRows.map(r => Math.round(r.asientosTotal || 0));

  const hasInt = intValues.some(v => v > 0);

  const subtitleEl = q("odAirlinesSubtitle");
  if (subtitleEl) {
    subtitleEl.innerHTML =
      `Asientos ofrecidos <span class="od-sub-asientos-cab">cabotaje</span>` +
      (hasInt ? ` e <span class="od-sub-asientos-int">internacional</span>` : ``) +
      ` por operador`;
  }

  const percents = dataRows.map(r =>
    totalSeatsAll > 0 ? ((r.asientosTotal || 0) / totalSeatsAll) * 100 : 0
  );

  const datasets = [
{
  label: "Cabotaje",
  data: cabValues,
  backgroundColor: "rgba(42, 111, 176, 0.22)",
  borderColor: "#2A6FB0",
  borderWidth: 1.1,
  borderRadius: 4,
  stack: "mercado",
  barThickness: 14,
  minBarLength: 10
}
  ];

  if (hasInt) {
    datasets.push({
  label: "Internacional",
  data: intValues,
  backgroundColor: "rgba(28, 124, 27, 0.16)",
  borderColor: "#1C7C1B",
  borderWidth: 1.1,
  borderRadius: 4,
  stack: "mercado",
  barThickness: 14,
  minBarLength: 10
});
  }

  const totalLabelPlugin = {
    id: "airlineTotalLabelPlugin",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(datasets.length - 1);
      if (!meta) return;

      ctx.save();
      ctx.font = "600 9px sans-serif";
      ctx.fillStyle = "#5f6e7d";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      meta.data.forEach((bar, index) => {
        const pct = percents[index] || 0;
        const label = `${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
        const x = bar.x + 6;
        const y = bar.y;
        ctx.fillText(label, x, y);
      });

      ctx.restore();
    }
  };

  canvas._chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      layout: {
        padding: {
          left: 2,
          right: 34,
          top: 0,
          bottom: 0
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: items => fullLabels[items[0].dataIndex],
            label: ctx => {
              const value = Number(ctx.raw || 0);
              return `${ctx.dataset.label}: ${value.toLocaleString("es-AR")} asientos`;
            },
            footer: items => {
              const idx = items[0].dataIndex;
              const total = totalValues[idx] || 0;
              const pct = percents[idx] || 0;
              return `Total: ${total.toLocaleString("es-AR")} asientos (${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: "#e6edf4"
          },
          ticks: {
            color: "#6f7d8c",
            font: {
              size: 9
            },
            maxTicksLimit: 4,
            callback: value => Number(value).toLocaleString("es-AR")
          }
        },
        y: {
          stacked: true,
          grid: {
            display: false
          },
          ticks: {
            color: "#334150",
            font: {
              size: 9
            }
          }
        }
      }
    },
    plugins: [totalLabelPlugin]
  });
}


function paginateTopRoutes() {
  const mainList = document.getElementById("odTopRoutes");
  const extraList = document.getElementById("odTopRoutesExtra");
  const extraPage = document.getElementById("odRoutesExtraPage");

  if (!mainList || !extraList || !extraPage) return;

  // Limpiar hoja extra
  extraList.innerHTML = "";

  const routeItems = Array.from(mainList.children).filter(el => {
    return !el.classList.contains("od-empty");
  });

  if (routeItems.length <= 3) {
    extraPage.classList.add("is-hidden");

    if (!routeItems.length) {
      extraList.innerHTML = '<div class="od-empty">Sin datos</div>';
    }

    return;
  }

  extraPage.classList.remove("is-hidden");

  const extraItems = routeItems.slice(3);

  extraItems.forEach(item => {
    extraList.appendChild(item);
  });

  if (!extraList.children.length) {
    extraList.innerHTML = '<div class="od-empty">Sin datos</div>';
  }
}
  
function buildRouteLineEndLabelsPlugin(pluginId, airlineStats) {
  return {
    id: pluginId,
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      ctx.save();
      ctx.font = "600 9px Roboto, Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const statsByName = new Map((airlineStats || []).map(a => [a.name, a]));

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (dataset.type !== "line") return;

        const airlineName = String(dataset.label || "").replace(/\s+asientos$/i, "");
        const stats = statsByName.get(airlineName);

        // Solo etiquetar líneas reales
        if (!stats || !(stats.totalAsientos > 0)) return;

        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta?.data?.length) return;

        const series = dataset.data || [];
        let lastIndex = -1;

        for (let i = series.length - 1; i >= 0; i--) {
          const v = Number(series[i] || 0);
          if (v > 0) {
            lastIndex = i;
            break;
          }
        }

        if (lastIndex < 0) return;

        const point = meta.data[lastIndex];
        if (!point) return;

        const x = Math.min(point.x + 8, chartArea.right - 64);
        const y = point.y;

        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(airlineName, x, y);

        ctx.fillStyle = dataset.borderColor || "#333";
        ctx.fillText(airlineName, x, y);
      });

      ctx.restore();
    }
  };
}

function buildRouteRightLabelsPlugin(pluginId, airlineStats) {
  return {
    id: pluginId,
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      const visibleAirlines = (airlineStats || [])
        .filter(a => a.totalAsientos > 0)
        .sort((a, b) => b.totalPax - a.totalPax);

      if (!visibleAirlines.length) return;

      ctx.save();
      ctx.font = "600 9px Roboto, Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const top = chartArea.top + 10;
      const bottom = chartArea.bottom - 10;
      const step = visibleAirlines.length === 1
        ? 0
        : (bottom - top) / (visibleAirlines.length - 1);

      visibleAirlines.forEach((airline, idx) => {
        const datasetIndex = chart.data.datasets.findIndex(ds =>
          ds.type === "line" &&
          String(ds.label || "").replace(/\s+asientos$/i, "") === airline.name
        );

        if (datasetIndex < 0) return;

        const dataset = chart.data.datasets[datasetIndex];
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta?.data?.length) return;

        const series = dataset.data || [];
        let lastIndex = -1;

        for (let i = series.length - 1; i >= 0; i--) {
          const v = Number(series[i] || 0);
          if (v > 0) {
            lastIndex = i;
            break;
          }
        }

        if (lastIndex < 0) return;

        const point = meta.data[lastIndex];
        if (!point) return;

        const labelX = chartArea.right + 10;
        const labelY = top + (step * idx);

        ctx.strokeStyle = dataset.borderColor || "#333";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(point.x + 3, point.y);
        ctx.lineTo(labelX - 4, labelY);
        ctx.stroke();

        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(airline.name, labelX, labelY);

        ctx.fillStyle = dataset.borderColor || "#333";
        ctx.fillText(airline.name, labelX, labelY);
      });

      ctx.restore();
    }
  };
}
  
function renderSingleRouteChart(canvasId, route) {
  const canvas = q(canvasId);
  if (!canvas || typeof Chart === "undefined") return;

  if (canvas._chart) {
    canvas._chart.destroy();
    canvas._chart = null;
  }

  const monthlyRows = (route.monthly || [])
    .slice()
    .sort((a, b) => a.anioMes.localeCompare(b.anioMes));

  if (!monthlyRows.length) return;

  const labels = monthlyRows.map(r => formatMonthShort(r.anioMes));

  const airlineStats = Array.from(new Set(
    monthlyRows.flatMap(m => Object.keys(m.airlines || {}))
  )).map(name => {
    const totalPax = monthlyRows.reduce((acc, m) => acc + (m.airlines?.[name]?.pax || 0), 0);
    const totalAsientos = monthlyRows.reduce((acc, m) => acc + (m.airlines?.[name]?.asientos || 0), 0);

    return {
      name,
      totalPax,
      totalAsientos
    };
  })
  .filter(a => a.totalPax > 0 || a.totalAsientos > 0)
  .sort((a, b) => b.totalPax - a.totalPax);

  const airlines = airlineStats.map(a => a.name);
  if (!airlines.length) return;

  const datasets = [];

  airlines.forEach((airline) => {
    const color = getAirlineColor(airline);

    datasets.push({
      type: "bar",
      label: `${airline} pasajeros`,
      data: monthlyRows.map(m => Math.round(m.airlines?.[airline]?.pax || 0)),
      backgroundColor: hexToRgba(color, 0.35),
      borderColor: color,
      borderWidth: 1.1,
      order: 3,
      barPercentage: 0.52,
      categoryPercentage: 0.92
    });

    datasets.push({
      type: "line",
      label: `${airline} asientos`,
      data: monthlyRows.map(m => Math.round(m.airlines?.[airline]?.asientos || 0)),
      borderColor: color,
      backgroundColor: "rgba(0,0,0,0)",
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointRadius: 2,
      pointHoverRadius: 3,
      borderWidth: 1.9,
      tension: 0.22,
      fill: false,
      order: 1
    });
  });

  const totalPaxSeries = monthlyRows.map(m => Math.round(m.totalPax || 0));
  const extremaPlugin = buildExtremaPlugin(`routeExtrema_${canvasId}`, totalPaxSeries);
  const rightLabelsPlugin = buildRouteRightLabelsPlugin(`routeRightLabels_${canvasId}`, airlineStats);

  canvas._chart = new Chart(canvas, {
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 20,
          right: 120,
          bottom: 4
        }
      },
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
tooltip: {
  displayColors: true,
  padding: 8,
  boxWidth: 10,
  boxHeight: 10,
  titleFont: {
    size: 10,
    weight: "600"
  },
  bodyFont: {
    size: 9
  },
  callbacks: {
title: items => {
  const idx = items[0]?.dataIndex ?? 0;
  const row = monthlyRows[idx];
  if (!row) return "";

  const d = parseFechaFlexible(row.anioMes);
  const mes = d
    ? d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")
    : row.anioMes;
  const anio = d ? d.getFullYear() : "";

  const totalPaxMes = Number(row.totalPax || 0);
  const totalAsientosMes = Number(row.totalAsientos || 0);

  return `${mes} ${anio} · ${totalPaxMes.toLocaleString("es-AR")} pasajeros · ${totalAsientosMes.toLocaleString("es-AR")} asientos`;
},
    label: ctx => {
      // mostramos una sola línea por aerolínea, usando el dataset de línea
      if (ctx.dataset.type !== "line") return null;

      const airline = String(ctx.dataset.label || "").replace(/\s+asientos$/i, "");
      const idx = ctx.dataIndex;

      const dsAsientos = ctx.chart.data.datasets.find(ds => ds.label === `${airline} asientos`);
      const dsPax = ctx.chart.data.datasets.find(ds => ds.label === `${airline} pasajeros`);

      const asientos = Number(dsAsientos?.data?.[idx] || 0);
      const pax = Number(dsPax?.data?.[idx] || 0);

      if (asientos === 0 && pax === 0) return null;

      return `${airline}: ${asientos.toLocaleString("es-AR")} as. · ${pax.toLocaleString("es-AR")} pax`;
    },
    labelColor: ctx => {
      const color = ctx.dataset.borderColor || "#2A6FB0";
      return {
        borderColor: color,
        backgroundColor: color
      };
    }
  },
  filter: ctx => {
    // filtra para que no duplique por barra + línea
    if (ctx.dataset.type !== "line") return false;

    const airline = String(ctx.dataset.label || "").replace(/\s+asientos$/i, "");
    const idx = ctx.dataIndex;

    const dsAsientos = ctx.chart.data.datasets.find(ds => ds.label === `${airline} asientos`);
    const dsPax = ctx.chart.data.datasets.find(ds => ds.label === `${airline} pasajeros`);

    const asientos = Number(dsAsientos?.data?.[idx] || 0);
    const pax = Number(dsPax?.data?.[idx] || 0);

    return asientos > 0 || pax > 0;
  }
}
      },
      scales: {
        x: {
          stacked: false,
          grid: {
            color: "#eef3f8"
          },
          ticks: {
            color: "#6f7d8c",
            font: { size: 8 },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "#eef3f8"
          },
          ticks: {
            color: "#6f7d8c",
            font: { size: 8 },
            callback: value => Number(value).toLocaleString("es-AR")
          }
        }
      }
    },
    plugins: [extremaPlugin, rightLabelsPlugin]
  });
}

function paginateTopRoutes() {
  const mainList = q("odTopRoutes");
  const extraList = q("odTopRoutesExtra");
  const extraPage = q("odRoutesExtraPage");

  if (!mainList || !extraList || !extraPage) return;

  // Limpiar hoja extra antes de mover nuevas tarjetas
  extraList.innerHTML = "";

  const routeItems = Array.from(mainList.children).filter(el => {
    return !el.classList.contains("od-empty");
  });

  if (routeItems.length <= 3) {
    extraPage.classList.add("is-hidden");

    if (!routeItems.length) {
      extraList.innerHTML = '<div class="od-empty">Sin datos</div>';
    }

    return;
  }

  // Mostrar hoja 2 solo si hay más de 3 rutas
  extraPage.classList.remove("is-hidden");

  const extraItems = routeItems.slice(3);

  extraItems.forEach(item => {
    extraList.appendChild(item);
  });

  if (!extraList.children.length) {
    extraList.innerHTML = '<div class="od-empty">Sin datos</div>';
  }
}
  
function renderTopRoutesCharts(routes) {
  const topRoutesEl = q("odTopRoutes");
  if (!topRoutesEl) return;

  const dataRoutes = (routes || [])
    .slice()
    .sort((a, b) => (b.totalPax || 0) - (a.totalPax || 0))
    .slice(0, 6);

  if (!dataRoutes.length) {
    topRoutesEl.innerHTML = '<div class="od-empty">Sin datos</div>';
    paginateTopRoutes();
    return;
  }

  topRoutesEl.innerHTML = dataRoutes.map((route, idx) => `
    <div class="od-route-card-chart">
      <div class="od-route-card-head">
        <div class="od-route-card-titleline">
<div class="od-route-card-title">
  ${escapeHtml(route.title)}
  <span class="od-route-card-metrics-inline">
    <span class="od-route-metric od-route-metric-pax">
      <span class="od-mini-icon od-mini-icon-bars" aria-hidden="true"></span>
      <span class="od-route-metric-label">Pasajeros</span>
      <span class="od-route-metric-value">${escapeHtml(formatNumber(Math.round(route.totalPax)))}</span>
      <span class="od-route-metric-share">(${escapeHtml(formatShareShort(route.sharePaxPct))})</span>
    </span>

    <span class="od-route-metric-sep">·</span>

    <span class="od-route-metric od-route-metric-seats">
      <span class="od-mini-icon od-mini-icon-lines" aria-hidden="true"></span>
      <span class="od-route-metric-label">Asientos</span>
      <span class="od-route-metric-value">${escapeHtml(formatNumber(Math.round(route.totalAsientos)))}</span>
      <span class="od-route-metric-share">(${escapeHtml(formatShareShort(route.shareSeatsPct))})</span>
    </span>
  </span>
</div>
        </div>
      </div>

      <div class="od-route-chart-wrap">
        <canvas id="odRouteChart_${idx}"></canvas>
      </div>
    </div>
  `).join("");

  // Primero mueve las rutas 4, 5 y 6 a la segunda hoja.
  // Recién después se dibujan los gráficos en su contenedor definitivo.
  paginateTopRoutes();

  dataRoutes.forEach((route, idx) => {
    renderSingleRouteChart(`odRouteChart_${idx}`, route);
  });
}
  
  function renderOfertaDemanda(iata) {
    const summary = getOfertaDemandaSummary(iata, YEAR_REF, { soloComercial: true });
setText(
  "odTotalPax",
  Number.isFinite(summary.totalPax) ? formatNumber(Math.round(summary.totalPax)) : "–"
);

setText(
  "odTotalAsientos",
  Number.isFinite(summary.totalAsientos) ? formatNumber(Math.round(summary.totalAsientos)) : "–"
);

setText(
  "odTotalVuelos",
  Number.isFinite(summary.totalVuelos) ? formatNumber(Math.round(summary.totalVuelos)) : "–"
);

setText(
  "odAirlinesCount",
  Number.isFinite(summary.airlinesCount) ? String(summary.airlinesCount) : "–"
);

setText(
  "odFrecuenciaSemanal",
  Number.isFinite(summary.totalFrecuenciaSemanal)
    ? formatNumber(Math.round(summary.totalFrecuenciaSemanal))
    : "–"
);

setText(
  "odLoadFactor",
  summary.loadFactorWeighted !== null
    ? `${(summary.loadFactorWeighted * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`
    : "–"
);
const snaRank = getSNAPassengerRanking(iata, YEAR_REF);

setHTML(
  "odSnaRank",
  snaRank.rank
    ? `#${formatNumber(snaRank.rank)} <span class="od-kpi-rank-total">/ ${formatNumber(snaRank.totalAirports)}</span>`
    : "–"
);
setHTML(
  "odSnaRank",
  snaRank.rank
    ? `#${formatNumber(snaRank.rank)} <span class="od-kpi-rank-total">/ ${formatNumber(snaRank.totalAirports)}</span>`
    : "–"
);
renderTopRoutesCharts(summary.mainRoutes);


renderOfertaDemandaMonthlyChart(summary.monthly);
renderAirlinesChart(summary.airlines);

console.log("Oferta-demanda resumen", {
  iata,
  totalPax: summary.totalPax,
  totalAsientos: summary.totalAsientos,
  totalVuelos: summary.totalVuelos,
  monthly: summary.monthly.slice(0, 3),
  destinos: summary.destinos.slice(0, 3)
});
  }

  function renderAirport(iataCode) {
    const iata = clean(iataCode).toUpperCase();
    const a = aeropuertos.find(x => clean(firstNonEmpty(x, ["IATA"])).toUpperCase() === iata);
    if (!a) return;

    currentIATA = iata;

    const airportName = getAirportDisplayName(a);
    setText("odAirportName", airportName);
    setText("odYearRef", String(YEAR_REF));

    renderOfertaDemanda(iata);
  }

  /* ============================================================
     CARGA DE DATOS
     ============================================================ */
  async function loadData() {
    const select = q("airportSelect");

    try {
const [
  airportsResp,
  rutasOfertaResp,
  rutasKmResp,
  iataWorldResp,
  airlineAliasResp
] = await Promise.all([
  fetch(AEROPUERTOS_GEOJSON_PATH),
  fetch(RUTAS_CSV_PATH).catch(() => null),
  fetch(RUTAS_KM_CSV_PATH).catch(() => null),
  fetch(IATA_MUNDO_CSV_PATH).catch(() => null),
  fetch(AIRLINE_ALIAS_CSV_PATH).catch(() => null)
]);

      const geojson = await airportsResp.json();
      aeropuertos = (geojson.features || [])
        .map(f => f.properties || {})
        .filter(p => clean(firstNonEmpty(p, ["IATA"])));

      aeropuertos.sort((a, b) =>
        clean(firstNonEmpty(a, ["IATA"])).localeCompare(clean(firstNonEmpty(b, ["IATA"])), "es")
      );

if (rutasOfertaResp && rutasOfertaResp.ok) {
  rutasOfertaRows = parseRutasOfertaCSV(await readTextSmart(rutasOfertaResp));
} else {
  rutasOfertaRows = [];
}

if (rutasKmResp && rutasKmResp.ok) {
  rutasKmRows = parseRutasKmCSV(await readTextSmart(rutasKmResp));
  rutasKmIndex = buildRutasKmIndex(rutasKmRows);
} else {
  rutasKmRows = [];
  rutasKmIndex = new Map();
}

rutasOfertaRows = rutasOfertaRows.map(r => ({
  ...r,
  distanciaKm: getDistanciaForRuta(r)
}));

      if (iataWorldResp && iataWorldResp.ok) {
        const parsedWorld = parseIATAMundoCSV(await readTextSmart(iataWorldResp));
        iataWorldIndex = parsedWorld.byIata;
        routeCodeIndex = parsedWorld.byCode;
      } else {
        iataWorldIndex = {};
        routeCodeIndex = {};
      }
if (airlineAliasResp && airlineAliasResp.ok) {
  airlineAliasIndex = parseAirlineAliasCSV(await readTextSmart(airlineAliasResp));
} else {
  airlineAliasIndex = {};
}
      if (select) {
        select.innerHTML = "";
        aeropuertos.forEach(a => {
          const opt = document.createElement("option");
          const iata = clean(firstNonEmpty(a, ["IATA"])).toUpperCase();
          opt.value = iata;
          opt.textContent = getAirportDisplayName(a);
          select.appendChild(opt);
        });
      }

      const params = new URLSearchParams(window.location.search);
      const initial = clean(params.get("airport")).toUpperCase() || clean(firstNonEmpty(aeropuertos[0], ["IATA"])).toUpperCase();

if (select) {
  select.value = initial;
  select.addEventListener("change", e => {
    const value = clean(e.target.value).toUpperCase();

    try {
      renderAirport(value);

      const url = new URL(window.location.href);
      url.searchParams.set("airport", value);
      window.history.replaceState({}, "", url);
    } catch (err) {
      console.error("Error al cambiar de aeropuerto:", err);
    }
  });
}

try {
  renderAirport(initial);
} catch (err) {
  console.error("Error al renderizar aeropuerto inicial:", err);
}

    } catch (err) {
      console.error("Error cargando oferta-demanda:", err);
      if (select) select.innerHTML = "<option>Error al cargar datos</option>";
    }
  }

  /* ============================================================
     INIT
     ============================================================ */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadData);
} else {
  loadData();
}})();
