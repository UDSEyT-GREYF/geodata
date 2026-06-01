/* global Chart */
(() => {
  "use strict";

  /* ============================================================
     CONFIG
     ============================================================ */
  const YEAR_REF = 2025;

  // Si tu archivo no se llama así, cambia SOLO esta línea
  const RUTAS_CSV_PATH = "/geodata/fuentes/rutasaereas.csv";
  const RUTAS_KM_CSV_PATH = "/geodata/fuentes/km rutasaereas.csv";
  const AEROPUERTOS_GEOJSON_PATH = "/geodata/fuentes/Datos_aeropuertos.geojson";
  const IATA_MUNDO_CSV_PATH = "/geodata/fuentes/ListadoIATAmundo.csv";
  const OURAIRPORTS_CSV_PATH = "/geodata/fuentes/ourairports.csv";
  const PROVINCIAS_GEOJSON_PATH = "/geodata/fuentes/provincias.geojson";
  const AIRLINE_ALIAS_CSV_PATH = "/geodata/fuentes/aerolineas_alias.csv";
  const FDO_TRAFFIC_AA_PATH = "/geodata/fuentes/fdo_trafico_aeropuertos_argentina.json";
  const FDO_ROUTES_MONTHLY_AA_PATH = "/geodata/fuentes/fdo_rutas_mensual_aeropuertos_argentina.json";
  const FDO_ROUTES_ANNUAL_AA_PATH = "/geodata/fuentes/fdo_rutas_aeropuertos_argentina.json";
  // Perfil operativo 2025: clasifica cada aeropuerto para modular la narrativa de conectividad.
  const PERFIL_OPERATIVO_PATH = "/geodata/fuentes/perfil_operativo_impacto_2025.json";
  const DESCRIPTIVO_AEROPUERTOS_GEOJSON_PATH = "/geodata/fuentes/Descriptivo_aeropuertos.geojson";
  const PAX_MENSUAL_PATH = "/geodata/fuentes/pasajeros_aeropuerto_mensual.csv";
const MOV_MENSUAL_PATH = "/geodata/fuentes/movimientos_aeropuerto_mensual.csv";
const EXTRA_TRAFFIC_PATH = "/geodata/fuentes/pasajeros_movimientos_extra_9aeropuertos.csv";

const PAX_DATASET_CAB = "pasajeros_comerciales_cabotaje_aeropuerto";
const PAX_DATASET_INT = "pasajeros_comerciales_internacional_aeropuerto";
const PAX_DATASET_TOTAL = "pasajeros_comerciales_total_aeropuerto";

const MOV_DATASET_CAB = "movimientos_comerciales_cabotaje_aeropuerto";
const MOV_DATASET_INT = "movimientos_comerciales_internacional_aeropuerto";
const MOV_DATASET_TOTAL = "movimientos_comerciales_total_aeropuerto";

const EXTRA_TRAFFIC_SOURCE = "extra_9_aeropuertos";

const EXTRA_TRAFFIC_IATAS = new Set([
  "SST", "TTG", "RYO", "NEC", "PMQ", "GNR", "LPG", "JNI", "AOL"
]);

const EXTRA_TRAFFIC_REPLACE_FROM_IATAS = new Set([
  "LPG", "JNI", "AOL"
]);

const EXTRA_TRAFFIC_REPLACE_FROM_DATE = new Date(2015, 0, 1);
const OD_MIN_ROUTE_PAX_SHARE_PCT = 0.5;
const OD_CONNECTED_DESTINATION_MIN_MONTHS = 7;
const OD_SEASONAL_DESTINATION_MIN_MONTHS = 3;
const OD_SEASONAL_DESTINATION_MIN_CONSECUTIVE_MONTHS = 3;

const OD_EXCLUDED_DESTINATION_CODES_FOR_CONNECTIVITY_TEXT = new Set([
  "FDO"
]);
const OD_AIRPORTS_WITHOUT_REGULAR_COMMERCIAL_SERVICE_2025 = new Set([
  "EPA",
  "COC",
  "LPG",
  "GNR",
  "GPO",
  "JNI",
  "LGS",
  "NEC",
  "PMQ",
  "RYO",
  "SST",
  "TDL",
  "TTG",
  "VLG",
  "VME"
]);
  /* ============================================================
     ESTADO
     ============================================================ */
  let aeropuertos = [];
  let rutasOfertaRows = [];
  let iataWorldIndex = {};
  let routeCodeIndex = {};
  let ourAirportsIndex = {};
  let provinciasFeatures = [];
  let odConnectivityMaps = {};
  let currentIATA = "";
  let rutasKmRows = [];
  let rutasKmIndex = new Map();
  let airlineAliasIndex = {};
  let historicTrafficByIata = {};
  let fdoTrafficAA = null;
  let fdoRoutesMonthlyAA = [];
  let fdoRoutesAnnualAA = [];
  let pasajerosMensualRows = [];
let movimientosMensualRows = [];
  // Índice por IATA construido a partir de perfil_operativo_impacto_2025.json.
  let operationalProfileByIata = {};
  // Índice por IATA construido a partir de Descriptivo_aeropuertos.geojson.
  let descriptivoByIata = {};
  
const DEST_OVERRIDES = {
  BUE: { ciudad: "Buenos Aires", pais: "Argentina" },
  GRU: { ciudad: "São Paulo", pais: "Brasil" },
  GIG: { ciudad: "Río de Janeiro", pais: "Brasil" },
  FLN: { ciudad: "Florianópolis", pais: "Brasil" },
  LIM: { ciudad: "Lima", pais: "Perú" },
  SCL: { ciudad: "Santiago", pais: "Chile" },
  ASU: { ciudad: "Asunción", pais: "Paraguay" },
  CML: { ciudad: "Carmelo", pais: "Uruguay" },
  PTY: { ciudad: "Panamá", pais: "Panamá" },
  FDO: { ciudad: "San Fernando", pais: "Argentina" },
  AR: { ciudad: "Otros destinos de cabotaje", pais: "Argentina" },
  EXT: { ciudad: "Otros destinos internacionales", pais: "" }
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

function odFormatNumber(value) {
  if (value === null || value === undefined || value === "" || isNaN(Number(value))) return "–";
  return Number(value).toLocaleString("es-AR");
}

function odFormatPctRatio(value, opts = {}) {
  if (value === null || value === undefined || isNaN(Number(value))) return "–";

  const abs = Math.abs(Number(value) * 100);
  const txt = abs.toLocaleString("es-AR", {
    minimumFractionDigits: opts.decimals ?? 1,
    maximumFractionDigits: opts.decimals ?? 1
  });

  if (opts.withSign === false) {
    return `${txt}%`;
  }

  const sign = Number(value) >= 0 ? "+" : "-";
  return `${sign}${txt}%`;
}

function odBuildRecoveryPhrase(varVs2019) {
  if (varVs2019 === null || varVs2019 === undefined || isNaN(Number(varVs2019))) {
    return "sin una comparación válida contra 2019";
  }

  const v = Number(varVs2019);

  if (v >= 0.05) {
    return `superó el nivel de 2019 en ${odFormatPctRatio(v, { withSign: false })}`;
  }

  if (v >= 0) {
    return `alcanzó un nivel similar al de 2019, ubicándose ${odFormatPctRatio(v)} por encima`;
  }

  if (v >= -0.05) {
    return `se ubicó en un nivel similar al de 2019 (${odFormatPctRatio(v)})`;
  }

  return `se mantuvo ${odFormatPctRatio(Math.abs(v), { withSign: false })} por debajo del nivel de 2019`;
}

function odBuildHistoricalTrendPhrase(tmcaLongTerm) {
  if (tmcaLongTerm === null || tmcaLongTerm === undefined || isNaN(Number(tmcaLongTerm))) {
    return "una trayectoria heterogénea";
  }

  const t = Number(tmcaLongTerm);

  if (t >= 0.08) return "una trayectoria de fuerte expansión";
  if (t >= 0.03) return "una tendencia de crecimiento sostenido";
  if (t >= 0.01) return "una expansión moderada";
  if (t >= -0.01) return "un comportamiento relativamente estable";
  if (t >= -0.03) return "una leve retracción";
  return "una tendencia contractiva";
}
function odBuildRecentTrendPhrase(tmcaRecent) {
  if (tmcaRecent === null || tmcaRecent === undefined || isNaN(Number(tmcaRecent))) {
    return "una evolución reciente sin una tendencia claramente definida";
  }

  const t = Number(tmcaRecent);

  if (t >= 0.08) return "una expansión reciente intensa";
  if (t >= 0.03) return "una expansión reciente moderada";
  if (t >= 0.01) return "una mejora reciente leve";
  if (t >= -0.01) return "un comportamiento reciente estable";
  if (t >= -0.03) return "una leve retracción reciente";
  return "una contracción reciente";
}  
function odBuildSyntheticNonPandemicTMCA(
  tmcaLongTerm,
  tmcaRecent,
  longStartYear,
  longEndYear,
  recentStartYear,
  recentEndYear
) {
  const tLong = Number(tmcaLongTerm);
  const tRecent = Number(tmcaRecent);

  const longIntervals = Number(longEndYear) - Number(longStartYear);
  const recentIntervals = Number(recentEndYear) - Number(recentStartYear);

  const hasLongTerm = Number.isFinite(tLong);
  const hasRecent = Number.isFinite(tRecent);

  const validLongIntervals = Number.isFinite(longIntervals) && longIntervals > 0;
  const validRecentIntervals = Number.isFinite(recentIntervals) && recentIntervals > 0;

  if (!hasLongTerm && !hasRecent) return null;

  if (hasLongTerm && validLongIntervals && (!hasRecent || !validRecentIntervals)) {
    return tLong;
  }

  if (hasRecent && validRecentIntervals && (!hasLongTerm || !validLongIntervals)) {
    return tRecent;
  }

  if (!validLongIntervals && !validRecentIntervals) return null;

  const accumulatedGrowth =
    Math.pow(1 + tLong, longIntervals) *
    Math.pow(1 + tRecent, recentIntervals);

  const totalIntervals = longIntervals + recentIntervals;

  if (
    !Number.isFinite(accumulatedGrowth) ||
    accumulatedGrowth <= 0 ||
    !Number.isFinite(totalIntervals) ||
    totalIntervals <= 0
  ) {
    return null;
  }

  return Math.pow(accumulatedGrowth, 1 / totalIntervals) - 1;
}
  function calcTMCAFromValues(startValue, endValue, startYear, endYear) {
  const start = Number(startValue);
  const end = Number(endValue);
  const y0 = Number(startYear);
  const y1 = Number(endYear);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(y0) ||
    !Number.isFinite(y1) ||
    start <= 0 ||
    end <= 0 ||
    y1 <= y0
  ) {
    return null;
  }

  return Math.pow(end / start, 1 / (y1 - y0)) - 1;
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

function splitDelimitedLine(line, sep) {
  const cols = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
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
    .filter(line => line.trim() !== "");

  if (lines.length < 2) return [];

  const sep = detectSep(lines[0]);
  const headers = splitDelimitedLine(lines[0], sep).map(normalizeHeader);

  return lines.slice(1).map(line => {
    const cols = splitDelimitedLine(line, sep);
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
function parsePasajerosMensualCSV(text) {
  return parseCSV(text).map(r => ({
    iata: clean(firstNonEmpty(r, ["iata"])).toUpperCase(),
    dataset: clean(firstNonEmpty(r, ["dataset"])),
    date: parseFechaFlexible(firstNonEmpty(r, ["fecha"])),
    valor: parseNumber(firstNonEmpty(r, ["valor_pax", "valor", "pasajeros"]))
  })).filter(r =>
    r.iata &&
    r.date &&
    Number.isFinite(r.valor)
  ).sort((a, b) => a.date - b.date);
}

function parseMovimientosMensualCSV(text) {
  return parseCSV(text).map(r => ({
    iata: clean(firstNonEmpty(r, ["iata"])).toUpperCase(),
    dataset: clean(firstNonEmpty(r, ["dataset"])),
    date: parseFechaFlexible(firstNonEmpty(r, ["fecha"])),
    valor: parseNumber(firstNonEmpty(r, ["valor_movimientos", "valor", "movimientos"]))
  })).filter(r =>
    r.iata &&
    r.date &&
    Number.isFinite(r.valor)
  ).sort((a, b) => a.date - b.date);
}

function normalizeTrafficSegment(value) {
  const key = normalizeHeader(value);

  if (
    key.includes("internacional") ||
    key.includes("international") ||
    key === "int"
  ) {
    return "internacional";
  }

  if (
    key.includes("cabotaje") ||
    key.includes("domestico") ||
    key.includes("domestic") ||
    key.includes("nacional") ||
    key === "cab"
  ) {
    return "cabotaje";
  }

  return "total";
}

function datasetForPassengerSegment(segment) {
  if (segment === "cabotaje") return PAX_DATASET_CAB;
  if (segment === "internacional") return PAX_DATASET_INT;
  return PAX_DATASET_TOTAL;
}

function datasetForMovementSegment(segment) {
  if (segment === "cabotaje") return MOV_DATASET_CAB;
  if (segment === "internacional") return MOV_DATASET_INT;
  return MOV_DATASET_TOTAL;
}

function parseExtraTrafficCSV(text) {
  const rows = parseCSV(text);
  const paxRows = [];
  const movRows = [];

  rows.forEach(r => {
    const iata = clean(firstNonEmpty(r, [
      "iata",
      "aeropuerto_iata",
      "airport_iata"
    ])).toUpperCase();

    if (!EXTRA_TRAFFIC_IATAS.has(iata)) return;

    const date = parseFechaFlexible(firstNonEmpty(r, [
      "fecha",
      "date",
      "anomes",
      "ano_mes",
      "año_mes",
      "periodo_id"
    ]));

    if (!date) return;

    const segment = normalizeTrafficSegment(firstNonEmpty(r, [
      "segmento",
      "clasificacion",
      "clasificación",
      "tipo",
      "tipo_trafico",
      "tipo_tráfico"
    ]));

    const pasajeros = parseNumber(firstNonEmpty(r, [
      "valor_pax",
      "pasajeros",
      "pax",
      "totalpasajeros",
      "total_pasajeros"
    ]));

    const movimientos = parseNumber(firstNonEmpty(r, [
      "movimientos",
      "valor_movimientos",
      "vuelos",
      "totalmovimientos",
      "total_movimientos"
    ]));

    if (Number.isFinite(pasajeros)) {
      paxRows.push({
        iata,
        dataset: datasetForPassengerSegment(segment),
        date,
        valor: pasajeros,
        source: EXTRA_TRAFFIC_SOURCE
      });
    }

    if (Number.isFinite(movimientos)) {
      movRows.push({
        iata,
        dataset: datasetForMovementSegment(segment),
        date,
        valor: movimientos,
        source: EXTRA_TRAFFIC_SOURCE
      });
    }
  });

  return {
    paxRows: paxRows.sort((a, b) => a.date - b.date),
    movRows: movRows.sort((a, b) => a.date - b.date)
  };
}

function isSameOrAfterMonth(date, cutoffDate) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;

  const y = date.getFullYear();
  const m = date.getMonth();
  const cy = cutoffDate.getFullYear();
  const cm = cutoffDate.getMonth();

  return y > cy || (y === cy && m >= cm);
}

function shouldDropBaseTrafficRow(row) {
  const iata = clean(row.iata).toUpperCase();

  return (
    EXTRA_TRAFFIC_REPLACE_FROM_IATAS.has(iata) &&
    row.date &&
    isSameOrAfterMonth(row.date, EXTRA_TRAFFIC_REPLACE_FROM_DATE)
  );
}

function mergeExtraTrafficRows(baseRows, extraRows) {
  const keptBaseRows = (baseRows || []).filter(row => !shouldDropBaseTrafficRow(row));

  return keptBaseRows
    .concat(extraRows || [])
    .sort((a, b) => a.date - b.date);
}

function replaceRowsForFDO(baseRows, replacementRows) {
  return (baseRows || [])
    .filter(row => !isFDO(row.iata))
    .concat(replacementRows || [])
    .sort((a, b) => a.date - b.date);
}

function fdoShouldUseTrafficRow(row) {
  const cls = clean(row?.clase_vuelo).toLowerCase();
  return !cls.startsWith("cargas");
}

function fdoPassengerDataset(segment) {
  const s = clean(segment).toLowerCase();
  if (s.includes("internacional")) return PAX_DATASET_INT;
  return PAX_DATASET_CAB;
}

function fdoMovementDataset(segment) {
  const s = clean(segment).toLowerCase();
  if (s.includes("internacional")) return MOV_DATASET_INT;
  return MOV_DATASET_CAB;
}

function getFdoTrafficMonthlyRecords() {
  if (Array.isArray(fdoTrafficAA?.mensual)) return fdoTrafficAA.mensual;
  if (Array.isArray(fdoTrafficAA?.monthly)) return fdoTrafficAA.monthly;
  if (Array.isArray(fdoTrafficAA?.data)) return fdoTrafficAA.data;
  if (Array.isArray(fdoTrafficAA?.rows)) return fdoTrafficAA.rows;
  return [];
}

function fdoAAToPassengerRows(data) {
  const acc = new Map();

  getFdoTrafficMonthlyRecords(data)
    .filter(fdoShouldUseTrafficRow)
    .forEach(row => {
      const anio = Number(row.anio ?? row.year ?? row.y);
      const mes = Number(row.mes ?? row.month ?? row.m);
      if (!Number.isFinite(anio) || !Number.isFinite(mes)) return;

      const dataset = fdoPassengerDataset(row.segmento);
      const key = `${anio}-${String(mes).padStart(2, "0")}-${dataset}`;

      if (!acc.has(key)) {
        acc.set(key, {
          iata: "FDO",
          dataset,
          date: new Date(anio, mes - 1, 1),
          valor: 0,
          source: "aeropuertos_argentina_fdo"
        });
      }

      acc.get(key).valor += Number(row.pasajeros ?? row.pax ?? row.p ?? 0) || 0;
    });

  return Array.from(acc.values()).sort((a, b) => a.date - b.date);
}

function fdoAAToMovementRows(data) {
  const acc = new Map();

  getFdoTrafficMonthlyRecords(data)
    .filter(fdoShouldUseTrafficRow)
    .forEach(row => {
      const anio = Number(row.anio ?? row.year ?? row.y);
      const mes = Number(row.mes ?? row.month ?? row.m);
      if (!Number.isFinite(anio) || !Number.isFinite(mes)) return;

      const dataset = fdoMovementDataset(row.segmento);
      const key = `${anio}-${String(mes).padStart(2, "0")}-${dataset}`;

      if (!acc.has(key)) {
        acc.set(key, {
          iata: "FDO",
          dataset,
          date: new Date(anio, mes - 1, 1),
          valor: 0,
          source: "aeropuertos_argentina_fdo"
        });
      }

      acc.get(key).valor += Number(row.movimientos ?? row.vuelos ?? row.v ?? 0) || 0;
    });

  return Array.from(acc.values()).sort((a, b) => a.date - b.date);
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

 function getAirportCityOnly(a) {
  return clean(firstNonEmpty(a, [
    "Aeropuerto",
    "IATA"
  ]));
}

function getAirportSelectorLabel(a) {
  const iata = clean(firstNonEmpty(a, ["IATA"])).toUpperCase();
  const ciudad = getAirportCityOnly(a);

  return `${ciudad} (${iata})`;
}

function getAirportSheetTitle(a) {
  const iata = clean(firstNonEmpty(a, ["IATA"])).toUpperCase();

  const ciudad = clean(firstNonEmpty(a, [
    "Aeropuerto",
    "IATA"
  ]));

  let base = "";

  if (iata === "AEP") {
    base = "Aeroparque Jorge Newbery";
  } else if (!ciudad) {
    base = "Aeropuerto";
  } else if (/^Aeropuerto\s+de\s+/i.test(ciudad)) {
    base = ciudad;
  } else if (/^Aeroparque/i.test(ciudad)) {
    base = ciudad;
  } else {
    base = `Aeropuerto de ${ciudad}`;
  }

  return iata ? `${base} (${iata})` : base;
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

/* ============================================================
   INTRO OFERTA Y CONECTIVIDAD 2025
   ------------------------------------------------------------
   Construye el párrafo introductorio ubicado entre los gráficos
   principales y el bloque "Perfil operativo y conectividad 2025".
   Resume operadores, asientos, frecuencia semanal y destinos.
   ============================================================ */

function odJoinList(items) {
  const values = (items || [])
    .map(clean)
    .filter(Boolean);

  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} y ${values[1]}`;

  return `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`;
}

function odGetAirportNarrativeName(iata) {
  const code = clean(iata).toUpperCase();
  const base = getAirportBaseRouteName(code);

  if (!base || base === code) return `Aeropuerto (${code})`;

  if (/^Aeropuerto/i.test(base) || /^Aeroparque/i.test(base)) {
    return base;
  }

  return `Aeropuerto de ${base}`;
}

function odCleanDestinationName(destino) {
  const city = clean(destino?.ciudad) || clean(destino?.code);

  if (!city) return "";

  if (/Buenos Aires AEP\+EZE/i.test(city)) return "Buenos Aires";

  return city
    .replace(/\s+[A-Z]{3}\+[A-Z]{3}$/g, "")
    .replace(/\s+[A-Z]{3}$/g, "")
    .trim();
}

function odGetMarketSeatTotals(summary) {
  const rows = summary?.monthly || [];

  return rows.reduce((acc, row) => {
    acc.cab += Number(row.asientosCab || 0);
    acc.int += Number(row.asientosInt || 0);
    acc.total += Number(row.asientosTotal || 0);
    return acc;
  }, {
    cab: 0,
    int: 0,
    total: 0
  });
}

function odGetRelevantAirlinesForIntro(summary, limit = 3) {
  const rows = (summary?.airlines || [])
    .filter(a => {
      const name = clean(a.name);
      const key = normalizeTextKey(name);

      // No mencionar aviación general como aerolínea regular en el texto introductorio.
      if (key === "aviacion general / privada") return false;

      const seats = Number(a.asientosTotal || 0);
      return seats > 0;
    })
    .sort((a, b) => Number(b.asientosTotal || 0) - Number(a.asientosTotal || 0));

  const totalSeats =
    Number(summary?.totalAsientos || 0) > 0
      ? Number(summary.totalAsientos)
      : rows.reduce((acc, a) => acc + Number(a.asientosTotal || 0), 0);

  return rows.slice(0, limit).map(a => {
    const seats = Number(a.asientosTotal || 0);
    const sharePct = totalSeats > 0 ? (seats / totalSeats) * 100 : 0;

    return {
      name: clean(a.name),
      seats,
      sharePct
    };
  });
}
function odFormatAirlineOfferShareList(airlines) {
  return odJoinList(
    (airlines || []).map(a =>
      `${a.name} (${formatShareShort(a.sharePct)})`
    )
  );
}
function odGetIntroDestinations(summary, limit = 5) {
  const rows = (summary?.destinos || [])
    .filter(d => {
      const seats = Number(d.asientos || 0);
      const pax = Number(d.pax || 0);
      return seats > 0 || pax > 0;
    })
    .sort((a, b) => {
      const seatsB = Number(b.asientos || 0);
      const seatsA = Number(a.asientos || 0);

      if (seatsB !== seatsA) return seatsB - seatsA;

      return Number(b.pax || 0) - Number(a.pax || 0);
    });

  const selected = rows
    .slice(0, limit)
    .map(odCleanDestinationName)
    .filter(Boolean);

  return {
    names: selected,
    text: selected.length ? odJoinList(selected) : ""
  };
}

 function odCleanRouteDestinationName(route) {
  const city = clean(route?.ciudad);
  const codes = clean(route?.codesLabel);

  if (city) {
    if (codes && !city.toUpperCase().includes(codes.toUpperCase())) {
      return `${city}`;
    }
    return city;
  }

  return clean(route?.title)
    .replace(/^.*?\s[-–]\s/g, "")
    .replace(/\s+[A-Z]{3}\+[A-Z]{3}$/g, "")
    .replace(/\s+[A-Z]{3}$/g, "")
    .trim();
}
function odRoutePassesMinPaxShare(route, minSharePct = OD_MIN_ROUTE_PAX_SHARE_PCT) {
  const sharePax = Number(route?.sharePaxPct || 0);
  return sharePax >= minSharePct;
}
function odGetIntroRoutes(summary, limit = 6, minSharePct = OD_MIN_ROUTE_PAX_SHARE_PCT) {
  const routes = (summary?.mainRoutes || [])
    .filter(route => odRoutePassesMinPaxShare(route, minSharePct))
    .slice(0, limit);

  const totalSeats =
    Number(summary?.totalAsientos || 0) > 0
      ? Number(summary.totalAsientos)
      : odGetMarketSeatTotals(summary).total;

  const items = routes.map(route => {
    const name = odCleanRouteDestinationName(route);

    let shareSeatsPct = Number(route.shareSeatsPct);

    if (!Number.isFinite(shareSeatsPct) && totalSeats > 0) {
      shareSeatsPct = (Number(route.totalAsientos || 0) / totalSeats) * 100;
    }

    return {
      name,
      shareSeatsPct
    };
  }).filter(item => item.name);

  return items;
}

function odFormatRouteSeatShareList(routes) {
  return odJoinList(
    (routes || []).map(route => {
      const pct = Number.isFinite(route.shareSeatsPct)
        ? formatShareShort(route.shareSeatsPct)
        : "s/d";

      return `${route.name} (${pct})`;
    })
  );
} 
  
function odBuildServiceMarketPhrase(seatsCab, seatsInt) {
  const hasCab = Number(seatsCab || 0) > 0;
  const hasInt = Number(seatsInt || 0) > 0;

  if (hasCab && hasInt) return "de cabotaje e internacionales";
  if (hasCab) return "de cabotaje";
  if (hasInt) return "internacionales";

  return "comerciales";
}
function odBuildFdoDestinationsText(summary) {
  const destinos = (summary?.destinos || [])
    .filter(d => (Number(d.pax || 0) > 0 || Number(d.vuelos || 0) > 0))
    .sort((a, b) => {
      const paxB = Number(b.pax || 0);
      const paxA = Number(a.pax || 0);
      if (paxB !== paxA) return paxB - paxA;
      return Number(b.vuelos || 0) - Number(a.vuelos || 0);
    });

  const genericTypes = new Set();

  const destinosNominales = destinos.filter(d => {
    const code = clean(d.code).toUpperCase();
    const nameKey = normalizeTextKey(d.ciudad || d.code);

    const isGenericInternational =
      code === "EXT" ||
      nameKey.includes("otros destinos internacionales");

    const isGenericDomestic =
      code === "AR" ||
      nameKey.includes("otros destinos de cabotaje") ||
      nameKey.includes("otros destinos nacionales");

    if (isGenericInternational) {
      genericTypes.add("internacionales");
      return false;
    }

    if (isGenericDomestic) {
      genericTypes.add("nacionales");
      return false;
    }

    return true;
  });

  const nombres = destinosNominales
    .slice(0, 4)
    .map(odCleanDestinationName)
    .filter(Boolean);

  if (!nombres.length && !genericTypes.size) return "";

  const listaDestinos = odJoinList(nombres);

  let cierre = "";

  if (genericTypes.has("internacionales") && genericTypes.has("nacionales")) {
    cierre = " entre otros destinos internacionales y nacionales";
  } else if (genericTypes.has("internacionales")) {
    cierre = " entre otros destinos internacionales";
  } else if (genericTypes.has("nacionales")) {
    cierre = " entre otros destinos nacionales";
  }

  if (!listaDestinos) {
    return genericTypes.size
      ? `otros destinos ${Array.from(genericTypes).join(" y ")}`
      : "";
  }

  return `${listaDestinos}${cierre}`;
}

const OD_SOUTH_AMERICA_COUNTRIES = new Set([
  "argentina",
  "bolivia",
  "brasil",
  "chile",
  "colombia",
  "ecuador",
  "guyana",
  "paraguay",
  "peru",
  "surinam",
  "uruguay",
  "venezuela"
]);

function odIsSouthAmericaCountry(country) {
  return OD_SOUTH_AMERICA_COUNTRIES.has(normalizeTextKey(country));
}
  
function odIsSouthAmericaDestinationItem(destino) {
  // Importante: los aeropuertos argentinos también tienen continent = SA,
  // pero no deben contarse como "destinos sudamericanos" si son cabotaje.
  if (!destino?.isInternational) return false;

  const continent = odGetDestinationContinent(destino);

  if (continent) {
    return continent === "SA";
  }

  // Respaldo por país si el código no aparece en ourairports.csv
  return odIsSouthAmericaCountry(destino?.pais);
}
  
function odIsGenericDestinationCodeOrName(code, city) {
  const codeKey = clean(code).toUpperCase();
  const cityKey = normalizeTextKey(city);

  return (
    codeKey === "AR" ||
    codeKey === "EXT" ||
    cityKey.includes("otros destinos")
  );
}

function odGetRouteMonthKey(row) {
  if (row?.date instanceof Date && !Number.isNaN(row.date.getTime())) {
    return `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}`;
  }

  const raw = clean(row?.anioMes);
  const m = raw.match(/^(\d{4})[-_/]?(\d{1,2})/);

  if (m) {
    return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  }

  return "";
}

function odRouteRowHasActivity(row) {
  return (
    Number(row?.pax || 0) > 0 ||
    Number(row?.asientos || 0) > 0 ||
    Number(row?.vuelos || 0) > 0
  );
}
function odRouteRowHasConnectivityActivity(row) {
  return (
    Number(row?.pax || 0) > 0 ||
    Number(row?.vuelos || 0) > 0
  );
}
function odRouteRowIsCommercial(row) {
  // Mismo criterio base que usa el resumen general de oferta-demanda:
  // considerar solamente registros cuyo tipo de operación sea comercial.
  return clean(row?.tipoOperacion).toLowerCase().includes("comercial");
}

function odGetDestinationMonthNumbers(destino) {
  return Array.from(destino?.months || [])
    .map(monthKey => {
      const m = clean(monthKey).match(/^\d{4}-(\d{2})$/);
      return m ? Number(m[1]) : null;
    })
    .filter(m => Number.isFinite(m) && m >= 1 && m <= 12)
    .sort((a, b) => a - b);
}

function odLongestConsecutiveMonthRun(monthNumbers) {
  const months = Array.from(new Set(monthNumbers || [])).sort((a, b) => a - b);
  if (!months.length) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < months.length; i++) {
    if (months[i] === months[i - 1] + 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function odDestinationPassesShareThreshold(destino) {
  return Number(destino?.sharePaxPct || 0) >= OD_MIN_ROUTE_PAX_SHARE_PCT;
}

function odDestinationIsRegular(destino, minMonths = OD_CONNECTED_DESTINATION_MIN_MONTHS) {
  return (
    Number(destino?.monthsCount || 0) >= minMonths &&
    odDestinationPassesShareThreshold(destino)
  );
}

function odDestinationIsSeasonal(destino) {
  const monthsCount = Number(destino?.monthsCount || 0);
  const longestRun = Number(destino?.longestConsecutiveMonthRun || 0);

  return (
    monthsCount >= OD_SEASONAL_DESTINATION_MIN_MONTHS &&
    monthsCount < OD_CONNECTED_DESTINATION_MIN_MONTHS &&
    longestRun >= OD_SEASONAL_DESTINATION_MIN_CONSECUTIVE_MONTHS &&
    odDestinationPassesShareThreshold(destino)
  );
}  
  
function odBuildRegularConnectedDestinationStats(iata, year = YEAR_REF, minMonths = OD_CONNECTED_DESTINATION_MIN_MONTHS) {
  const selected = clean(iata).toUpperCase();
  const destinosMap = new Map();

const rows = (rutasOfertaRows || []).filter(row =>
  (row.endpointA === selected || row.endpointB === selected) &&
  Number(row.year) === Number(year) &&
  odRouteRowIsCommercial(row) &&
  odRouteRowHasConnectivityActivity(row)
);

  rows.forEach(row => {
    const otherCodeRaw = row.endpointA === selected ? row.endpointB : row.endpointA;
    if (!otherCodeRaw || otherCodeRaw === selected) return;

    const otherMeta = getRouteMeta(otherCodeRaw);
    const otherNormalizedCode = clean(otherMeta?.iata || otherCodeRaw).toUpperCase();

const destinationCode = getEquivalentDestinationCode(selected, otherNormalizedCode);
if (!destinationCode || destinationCode === selected) return;

if (OD_EXCLUDED_DESTINATION_CODES_FOR_CONNECTIVITY_TEXT.has(destinationCode)) return;
if (OD_EXCLUDED_DESTINATION_CODES_FOR_CONNECTIVITY_TEXT.has(otherNormalizedCode)) return;

    const isInternational = clean(row.clasificacion).toLowerCase() === "internacional";
    const label = getDestinationLabel(destinationCode, isInternational);

    const ciudad = clean(label.ciudad) || destinationCode;
    const pais = clean(label.pais) || (isInternational ? "" : "Argentina");

    if (odIsGenericDestinationCodeOrName(destinationCode, ciudad)) return;

    const monthKey = odGetRouteMonthKey(row);
    if (!monthKey) return;

    const destinationKey = [
      isInternational ? "INT" : "CAB",
      normalizeTextKey(ciudad),
      normalizeTextKey(pais) || clean(destinationCode).toUpperCase()
    ].join("|");

    if (!destinosMap.has(destinationKey)) {
      destinosMap.set(destinationKey, {
        code: destinationCode,
        ciudad,
        pais,
        isInternational,
        months: new Set(),
        airportCodes: new Set(),
        pax: 0,
        asientos: 0,
        vuelos: 0
      });
    }

    const item = destinosMap.get(destinationKey);

    item.months.add(monthKey);

    // Guarda los códigos reales que aparecen en la ruta.
    // Para Buenos Aires agrupado, esto permite ver AEP+EZE.
    item.airportCodes.add(otherNormalizedCode);

    item.pax += Number(row.pax || 0);
    item.asientos += Number(row.asientos || 0);
    item.vuelos += Number(row.vuelos || 0);
  });

const totalAirportPax = Array.from(destinosMap.values())
  .reduce((acc, destino) => acc + Number(destino.pax || 0), 0);

const candidateDestinations = Array.from(destinosMap.values())
  .map(destino => {
    const pax = Number(destino.pax || 0);
    const sharePaxPct = totalAirportPax > 0
      ? (pax / totalAirportPax) * 100
      : 0;

    const monthNumbers = odGetDestinationMonthNumbers(destino);
    const longestConsecutiveMonthRun = odLongestConsecutiveMonthRun(monthNumbers);

    return {
      ...destino,
      monthsCount: destino.months.size,
      monthNumbers,
      longestConsecutiveMonthRun,
      sharePaxPct,
      airportCodesList: Array.from(destino.airportCodes).sort((a, b) => a.localeCompare(b, "es"))
    };
  });

const regularDestinations = candidateDestinations
  .filter(destino => odDestinationIsRegular(destino, minMonths));

const seasonalDestinations = candidateDestinations
  .filter(destino =>
    !odDestinationIsRegular(destino, minMonths) &&
    odDestinationIsSeasonal(destino)
  );

  const domestic = regularDestinations.filter(destino => !destino.isInternational);
  const international = regularDestinations.filter(destino => destino.isInternational);

  const southAmerica = international.filter(destino =>
    odIsSouthAmericaDestinationItem(destino)
  );

  const extraSouthAmerica = international.filter(destino =>
    !odIsSouthAmericaDestinationItem(destino)
  );
const seasonalDomestic = seasonalDestinations.filter(destino => !destino.isInternational);
const seasonalInternational = seasonalDestinations.filter(destino => destino.isInternational);

const seasonalSouthAmerica = seasonalInternational.filter(destino =>
  odIsSouthAmericaDestinationItem(destino)
);

const seasonalExtraSouthAmerica = seasonalInternational.filter(destino =>
  !odIsSouthAmericaDestinationItem(destino)
);
return {
  domestic,
  southAmerica,
  extraSouthAmerica,

  seasonalDomestic,
  seasonalSouthAmerica,
  seasonalExtraSouthAmerica,

  domesticCount: domestic.length,
  southAmericaCount: southAmerica.length,
  extraSouthAmericaCount: extraSouthAmerica.length,

  seasonalDomesticCount: seasonalDomestic.length,
  seasonalSouthAmericaCount: seasonalSouthAmerica.length,
  seasonalExtraSouthAmericaCount: seasonalExtraSouthAmerica.length,

  totalCount: regularDestinations.length,
  minMonths
};
}

function odPlural(value, singular, plural) {
  return Number(value) === 1 ? singular : plural;
}

function odGetDestinationCodesLabel(destino) {
  const codes = Array.isArray(destino?.airportCodesList)
    ? destino.airportCodesList.filter(Boolean)
    : [];

  if (codes.length) return codes.join("+");

  return clean(destino?.code).toUpperCase();
}

function odFormatMonthDuration(monthsCount) {
  const months = Number(monthsCount || 0);

  if (months === 1) return "durante 1 mes del año";

  return `durante ${formatNumber(months)} meses del año`;
}

function odFormatDestinationNameWithCodes(destino) {
  const city = escapeHtml(clean(destino?.ciudad));
  const codes = escapeHtml(odGetDestinationCodesLabel(destino));

  if (!city && !codes) return "";
  if (!codes) return city;

  return `${city} <strong>(${codes})</strong>`;
}

function odFormatDestinationsGroupedByMonths(destinations) {
  const groups = new Map();

  (destinations || []).forEach(destino => {
    const months = Number(destino?.monthsCount || 0);
    if (!months) return;

    if (!groups.has(months)) groups.set(months, []);

    const label = odFormatDestinationNameWithCodes(destino);
    if (label) groups.get(months).push(label);
  });

  const orderedGroups = Array.from(groups.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]));

  if (!orderedGroups.length) return "";

  return orderedGroups
    .map(([months, labels]) => {
      const cleanLabels = labels
        .slice()
        .sort((a, b) => a.localeCompare(b, "es"));

      return `${odJoinList(cleanLabels)} ${odFormatMonthDuration(months)}`;
    })
    .join("; ");
}

function odBuildDestinationCategoryText(count, singular, plural, destinations) {
  if (Number(count || 0) <= 0) return "";

  const groupedText = odFormatDestinationsGroupedByMonths(destinations);

  return `<strong>${formatNumber(count)}</strong> ${odPlural(count, singular, plural)}${groupedText ? `: ${groupedText}` : ""}`;
}

function odBuildSeasonalDestinationText(counts) {
  const parts = [];

  const seasonalDomesticText = odBuildDestinationCategoryText(
    counts.seasonalDomesticCount,
    "ciudad del país de temporada",
    "ciudades del país de temporada",
    counts.seasonalDomestic
  );

  if (seasonalDomesticText) parts.push(seasonalDomesticText);

  const seasonalSouthAmericaText = odBuildDestinationCategoryText(
    counts.seasonalSouthAmericaCount,
    "destino sudamericano de temporada",
    "destinos sudamericanos de temporada",
    counts.seasonalSouthAmerica
  );

  if (seasonalSouthAmericaText) parts.push(seasonalSouthAmericaText);

  const seasonalExtraSouthAmericaText = odBuildDestinationCategoryText(
    counts.seasonalExtraSouthAmericaCount,
    "destino extra-sudamericano de temporada",
    "destinos extra-sudamericanos de temporada",
    counts.seasonalExtraSouthAmerica
  );

  if (seasonalExtraSouthAmericaText) parts.push(seasonalExtraSouthAmericaText);

  return odJoinList(parts);
}

function odBuildDestinationCountText(iata) {
  const counts = odBuildRegularConnectedDestinationStats(
    iata,
    YEAR_REF,
    OD_CONNECTED_DESTINATION_MIN_MONTHS
  );

  const regularParts = [];

  const domesticText = odBuildDestinationCategoryText(
    counts.domesticCount,
    "ciudad del país",
    "ciudades de todo el país",
    counts.domestic
  );

  if (domesticText) regularParts.push(domesticText);

  const southAmericaText = odBuildDestinationCategoryText(
    counts.southAmericaCount,
    "destino sudamericano",
    "destinos sudamericanos",
    counts.southAmerica
  );

  if (southAmericaText) regularParts.push(southAmericaText);

  const extraSouthAmericaText = odBuildDestinationCategoryText(
    counts.extraSouthAmericaCount,
    "destino extra-sudamericano",
    "destinos extra-sudamericanos",
    counts.extraSouthAmerica
  );

  if (extraSouthAmericaText) regularParts.push(extraSouthAmericaText);

  const seasonalText = odBuildSeasonalDestinationText(counts);

  return {
    counts,
    hasRegular: regularParts.length > 0,
    hasSeasonal: Boolean(seasonalText),
    regularText: regularParts.length ? odJoinList(regularParts) : "",
    seasonalText
  };
}

function odIsAirportWithoutRegularCommercialService2025(iata) {
  return OD_AIRPORTS_WITHOUT_REGULAR_COMMERCIAL_SERVICE_2025.has(
    clean(iata).toUpperCase()
  );
}

function odShouldSuppressCurrentRouteAnalysis(iata, summary, destinationInfo = null) {
  const code = clean(iata).toUpperCase();

  // FDO tiene tratamiento especial propio.
  if (isFDO(code) || summary?.source === "aeropuertos_argentina_fdo") {
    return false;
  }

  const info = destinationInfo || odBuildDestinationCountText(code);

  return (
    odIsAirportWithoutRegularCommercialService2025(code) ||
    !info.hasRegular
  );
}

function odBuildNoRegularCommercialServiceIntroHtml(iata) {
  const airportName = odGetAirportNarrativeName(iata);

  return `
<p> En el año <strong>${YEAR_REF}</strong>, no se identificaron destinos comerciales regulares para el <strong>${escapeHtml(airportName)}</strong>. La actividad no regular registrada corresponde a aviación general/privada. </p>
  `;
}

  
function odBuildFdoIntroTextHtml(summary) {
  const freq = Number(summary?.totalFrecuenciaSemanal || 0);

  const freqText = Number.isFinite(freq) && freq > 0
    ? `<strong>${formatNumber(Math.round(freq))}</strong> frecuencias semanales promedio`
    : "frecuencias semanales no determinadas";

const fdoDestinationsText = odBuildFdoDestinationsText(summary);

const destinationsText = fdoDestinationsText
  ? ` Entre los principales destinos registrados se encuentran <strong>${escapeHtml(fdoDestinationsText)}</strong>.`
  : "";

  return `
    <p>
      En el año <strong>${YEAR_REF}</strong>, el <strong>Aeropuerto de San Fernando</strong>
      presentó un perfil operativo asociado principalmente a la <strong>aviación general, ejecutiva y privada</strong>.
      Por ese motivo, su actividad no debe interpretarse bajo la misma lógica de vuelos regulares comerciales
      que caracteriza a los aeropuertos aerocomerciales del SNA.
    </p>

    <p>
      A lo largo del año, se registraron
      ${freqText} asociadas a los destinos operados.
      ${destinationsText}
    </p>
  `;
}
 /* ============================================================
   MAPAS DE CONECTIVIDAD 2025
   ------------------------------------------------------------
   Reemplazan el párrafo largo de oferta y conectividad.
   Usan la misma clasificación ya empleada por el texto:
   cabotaje / sudamérica / extra-sudamérica / temporada.
   ============================================================ */

const OD_MAP_BOUNDS_ARGENTINA = [
  [-55.1, -73.2],
  [-21.8, -53.0]
];

const OD_MAP_BOUNDS_SOUTH_AMERICA = [
  [-56.5, -82.8],
  [13.0, -34.0]
];

const OD_MAP_COLORS = {
  domestic: "#00A3E0",
  southamerica: "#2CA25F",
  extra: "#F28C28"
};

const OD_MAP_ROUTE_WEIGHT_MIN = 1.6;
const OD_MAP_ROUTE_WEIGHT_MAX = 4.6;

function odDestroyConnectivityMaps() {
  Object.values(odConnectivityMaps || {}).forEach(map => {
    try {
      if (map && typeof map.remove === "function") map.remove();
    } catch (e) {
      console.warn("No se pudo destruir mapa de conectividad", e);
    }
  });

  odConnectivityMaps = {};
}

function odGetAirportRecordByIata(iata) {
  const code = clean(iata).toUpperCase();

  return aeropuertos.find(a =>
    clean(firstNonEmpty(a, ["IATA"])).toUpperCase() === code
  ) || null;
}

function odGetAirportLatLngByCode(code) {
  const key = clean(code).toUpperCase();
  if (!key) return null;

  // 1) Primero busca en Datos_aeropuertos.geojson: aeropuertos del SNA
  const airport = odGetAirportRecordByIata(key);

  if (airport) {
    const lat = parseNumber(firstNonEmpty(airport, [
      "__lat",
      "Lat",
      "LAT",
      "lat",
      "latitude",
      "latitude_deg",
      "y",
      "Y"
    ]));

    const lon = parseNumber(firstNonEmpty(airport, [
      "__lon",
      "Lon",
      "LON",
      "Long",
      "long",
      "lng",
      "longitude",
      "longitude_deg",
      "x",
      "X"
    ]));

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [lat, lon];
    }
  }

  // 2) Si no está en el SNA, busca en ourairports.csv
  const meta = ourAirportsIndex[key];

  if (
    meta &&
    Number.isFinite(meta.latitude) &&
    Number.isFinite(meta.longitude)
  ) {
    return [meta.latitude, meta.longitude];
  }

  console.warn("No se encontraron coordenadas para código IATA/OACI:", key);
  return null;
}
window.odDebugCoords = function(codes = ["AEP", "COR", "BRC", "MDZ", "IGR", "SCL", "GRU"]) {
  const rows = codes.map(code => {
    const key = clean(code).toUpperCase();
    const sna = odGetAirportRecordByIata(key);
    const our = ourAirportsIndex?.[key];

    return {
      code: key,
      coords: JSON.stringify(odGetAirportLatLngByCode(key)),
      enDatosAeropuertos: Boolean(sna),
      snaLat: sna?.__lat ?? "",
      snaLon: sna?.__lon ?? "",
      enOurAirports: Boolean(our),
      ourLat: our?.latitude ?? "",
      ourLon: our?.longitude ?? "",
      municipality: our?.municipality ?? "",
      continent: our?.continent ?? ""
    };
  });

  console.table(rows);
  return rows;
};
function odResolveDestinationMapCode(destino, mapKind) {
  const code = clean(destino?.code).toUpperCase();

  // Para destinos agrupados como BUE:
  // - cabotaje se ubica en AEP;
  // - internacional se ubica en EZE.
  if (code === "BUE") {
    return mapKind === "domestic" ? "AEP" : "EZE";
  }

  const codes = Array.isArray(destino?.airportCodesList)
    ? destino.airportCodesList.map(c => clean(c).toUpperCase()).filter(Boolean)
    : [];

  const withCoords = codes.find(c => odGetAirportLatLngByCode(c));
  if (withCoords) return withCoords;

  return code;
}

function odGetDestinationMapLabel(destino, mapKind) {
  const code = odResolveDestinationMapCode(destino, mapKind);
  const airport = odGetAirportRecordByIata(code);

  // Para aeropuertos del SNA, usar la denominación local del sistema.
  if (airport) {
    const local = clean(firstNonEmpty(airport, [
      "Aeropuerto",
      "Ciudad",
      "Localidad",
      "Municipio",
      "Ciudad / Localidad"
    ]));

    if (local) {
      return local
        .replace(/^Aeropuerto\s+de\s+/i, "")
        .replace(/\s*\([A-Z]{3}\)\s*$/g, "")
        .trim();
    }
  }

  // Para destinos fuera del SNA, usar municipality de ourairports.csv.
  const meta = ourAirportsIndex[code];

  return (
    clean(meta?.municipality) ||
    clean(destino?.ciudad) ||
    code
  );
}

function odGetConnectivityMapPlan(iata) {
  const info = odBuildRegularConnectedDestinationStats(
    iata,
    YEAR_REF,
    OD_CONNECTED_DESTINATION_MIN_MONTHS
  );

  const domesticItems = [
    ...(info.domestic || []).map(d => ({ ...d, mapStatus: "regular", mapKind: "domestic" })),
    ...(info.seasonalDomestic || []).map(d => ({ ...d, mapStatus: "seasonal", mapKind: "domestic" }))
  ];

  const southAmericaItems = [
    ...(info.southAmerica || []).map(d => ({ ...d, mapStatus: "regular", mapKind: "southamerica" })),
    ...(info.seasonalSouthAmerica || []).map(d => ({ ...d, mapStatus: "seasonal", mapKind: "southamerica" }))
  ];

  const extraItems = [
    ...(info.extraSouthAmerica || []).map(d => ({ ...d, mapStatus: "regular", mapKind: "extra" })),
    ...(info.seasonalExtraSouthAmerica || []).map(d => ({ ...d, mapStatus: "seasonal", mapKind: "extra" }))
  ];

  const hasDomestic = domesticItems.length > 0;
  const hasSouthAmerica = southAmericaItems.length > 0;
  const hasExtra = extraItems.length > 0;

  const maps = [];

  if (hasDomestic) {
    maps.push({
      id: "odConnectivityMapDomestic",
      legendId: "odConnectivityMapDomesticLegend",
      title: "Conectividad aérea 2025 · Cabotaje",
      mode: "argentina",
      kind: "domestic",
      routes: domesticItems
    });
  }

  if (hasSouthAmerica || hasExtra) {
    maps.push({
      id: "odConnectivityMapInternational",
      legendId: "odConnectivityMapInternationalLegend",
      title: hasExtra
        ? "Conectividad aérea 2025 · Internacional"
        : "Conectividad aérea 2025 · Internacional sudamericana",
      mode: hasExtra ? "extra" : "southamerica",
      kind: hasExtra ? "international-extra" : "international-southamerica",
      routes: hasExtra
        ? [...southAmericaItems, ...extraItems]
        : southAmericaItems
    });
  }

  return {
    info,
    maps
  };
}

function odScaleRouteWeight(pax, maxPax) {
  const value = Number(pax || 0);
  const max = Number(maxPax || 0);

  if (max <= 0 || value <= 0) return OD_MAP_ROUTE_WEIGHT_MIN;

  const ratio = Math.sqrt(value / max);

  return OD_MAP_ROUTE_WEIGHT_MIN +
    (OD_MAP_ROUTE_WEIGHT_MAX - OD_MAP_ROUTE_WEIGHT_MIN) * ratio;
}

function odMakeCurvedRouteLatLngs(origin, destination, curvature = 0.22) {
  const [lat1, lng1] = origin;
  const [lat2, lng2] = destination;

  const dx = lng2 - lng1;
  const dy = lat2 - lat1;

  const distance = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular normalizada.
  const px = -dy / distance;
  const py = dx / distance;

  // Curvatura proporcional a la distancia.
  const curveAmount = distance * curvature;

  const controlLng = (lng1 + lng2) / 2 + px * curveAmount;
  const controlLat = (lat1 + lat2) / 2 + py * curveAmount;

  const points = [];
  const steps = 34;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const oneMinusT = 1 - t;

    const lat =
      oneMinusT * oneMinusT * lat1 +
      2 * oneMinusT * t * controlLat +
      t * t * lat2;

    const lng =
      oneMinusT * oneMinusT * lng1 +
      2 * oneMinusT * t * controlLng +
      t * t * lng2;

    points.push([lat, lng]);
  }

  return points;
}
function odGetRouteCurvature(route, index, mapMode) {
  const sign = index % 2 === 0 ? 1 : -1;

  /*
    Curvatura muy contenida:
    el mapa de cabotaje siempre muestra Argentina completa,
    por lo que una curva fuerte se va fuera del encuadre.
  */
  if (mapMode === "argentina") {
    return sign * 0.012;
  }

  if (mapMode === "southamerica") {
    return sign * 0.018;
  }

  return sign * 0.014;
}
  function odFitConnectivityMap(map, mapCfg, routeBounds) {
  if (!map || !mapCfg) return;

  if (mapCfg.mode === "argentina") {
map.fitBounds(OD_MAP_BOUNDS_ARGENTINA, {
  padding: [2, 2],
  animate: false
});
    return;
  }

  if (mapCfg.mode === "southamerica") {
    map.fitBounds(OD_MAP_BOUNDS_SOUTH_AMERICA, {
      padding: [10, 10],
      animate: false
    });
    return;
  }

  if (routeBounds && routeBounds.isValid()) {
    map.fitBounds(routeBounds.pad(0.18), {
      padding: [12, 12],
      animate: false,
      maxZoom: 4
    });
  }
}
function odShouldShowProvincesInConnectivityMap(mode) {
  // Provincias en Argentina y en Sudamérica.
  // No en mapa extra-sudamericano.
  return mode === "argentina" || mode === "southamerica";
}

function odAddConnectivityBaseMap(map, mode) {
  if (mode === "argentina") {
    L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      {
        maxZoom: 14,
        tms: true,
        attribution: "© IGN Argentina - Argenmap"
      }
    ).addTo(map);
  } else {
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 10,
        attribution: "© OpenStreetMap © CARTO"
      }
    ).addTo(map);
  }

  if (
    odShouldShowProvincesInConnectivityMap(mode) &&
    provinciasFeatures &&
    provinciasFeatures.length
  ) {
    L.geoJSON(
      {
        type: "FeatureCollection",
        features: provinciasFeatures
      },
      {
        style: {
          color: "#ffffff",
          weight: 0.8,
          fillColor: "#d9d9d9",
          fillOpacity: mode === "argentina" ? 0.7 : 0.45
        }
      }
    ).addTo(map);
  }
}

function odGetMapRouteColor(route) {
  if (route.mapKind === "domestic") return OD_MAP_COLORS.domestic;
  if (route.mapKind === "southamerica") return OD_MAP_COLORS.southamerica;
  return OD_MAP_COLORS.extra;
}

function odBuildConnectivityMapLegendHtml(routes, mapCfg = null) {
  const sourceRoutes = (routes || []).filter(route => Number(route.pax || 0) > 0);

  if (!sourceRoutes.length) return "";

  function getMarketKey(route) {
    if (route.mapKind === "domestic") return "domestic";
    if (route.mapKind === "southamerica") return "southamerica";
    return "extra";
  }

  function getDurationKey(route) {
    const months = Number(route.monthsCount || 0);

    if (route.mapStatus === "seasonal") return "seasonal";
    if (months >= 12) return "fullYear";

    return "regularPartial";
  }

  function monthRangeText(items) {
    const months = items
      .map(route => Number(route.monthsCount || 0))
      .filter(v => Number.isFinite(v) && v > 0);

    if (!months.length) return "";

    const min = Math.min(...months);
    const max = Math.max(...months);

    if (min === max) {
      return `${formatNumber(min)} ${min === 1 ? "mes" : "meses"}`;
    }

    return `${formatNumber(min)} a ${formatNumber(max)} meses`;
  }

  function getGroupLabel(marketKey, durationKey, items) {
    const range = monthRangeText(items);

    if (marketKey === "domestic") {
      if (durationKey === "fullYear") return "Rutas de cabotaje 12 meses";
      if (durationKey === "seasonal") return "Rutas de cabotaje de temporada";
      return `Rutas de cabotaje ${range}`;
    }

    if (marketKey === "southamerica") {
      if (durationKey === "fullYear") return "Rutas sudamericanas 12 meses";
      if (durationKey === "seasonal") return "Rutas sudamericanas de temporada";
      return `Rutas sudamericanas ${range}`;
    }

    if (durationKey === "fullYear") return "Rutas extra-sudamericanas 12 meses";
    if (durationKey === "seasonal") return "Rutas extra-sudamericanas de temporada";
    return `Rutas extra-sudamericanas ${range}`;
  }

  function getGroupOrder(marketKey, durationKey) {
    const marketOrder = {
      domestic: 1,
      southamerica: 2,
      extra: 3
    };

    const durationOrder = {
      fullYear: 1,
      regularPartial: 2,
      seasonal: 3
    };

    return `${marketOrder[marketKey] || 9}.${durationOrder[durationKey] || 9}`;
  }

  const groups = new Map();

  sourceRoutes.forEach(route => {
    const marketKey = getMarketKey(route);
    const durationKey = getDurationKey(route);
    const key = `${marketKey}|${durationKey}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        marketKey,
        durationKey,
        routes: [],
        pax: 0
      });
    }

    const group = groups.get(key);
    group.routes.push(route);
    group.pax += Number(route.pax || 0);
  });

  return Array.from(groups.values())
    .sort((a, b) => getGroupOrder(a.marketKey, a.durationKey).localeCompare(getGroupOrder(b.marketKey, b.durationKey)))
    .map(group => {
      const representative = group.routes[0];
      const color = odGetMapRouteColor(representative);
      const isSeasonal = group.durationKey === "seasonal";
      const isPartial = group.durationKey === "regularPartial";
      const label = getGroupLabel(group.marketKey, group.durationKey, group.routes);
      const count = group.routes.length;

const countText = `${formatNumber(count)} ${count === 1 ? "destino" : "destinos"}`;
const paxText = `${formatNumber(Math.round(group.pax))} pasajeros`;

return `
  <div class="od-map-legend-row">
    <span
      class="od-map-legend-line ${isSeasonal ? "is-seasonal" : ""} ${isPartial ? "is-partial" : ""}"
      style="--route-color:${color};"
    ></span>

    <span class="od-map-legend-text">
      <strong>${escapeHtml(label)} - ${escapeHtml(countText)} - ${escapeHtml(paxText)}</strong>
    </span>
  </div>
`;
    })
    .join("");
}
function odBuildConnectivityMapsHtml(iata, summary) {
  if (isFDO(iata) || summary?.source === "aeropuertos_argentina_fdo") {
    return odBuildIntroTextHtml(iata, summary);
  }

  const destinationInfo = odBuildDestinationCountText(iata);

  if (odShouldSuppressCurrentRouteAnalysis(iata, summary, destinationInfo)) {
    return odBuildNoRegularCommercialServiceIntroHtml(iata);
  }

  const plan = odGetConnectivityMapPlan(iata);

  if (!plan.maps.length) {
    return odBuildIntroTextHtml(iata, summary);
  }

  const layoutClass = plan.maps.length === 1
    ? "od-connectivity-maps--single"
    : "od-connectivity-maps--double";

const seasonalityHtml = buildConnectivityProfileHtml(iata, summary, null);

return `
  <div class="od-connectivity-maps-with-seasonality">
    ${seasonalityHtml}

    <div class="od-connectivity-map-section ${layoutClass}">
      ${plan.maps.map(mapCfg => `
        <div class="od-connectivity-map-panel">
          <div class="od-connectivity-map-title">${escapeHtml(mapCfg.title)}</div>
          <div id="${mapCfg.id}" class="od-connectivity-map-box"></div>
          <div id="${mapCfg.legendId}" class="od-connectivity-map-legend"></div>
        </div>
      `).join("")}
    </div>
  </div>
`;
}

function odRenderConnectivityMaps(iata, summary) {
  odDestroyConnectivityMaps();

  if (typeof L === "undefined") {
    console.warn("Leaflet no está cargado. No se pueden renderizar los mapas de conectividad.");
    return;
  }

  if (isFDO(iata) || summary?.source === "aeropuertos_argentina_fdo") return;

  const destinationInfo = odBuildDestinationCountText(iata);
  if (odShouldSuppressCurrentRouteAnalysis(iata, summary, destinationInfo)) return;

  const originCode = clean(iata).toUpperCase();
  const originLatLng = odGetAirportLatLngByCode(originCode);
  if (!originLatLng) return;

  const plan = odGetConnectivityMapPlan(originCode);

  plan.maps.forEach(mapCfg => {
const mapEl = q(mapCfg.id);
const legendEl = q(mapCfg.legendId);

if (!mapEl || !mapCfg.routes.length) return;

if (legendEl) {
  legendEl.innerHTML = odBuildConnectivityMapLegendHtml(mapCfg.routes, mapCfg);
}

const map = L.map(mapEl, {
  zoomControl: false,
  attributionControl: false,
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
  tap: false
});

/*
  Leaflet necesita una vista inicial antes de agregar polígonos
  como provincias.geojson. Si no, puede fallar en Polygon.js.
*/
if (mapCfg.mode === "argentina") {
  map.setView([-38.5, -63.5], 4);
} else if (mapCfg.mode === "southamerica") {
  map.setView([-22.0, -60.0], 3);
} else {
  map.setView([-20.0, -58.0], 3);
}

odConnectivityMaps[mapCfg.id] = map;

odAddConnectivityBaseMap(map, mapCfg.mode);

    const maxPax = Math.max(
      ...mapCfg.routes.map(r => Number(r.pax || 0)),
      1
    );

    const routeBounds = L.latLngBounds([originLatLng]);

    mapCfg.routes.forEach((route, routeIdx) => {
      const destCode = odResolveDestinationMapCode(route, route.mapKind);
      const destLatLng = odGetAirportLatLngByCode(destCode);

      if (!destLatLng) {
  console.warn("Sin coordenadas para destino del mapa de conectividad", {
    origen: originCode,
    destino: destCode,
    ruta: route
  });
  return;
}

      routeBounds.extend(destLatLng);

const color = odGetMapRouteColor(route);
const weight = odScaleRouteWeight(route.pax, maxPax);
const isSeasonal = route.mapStatus === "seasonal";
const monthsCount = Number(route.monthsCount || 0);
const isFullYear = monthsCount >= 12;

const routeOpacity = isSeasonal
  ? 0.82
  : isFullYear
    ? 0.95
    : 0.68;

const curve = odMakeCurvedRouteLatLngs(
  originLatLng,
  destLatLng,
  odGetRouteCurvature(route, routeIdx, mapCfg.mode)
);

      L.polyline(curve, {
        color,
        weight,
opacity: routeOpacity,
dashArray: isSeasonal ? "5 5" : null,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);

      const label = odGetDestinationMapLabel(route, route.mapKind);

      L.circleMarker(destLatLng, {
        radius: 3.2,
        color: "#555",
        weight: 0.8,
        fillColor: "#6f7d8c",
        fillOpacity: 1
      })
        .addTo(map)
        .bindTooltip(label, {
          permanent: true,
          direction: "top",
          offset: [0, -4],
          className: "od-map-city-label"
        });
    });

    L.circleMarker(originLatLng, {
      radius: 4.8,
      color: "#003b70",
      weight: 1.2,
      fillColor: "#00A3E0",
      fillOpacity: 1
    })
      .addTo(map)
      .bindTooltip(getAirportBaseRouteName(originCode), {
        permanent: true,
        direction: "right",
        offset: [6, 0],
        className: "od-map-origin-label"
      });

odFitConnectivityMap(map, mapCfg, routeBounds);

    if (legendEl) {
      legendEl.innerHTML = odBuildConnectivityMapLegendHtml(mapCfg.routes, mapCfg);
    }

[80, 300, 700].forEach(delay => {
  setTimeout(() => {
    map.invalidateSize();
    odFitConnectivityMap(map, mapCfg, routeBounds);
  }, delay);
});
  });
}
function odBuildIntroTextHtml(iata, summary) {
  if (isFDO(iata) || summary?.source === "aeropuertos_argentina_fdo") {
    return odBuildFdoIntroTextHtml(summary);
  }

const airportName = odGetAirportNarrativeName(iata);
const destinationInfo = odBuildDestinationCountText(iata);
if (odShouldSuppressCurrentRouteAnalysis(iata, summary, destinationInfo)) {
  return odBuildNoRegularCommercialServiceIntroHtml(iata);
}
  
  const seats = odGetMarketSeatTotals(summary);
  const hasSeatData = seats.total > 0;

  const hasCabSeats = seats.cab > 0;
  const hasIntSeats = seats.int > 0;

  const airlineItems = odGetRelevantAirlinesForIntro(summary, 3);
  const airlineText = airlineItems.length
    ? odFormatAirlineOfferShareList(airlineItems)
    : "";

  const airlineVerb = airlineItems.length === 1 ? "sostuvo" : "sostuvieron";
  const marketPhrase = odBuildServiceMarketPhrase(seats.cab, seats.int);

  const operatorSentence = airlineText
    ? `La operación fue sostenida principalmente por <strong>${escapeHtml(airlineText)}</strong>, que ${airlineVerb} vuelos regulares ${marketPhrase}.`
    : `La operación registró vuelos regulares ${marketPhrase}.`;

  const freq = Number(summary?.totalFrecuenciaSemanal || 0);

  const freqText = Number.isFinite(freq) && freq > 0
    ? `<strong>${formatNumber(Math.round(freq))}</strong> frecuencias comerciales semanales promedio`
    : "frecuencias comerciales semanales no determinadas";

  const annualSeatsText = hasSeatData
    ? `<strong>${formatNumber(Math.round(seats.total))}</strong> asientos anuales ofrecidos`
    : "asientos anuales no determinados";

  const weeklySeats = hasSeatData ? seats.total / 52 : null;

  const weeklySeatsText = hasSeatData
    ? `, equivalentes a aproximadamente <strong>${formatNumber(Math.round(weeklySeats))}</strong> asientos semanales`
    : "";

  let seatsBreakdownText = "";

  if (hasCabSeats && hasIntSeats) {
    seatsBreakdownText =
      ` La oferta se distribuyó entre <strong>${formatNumber(Math.round(seats.cab))}</strong> asientos de cabotaje y <strong>${formatNumber(Math.round(seats.int))}</strong> asientos internacionales.`;
  } else if (hasCabSeats) {
    seatsBreakdownText =
      ` La oferta correspondió al mercado de cabotaje.`;
  } else if (hasIntSeats) {
    seatsBreakdownText =
      ` La oferta correspondió al mercado internacional.`;
  }

  const noSeatsNote = !hasSeatData
    ? ` En este caso, la fuente utilizada no permite reconstruir una oferta anual completa de asientos, por lo que la lectura se apoya principalmente en pasajeros, vuelos y frecuencias.`
    : "";
let openingParagraph = `
  En el año <strong>${YEAR_REF}</strong>, la oferta aerocomercial del
  <strong>${escapeHtml(airportName)}</strong> conectó de forma directa a esta ciudad con
  ${destinationInfo.regularText}${destinationInfo.hasSeasonal ? `. Además, registró conexiones comerciales de temporada con ${destinationInfo.seasonalText}` : ""}.
`;
  return `
<p>
  ${openingParagraph.replace(/\s+/g, " ").trim()}
</p>

    <p>
      ${operatorSentence}
    </p>

    <p>
      A lo largo del año, el aeropuerto contó con ${freqText} y ${annualSeatsText}${weeklySeatsText}.${seatsBreakdownText}${noSeatsNote}
    </p>
  `;
}

function renderOfertaDemandaIntro(iata, summary) {
  const el = q("odIntroText");
  if (!el) return;

  el.innerHTML = odBuildConnectivityMapsHtml(iata, summary);

  requestAnimationFrame(() => {
    odRenderConnectivityMaps(iata, summary);
  });
}
  
function formatShareShort(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

// Formato compacto para frecuencias semanales: evita mostrar decimales innecesarios.
function formatFrequencyShort(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "–";
  return Number(value).toLocaleString("es-AR", {
    minimumFractionDigits: Number(value) < 10 ? 1 : 0,
    maximumFractionDigits: Number(value) < 10 ? 1 : 0
  });
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

function parseOurAirportsCSV(text) {
  const rows = parseCSV(text);
  const index = {};

  rows.forEach(row => {
    const iata = clean(firstNonEmpty(row, [
      "iata",
      "iata_code",
      "iata_code_"
    ])).toUpperCase();

    const oaci = clean(firstNonEmpty(row, [
      "oaci",
      "icao",
      "icao_code"
    ])).toUpperCase();

    const continent = clean(firstNonEmpty(row, ["continent"])).toUpperCase();

    const meta = {
      iata,
      oaci,
      continent,
      countryCode: clean(firstNonEmpty(row, [
        "country_code",
        "iso_country",
        "pais_codigo"
      ])).toUpperCase(),
      municipality: clean(firstNonEmpty(row, [
        "municipality",
        "ciudad",
        "city"
      ])),
      name: clean(firstNonEmpty(row, [
        "name",
        "airport_name",
        "nombre"
      ])),
      latitude: parseNumber(firstNonEmpty(row, [
        "latitude",
        "latitude_deg",
        "lat"
      ])),
      longitude: parseNumber(firstNonEmpty(row, [
        "longitude",
        "longitude_deg",
        "lon",
        "lng"
      ]))
    };

    if (iata) index[iata] = meta;
    if (oaci) index[oaci] = meta;
  });

  return index;
}

function odGetAirportContinentByCode(code) {
  const key = clean(code).toUpperCase();
  if (!key) return "";

  const ourMeta = ourAirportsIndex[key];
  if (ourMeta?.continent) return clean(ourMeta.continent).toUpperCase();

  return "";
}

function odGetDestinationContinent(destino) {
  const codes = [];

  const mainCode = clean(destino?.code).toUpperCase();
  if (mainCode) codes.push(mainCode);

  if (Array.isArray(destino?.airportCodesList)) {
    destino.airportCodesList.forEach(code => {
      const c = clean(code).toUpperCase();
      if (c) codes.push(c);
    });
  }

  for (const code of codes) {
    const continent = odGetAirportContinentByCode(code);
    if (continent) return continent;
  }

  return "";
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


/* ============================================================
   PERFIL OPERATIVO 2025 Y NARRATIVA DE CONECTIVIDAD
   ============================================================ */

function buildOperationalProfileIndex(data) {
  const index = {};
  const categorias = data?.categorias || {};

  Object.entries(categorias).forEach(([categoryKey, category]) => {
    (category?.aeropuertos || []).forEach(item => {
      const iata = clean(item?.iata).toUpperCase();
      if (!iata) return;

      index[iata] = {
        categoryKey,
        label: clean(category?.label) || categoryKey,
        criterio: clean(category?.criterio),
        enfoqueNarrativo: clean(category?.enfoque_narrativo),
        aclaracionHistorica: clean(category?.aclaracion_historica),
        pasajeros2025: Number(item?.pasajeros_2025),
        movimientos2025: Number(item?.movimientos_2025),
        pasajerosPorMovimiento: Number(item?.pasajeros_por_movimiento),
        movimientosPorPasajero: Number(item?.movimientos_por_pasajero)
      };
    });
  });

  return index;
}

function getOperationalProfile(iata) {
  return operationalProfileByIata?.[clean(iata).toUpperCase()] || null;
}

/* ============================================================
   DESCRIPTIVO AEROPORTUARIO
   ------------------------------------------------------------
   Convierte Descriptivo_aeropuertos.geojson en un índice por IATA.
   Esta fuente aporta perfil territorial, tipo de demanda y estacionalidad
   esperada para enriquecer la narrativa de conectividad.
   ============================================================ */

function buildDescriptivoAirportIndex(geojson) {
  const index = {};

  (geojson?.features || []).forEach(feature => {
    const props = feature?.properties || {};
    const iata = clean(firstNonEmpty(props, ["IATA", "iata"])).toUpperCase();

    if (!iata) return;

    index[iata] = props;
  });

  return index;
}

function getAirportDescriptivo(iata) {
  return descriptivoByIata?.[clean(iata).toUpperCase()] || null;
}
  
function sumMarketPassengers(summary, marketKey) {
  return (summary?.monthly || []).reduce((acc, row) => {
    if (marketKey === "cab") return acc + (Number(row.paxCab) || 0);
    if (marketKey === "int") return acc + (Number(row.paxInt) || 0);
    return acc + (Number(row.paxTotal) || 0);
  }, 0);
}

function hasRelevantInternationalTraffic(summary) {
  const total = Number(summary?.totalPax || 0);
  const paxInt = sumMarketPassengers(summary, "int");
  if (total <= 0 || paxInt <= 0) return false;

  const share = paxInt / total;

  // Umbral prudente: evita sobredimensionar operaciones internacionales muy marginales.
  return paxInt >= 10000 && share >= 0.01;
}

function getSNAPassengerRankingByMarket(selectedIata, marketKey, year = YEAR_REF) {
  const selected = clean(selectedIata).toUpperCase();

  const rankingRows = (aeropuertos || []).map(a => {
    const iata = clean(firstNonEmpty(a, ["IATA"])).toUpperCase();
    const summary = getOfertaDemandaSummary(iata, year, { soloComercial: true });

    return {
      iata,
      totalPax: sumMarketPassengers(summary, marketKey)
    };
  });

  rankingRows.sort((a, b) => b.totalPax - a.totalPax);

  const rank = rankingRows.findIndex(r => r.iata === selected) + 1;
  const selectedRow = rankingRows.find(r => r.iata === selected);

  return {
    rank: rank > 0 ? rank : null,
    totalAirports: rankingRows.length,
    value: selectedRow?.totalPax ?? 0
  };
}

function classifyConcentration(mainRoutes) {
  const routes = (mainRoutes || []).slice().sort((a, b) => (b.totalPax || 0) - (a.totalPax || 0));
  const r1 = Number(routes[0]?.sharePaxPct || 0);
  const top3 = routes.slice(0, 3).reduce((acc, r) => acc + (Number(r.sharePaxPct) || 0), 0);

  if (r1 >= 50) return { label: "muy concentrada", r1, top3 };
  if (r1 >= 35) return { label: "concentrada", r1, top3 };
  if (r1 >= 25) return { label: "intermedia", r1, top3 };
  if (r1 < 20 && top3 < 60) return { label: "muy diversificada", r1, top3 };
  return { label: "diversificada", r1, top3 };
}

function classifyBueDependence(shareBue) {
  if (!Number.isFinite(shareBue)) return "sin dependencia radial claramente identificable";
  if (shareBue >= 70) return "alta dependencia de BUE";
  if (shareBue >= 50) return "dependencia marcada de BUE";
  if (shareBue >= 30) return "estructura mixta, con peso relevante de BUE";
  return "baja dependencia de BUE";
}

function buildMarketProfilePhrase(iata, paxCab, paxInt) {
  const code = clean(iata).toUpperCase();
  const total = Number(paxCab || 0) + Number(paxInt || 0);
  if (total <= 0) return "un perfil de mercado no claramente identificable";

  const cabShare = Number(paxCab || 0) / total;
  const intShare = Number(paxInt || 0) / total;

  if (code === "AEP") {
    return intShare >= 0.20
      ? "un perfil con predominio del cabotaje, aunque con un volumen internacional relevante"
      : "un perfil con predominio marcado del cabotaje";
  }

  if (code === "EZE") {
    return cabShare >= 0.20
      ? "un perfil con predominio internacional, aunque con un volumen de cabotaje significativo"
      : "un perfil con predominio marcado del tráfico internacional";
  }

  if (intShare >= 0.25) return "un perfil con presencia internacional relevante";
  if (intShare > 0.01) return "un perfil con presencia internacional acotada";
  return "un perfil orientado principalmente al cabotaje";
}

/* ============================================================
   ESTACIONALIDAD OBSERVADA
   ------------------------------------------------------------
   Usa la serie mensual 2025 del gráfico de oferta-demanda.
   No reemplaza la estacionalidad esperada del descriptivo:
   la contrasta con los datos mensuales observados.
   ============================================================ */

function buildObservedSeasonality(summary) {
  const rows = (summary?.monthly || [])
    .map(row => {
      const date = parseFechaFlexible(row.anioMes);
      const pax = Number(row.paxTotal || 0);

      return {
        anioMes: row.anioMes,
        date,
        month: date ? date.getMonth() + 1 : null,
        monthLabel: date
          ? date.toLocaleDateString("es-AR", { month: "long" })
          : row.anioMes,
        pax
      };
    })
    .filter(row => row.pax > 0);

  if (!rows.length) return null;

  const total = rows.reduce((acc, row) => acc + row.pax, 0);
  const avg = total / rows.length;

  const sorted = rows.slice().sort((a, b) => b.pax - a.pax);
  const peak = sorted[0];
  const top3 = sorted.slice(0, 3);
  const top3Pax = top3.reduce((acc, row) => acc + row.pax, 0);

  const peakShare = total > 0 ? (peak.pax / total) * 100 : 0;
  const top3Share = total > 0 ? (top3Pax / total) * 100 : 0;
  const peakVsAvg = avg > 0 ? peak.pax / avg : null;

  let intensity = "sin estacionalidad marcada";

  if (top3Share >= 45 || peakVsAvg >= 2) {
    intensity = "estacionalidad muy marcada";
  } else if (top3Share >= 35 || peakVsAvg >= 1.6) {
    intensity = "estacionalidad marcada";
  } else if (top3Share >= 30 || peakVsAvg >= 1.35) {
    intensity = "estacionalidad moderada";
  }

  return {
    peak,
    top3,
    peakShare,
    top3Share,
    peakVsAvg,
    intensity
  };
}

/* ============================================================
   FRASES TERRITORIALES Y DE ESTACIONALIDAD
   ------------------------------------------------------------
   Estas funciones convierten los campos del descriptivo en texto
   más narrativo para evitar que el bloque quede como una lista
   de indicadores.
   ============================================================ */

function formatDescriptiveList(items, maxItems = 2) {
  const values = items
    .map(clean)
    .filter(Boolean)
    .slice(0, maxItems);

  if (!values.length) return "";

  if (values.length === 1) return values[0];

  return `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`;
}

function buildTerritorialRolePhrase(descriptivo) {
  if (!descriptivo) return "";

  const rasgo = clean(descriptivo.rasgo_territorial);
  const tipologia = clean(descriptivo.tipologia_principal);
  const secundaria = clean(descriptivo.tipologia_secundaria);

  const funciones = formatDescriptiveList([tipologia, secundaria], 2);

  if (rasgo && funciones) {
    return `asociado a <strong>${escapeHtml(rasgo)}</strong>, con funciones vinculadas a <strong>${escapeHtml(funciones)}</strong>`;
  }

  if (rasgo) {
    return `asociado a <strong>${escapeHtml(rasgo)}</strong>`;
  }

  if (funciones) {
    return `vinculado a funciones de <strong>${escapeHtml(funciones)}</strong>`;
  }

  return "";
}

function buildDemandRolePhrase(descriptivo) {
  if (!descriptivo) return "";

  const observacion = clean(descriptivo.observacion_demanda);
  const demanda = clean(descriptivo.tipologia_demanda_aerea);
  const secundaria = clean(descriptivo.demanda_secundaria);

  if (observacion) {
    const txt = lowerFirst(observacion).replace(/\.$/, "");

    if (/^fuerte peso/.test(txt)) return `por un ${escapeHtml(txt)}`;
    if (/^predominio/.test(txt)) return `por el ${escapeHtml(txt)}`;
    if (/^puerta/.test(txt)) return `por su rol como ${escapeHtml(txt)}`;

    return `por ${escapeHtml(txt)}`;
  }

  if (demanda && secundaria) {
    return `por una demanda de perfil ${escapeHtml(demanda)}, con un componente secundario ${escapeHtml(secundaria)}`;
  }

  if (demanda) {
    return `por una demanda de perfil ${escapeHtml(demanda)}`;
  }

  return "";
}

function buildTourismPhrase(descriptivo) {
  if (!descriptivo) return "";

  const tourismCat = clean(descriptivo.turismo_cat);
  const atractivos = formatDescriptiveList([
    descriptivo.atractivo_1,
    descriptivo.atractivo_2
  ]);

  if (!tourismCat && !atractivos) return "";

  if (tourismCat && atractivos) {
    return `El componente turístico se vincula con <strong>${escapeHtml(atractivos)}</strong>.`;
  }

  if (atractivos) {
    return `Entre los elementos territoriales relevantes se destacan <strong>${escapeHtml(atractivos)}</strong>.`;
  }

  return "";
}

function isPeakConsistentWithExpectedSeason(expectedType, peakMonth) {
  const expected = normalizeTextKey(expectedType);

  if (!peakMonth) return null;

  if (expected === "invierno") {
    return [6, 7, 8].includes(Number(peakMonth));
  }

  if (expected === "verano") {
    return [12, 1, 2].includes(Number(peakMonth));
  }

  if (expected === "todo_el_ano" || expected === "todo el ano" || expected === "todo el año") {
    return null;
  }

  if (expected === "eventos") {
    return null;
  }

  return null;
}

function buildSeasonalityPhrase(descriptivo, observed) {
  if (!observed) return "";

  const expectedType = clean(descriptivo?.tipo_estacionalidad);
  const expectedNote = clean(descriptivo?.observacion_estacionalidad);

  const peakLabel = observed.peak?.monthLabel || "el mes pico";
  const peakText = formatShareShort(observed.peakShare);
  const top3Text = formatShareShort(observed.top3Share);

  const top3Months = joinHtmlList(
    (observed.top3 || []).map(row =>
      `<strong>${escapeHtml(row.monthLabel)}</strong>`
    )
  );

  let base = "";

  if (observed.intensity === "sin estacionalidad marcada") {
    base = `
      La dinámica mensual no mostró una estacionalidad marcada:
      el mes de mayor movimiento fue <strong>${escapeHtml(peakLabel)}</strong>, con <strong>${peakText}</strong>
      de los pasajeros anuales, y los tres meses principales —${top3Months}— concentraron
      <strong>${top3Text}</strong>.
    `;
  } else {
    base = `
      La dinámica mensual mostró <strong>${escapeHtml(observed.intensity)}</strong>:
      el mes de mayor movimiento fue <strong>${escapeHtml(peakLabel)}</strong>, con <strong>${peakText}</strong>
      de los pasajeros anuales, y los tres meses principales —${top3Months}— concentraron
      <strong>${top3Text}</strong>.
    `;
  }

  if (expectedNote) {
    base += ` ${escapeHtml(normalizeSentenceText(expectedNote))}`;
  } else if (normalizeTextKey(expectedType).includes("todo") && observed.intensity === "sin estacionalidad marcada") {
    base += " Esto resulta compatible con un perfil de demanda de actividad anual.";
  } else if (normalizeTextKey(expectedType).includes("todo")) {
    base += " Aunque el descriptivo identifica una demanda de actividad anual, en 2025 se observó una concentración mensual relevante.";
  }

  return base.replace(/\s+/g, " ").trim();
}
 function joinHtmlList(items) {
  const values = (items || []).filter(Boolean);

  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} y ${values[1]}`;

  return `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`;
}

function routeTextName(route) {
  const ciudad = clean(route?.ciudad);
  const codes = clean(route?.codesLabel);

  if (ciudad && codes && !ciudad.toUpperCase().includes(codes.toUpperCase())) {
    return `${ciudad} (${codes})`;
  }

  if (ciudad) return ciudad;

  return clean(route?.title)
    .replace(/^.*?\s[-–]\s/g, "")
    .trim();
}

function destinationTextName(destino) {
  const ciudad = clean(destino?.ciudad) || clean(destino?.code);
  const code = clean(destino?.code);

  if (ciudad && code && !ciudad.toUpperCase().includes(code.toUpperCase())) {
    return `${ciudad} (${code})`;
  }

  return ciudad || code;
}

function routeNamesHtml(routes) {
  return joinHtmlList(
    (routes || []).map(route =>
      `<strong>${escapeHtml(routeTextName(route))}</strong>`
    )
  );
}

function destinationNamesWithSharesHtml(destinos, denominatorPax) {
  const denom = Number(denominatorPax || 0);

  return joinHtmlList(
    (destinos || []).map(destino => {
      const share = denom > 0
        ? (Number(destino.pax || 0) / denom) * 100
        : 0;

      return `<strong>${escapeHtml(destinationTextName(destino))}</strong> (${formatShareShort(share)})`;
    })
  );
}

function normalizeSentenceText(text) {
  const value = clean(text);
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function lowerFirst(text) {
  const value = clean(text);
  if (!value) return "";
  return value.charAt(0).toLowerCase() + value.slice(1);
} 
function buildConnectivityProfile(iata, summary, snaRank) {
  const code = clean(iata).toUpperCase();
  const profile = getOperationalProfile(code);
  const descriptivo = getAirportDescriptivo(code);
  const observedSeasonality = buildObservedSeasonality(summary);
  const totalPax = Number(summary?.totalPax || 0);
  const paxCab = sumMarketPassengers(summary, "cab");
  const paxInt = sumMarketPassengers(summary, "int");
  const intRelevant = hasRelevantInternationalTraffic(summary);
  const isMetroNode = code === "AEP" || code === "EZE";
  const concentration = classifyConcentration(summary?.mainRoutes || []);

  const rankCab = getSNAPassengerRankingByMarket(code, "cab", YEAR_REF);
  const rankInt = getSNAPassengerRankingByMarket(code, "int", YEAR_REF);

  const destinos = (summary?.destinos || []).filter(d => Number(d.pax || 0) > 0);
  const buePax = destinos
    .filter(d => clean(d.code).toUpperCase() === "BUE")
    .reduce((acc, d) => acc + (Number(d.pax) || 0), 0);

  const domesticFederal = destinos.filter(d => {
    const destCode = clean(d.code).toUpperCase();
    const cls = normalizeTextKey(d.clasificacion || "");
    return destCode !== "BUE" && !cls.includes("internacional");
  });

  const federalPax = domesticFederal.reduce((acc, d) => acc + (Number(d.pax) || 0), 0);
  const federalShare = totalPax > 0 ? (federalPax / totalPax) * 100 : 0;

const intlDestinos = destinos
  .filter(d => normalizeTextKey(d.clasificacion || "").includes("internacional"))
  .sort((a, b) => (Number(b.pax) || 0) - (Number(a.pax) || 0));

const intlShare = totalPax > 0 ? (paxInt / totalPax) * 100 : 0;
const bueShare = totalPax > 0 ? (buePax / totalPax) * 100 : NaN;

const routesSorted = (summary?.mainRoutes || [])
  .slice()
  .sort((a, b) => (b.totalPax || 0) - (a.totalPax || 0));

const topRoute = routesSorted[0] || null;
const top3Routes = routesSorted.slice(0, 3);
const topIntlDestinos = intlDestinos.slice(0, 3);

return {
  code,
  profile,
  descriptivo,
  observedSeasonality,
  totalPax,
  paxCab,
  paxInt,
  intRelevant,
  isMetroNode,
  concentration,
  rankCab,
  rankInt,
  marketPhrase: buildMarketProfilePhrase(code, paxCab, paxInt),
  routesSorted,
  topRoute,
  top3Routes,
  topIntlDestinos,
  destinosCount: destinos.length,
  bueShare,
  bueDependence: classifyBueDependence(bueShare),
  federalRoutesCount: domesticFederal.length,
  federalShare,
  intlRoutesCount: intlDestinos.length,
  intlShare,
  snaRank
};
}

function buildConnectivityProfileHtml(iata, summary, snaRank) {
  const p = buildConnectivityProfile(iata, summary, snaRank);
  const seasonalityPhrase = buildSeasonalityPhrase(p.descriptivo, p.observedSeasonality);

  return `
    <div class="od-connectivity-block">
      <div class="od-connectivity-kicker">Estacionalidad mensual 2025</div>
      <p>${seasonalityPhrase}</p>
    </div>
  `;
}

function renderConnectivityProfileText(iata, summary, snaRank) {
  const el = q("odConnectivityProfileText");
  if (!el) return;

  /*
    La estacionalidad ahora se inserta dentro de odIntroText,
    por encima de los mapas de conectividad.
    Este contenedor queda oculto para no duplicar el bloque.
  */
  el.innerHTML = "";
  el.style.display = "none";
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
    const yearNum = parseNumber(firstNonEmpty(r, ["anio", "ano", "year", "año","AÃ±o"]));

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

function isFDO(iata) {
  return clean(iata).toUpperCase() === "FDO";
}

function normalizeFDORouteCode(code) {
  const c = clean(code).toUpperCase();

  // Corrección metodológica: ASI se interpreta como ASU, Asunción, Paraguay.
  if (c === "ASI") return "ASU";

  // Códigos agregados de la fuente especial de San Fernando.
  if (c === "-AR" || c === "AR") return "AR";
  if (c === "-EX" || c === "EX") return "EXT";

  return c;
}

function getFdoRouteRecords(data) {
  // La fuente especial de FDO puede publicarse como array directo
  // o dentro de distintas claves contenedoras. Esta función centraliza
  // esa lectura para no atar el gráfico histórico a una única estructura JSON.
  if (Array.isArray(data)) return data;

  const candidateKeys = [
    "routes", "rutas", "rutas_mensuales", "rutas_mensual",
    "monthly", "mensual", "data", "rows", "records", "registros"
  ];

  for (const key of candidateKeys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function normalizeFdoRowKeys(row) {
  const out = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    out[normalizeHeader(key)] = value;
  });
  return out;
}

function parseFdoRoutesMonthlyAAJSON(data) {
  const records = getFdoRouteRecords(data);
  const acc = new Map();

  // Extrae año y mes de FDO desde columnas explícitas (y/m, anio/mes)
  // o desde campos período tipo 2018-01, 201801, AñoMes, fecha, etc.
  // Esto corrige el histórico: si los registros 2018-2024 vienen solo con AñoMes,
  // no deben descartarse ni quedar el gráfico limitado a 2025.
  function getFdoYearMonth(row) {
    let year = parseNumber(firstNonEmpty(row, ["y", "anio", "ano", "year"]));
    let month = parseNumber(firstNonEmpty(row, ["m", "mes", "month"]));

    if (Number.isFinite(year) && Number.isFinite(month)) {
      return { year, month };
    }

    const rawPeriod = clean(firstNonEmpty(row, [
      "am",
      "anomes",
      "anio_mes",
      "ano_mes",
      "periodo",
      "periodo_id",
      "fecha",
      "date"
    ]));

    if (!rawPeriod) return { year: NaN, month: NaN };

    const compact = rawPeriod.match(/^(\d{4})(\d{2})$/);
    if (compact) {
      return { year: Number(compact[1]), month: Number(compact[2]) };
    }

    const ym = rawPeriod.match(/^(\d{4})[-_/](\d{1,2})/);
    if (ym) {
      return { year: Number(ym[1]), month: Number(ym[2]) };
    }

    const d = parseFechaFlexible(rawPeriod);
    if (d) {
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }

    return { year: NaN, month: NaN };
  }

  // Extrae el destino de FDO. Si el campo viene como CityPair/Ruta
  // del tipo FDO - ASU, se queda con el extremo distinto de FDO.
  function getFdoDestinationCode(row) {
    const raw = clean(firstNonEmpty(row, [
      "d",
      "destino",
      "destino_iata",
      "iata_destino",
      "codigo_destino",
      "cod_destino",
      "ruta",
      "citypair_iata",
      "citypair",
      "par_iata"
    ])).toUpperCase();

    if (!raw) return "";

    if (raw.includes("-")) {
      const parts = raw.split("-").map(x => clean(x).toUpperCase()).filter(Boolean);
      const other = parts.find(x => x !== "FDO");
      return normalizeFDORouteCode(other || raw);
    }

    const codes = raw.match(/[A-Z]{3}/g) || [];
    if (codes.length > 1 && codes.includes("FDO")) {
      return normalizeFDORouteCode(codes.find(x => x !== "FDO") || raw);
    }

    return normalizeFDORouteCode(raw);
  }

  records.forEach(rawRow => {
    const r = normalizeFdoRowKeys(rawRow);
    const { year, month } = getFdoYearMonth(r);
    const code = getFdoDestinationCode(r);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !code) return;

    const pax = parseNumber(firstNonEmpty(r, [
      "p",
      "pax",
      "pasajeros",
      "pasajeros_totales",
      "total_pasajeros",
      "valor_pax"
    ]));

    const vuelos = parseNumber(firstNonEmpty(r, [
      "v",
      "vuelos",
      "movimientos",
      "vuelos_totales",
      "total_vuelos",
      "total_movimientos"
    ]));

    const freq = parseNumber(firstNonEmpty(r, [
      "f",
      "frecuencia",
      "frecuencias",
      "frecuencias_semanales",
      "frecuencia_semanal"
    ]));

    const seatsProvided = parseNumber(firstNonEmpty(r, [
      "s",
      "asientos",
      "asientos_pax",
      "seats"
    ]));

    const lf = parseNumber(firstNonEmpty(r, [
      "lf",
      "load_factor",
      "ocupacion"
    ]));

    const seats = Number.isFinite(seatsProvided)
      ? seatsProvided
      : (Number.isFinite(pax) && Number.isFinite(lf) && lf > 0 ? pax / lf : 0);

    if (!Number.isFinite(pax) && !Number.isFinite(vuelos)) return;

    const key = `${year}|${month}|${code}`;

    if (!acc.has(key)) {
      acc.set(key, {
        i: "FDO",
        y: year,
        m: month,
        am: `${year}-${String(month).padStart(2, "0")}`,
        d: code,
        p: 0,
        v: 0,
        f: 0,
        s: 0
      });
    }

    const item = acc.get(key);
    item.p += Number.isFinite(pax) ? pax : 0;
    item.v += Number.isFinite(vuelos) ? vuelos : 0;
    item.f += Number.isFinite(freq) ? freq : 0;
    item.s += Number.isFinite(seats) ? seats : 0;
  });

  return Array.from(acc.values()).map(r => ({
    ...r,
    lf: r.s > 0 ? r.p / r.s : null
  })).filter(r =>
    r.i === "FDO" &&
    Number.isFinite(r.y) &&
    Number.isFinite(r.m) &&
    r.d &&
    ((Number(r.p) || 0) > 0 || (Number(r.v) || 0) > 0)
  );
}
function parseFdoRoutesAnnualAAJSON(data) {
  const records = getFdoRouteRecords(data);
  const acc = new Map();

  function getFdoYear(row) {
    let year = parseNumber(firstNonEmpty(row, [
      "y",
      "anio",
      "ano",
      "año",
      "year"
    ]));

    if (Number.isFinite(year)) return year;

    const rawPeriod = clean(firstNonEmpty(row, [
      "am",
      "anomes",
      "anio_mes",
      "ano_mes",
      "año_mes",
      "periodo",
      "periodo_id",
      "fecha",
      "date"
    ]));

    if (!rawPeriod) return NaN;

    const compact = rawPeriod.match(/^(\d{4})(\d{2})?$/);
    if (compact) return Number(compact[1]);

    const ym = rawPeriod.match(/^(\d{4})[-_/]?/);
    if (ym) return Number(ym[1]);

    const d = parseFechaFlexible(rawPeriod);
    return d ? d.getFullYear() : NaN;
  }

  function getFdoDestinationCodeAnnual(row) {
    const raw = clean(firstNonEmpty(row, [
      "d",
      "destino",
      "destino_iata",
      "iata_destino",
      "codigo_destino",
      "cod_destino",
      "ruta",
      "citypair_iata",
      "citypair",
      "par_iata"
    ])).toUpperCase();

    if (!raw) return "";

    if (raw.includes("-")) {
      const parts = raw.split("-").map(x => clean(x).toUpperCase()).filter(Boolean);
      const other = parts.find(x => x !== "FDO");
      return normalizeFDORouteCode(other || raw);
    }

    const codes = raw.match(/[A-Z]{3}/g) || [];
    if (codes.length > 1 && codes.includes("FDO")) {
      return normalizeFDORouteCode(codes.find(x => x !== "FDO") || raw);
    }

    return normalizeFDORouteCode(raw);
  }

  records.forEach(rawRow => {
    const r = normalizeFdoRowKeys(rawRow);

    const year = getFdoYear(r);
    const code = getFdoDestinationCodeAnnual(r);

    if (!Number.isFinite(year) || !code) return;

    const pax = parseNumber(firstNonEmpty(r, [
      "p",
      "pax",
      "pasajeros",
      "pasajeros_totales",
      "total_pasajeros",
      "valor_pax"
    ]));

    const vuelos = parseNumber(firstNonEmpty(r, [
      "v",
      "vuelos",
      "movimientos",
      "vuelos_totales",
      "total_vuelos",
      "total_movimientos"
    ]));

    if (!Number.isFinite(pax) && !Number.isFinite(vuelos)) return;

    const key = `${year}|${code}`;

    if (!acc.has(key)) {
      acc.set(key, {
        i: "FDO",
        y: year,
        m: 1,
        am: String(year),
        d: code,
        p: 0,
        v: 0,
        f: 0,
        s: 0
      });
    }

    const item = acc.get(key);
    item.p += Number.isFinite(pax) ? pax : 0;
    item.v += Number.isFinite(vuelos) ? vuelos : 0;
  });

  return Array.from(acc.values()).filter(r =>
    r.i === "FDO" &&
    Number.isFinite(r.y) &&
    r.d &&
    ((Number(r.p) || 0) > 0 || (Number(r.v) || 0) > 0)
  );
}
function isArgentinaCountry(value) {
  const p = clean(value).toUpperCase();
  return p === "AR" || p === "ARG" || p === "ARGENTINA" || p.startsWith("AR-");
}

function isFdoRouteInternational(code) {
  const c = normalizeFDORouteCode(code);

  if (c === "EXT") return true;
  if (c === "AR") return false;
  if (c === "FDO") return false;

  const meta = getRouteMeta(c);
  if (meta) return !isArgentinaCountry(meta.pais);

  const isDomesticAirport = aeropuertos.some(a =>
    clean(firstNonEmpty(a, ["IATA"])).toUpperCase() === c
  );

  return !isDomesticAirport;
}

function fdoShouldUseTrafficRow(row) {
  const cls = clean(row?.clase_vuelo).toLowerCase();

  // Excluimos cargas para oferta-demanda de pasajeros/movimientos.
  return !cls.startsWith("cargas");
}

function fdoTrafficSegment(row) {
  const s = clean(row?.segmento).toLowerCase();

  if (s.includes("internacional")) return "Int";
  return "Cab";
}

function getFdoTrafficMonthlyRecords() {
  if (Array.isArray(fdoTrafficAA?.mensual)) return fdoTrafficAA.mensual;
  if (Array.isArray(fdoTrafficAA?.monthly)) return fdoTrafficAA.monthly;
  if (Array.isArray(fdoTrafficAA?.data)) return fdoTrafficAA.data;
  if (Array.isArray(fdoTrafficAA?.rows)) return fdoTrafficAA.rows;
  return [];
}

function buildFdoHistoricTrafficData() {
  if (!fdoTrafficAA) return null;

  const yearMap = new Map();

  getFdoTrafficMonthlyRecords()
    .map(normalizeFdoRowKeys)
    .filter(fdoShouldUseTrafficRow)
    .forEach(row => {
      const year = Number(firstNonEmpty(row, [
        "anio",
        "ano",
        "año",
        "year",
        "y"
      ]));

      if (!Number.isFinite(year)) return;

      const pax = parseNumber(firstNonEmpty(row, [
        "pasajeros",
        "pax",
        "p",
        "pasajeros_totales",
        "total_pasajeros"
      ]));

      const mov = parseNumber(firstNonEmpty(row, [
        "movimientos",
        "vuelos",
        "v",
        "movimientos_totales",
        "total_movimientos",
        "total_vuelos"
      ]));

      if (!yearMap.has(year)) {
        yearMap.set(year, {
          year,
          pax: 0,
          movimientos: 0
        });
      }

      const item = yearMap.get(year);
      item.pax += Number.isFinite(pax) ? pax : 0;
      item.movimientos += Number.isFinite(mov) ? mov : 0;
    });

  const annualSeries = Array.from(yearMap.values())
    .filter(row => Number(row.pax) > 0 || Number(row.movimientos) > 0)
    .sort((a, b) => a.year - b.year);

  if (!annualSeries.length) return null;

  function getAnnualPax(year) {
    const row = annualSeries.find(x => Number(x.year) === Number(year));
    return row && Number.isFinite(Number(row.pax)) ? Number(row.pax) : null;
  }

  const availableYears = annualSeries.map(row => Number(row.year));

  const latestYear = availableYears.includes(Number(YEAR_REF))
    ? Number(YEAR_REF)
    : Math.max(...availableYears);

  const baselineYear = availableYears.includes(2019)
    ? 2019
    : Math.max(...availableYears.filter(y => y <= 2019));

  const longStartYear = Math.min(
    ...annualSeries
      .filter(row => Number(row.year) <= baselineYear && Number(row.pax) > 0)
      .map(row => Number(row.year))
  );

  const recentStartYear = availableYears.includes(2023)
    ? 2023
    : Math.min(...availableYears.filter(y => y >= 2020));

  const startPax = getAnnualPax(longStartYear);
  const baselinePax = getAnnualPax(baselineYear);
  const recentStartPax = getAnnualPax(recentStartYear);
  const latestPax = getAnnualPax(latestYear);

  const maxRow = annualSeries.reduce((max, row) => {
    if (!max) return row;
    return Number(row.pax) > Number(max.pax) ? row : max;
  }, null);

  const tmcaPrepandemic = calcTMCAFromValues(
    startPax,
    baselinePax,
    longStartYear,
    baselineYear
  );

  const tmcaRecent = calcTMCAFromValues(
    recentStartPax,
    latestPax,
    recentStartYear,
    latestYear
  );

  const varLatestVs2019 =
    Number.isFinite(Number(baselinePax)) &&
    Number.isFinite(Number(latestPax)) &&
    Number(baselinePax) > 0
      ? (Number(latestPax) / Number(baselinePax)) - 1
      : null;

  return {
    iata: "FDO",
    aeropuerto: "Aeropuerto de San Fernando (FDO)",
    source: "aeropuertos_argentina_fdo",

    annual_series: annualSeries,

    years_shown: latestYear - longStartYear + 1,

    prepandemic_start_year: longStartYear,
    prepandemic_start_pax: startPax,

    baseline_year: baselineYear,
    baseline_pax: baselinePax,

    latest_year: latestYear,
    latest_pax: latestPax,

    tmca_prepandemic: tmcaPrepandemic,
    tmca_recent: tmcaRecent,
    var_latest_vs_2019: varLatestVs2019,

    max_year: maxRow?.year ?? null,
    max_pax: maxRow?.pax ?? null
  };
}
  
function buildFdoMonthlyBase(year = YEAR_REF) {
  const monthlyMap = new Map();

  (fdoTrafficAA?.mensual || [])
    .filter(fdoShouldUseTrafficRow)
    .filter(row => Number(row.anio) === Number(year))
    .forEach(row => {
      const mes = Number(row.mes);
      if (!Number.isFinite(mes)) return;

      const key = `${year}-${String(mes).padStart(2, "0")}`;
      const marketKey = fdoTrafficSegment(row);

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          anioMes: key,
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

      const item = monthlyMap.get(key);
      const pax = Number(row.pasajeros) || 0;
      const mov = Number(row.movimientos) || 0;

      item.paxTotal += pax;
      item.vuelosTotal += mov;

      item[`pax${marketKey}`] += pax;
      item[`vuelos${marketKey}`] += mov;
    });

  return Array.from(monthlyMap.values())
    .sort((a, b) => a.anioMes.localeCompare(b.anioMes));
}

function getFdoRouteLabel(code) {
  const c = normalizeFDORouteCode(code);
  const isInternational = isFdoRouteInternational(c);
  const label = getDestinationLabel(c, isInternational);

  return {
    code: c,
    ciudad: label.ciudad || c,
    pais: label.pais || "",
    clasificacion: isInternational ? "Internacional" : "Cabotaje"
  };
}

function buildFdoOfertaDemandaSummary(year = YEAR_REF) {
  const monthly = buildFdoMonthlyBase(year);
  const airlineName = "Aviación general / privada";

  const monthlyByKey = new Map(monthly.map(m => [m.anioMes, m]));

  const routesRows = (fdoRoutesMonthlyAA || [])
    .filter(r => Number(r.y) === Number(year))
    .filter(r => (Number(r.p) || 0) > 0 || (Number(r.v) || 0) > 0);

  const destinosMap = new Map();
  const mainRoutesMap = new Map();
  const freqByRoute = new Map();

  let totalPaxRoutes = 0;
  let totalVuelosRoutes = 0;

  routesRows.forEach(r => {
    const label = getFdoRouteLabel(r.d);
    const pax = Number(r.p) || 0;
    const vuelos = Number(r.v) || 0;
    const freq = Number(r.f) || 0;
    const monthKey = r.am || `${year}-${String(r.m).padStart(2, "0")}`;

    totalPaxRoutes += pax;
    totalVuelosRoutes += vuelos;

    if (!monthlyByKey.has(monthKey)) {
      monthlyByKey.set(monthKey, {
        anioMes: monthKey,
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

    if (!destinosMap.has(label.code)) {
      destinosMap.set(label.code, {
        code: label.code,
        ciudad: label.ciudad,
        pais: label.pais,
        clasificacion: label.clasificacion,
        pax: 0,
        asientos: 0,
        vuelos: 0,
        frecuenciaSemanal: 0,
        distanciaKm: null,
        ask: 0,
        rpk: 0
      });
    }

    const dest = destinosMap.get(label.code);
    dest.pax += pax;
    dest.vuelos += vuelos;
    dest.frecuenciaSemanal += freq;

    if (!freqByRoute.has(label.code)) {
      freqByRoute.set(label.code, { sum: 0, count: 0 });
    }
    const freqAcc = freqByRoute.get(label.code);
    if (Number.isFinite(freq) && freq > 0) {
      freqAcc.sum += freq;
      freqAcc.count += 1;
    }

    const routeKey = [
      normalizeTextKey(label.ciudad),
      normalizeTextKey(label.pais),
      normalizeTextKey(label.clasificacion)
    ].join("|");

    if (!mainRoutesMap.has(routeKey)) {
      mainRoutesMap.set(routeKey, {
        key: routeKey,
        ciudad: label.ciudad,
        pais: label.pais,
        clasificacion: label.clasificacion,
        code: label.code,
        totalPax: 0,
        totalAsientos: 0,
        totalVuelos: 0,
        monthlyMap: new Map(),
        // Frecuencia semanal de la ruta: promedio mensual del dato f/frecuencia.
        frequencyAcc: { sum: 0, count: 0 }
      });
    }

    const routeAgg = mainRoutesMap.get(routeKey);
    routeAgg.totalPax += pax;
    routeAgg.totalVuelos += vuelos;

    if (Number.isFinite(freq) && freq > 0) {
      routeAgg.frequencyAcc.sum += freq;
      routeAgg.frequencyAcc.count += 1;
    }

    if (!routeAgg.monthlyMap.has(monthKey)) {
      routeAgg.monthlyMap.set(monthKey, {
        anioMes: monthKey,
        totalPax: 0,
        totalAsientos: 0,
        totalVuelos: 0,
        airlines: {}
      });
    }

    const routeMonth = routeAgg.monthlyMap.get(monthKey);
    routeMonth.totalPax += pax;
    routeMonth.totalVuelos += vuelos;

    if (!routeMonth.airlines[airlineName]) {
      routeMonth.airlines[airlineName] = {
        pax: 0,
        asientos: 0,
        vuelos: 0
      };
    }

    routeMonth.airlines[airlineName].pax += pax;
    routeMonth.airlines[airlineName].vuelos += vuelos;
  });

  const totalFrecuenciaSemanal = Array.from(freqByRoute.values())
    .reduce((acc, item) => {
      if (!item.count) return acc;
      return acc + (item.sum / item.count);
    }, 0);

  const monthlyFinal = Array.from(monthlyByKey.values())
    .sort((a, b) => a.anioMes.localeCompare(b.anioMes));

  const totalPaxTraffic = monthlyFinal.reduce((acc, r) => acc + (Number(r.paxTotal) || 0), 0);
  const totalVuelosTraffic = monthlyFinal.reduce((acc, r) => acc + (Number(r.vuelosTotal) || 0), 0);

  const paxCab = monthlyFinal.reduce((acc, r) => acc + (Number(r.paxCab) || 0), 0);
  const paxInt = monthlyFinal.reduce((acc, r) => acc + (Number(r.paxInt) || 0), 0);
  const vuelosCab = monthlyFinal.reduce((acc, r) => acc + (Number(r.vuelosCab) || 0), 0);
  const vuelosInt = monthlyFinal.reduce((acc, r) => acc + (Number(r.vuelosInt) || 0), 0);

  const originRouteName = getAirportBaseRouteName("FDO");

  const mainRoutes = Array.from(mainRoutesMap.values())
    .filter(r => r.totalPax > 0 || r.totalVuelos > 0)
    .sort((a, b) => b.totalPax - a.totalPax)
    .slice(0, 6)
    .map(route => {
      const monthlyRoute = Array.from(route.monthlyMap.values())
        .sort((a, b) => a.anioMes.localeCompare(b.anioMes));

      return {
        key: route.key,
        title: `${originRouteName} - ${route.ciudad}${route.code ? ` ${route.code}` : ""}`,
        ciudad: route.ciudad,
        pais: route.pais,
        clasificacion: route.clasificacion,
        codesLabel: route.code,
        totalPax: route.totalPax,
        totalAsientos: 0,
        totalVuelos: route.totalVuelos,
        // Promedio mensual de frecuencia semanal para esta ruta.
        frecuenciaSemanal: route.frequencyAcc.count ? (route.frequencyAcc.sum / route.frequencyAcc.count) : null,
        sharePaxPct: totalPaxRoutes > 0 ? (route.totalPax / totalPaxRoutes) * 100 : 0,
        shareSeatsPct: 0,
        monthly: monthlyRoute
      };
    });

  const airlines = [{
    name: airlineName,
    paxCab,
    paxInt,
    paxTotal: totalPaxTraffic,
    asientosCab: 0,
    asientosInt: 0,
    asientosTotal: 0,
    vuelosCab,
    vuelosInt,
    vuelosTotal: totalVuelosTraffic
  }];

  return {
    totalPax: totalPaxTraffic,
    totalAsientos: null,
    totalVuelos: totalVuelosTraffic,
    totalFrecuenciaSemanal,
    totalASK: 0,
    totalRPK: 0,
    loadFactor: null,
    loadFactorWeighted: null,
    routeDistanceAvgBySeats: null,
    airlinesCount: 0,
    destinos: Array.from(destinosMap.values()).sort((a, b) => b.pax - a.pax),
    airlines,
    monthly: monthlyFinal,
    mainRoutes,
    hasSeatData: false,
    source: "aeropuertos_argentina_fdo"
  };
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

    if (isFDO(selected) && fdoTrafficAA && fdoRoutesMonthlyAA.length) {
      return buildFdoOfertaDemandaSummary(year);
    }

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
    monthlyMap: new Map(),
    // Frecuencia de la ruta por operador: se promedia por mes y luego se suma por ruta.
    freqByRouteAirline: new Map()
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

  // Mismo criterio del KPI general, pero guardado dentro de cada ruta.
  if (routeAgg?.freqByRouteAirline) {
    if (!routeAgg.freqByRouteAirline.has(freqKey)) {
      routeAgg.freqByRouteAirline.set(freqKey, { sum: 0, count: 0 });
    }
    const routeFreqAcc = routeAgg.freqByRouteAirline.get(freqKey);
    routeFreqAcc.sum += freq;
    routeFreqAcc.count += 1;
  }
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

    // Frecuencia semanal de la ruta: suma de promedios mensuales por ruta-operador.
    const frecuenciaSemanalRuta = Array.from(route.freqByRouteAirline?.values?.() || [])
      .reduce((acc, item) => {
        if (!item.count) return acc;
        return acc + (item.sum / item.count);
      }, 0);

return {
  key: route.key,
  title: `${originRouteName} - ${destinationDisplay}`,
  ciudad: route.ciudad,
  pais: route.pais,
  clasificacion: route.clasificacion || "",
  codesLabel,
  totalPax: route.totalPax,
  totalAsientos: route.totalAsientos,
  totalVuelos: route.totalVuelos,
  frecuenciaSemanal: frecuenciaSemanalRuta > 0 ? frecuenciaSemanalRuta : null,
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
  const hasAsientosCab = asientosCab.some(v => v > 0);
  const hasAsientosInt = asientosInt.some(v => v > 0);
  const hasSeatData = hasAsientosCab || hasAsientosInt;

  const subtitleEl = q("odMonthlySubtitle");
  if (subtitleEl) {
    subtitleEl.innerHTML = hasSeatData
      ? `Asientos ofrecidos <span class="od-sub-asientos-cab">cabotaje</span>` +
        (hasAsientosInt ? ` e <span class="od-sub-asientos-int">internacional</span>` : ``) +
        ` y pasajeros transportados <span class="od-sub-pax-cab">cabotaje</span>` +
        (hasPaxInt ? ` e <span class="od-sub-pax-int">internacional</span>` : ``)
      : `Pasajeros transportados <span class="od-sub-pax-cab">cabotaje</span>` +
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
      barPercentage: hasSeatData ? 0.34 : 0.52,
      categoryPercentage: 0.82
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
      barPercentage: hasSeatData ? 0.34 : 0.52,
      categoryPercentage: 0.82
    });
  }

  if (hasAsientosCab) {
    datasets.push({
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
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22, bottom: 4 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: true,
          padding: 8,
          boxWidth: 10,
          boxHeight: 10,
          titleFont: { size: 10, weight: "600" },
          bodyFont: { size: 9 },
          callbacks: {
            title: items => {
              const idx = items[0]?.dataIndex ?? 0;
              const row = dataRows[idx];
              if (!row) return "";

              const d = parseFechaFlexible(row.anioMes);
              const mes = d ? d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "") : row.anioMes;
              const anio = d ? d.getFullYear() : "";
              const totalPaxMes = Number(row.paxCab || 0) + Number(row.paxInt || 0);
              const totalAsientosMes = Number(row.asientosCab || 0) + Number(row.asientosInt || 0);

              return hasSeatData
                ? `${mes} ${anio} · ${totalPaxMes.toLocaleString("es-AR")} pasajeros · ${totalAsientosMes.toLocaleString("es-AR")} asientos`
                : `${mes} ${anio} · ${totalPaxMes.toLocaleString("es-AR")} pasajeros`;
            },
            label: ctx => {
              const idx = ctx.dataIndex;
              const isInternational = /internacional/i.test(String(ctx.dataset.label || ""));
              const mercado = isInternational ? "Internacional" : "Cabotaje";
              const value = Number(ctx.raw || 0);

              if (value === 0) return null;

              if (ctx.dataset.type === "line") {
                return `${mercado}: ${value.toLocaleString("es-AR")} asientos`;
              }

              return `${mercado}: ${value.toLocaleString("es-AR")} pasajeros`;
            },
            labelColor: ctx => {
              const color = ctx.dataset.borderColor || "#2A6FB0";
              return { borderColor: color, backgroundColor: color };
            }
          },
          filter: ctx => Number(ctx.raw || 0) > 0
        }
      },
      scales: {
        x: {
          stacked: false,
          grid: { color: "#e6edf4" },
          ticks: {
            color: "#6f7d8c",
            font: { size: 9 },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          stacked: false,
          beginAtZero: true,
          grid: { color: "#e6edf4" },
          ticks: {
            color: "#6f7d8c",
            font: { size: 9 },
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

  const sourceRows = rows || [];
  const hasSeatData = sourceRows.some(r => (Number(r.asientosTotal) || 0) > 0);
  const metricPrefix = hasSeatData ? "asientos" : "pax";
  const metricTotalKey = hasSeatData ? "asientosTotal" : "paxTotal";
  const metricCabKey = hasSeatData ? "asientosCab" : "paxCab";
  const metricIntKey = hasSeatData ? "asientosInt" : "paxInt";
  const metricLabel = hasSeatData ? "asientos" : "pasajeros";

  const allRows = sourceRows
    .filter(r => (Number(r[metricTotalKey]) || 0) > 0)
    .sort((a, b) => (Number(b[metricTotalKey]) || 0) - (Number(a[metricTotalKey]) || 0));

  const dataRows = allRows.slice(0, 6);
  if (!dataRows.length) return;

  const totalMetricAll = allRows.reduce((acc, r) => acc + (Number(r[metricTotalKey]) || 0), 0);

  const fullLabels = dataRows.map(r => r.name);
  const labels = fullLabels.map(name => splitLabelTwoLines(name, 12));

  const cabValues = dataRows.map(r => Math.round(Number(r[metricCabKey]) || 0));
  const intValues = dataRows.map(r => Math.round(Number(r[metricIntKey]) || 0));
  const totalValues = dataRows.map(r => Math.round(Number(r[metricTotalKey]) || 0));

  const hasInt = intValues.some(v => v > 0);

  const subtitleEl = q("odAirlinesSubtitle");
  if (subtitleEl) {
    subtitleEl.innerHTML = hasSeatData
      ? `Asientos ofrecidos <span class="od-sub-asientos-cab">cabotaje</span>` +
        (hasInt ? ` e <span class="od-sub-asientos-int">internacional</span>` : ``) +
        ` por operador`
      : `Pasajeros transportados <span class="od-sub-pax-cab">cabotaje</span>` +
        (hasInt ? ` e <span class="od-sub-pax-int">internacional</span>` : ``) +
        ` por operador`;
  }

  const percents = dataRows.map(r =>
    totalMetricAll > 0 ? ((Number(r[metricTotalKey]) || 0) / totalMetricAll) * 100 : 0
  );

  const datasets = [
    {
      label: "Cabotaje",
      data: cabValues,
      backgroundColor: hasSeatData ? "rgba(42, 111, 176, 0.22)" : "rgba(117, 170, 219, 0.35)",
      borderColor: hasSeatData ? "#2A6FB0" : "#75AADB",
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
      backgroundColor: hasSeatData ? "rgba(28, 124, 27, 0.16)" : "rgba(62, 209, 4, 0.18)",
      borderColor: hasSeatData ? "#1C7C1B" : "#3ed104",
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
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      layout: { padding: { left: 2, right: 34, top: 0, bottom: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => fullLabels[items[0].dataIndex],
            label: ctx => {
              const value = Number(ctx.raw || 0);
              return `${ctx.dataset.label}: ${value.toLocaleString("es-AR")} ${metricLabel}`;
            },
            footer: items => {
              const idx = items[0].dataIndex;
              const total = totalValues[idx] || 0;
              const pct = percents[idx] || 0;
              return `Total: ${total.toLocaleString("es-AR")} ${metricLabel} (${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          grid: { color: "#e6edf4" },
          ticks: {
            color: "#6f7d8c",
            font: { size: 9 },
            maxTicksLimit: 4,
            callback: value => Number(value).toLocaleString("es-AR")
          }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { color: "#334150", font: { size: 9 } }
        }
      }
    },
    plugins: [totalLabelPlugin]
  });
}

function paginateTopRoutes() {
  const routesPage = document.getElementById("odRoutesExtraPage");
  const mainList = document.getElementById("odTopRoutes");
  const extraList = document.getElementById("odTopRoutesExtra");

  // Desde esta versión, las 6 rutas 2025 se muestran juntas en una hoja propia.
  // La hoja histórica queda siempre separada como tercera página.
  if (extraList) extraList.innerHTML = "";
  if (!routesPage || !mainList) return;

  const routeCount = Array.from(mainList.children).filter(el => !el.classList.contains("od-empty")).length;
  const shouldHideRoutesPage = routeCount === 0;

routesPage.classList.toggle("is-hidden", shouldHideRoutesPage);
routesPage.style.display = shouldHideRoutesPage ? "none" : "";
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
  const hasSeatData = monthlyRows.some(m => (Number(m.totalAsientos) || 0) > 0);

  const airlineStats = Array.from(new Set(
    monthlyRows.flatMap(m => Object.keys(m.airlines || {}))
  )).map(name => {
    const totalPax = monthlyRows.reduce((acc, m) => acc + (m.airlines?.[name]?.pax || 0), 0);
    const totalAsientos = monthlyRows.reduce((acc, m) => acc + (m.airlines?.[name]?.asientos || 0), 0);

    return { name, totalPax, totalAsientos };
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
      barPercentage: hasSeatData ? 0.52 : 0.62,
      categoryPercentage: 0.92
    });

    if (hasSeatData) {
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
    }
  });

  const totalPaxSeries = monthlyRows.map(m => Math.round(m.totalPax || 0));
  const extremaPlugin = buildExtremaPlugin(`routeExtrema_${canvasId}`, totalPaxSeries);
  const plugins = hasSeatData
    ? [extremaPlugin, buildRouteRightLabelsPlugin(`routeRightLabels_${canvasId}`, airlineStats)]
    : [extremaPlugin];

  canvas._chart = new Chart(canvas, {
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20, right: hasSeatData ? 120 : 18, bottom: 4 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: true,
          padding: 8,
          boxWidth: 10,
          boxHeight: 10,
          titleFont: { size: 10, weight: "600" },
          bodyFont: { size: 9 },
          callbacks: {
            title: items => {
              const idx = items[0]?.dataIndex ?? 0;
              const row = monthlyRows[idx];
              if (!row) return "";

              const d = parseFechaFlexible(row.anioMes);
              const mes = d ? d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "") : row.anioMes;
              const anio = d ? d.getFullYear() : "";
              const totalPaxMes = Number(row.totalPax || 0);
              const totalAsientosMes = Number(row.totalAsientos || 0);

              return hasSeatData
                ? `${mes} ${anio} · ${totalPaxMes.toLocaleString("es-AR")} pasajeros · ${totalAsientosMes.toLocaleString("es-AR")} asientos`
                : `${mes} ${anio} · ${totalPaxMes.toLocaleString("es-AR")} pasajeros`;
            },
            label: ctx => {
              const rawLabel = String(ctx.dataset.label || "");
              const airline = rawLabel.replace(/\s+(asientos|pasajeros)$/i, "");
              const idx = ctx.dataIndex;

              if (ctx.dataset.type === "line") {
                const asientos = Number(ctx.raw || 0);
                if (asientos === 0) return null;
                return `${airline}: ${asientos.toLocaleString("es-AR")} asientos`;
              }

              const pax = Number(ctx.raw || 0);
              if (pax === 0) return null;
              return `${airline}: ${pax.toLocaleString("es-AR")} pasajeros`;
            },
            labelColor: ctx => {
              const color = ctx.dataset.borderColor || "#2A6FB0";
              return { borderColor: color, backgroundColor: color };
            }
          },
          filter: ctx => Number(ctx.raw || 0) > 0
        }
      },
      scales: {
        x: {
          stacked: false,
          grid: { color: "#eef3f8" },
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
          grid: { color: "#eef3f8" },
          ticks: {
            color: "#6f7d8c",
            font: { size: 8 },
            callback: value => Number(value).toLocaleString("es-AR")
          }
        }
      }
    },
    plugins
  });
}

 function isInternationalRoute(route) {
  return normalizeTextKey(route?.clasificacion || "").includes("internacional");
}

function renderInternationalRouteNotes(routes) {
  const noteMain = q("odIntlRoutesNoteMain");
  const noteExtra = q("odIntlRoutesNoteExtra");
  const dataRoutes = (routes || [])
  .slice()
  .filter(route => odRoutePassesMinPaxShare(route))
  .sort((a, b) => (b.totalPax || 0) - (a.totalPax || 0))
  .slice(0, 6);
  const hasIntl = dataRoutes.some(isInternationalRoute);

  if (noteMain) noteMain.style.display = hasIntl ? "block" : "none";
  if (noteExtra) noteExtra.style.display = "none";
}
function odSetTopRoutesTitles(iata, summary) {
  const airportName = odGetAirportNarrativeName(iata);

  const hasSeatData =
    Number(summary?.totalAsientos || 0) > 0 ||
    (summary?.mainRoutes || []).some(route => Number(route.totalAsientos || 0) > 0);

  // Para casi todos los aeropuertos: pasajeros y asientos.
  // Para FDO u otros casos sin asientos: pasajeros y movimientos.
  const metricText = hasSeatData
    ? "Pasajeros y asientos"
    : "Pasajeros y movimientos";

  const fullTitle = `${metricText} en las principales rutas del ${airportName}`;

  const routesPage = q("odRoutesExtraPage");
  const topRoutesEl = q("odTopRoutes");

  // Título grande de la hoja: antes decía "Principales rutas 2025".
  // Lo dejamos más corto para que no se corte en el encabezado.
  const pageTitle =
    routesPage?.querySelector(".od-sheet-header .sheet-airport-name") ||
    routesPage?.querySelector(".sheet-airport-name");

  if (pageTitle) {
    pageTitle.textContent = `Principales rutas · ${airportName} ${YEAR_REF}`;
  }

  // Título interno del panel: antes decía "PRINCIPALES RUTAS".
  const panel =
    topRoutesEl?.closest(".od-panel") ||
    topRoutesEl?.closest(".od-panel-routes-page") ||
    routesPage;

  const panelTitle =
    panel?.querySelector(".od-panel-title") ||
    Array.from(document.querySelectorAll(".od-panel-title"))
      .find(el => normalizeTextKey(el.textContent).includes("principales rutas"));

  if (panelTitle) {
    panelTitle.textContent = fullTitle;
  }
}
function renderTopRoutesCharts(routes) {
  const topRoutesEl = q("odTopRoutes");
  if (!topRoutesEl) return;

const dataRoutes = (routes || [])
  .slice()
  .filter(route => odRoutePassesMinPaxShare(route))
  .sort((a, b) => (b.totalPax || 0) - (a.totalPax || 0))
  .slice(0, 6);

  if (!dataRoutes.length) {
    topRoutesEl.innerHTML = '<div class="od-empty">Sin datos</div>';
    renderInternationalRouteNotes([]);
    paginateTopRoutes();
    return;
  }

  topRoutesEl.innerHTML = dataRoutes.map((route, idx) => {
    const hasSeats = Number(route.totalAsientos || 0) > 0;
    const secondaryMetric = hasSeats
      ? `<span class="od-route-metric od-route-metric-seats">
          <span class="od-mini-icon od-mini-icon-lines" aria-hidden="true"></span>
          <span class="od-route-metric-label">Asientos</span>
          <span class="od-route-metric-value">${escapeHtml(formatNumber(Math.round(route.totalAsientos)))}</span>
          <span class="od-route-metric-share">(${escapeHtml(formatShareShort(route.shareSeatsPct))})</span>
        </span>`
      : `<span class="od-route-metric od-route-metric-seats">
          <span class="od-mini-icon od-mini-icon-lines" aria-hidden="true"></span>
          <span class="od-route-metric-label">Mov.</span>
          <span class="od-route-metric-value">${escapeHtml(formatNumber(Math.round(route.totalVuelos || 0)))}</span>
        </span>`;

    const frequencyMetric = Number.isFinite(Number(route.frecuenciaSemanal)) && Number(route.frecuenciaSemanal) > 0
      ? `<span class="od-route-metric-sep">·</span>
         <span class="od-route-metric od-route-metric-frequency">
           <span class="od-mini-icon od-mini-icon-frequency" aria-hidden="true"></span>
           <span class="od-route-metric-label">Frec. semanal</span>
           <span class="od-route-metric-value">${escapeHtml(formatFrequencyShort(route.frecuenciaSemanal))}</span>
         </span>`
      : "";

    return `
      <div class="od-route-card-chart">
        <div class="od-route-card-head">
          <div class="od-route-card-title">${escapeHtml(route.title)}</div>

          <div class="od-route-card-metrics-inline">
            <span class="od-route-metric od-route-metric-pax">
              <span class="od-mini-icon od-mini-icon-bars" aria-hidden="true"></span>
              <span class="od-route-metric-label">Pasajeros</span>
              <span class="od-route-metric-value">${escapeHtml(formatNumber(Math.round(route.totalPax)))}</span>
              <span class="od-route-metric-share">(${escapeHtml(formatShareShort(route.sharePaxPct))})</span>
            </span>

            <span class="od-route-metric-sep">·</span>
            ${secondaryMetric}
            ${frequencyMetric}
          </div>
        </div>

        <div class="od-route-chart-wrap">
          <canvas id="odRouteChart_${idx}"></canvas>
        </div>
      </div>
    `;
  }).join("");

  paginateTopRoutes();
  renderInternationalRouteNotes(dataRoutes);

  dataRoutes.forEach((route, idx) => {
    renderSingleRouteChart(`odRouteChart_${idx}`, route);
  });
}

/* ============================================================
   HISTÓRICO DE RUTAS
   ============================================================ */

const HISTORIC_ROUTE_COLORS = [
  "#2A6FB0", "#75AADB", "#F28C28", "#2CA25F", "#7B61C9",
  "#C62828", "#8C6D5A", "#19A7A0", "#D4A000", "#7A7F87", "#B0B7BF"
];
const HISTORIC_ROUTE_MIN_SHARE_PCT = 1.0;
const HISTORIC_ROUTE_DOMINANT_SHARE_PCT = 95;
function getHistoricRouteLimit(iata) {
  const code = clean(iata).toUpperCase();
  return (code === "AEP" || code === "EZE") ? 10 : 6;
}

function getHistoricRouteColor(index) {
  return HISTORIC_ROUTE_COLORS[index % HISTORIC_ROUTE_COLORS.length];
}

function buildHistoricRouteTitle(selected, route) {
  const originRouteName = getAirportBaseRouteName(selected);
  return `${originRouteName} - ${route.ciudad}${route.codesLabel ? ` ${route.codesLabel}` : ""}`;
}
function buildHistoricRouteLegendLabel(selected, route) {
  if (!route || route.key === "__otras__") return "Otras rutas";

  const city = clean(route.ciudad);
  const code = clean(route.codesLabel);

  if (!city && !code) return "Ruta";

  return `${city}${code ? ` ${code}` : ""}`;
}
function addHistoricRouteRow(acc, row) {
  const routeKey = row.routeKey;
  const year = Number(row.year);
  const pax = Number(row.pax || 0);
  if (!routeKey || !Number.isFinite(year) || pax <= 0) return;

  if (!acc.routes.has(routeKey)) {
    acc.routes.set(routeKey, {
      key: routeKey,
      ciudad: row.ciudad,
      pais: row.pais || "",
      clasificacion: row.clasificacion || "",
      codesLabel: row.codesLabel || "",
      totalPax: 0,
      annual: new Map()
    });
  }

  const route = acc.routes.get(routeKey);
  route.totalPax += pax;
  route.annual.set(year, (route.annual.get(year) || 0) + pax);
  acc.years.add(year);
  acc.totalByYear.set(year, (acc.totalByYear.get(year) || 0) + pax);
}

function buildHistoricRouteSeriesFromGeneral(iata) {
  const selected = clean(iata).toUpperCase();
  const acc = { routes: new Map(), years: new Set(), totalByYear: new Map() };

  const rows = (rutasOfertaRows || []).filter(r =>
    (r.endpointA === selected || r.endpointB === selected) &&
    clean(r.tipoOperacion).toLowerCase().includes("comercial")
  );

  rows.forEach(r => {
    const otherCodeRaw = (r.endpointA === selected) ? r.endpointB : r.endpointA;
    if (!otherCodeRaw || otherCodeRaw === selected) return;

    const otherMeta = getRouteMeta(otherCodeRaw);
    const otherNormalizedCode = clean(otherMeta?.iata || otherCodeRaw).toUpperCase();
    const destinationCode = getEquivalentDestinationCode(selected, otherNormalizedCode);
    if (!destinationCode || destinationCode === selected) return;

const isInternational = clean(r.clasificacion).toLowerCase() === "internacional";
const label = getDestinationLabel(destinationCode, isInternational);

const codesLabel =
  destinationCode === "BUE"
    ? "AEP+EZE"
    : otherNormalizedCode;

const routeKey = [
  normalizeTextKey(label.ciudad || destinationCode),
  normalizeTextKey(label.pais || ""),
  normalizeTextKey(r.clasificacion || "")
].join("|");

addHistoricRouteRow(acc, {
  routeKey,
  year: r.year,
  pax: Number.isFinite(r.pax) ? r.pax : 0,
  ciudad: label.ciudad || destinationCode,
  pais: label.pais || "",
  clasificacion: clean(r.clasificacion),
  codesLabel
});
  });

  return buildHistoricRouteSeriesFromAccumulator(selected, acc);
}

function buildFdoHistoricRouteSeries() {
  const selected = "FDO";
  const acc = { routes: new Map(), years: new Set(), totalByYear: new Map() };

  const monthlyRows = fdoRoutesMonthlyAA || [];
  const monthlyYears = new Set(
    monthlyRows
      .map(r => Number(r.y))
      .filter(y => Number.isFinite(y))
  );

  /*
    Usamos la fuente mensual cuando existe.
    La fuente anual se usa como complemento para años que no están
    en el archivo mensual, evitando duplicar 2025 si aparece en ambos.
  */
  const annualComplementRows = (fdoRoutesAnnualAA || [])
    .filter(r => {
      const y = Number(r.y);
      return Number.isFinite(y) && !monthlyYears.has(y);
    });

  const rows = monthlyRows.concat(annualComplementRows);

  rows.forEach(r => {
    const year = Number(r.y);
    const pax = Number(r.p) || 0;

    if (!Number.isFinite(year) || pax <= 0) return;

    const label = getFdoRouteLabel(r.d);

    const routeKey = [
      normalizeTextKey(label.ciudad),
      normalizeTextKey(label.pais || ""),
      normalizeTextKey(label.clasificacion || "")
    ].join("|");

    addHistoricRouteRow(acc, {
      routeKey,
      year,
      pax,
      ciudad: label.ciudad,
      pais: label.pais || "",
      clasificacion: label.clasificacion || "",
      codesLabel: label.code || ""
    });
  });

  return buildHistoricRouteSeriesFromAccumulator(selected, acc);
}

function buildHistoricRouteSeriesFromAccumulator(selected, acc) {
  const years = Array.from(acc.years).sort((a, b) => a - b);
  const routes = Array.from(acc.routes.values()).sort((a, b) => b.totalPax - a.totalPax);
  const limit = getHistoricRouteLimit(selected);

  const totalPaxAll = routes.reduce(
    (sum, route) => sum + (Number(route.totalPax) || 0),
    0
  );

  /*
    Criterio:
    - La ruta principal siempre se muestra.
    - Las demás solo se muestran si alcanzan al menos 1% del total histórico.
    - Las rutas menores quedan agrupadas como "Otras rutas".
  */
  const significantRoutes = routes.filter((route, idx) => {
    if (idx === 0) return true;

    const share = totalPaxAll > 0
      ? (Number(route.totalPax || 0) / totalPaxAll) * 100
      : 0;

    return share >= HISTORIC_ROUTE_MIN_SHARE_PCT;
  });

  const selectedRoutes = significantRoutes.slice(0, limit);

  const datasets = selectedRoutes.map((route, idx) => {
    const totalPax = Number(route.totalPax) || 0;
    const historicSharePct = totalPaxAll > 0
      ? (totalPax / totalPaxAll) * 100
      : 0;

    const color = getHistoricRouteColor(idx);

    return {
      key: route.key,
      label: buildHistoricRouteTitle(selected, route),
      legendLabel: buildHistoricRouteLegendLabel(selected, route),
      data: years.map(year => Math.round(route.annual.get(year) || 0)),
      totalPax,
      historicSharePct,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 0.5
    };
  });

  const otherData = years.map(year => {
    const total = Number(acc.totalByYear.get(year) || 0);
    const selectedTotal = selectedRoutes.reduce(
      (sum, route) => sum + (Number(route.annual.get(year)) || 0),
      0
    );

    return Math.max(0, Math.round(total - selectedTotal));
  });

  const otherTotalPax = otherData.reduce((a, b) => a + b, 0);

  if (otherTotalPax > 0) {
    datasets.push({
      key: "__otras__",
      label: "Otras rutas",
      legendLabel: "Otras rutas",
      data: otherData,
      totalPax: otherTotalPax,
      historicSharePct: totalPaxAll > 0
        ? (otherTotalPax / totalPaxAll) * 100
        : 0,
      backgroundColor: "#C9D1DA",
      borderColor: "#AEB8C3",
      borderWidth: 0.5
    });
  }

  return {
    years,
    routes,
    selectedRoutes,
    datasets,
    limit,
    totalPaxAll,
    otherTotalPax,
    hasOtherRoutes: otherTotalPax > 0,
    hasOnlyOneSignificantRoute: selectedRoutes.length === 1,
    hasData: years.length > 0 && datasets.length > 0
  };
}

function buildHistoricRouteSeries(iata) {
  const code = clean(iata).toUpperCase();
  if (isFDO(code)) return buildFdoHistoricRouteSeries();
  return buildHistoricRouteSeriesFromGeneral(code);
}
function odCompactAirportNameForTitle(iata) {
  const code = clean(iata).toUpperCase();
  const a = aeropuertos.find(x =>
    clean(firstNonEmpty(x, ["IATA"])).toUpperCase() === code
  );

  if (!a) return code;

  return getAirportSheetTitle(a);
}

function odSetHistoricTrafficTitle(iata) {
  const block = q("historicTrafficBlock");
  if (!block) return;

  const titleEl =
    q("historicTrafficTitle") ||
    block.querySelector(".historic-traffic-title") ||
    block.querySelector(".od-panel-title");

  if (!titleEl) return;

  titleEl.textContent = `Tráfico histórico · ${odCompactAirportNameForTitle(iata)}`;
}

function odSetHistoricRoutesTitle(iata) {
  const canvas = q("odHistoricRoutesChart");
  if (!canvas) return;

  const panel =
    canvas.closest(".od-panel") ||
    canvas.closest(".od-historic-routes-panel") ||
    canvas.parentElement;

  if (!panel) return;

  const titleEl =
    q("odHistoricRoutesTitle") ||
    panel.querySelector(".od-panel-title");

  if (!titleEl) return;

  titleEl.textContent = `Evolución histórica de pasajeros en las rutas aéreas · ${odCompactAirportNameForTitle(iata)}`;
}
function renderHistoricRoutesChart(iata) {
  const canvas = q("odHistoricRoutesChart");
  const subtitle = q("odHistoricRoutesSubtitle");
  const page = q("odHistoricPage");

  if (!canvas || typeof Chart === "undefined") return;

  if (canvas._chart) {
    canvas._chart.destroy();
    canvas._chart = null;
  }

  const data = buildHistoricRouteSeries(iata);

  if (!data?.hasData) {
    if (page) page.classList.add("is-hidden");
    return;
  }

  if (page) page.classList.remove("is-hidden");
odSetHistoricRoutesTitle(iata);
  if (subtitle) {
    let topText = "";

    if (data.hasOnlyOneSignificantRoute) {
      topText = data.hasOtherRoutes
        ? "Ruta histórica principal por pasajeros acumulados; las conexiones de menor peso se agrupan como Otras rutas."
        : "Ruta histórica principal por pasajeros acumulados, según años disponibles en la fuente de rutas.";
    } else {
      const countText = data.selectedRoutes.length === 10
        ? "Diez"
        : data.selectedRoutes.length === 6
          ? "Seis"
          : formatNumber(data.selectedRoutes.length);

      topText = `${countText} principales rutas históricas por pasajeros acumulados, más resto de rutas, según años disponibles en la fuente de rutas.`;
    }

    subtitle.textContent = topText;
  }

  canvas._chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: data.years.map(String),
      datasets: data.datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: {
        padding: {
          top: 4,
          right: 4,
          bottom: 2,
          left: 0
        }
      },
      plugins: {
        legend: {
          position: "right",
          align: "center",
          labels: {
            boxWidth: 9,
            boxHeight: 9,
            padding: 8,
            font: { size: 8 },
            generateLabels(chart) {
              return (chart.data.datasets || []).map((ds, idx) => ({
                text: `${ds.legendLabel || ds.label} · ${formatShareShort(Number(ds.historicSharePct || 0))}`,
                fillStyle: ds.backgroundColor,
                strokeStyle: ds.borderColor || ds.backgroundColor,
                lineWidth: 1,
                hidden: !chart.isDatasetVisible(idx),
                datasetIndex: idx
              }));
            }
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const ds = ctx.dataset || {};
              const value = Number(ctx.raw || 0).toLocaleString("es-AR");
              const share = Number.isFinite(Number(ds.historicSharePct))
                ? ` · participación histórica ${formatShareShort(Number(ds.historicSharePct))}`
                : "";

              return `${ds.label}: ${value} pasajeros${share}`;
            },
            footer: items => {
              const total = items.reduce((acc, item) => acc + (Number(item.raw) || 0), 0);
              return `Total seleccionado: ${total.toLocaleString("es-AR")} pasajeros`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: "#6f7d8c",
            font: {
  size: 9.5,
  weight: "600"
},
            maxRotation: 0
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: "#e6edf4" },
          ticks: {
            color: "#6f7d8c",
            font: { size: 8 },
            callback: value => Number(value).toLocaleString("es-AR")
          }
        }
      }
    }
  });
}
function buildTrafficMonthlySeries(iataUpper, mode, kind) {
  const selected = clean(iataUpper).toUpperCase();
  const rowsAll = kind === "mov"
    ? movimientosMensualRows.filter(r => r.iata === selected)
    : pasajerosMensualRows.filter(r => r.iata === selected);

  if (!rowsAll.length) return [];

  const datasetCab = kind === "mov" ? MOV_DATASET_CAB : PAX_DATASET_CAB;
  const datasetInt = kind === "mov" ? MOV_DATASET_INT : PAX_DATASET_INT;
  const datasetTotal = kind === "mov" ? MOV_DATASET_TOTAL : PAX_DATASET_TOTAL;

  if (mode === "cabotaje" || mode === "internacional") {
    const target = mode === "cabotaje" ? datasetCab : datasetInt;

    return rowsAll
      .filter(r => r.dataset === target)
      .sort((a, b) => a.date - b.date);
  }

  const acc = new Map();

  rowsAll.forEach(r => {
    if (![datasetCab, datasetInt, datasetTotal].includes(r.dataset)) return;

    const year = r.date.getFullYear();
    const month = r.date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    if (!acc.has(key)) {
      acc.set(key, {
        date: new Date(year, month - 1, 1),
        valor: 0
      });
    }

    acc.get(key).valor += Number(r.valor) || 0;
  });

  return Array.from(acc.values())
    .filter(r => r.valor > 0)
    .sort((a, b) => a.date - b.date);
}

function annualTotalsFromMonthlyRows(rows) {
  const acc = new Map();

  (rows || []).forEach(r => {
    const y = r.date.getFullYear();
    acc.set(y, (acc.get(y) || 0) + (Number(r.valor) || 0));
  });

  return Array.from(acc.entries())
    .map(([year, valor]) => ({ year, valor }))
    .sort((a, b) => a.year - b.year);
}

function buildHistoricAirportTrafficChartData(iata) {
  const code = clean(iata).toUpperCase();

  const paxCab = annualTotalsFromMonthlyRows(
    buildTrafficMonthlySeries(code, "cabotaje", "pax")
  );

  const paxInt = annualTotalsFromMonthlyRows(
    buildTrafficMonthlySeries(code, "internacional", "pax")
  );

  const movTotal = annualTotalsFromMonthlyRows(
    buildTrafficMonthlySeries(code, "total", "mov")
  );

  const yearsSet = new Set();

  paxCab.forEach(r => yearsSet.add(r.year));
  paxInt.forEach(r => yearsSet.add(r.year));
  movTotal.forEach(r => yearsSet.add(r.year));

  const years = Array.from(yearsSet)
    .filter(y => y >= 2001 && y <= YEAR_REF)
    .sort((a, b) => a - b);

  const cabMap = new Map(paxCab.map(r => [r.year, r.valor]));
  const intMap = new Map(paxInt.map(r => [r.year, r.valor]));
  const movMap = new Map(movTotal.map(r => [r.year, r.valor]));

  return {
    years,
    paxCab: years.map(y => Math.round(cabMap.get(y) || 0)),
    paxInt: years.map(y => Math.round(intMap.get(y) || 0)),
    movTotal: years.map(y => Math.round(movMap.get(y) || 0)),
    hasData: years.length > 0
  };
}

function ensureHistoricAirportChartHost() {
  const block = q("historicTrafficBlock");
  const textEl = q("historicTrafficText");

  if (!block || !textEl) return null;

  let wrap = q("odHistoricAirportTrafficChartWrap");

  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "odHistoricAirportTrafficChartWrap";
    wrap.className = "od-historic-airport-chart-wrap";

wrap.innerHTML = `
  <div class="od-historic-airport-chart-head">
    <div class="od-historic-airport-chart-title">Evolución histórica de pasajeros y aeronaves</div>
    <div id="odHistoricAirportTrafficSubtitle" class="od-historic-airport-chart-subtitle"></div>
  </div>
  <div class="od-historic-airport-canvas-wrap">
    <canvas id="odHistoricAirportTrafficChart"></canvas>
  </div>
  <div id="odHistoricAirportTrafficSource" class="od-historic-airport-source"></div>
`;
  }

  // El gráfico debe ir antes del texto narrativo general.
  if (wrap.parentElement !== textEl.parentElement || wrap.nextElementSibling !== textEl) {
    textEl.insertAdjacentElement("beforebegin", wrap);
  }

  return wrap;
}
function odForceChartResize(chart, attempt = 0) {
  if (!chart || !chart.canvas) return;

  const canvas = chart.canvas;
  const parent = canvas.parentElement;
  const box = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();

  const hasUsableSize =
    box &&
    box.width > 40 &&
    box.height > 40;

  if (hasUsableSize || attempt >= 12) {
    chart.resize();
    chart.update("none");
    return;
  }

  requestAnimationFrame(() => {
    odForceChartResize(chart, attempt + 1);
  });
}
function renderHistoricAirportTrafficChart(iata) {
  const wrap = ensureHistoricAirportChartHost();
  if (!wrap || typeof Chart === "undefined") return;

const canvas = q("odHistoricAirportTrafficChart");
const source = q("odHistoricAirportTrafficSource");
const subtitleEl = q("odHistoricAirportTrafficSubtitle");

  if (!canvas) return;

  if (canvas._chart) {
    canvas._chart.destroy();
    canvas._chart = null;
  }

  const data = buildHistoricAirportTrafficChartData(iata);

  if (!data.hasData) {
    wrap.style.display = "none";
    return;
  }

  wrap.style.display = "";

  const hasInt = data.paxInt.some(v => v > 0);
  const hasMov = data.movTotal.some(v => v > 0);
if (subtitleEl) {
  subtitleEl.innerHTML =
    `Pasajeros <span class="od-sub-pax-cab">cabotaje</span>` +
    (hasInt ? ` e <span class="od-sub-pax-int">internacional</span>` : ``) +
    (hasMov ? ` y <span class="od-sub-mov-total">movimientos totales</span>` : ``);
}
  const datasets = [
    {
      type: "bar",
      label: "Pasajeros cabotaje",
      data: data.paxCab,
      backgroundColor: "rgba(117, 170, 219, 0.38)",
      borderColor: "#75AADB",
      borderWidth: 1,
      stack: "pax",
      yAxisID: "y",
      order: 2
    }
  ];

  if (hasInt) {
    datasets.push({
      type: "bar",
      label: "Pasajeros internacional",
      data: data.paxInt,
      backgroundColor: "rgba(62, 209, 4, 0.18)",
      borderColor: "#3ed104",
      borderWidth: 1,
      stack: "pax",
      yAxisID: "y",
      order: 2
    });
  }

  if (hasMov) {
    datasets.push({
      type: "line",
      label: "Movimientos",
      data: data.movTotal,
      borderColor: "#C6923A",
      backgroundColor: "rgba(198, 146, 58, 0)",
      pointBackgroundColor: "#C6923A",
      pointBorderColor: "#C6923A",
      pointRadius: 2,
      pointHoverRadius: 3,
      borderWidth: 2,
      tension: 0.22,
      yAxisID: "y1",
      order: 1
    });
  }

  canvas._chart = new Chart(canvas, {
    data: {
      labels: data.years.map(String),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
legend: {
  display: false
},
        tooltip: {
          callbacks: {
            label: ctx => {
              const value = Number(ctx.raw || 0).toLocaleString("es-AR");
              return ctx.dataset.yAxisID === "y1"
                ? `${ctx.dataset.label}: ${value} movimientos`
                : `${ctx.dataset.label}: ${value} pasajeros`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: "#eef3f8" },
          ticks: {
            color: "#6f7d8c",
            font: { size: 8 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 13
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          position: "left",
          grid: { color: "#e6edf4" },
          ticks: {
            color: "#6f7d8c",
            font: { size: 8 },
            callback: value => Number(value).toLocaleString("es-AR")
          },
          title: {
            display: true,
            text: "Pasajeros",
            color: "#6f7d8c",
            font: { size: 9 }
          }
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: {
            color: "#6f7d8c",
            font: { size: 8 },
            callback: value => Number(value).toLocaleString("es-AR")
          },
          title: {
            display: true,
            text: "Movimientos",
            color: "#6f7d8c",
            font: { size: 9 }
          }
        }
      }
    }
  });
odForceChartResize(canvas._chart);

setTimeout(() => {
  odForceChartResize(canvas._chart);
}, 150);

setTimeout(() => {
  odForceChartResize(canvas._chart);
}, 400);
  if (source) {
    source.textContent = isFDO(iata)
      ? "Fuente: elaborado por GREyF ORSNA con datos de Aeropuertos Argentina."
      : "Fuente: elaborado por GREyF ORSNA con datos de SIAC ANAC.";
  }
}

function getHistoricRoutesPanel() {
  const canvas = q("odHistoricRoutesChart");
  if (!canvas) return null;

  return (
    canvas.closest(".od-panel") ||
    canvas.closest(".od-chart-card") ||
    canvas.closest(".od-historic-chart-wrap") ||
    canvas.parentElement
  );
}

function ensureHistoricRoutesInsideTrafficBlock() {
  const block = q("historicTrafficBlock");
  const textEl = q("historicTrafficText");
  const routesPanel = getHistoricRoutesPanel();

  if (!block || !textEl || !routesPanel || routesPanel === block) return routesPanel;

  /*
    El orden deseado dentro del marco Tráfico histórico es:
    KPIs -> gráfico pasajeros/aeronaves -> texto general -> gráfico rutas -> texto rutas
  */
  if (routesPanel.parentElement !== block || routesPanel.previousElementSibling !== textEl) {
    textEl.insertAdjacentElement("afterend", routesPanel);
  }

  return routesPanel;
}

function ensureHistoricRoutesNarrativeHost() {
  const routesPanel = ensureHistoricRoutesInsideTrafficBlock();
  if (!routesPanel) return null;

  let el = q("odHistoricRoutesNarrative");

  if (!el) {
    el = document.createElement("div");
    el.id = "odHistoricRoutesNarrative";
    el.className = "od-historic-routes-narrative";
  }

  if (el.parentElement !== routesPanel.parentElement || el.previousElementSibling !== routesPanel) {
    routesPanel.insertAdjacentElement("afterend", el);
  }

  return el;
}

function renderHistoricRoutesNarrative(iata) {
  const el = ensureHistoricRoutesNarrativeHost();
  if (!el) return;

  const html = buildHistoricRouteNarrative(iata);

  if (!html) {
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }

  el.classList.add(
    "od-connectivity-text",
    "od-connectivity-text--historic-routes"
  );

  el.innerHTML = odBuildHistoricConnectivityBlock(
    "Lectura de rutas históricas",
    html
  );

  el.style.display = "";
}
function buildHistoricRouteNarrative(iata) {
  const data = buildHistoricRouteSeries(iata);
  if (!data?.hasData || !data.selectedRoutes.length) return "";

  const code = clean(iata).toUpperCase();
  const first = data.selectedRoutes[0];
  const firstLabel = buildHistoricRouteTitle(code, first);

  const totalAll = Number(data.totalPaxAll || 0) > 0
    ? Number(data.totalPaxAll)
    : data.datasets.reduce((acc, ds) => acc + (Number(ds.totalPax) || 0), 0);

  const firstShare = totalAll > 0
    ? (Number(first.totalPax || 0) / totalAll) * 100
    : 0;

  if (code === "AEP" || code === "EZE") {
    return `<p>La evolución histórica por rutas muestra una red amplia y distribuida. Por ese motivo, en los nodos metropolitanos se representan las diez principales conexiones históricas y el resto de rutas, evitando interpretar el comportamiento del aeropuerto a partir de una única ruta dominante.</p>`;
  }

  if (code === "FDO") {
    return `<p>La evolución por rutas de San Fernando debe interpretarse en el marco de su perfil de aviación general, ejecutiva y privada: los destinos operados y la frecuencia de movimientos resultan más representativos que la oferta aerocomercial regular tradicional.</p>`;
  }

  if (data.hasOnlyOneSignificantRoute) {
    const dominancePhrase = firstShare >= HISTORIC_ROUTE_DOMINANT_SHARE_PCT
      ? "se explicó casi exclusivamente por"
      : "estuvo principalmente asociada a";

    const otherPhrase = data.hasOtherRoutes
      ? " Las demás conexiones tuvieron una participación marginal y se presentan agrupadas como <strong>Otras rutas</strong>."
      : " No se identificaron otras rutas con peso significativo en la serie histórica representada.";

    return `<p>La evolución histórica por rutas ${dominancePhrase} <strong>${escapeHtml(firstLabel)}</strong>, que concentró aproximadamente <strong>${formatShareShort(firstShare)}</strong> de los pasajeros acumulados. ${otherPhrase}</p>`;
  }

  return `<p>El gráfico histórico por rutas permite identificar el peso estructural de <strong>${escapeHtml(firstLabel)}</strong>, que concentró el <strong>${formatShareShort(firstShare)}</strong> de los pasajeros acumulados entre las rutas principales. Esta lectura complementa la serie total del aeropuerto al mostrar qué corredores explicaron la dinámica de largo plazo.</p>`;
}

function getHistoricTrafficDataForAirport(iata) {
  const code = clean(iata).toUpperCase();

  if (isFDO(code)) {
    const fdoHistoricData = buildFdoHistoricTrafficData();

    if (fdoHistoricData) {
      return fdoHistoricData;
    }

    console.warn(
      "No se pudo construir el histórico de FDO desde fdo_trafico_aeropuertos_argentina.json. Se usará la fuente histórica general como respaldo."
    );
  }

  return Array.isArray(historicTrafficByIata)
    ? historicTrafficByIata.find(x => clean(x.iata).toUpperCase() === code)
    : historicTrafficByIata?.[code];
}

function odStripOuterParagraph(html) {
  return clean(html)
    .replace(/^<p[^>]*>/i, "")
    .replace(/<\/p>\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function odBuildHistoricConnectivityBlock(title, bodyHtml) {
  const body = odStripOuterParagraph(bodyHtml);

  if (!body) return "";

  return `
    <div class="od-connectivity-block od-historic-text-block">
      <div class="od-connectivity-kicker">${escapeHtml(title)}</div>
      <p>${body}</p>
    </div>
  `;
}  
function renderHistoricTrafficBlock(iata, airportName) {
  const block = q("historicTrafficBlock");
  const textEl = q("historicTrafficText");

  const labelLongTermEl = q("historicLabelTmcaLongTerm");
  const labelRecentEl = q("historicLabelTmcaRecent");

  const tmcaEl = q("historicTmcaPrepandemia");
  const tmcaRecentEl = q("historicTmcaRecent");
  const varEl = q("historicVarVs2019");

  if (!block || !textEl) return;

const code = clean(iata).toUpperCase();

const d = getHistoricTrafficDataForAirport(code);

  if (!d) {
    block.style.display = "none";
    return;
  }

  block.style.display = "block";
odSetHistoricTrafficTitle(code);
  const nombreAeropuerto = airportName || d.aeropuerto || `Aeropuerto ${code}`;

  const longStartYear = Number(d.prepandemic_start_year);
  const longEndYear = Number(d.baseline_year || 2019);

  const recentStartYear = 2023;
  const recentEndYear = Number(d.latest_year || YEAR_REF || 2025);

  function getAnnualPax(year) {
    const row = Array.isArray(d.annual_series)
      ? d.annual_series.find(x => Number(x.year) === Number(year))
      : null;

    return row && Number.isFinite(Number(row.pax))
      ? Number(row.pax)
      : null;
  }

  function calcTMCA(startYear, endYear) {
    const startPax = getAnnualPax(startYear);
    const endPax = getAnnualPax(endYear);

    if (
      !Number.isFinite(startPax) ||
      !Number.isFinite(endPax) ||
      startPax <= 0 ||
      endPax <= 0 ||
      endYear <= startYear
    ) {
      return null;
    }

    return Math.pow(endPax / startPax, 1 / (endYear - startYear)) - 1;
  }

  const tmcaLongTerm = Number.isFinite(Number(d.tmca_prepandemic))
    ? Number(d.tmca_prepandemic)
    : null;

  const tmcaRecent = Number.isFinite(Number(d.tmca_recent))
    ? Number(d.tmca_recent)
    : calcTMCA(recentStartYear, recentEndYear);

  const recentStartPax = getAnnualPax(recentStartYear);
  const recentEndPax = getAnnualPax(recentEndYear) || Number(d.latest_pax);

  if (labelLongTermEl) {
    labelLongTermEl.textContent = `TMCA ${longStartYear}-${longEndYear}`;
  }

  if (labelRecentEl) {
    labelRecentEl.textContent = `TMCA ${recentStartYear}-${recentEndYear}`;
  }

  if (tmcaEl) {
    tmcaEl.textContent = odFormatPctRatio(tmcaLongTerm);
  }

  if (tmcaRecentEl) {
    tmcaRecentEl.textContent = odFormatPctRatio(tmcaRecent);
  }

  if (varEl) {
    varEl.textContent = odFormatPctRatio(d.var_latest_vs_2019);
  }

const tmcaNonPandemicOverall = odBuildSyntheticNonPandemicTMCA(
  tmcaLongTerm,
  tmcaRecent,
  longStartYear,
  longEndYear,
  recentStartYear,
  recentEndYear
);

const trendPhrase = odBuildHistoricalTrendPhrase(tmcaNonPandemicOverall);
const recentPhrase = odBuildRecentTrendPhrase(tmcaRecent);
const recoveryPhrase = odBuildRecoveryPhrase(d.var_latest_vs_2019);

  const maxSentence = (
    d.max_year &&
    d.max_pax !== null &&
    d.max_pax !== undefined
  )
    ? `El máximo de la serie se registró en <strong>${d.max_year}</strong>, con <strong>${odFormatNumber(d.max_pax)}</strong> pasajeros.`
    : "";
  

  
const historicSubject = d.source === "aeropuertos_argentina_fdo"
  ? "el movimiento de pasajeros registrados en el"
  : "el tráfico aerocomercial del";

  
const historicOverviewText = `
  Durante los últimos <strong>${d.years_shown} años</strong>, ${historicSubject}
  <strong>${escapeHtml(nombreAeropuerto)}</strong> experimentó tanto tendencias de crecimiento
  de la demanda como caídas de pasajeros y operaciones. ${maxSentence}
`;

const historicMethodText = `
  Para analizar la serie histórica, se decidió utilizar el período ${longStartYear}-${longEndYear}
  como referencia prepandemia, mientras que el período ${recentStartYear}-${recentEndYear}
  resume la dinámica posterior. Por ello, el indicador Tasa Media de Crecimiento Anual (TMCA)
  se muestra diferenciado, evitando los años 2020 a 2022 debido a su carácter atípico.
`;

const historicComparisonText = `
  Entre <strong>${longStartYear}</strong> y <strong>${longEndYear}</strong>, los pasajeros pasaron de
  <strong>${odFormatNumber(d.prepandemic_start_pax)}</strong> a
  <strong>${odFormatNumber(d.baseline_pax)}</strong>, con una
  <strong>Tasa Media de Crecimiento Anual (TMCA) de ${odFormatPctRatio(tmcaLongTerm)}</strong>.
  Mientras que entre <strong>${recentStartYear}</strong> y <strong>${recentEndYear}</strong>,
  el aeropuerto mostró <strong>${recentPhrase}</strong>, pasando de
  <strong>${odFormatNumber(recentStartPax)}</strong> a
  <strong>${odFormatNumber(recentEndPax)}</strong> pasajeros, con una
  <strong>TMCA de ${odFormatPctRatio(tmcaRecent)}</strong>.
  En una lectura de conjunto de los años no pandémicos, el aeropuerto presentó
  <strong>${trendPhrase}</strong>. Tomando 2019 como año de referencia, en
  <strong>${recentEndYear}</strong> el aeropuerto <strong>${recoveryPhrase}</strong>.
`;
textEl.classList.add("od-connectivity-text", "od-connectivity-text--historic");
textEl.innerHTML = `
  ${odBuildHistoricConnectivityBlock("Lectura general 2001–2025", historicOverviewText)}
  ${odBuildHistoricConnectivityBlock("Criterio de análisis", historicMethodText)}
  ${odBuildHistoricConnectivityBlock("Comparación de períodos", historicComparisonText)}
`;

renderHistoricAirportTrafficChart(code);
}
  function renderOfertaDemanda(iata) {
    const summary = getOfertaDemandaSummary(iata, YEAR_REF, { soloComercial: true });

const isFdoWithAA = isFDO(iata) && summary?.source === "aeropuertos_argentina_fdo";
const sourceText = isFdoWithAA
  ? "Fuente: elaborado por GREyF ORSNA con datos de Aeropuertos Argentina."
  : "Fuente: elaborado por GREyF ORSNA con datos de SIAC ANAC.";

document
  .querySelectorAll(".od-source-note, .od-footer-source, .history-note, .od-routes-source, .od-historic-source")
  .forEach(el => {
    el.textContent = sourceText;
  });

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

renderOfertaDemandaIntro(iata, summary);
    
// Bloque narrativo de perfil operativo, ranking por segmento y conectividad 2025.
renderConnectivityProfileText(iata, summary, snaRank);

setHTML(
  "odSnaRank",
  snaRank.rank
    ? `#${formatNumber(snaRank.rank)} <span class="od-kpi-rank-total">/ ${formatNumber(snaRank.totalAirports)}</span>`
    : "–"
);

const suppressCurrentRouteAnalysis = odShouldSuppressCurrentRouteAnalysis(iata, summary);

odSetTopRoutesTitles(iata, summary);

renderTopRoutesCharts(
  suppressCurrentRouteAnalysis ? [] : summary.mainRoutes
);

// Gráfico histórico de rutas, construido con la fuente general o con la fuente especial de FDO.
// Se mantiene también para aeropuertos sin conectividad comercial regular 2025.
renderHistoricRoutesChart(iata);
renderHistoricRoutesNarrative(iata);

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
function ensureHistoricSectionOrder() {
  const trafficBlock = q("historicTrafficBlock");
  const routesCanvas = q("odHistoricRoutesChart");

  if (!trafficBlock || !routesCanvas) return;

  const routesPanel =
    routesCanvas.closest(".od-panel") ||
    routesCanvas.closest(".od-chart-card") ||
    routesCanvas.closest(".od-historic-routes-panel") ||
    routesCanvas.closest(".od-historic-chart-wrap") ||
    routesCanvas.parentElement;

  if (!routesPanel || !routesPanel.parentElement) return;

  /*
    Desde que ensureHistoricRoutesInsideTrafficBlock() mueve el gráfico
    de rutas históricas dentro de historicTrafficBlock, no hay que intentar
    mover historicTrafficBlock otra vez si routesPanel ya está adentro.
  */
  if (routesPanel === trafficBlock || trafficBlock.contains(routesPanel)) {
    return;
  }

  if (routesPanel.contains(trafficBlock)) {
    return;
  }

  const parent = routesPanel.parentElement;

  if (trafficBlock.parentElement !== parent) {
    parent.insertBefore(trafficBlock, routesPanel);
    return;
  }

  const routesIsBeforeTraffic =
    trafficBlock.compareDocumentPosition(routesPanel) & Node.DOCUMENT_POSITION_PRECEDING;

  if (routesIsBeforeTraffic) {
    parent.insertBefore(trafficBlock, routesPanel);
  }
}
function renderAirport(iataCode) {
  const iata = clean(iataCode).toUpperCase();
  const a = aeropuertos.find(x => clean(firstNonEmpty(x, ["IATA"])).toUpperCase() === iata);
  if (!a) return;

  currentIATA = iata;

  const airportName = getAirportSheetTitle(a);

  setText("odAirportName", airportName);
  setText("odYearRef", String(YEAR_REF));

renderHistoricTrafficBlock(iata, airportName);
renderOfertaDemanda(iata);
ensureHistoricSectionOrder();
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
  ourAirportsResp,
  provinciasResp,
  airlineAliasResp,
fdoTrafficResp,
fdoRoutesMonthlyResp,
fdoRoutesAnnualResp,
operationalProfileResp,
  descriptivoResp,
  paxMensualResp,
  movMensualResp,
  extraTrafficResp
] = await Promise.all([
  fetch(AEROPUERTOS_GEOJSON_PATH),
  fetch(RUTAS_CSV_PATH).catch(() => null),
  fetch(RUTAS_KM_CSV_PATH).catch(() => null),
  fetch(IATA_MUNDO_CSV_PATH).catch(() => null),
  fetch(OURAIRPORTS_CSV_PATH).catch(() => null),
  fetch(PROVINCIAS_GEOJSON_PATH).catch(() => null),
  fetch(AIRLINE_ALIAS_CSV_PATH).catch(() => null),
  fetch(FDO_TRAFFIC_AA_PATH).catch(() => null),
  fetch(FDO_ROUTES_MONTHLY_AA_PATH).catch(() => null),
  fetch(FDO_ROUTES_ANNUAL_AA_PATH).catch(() => null),
  fetch(PERFIL_OPERATIVO_PATH).catch(() => null),
  fetch(DESCRIPTIVO_AEROPUERTOS_GEOJSON_PATH).catch(() => null),
  fetch(PAX_MENSUAL_PATH).catch(() => null),
  fetch(MOV_MENSUAL_PATH).catch(() => null),
  fetch(EXTRA_TRAFFIC_PATH).catch(() => null)
]);

const geojson = await airportsResp.json();

aeropuertos = (geojson.features || [])
  .map(f => {
    const props = { ...(f.properties || {}) };
    const coords = f.geometry?.coordinates;

    // GeoJSON usa [longitud, latitud]
    if (Array.isArray(coords) && coords.length >= 2) {
      props.__lon = Number(coords[0]);
      props.__lat = Number(coords[1]);
    }

    return props;
  })
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
      if (ourAirportsResp && ourAirportsResp.ok) {
  ourAirportsIndex = parseOurAirportsCSV(await readTextSmart(ourAirportsResp));
} else {
  ourAirportsIndex = {};
  console.warn("No se pudo cargar ourairports.csv para clasificar continentes.");
}
if (provinciasResp && provinciasResp.ok) {
  const provinciasGeojson = await provinciasResp.json();
  provinciasFeatures = provinciasGeojson?.features || [];
} else {
  provinciasFeatures = [];
  console.warn("No se pudo cargar provincias.geojson para mapas de conectividad.");
}
if (airlineAliasResp && airlineAliasResp.ok) {
  airlineAliasIndex = parseAirlineAliasCSV(await readTextSmart(airlineAliasResp));
} else {
  airlineAliasIndex = {};
}

if (fdoTrafficResp && fdoTrafficResp.ok) {
  fdoTrafficAA = await fdoTrafficResp.json();
} else {
  fdoTrafficAA = null;
}
if (paxMensualResp && paxMensualResp.ok) {
  pasajerosMensualRows = parsePasajerosMensualCSV(await readTextSmart(paxMensualResp));
} else {
  pasajerosMensualRows = [];
}

if (movMensualResp && movMensualResp.ok) {
  movimientosMensualRows = parseMovimientosMensualCSV(await readTextSmart(movMensualResp));
} else {
  movimientosMensualRows = [];
}

if (extraTrafficResp && extraTrafficResp.ok) {
  const extraTraffic = parseExtraTrafficCSV(await readTextSmart(extraTrafficResp));

  pasajerosMensualRows = mergeExtraTrafficRows(
    pasajerosMensualRows,
    extraTraffic.paxRows
  );

  movimientosMensualRows = mergeExtraTrafficRows(
    movimientosMensualRows,
    extraTraffic.movRows
  );
}

if (fdoTrafficAA) {
  pasajerosMensualRows = replaceRowsForFDO(
    pasajerosMensualRows,
    fdoAAToPassengerRows(fdoTrafficAA)
  );

  movimientosMensualRows = replaceRowsForFDO(
    movimientosMensualRows,
    fdoAAToMovementRows(fdoTrafficAA)
  );
}
if (fdoRoutesMonthlyResp && fdoRoutesMonthlyResp.ok) {
  fdoRoutesMonthlyAA = parseFdoRoutesMonthlyAAJSON(await fdoRoutesMonthlyResp.json());
} else {
  fdoRoutesMonthlyAA = [];
}
if (fdoRoutesAnnualResp && fdoRoutesAnnualResp.ok) {
  fdoRoutesAnnualAA = parseFdoRoutesAnnualAAJSON(await fdoRoutesAnnualResp.json());
} else {
  fdoRoutesAnnualAA = [];
}
// Carga opcional del perfil operativo 2025.
if (operationalProfileResp && operationalProfileResp.ok) {
  operationalProfileByIata = buildOperationalProfileIndex(await operationalProfileResp.json());
} else {
  operationalProfileByIata = {};
  console.warn("No se pudo cargar perfil_operativo_impacto_2025.json.");
}
// Carga opcional del descriptivo aeroportuario.
// Aporta rol territorial, tipo de demanda y estacionalidad esperada.
if (descriptivoResp && descriptivoResp.ok) {
  descriptivoByIata = buildDescriptivoAirportIndex(await descriptivoResp.json());
} else {
  descriptivoByIata = {};
  console.warn("No se pudo cargar Descriptivo_aeropuertos.geojson.");
}
try {
  const respHistoric = await fetch("fuentes/tmca_historica_57_aeropuertos_base2019.json");

  if (respHistoric && respHistoric.ok) {
    historicTrafficByIata = await respHistoric.json();
  } else {
    historicTrafficByIata = {};
    console.warn("No se pudo cargar el JSON de tráfico histórico base 2019.");
  }
} catch (e) {
  console.warn("No se pudo cargar tmca_historica", e);
  historicTrafficByIata = {};
}
      
if (select) {
  select.innerHTML = "";
  aeropuertos.forEach(a => {
    const opt = document.createElement("option");
    const iata = clean(firstNonEmpty(a, ["IATA"])).toUpperCase();

    opt.value = iata;
    opt.textContent = getAirportSelectorLabel(a);

    select.appendChild(opt);
  });
}

const params = new URLSearchParams(window.location.search);

const fromUrl = clean(params.get("airport")).toUpperCase();
const fromSelect = clean(select?.value).toUpperCase();
const firstAirport = clean(firstNonEmpty(aeropuertos[0], ["IATA"])).toUpperCase();

const initial = fromUrl || fromSelect || firstAirport;

if (select) {
  select.value = initial;

  if (!select.dataset.odBound) {
    select.dataset.odBound = "1";

    select.addEventListener("change", e => {
      const value = clean(e.target.value).toUpperCase();
      if (!value) return;

      try {
        requestAnimationFrame(() => {
          renderAirport(value);
        });

        const url = new URL(window.location.href);
        url.searchParams.set("airport", value);
        window.history.replaceState({}, "", url);
      } catch (err) {
        console.error("Error al cambiar de aeropuerto:", err);
      }
    });
  }
}

try {
  requestAnimationFrame(() => {
    renderAirport(initial);
  });
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
let ofertaDemandaBooted = false;
let odBootObserver = null;

function bootOfertaDemanda() {
  if (ofertaDemandaBooted) return;

  const sheet = q("sheetOfertaDemanda");
  const monthlyCanvas = q("odMonthlyChart");
  const airlinesCanvas = q("odAirlinesChart");
  const routesList = q("odTopRoutes");
  const extraRoutesList = q("odTopRoutesExtra");
  const select = q("airportSelect");

  // En informe-impacto.html el partial se monta después.
  // No arrancar hasta que existan todos los nodos necesarios.
  // odTopRoutesExtra queda como nodo de compatibilidad, pero ya no es obligatorio para renderizar.
  if (!sheet || !monthlyCanvas || !airlinesCanvas || !routesList || !select) {
    return;
  }

  ofertaDemandaBooted = true;

  if (odBootObserver) {
    odBootObserver.disconnect();
    odBootObserver = null;
  }

  requestAnimationFrame(() => {
    loadData();
  });
}

document.addEventListener("DOMContentLoaded", bootOfertaDemanda);
document.addEventListener("report:partials-ready", bootOfertaDemanda);

if ("MutationObserver" in window) {
  odBootObserver = new MutationObserver(() => {
    bootOfertaDemanda();
  });

  odBootObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

if (document.readyState !== "loading") {
  bootOfertaDemanda();
}
})();
