/* global L, html2canvas */
(() => {
  "use strict";

  let aeropuertos = [];
  let poligonos = [];
  let pistasFeatures = [];
  let terminalesFeatures = [];
  let pasajerosMensualRows = [];
  let movimientosMensualRows = [];
  let vuelosRows = [];
  let rutasRows = [];
  let transportePorIATA = {};
  let domesticIATAs = new Set();
let currentIATA = "";
let laminaBooted = false;

let mapPredio = null;
  let predioLayer = null;
  let pistasLayer = null;
  let terminalesLayer = null;
  let predioMarker = null;
  let iataWorldIndex = {};
  let routeCodeIndex = {};
  const DEST_OVERRIDES = {
  BUE: { ciudad: "Buenos Aires AEP+EZE", pais: "Argentina" },
  GRU: { ciudad: "São Paulo", pais: "Brasil" },
  GIG: { ciudad: "Río de Janeiro", pais: "Brasil" },
  FLN: { ciudad: "Florianópolis", pais: "Brasil" },
  LIM: { ciudad: "Lima", pais: "Perú" },
  SCL: { ciudad: "Santiago", pais: "Chile" }, 
  PTY: { ciudad: "Tocumén", pais: "Panamá" }, 
  MAD: { ciudad: "Madrid", pais: "España" }
};
  const YEAR_REF = 2025;
  const PAX_DATASET_CAB = "pasajeros_comerciales_cabotaje_aeropuerto";
  const PAX_DATASET_INT = "pasajeros_comerciales_internacional_aeropuerto";
  const MIN_PAX_TO_SHOW = 20;
  const GENERAL_AVIATION_LABEL = "Aviación general / privada";
  const q = id => document.getElementById(id);
const CHART_COLORS = {
  passengersLine: "#2A6FB0",
  passengersLineDark: "#1E5A94",
  passengersArea: "#DCE9F7",

  aircraftBar: "#C6923A",
  aircraftBarFill: "rgba(198, 146, 58, 0.34)",

  grid: "#E4EAF1",
  axis: "#C9D3DF",
  label: "#6F7D8C",
  note: "#7A838C",
  value: "#5C6670"
};
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

  function formatNumber(n) {
    if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("es-AR");
  }

  function safeValue(v) {
    const n = parseNumber(v);
    if (Number.isFinite(n)) return formatNumber(n);
    const s = clean(v);
    return s || "–";
  }

  function formatAreaHectares(v) {
    const n = parseNumber(v);
    if (Number.isFinite(n)) return `${formatNumber(n)} hectáreas`;
    const s = clean(v);
    if (!s) return "–";
    return /hect/i.test(s) ? s : `${s} hectáreas`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function splitField(str) {
    if (!str) return [];
    return String(str)
      .split(/[;]+| {2,}|\t+|\|/)
      .map(s => s.trim())
      .filter(Boolean);
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

  function normalizeAirlineKey(name) {
    return clean(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }
function isUnnamedAirline(name) {
  const key = normalizeAirlineKey(name);
  return !key || key === "sindato";
}

function isGeneralAviationType(value) {
  const key = normalizeAirlineKey(value);

  return (
    key === "avgeneral" ||
    key === "avgral" ||
    key === "aviaciongeneral" ||
    key === "aviacionprivada" ||
    key === "generalaviation" ||
    key.includes("avgeneral") ||
    key.includes("avgral") ||
    key.includes("aviaciongeneral") ||
    key.includes("aviacionprivada")
  );
}
  const FORCE_COMMERCIAL_AIRLINES = new Map([
  ["americanjet", "American Jet"],
  ["andeslineasaereas", "Andes Líneas Aéreas"],
  ["lade", "LADE - Líneas Aéreas del Estado"],
  ["ladelineasaereasdelestado", "LADE - Líneas Aéreas del Estado"],
  ["lineasaereasdelestado", "LADE - Líneas Aéreas del Estado"]
]);

function getForcedCommercialAirlineName(name) {
  const key = normalizeAirlineKey(name);

  if (FORCE_COMMERCIAL_AIRLINES.has(key)) {
    return FORCE_COMMERCIAL_AIRLINES.get(key);
  }

  if (key.includes("americanjet")) return "American Jet";
  if (key.includes("andes")) return "Andes Líneas Aéreas";

  if (
    key === "lade" ||
    key.includes("ladelineasaereasdelestado") ||
    key.includes("lineasaereasdelestado")
  ) {
    return "LADE - Líneas Aéreas del Estado";
  }

  return "";
}
  function getAirlineLogoSrc(name) {
    const key = normalizeAirlineKey(name);
    const logos = {
      aerolineasargentinas: "img/LogosAerolineas/AerolineasArgentinas.png",
      jetsmartairlines: "img/LogosAerolineas/JetSMART.png",
      flybondi: "img/LogosAerolineas/Flybondi.png",
      goltransportesaereos: "img/LogosAerolineas/GOL.png",
      latam: "img/LogosAerolineas/LATAM.png",
      copaairlines: "img/LogosAerolineas/Copa.png",
      iberiaairlines: "img/LogosAerolineas/Iberia.png",
      latamperu: "img/LogosAerolineas/LATAMPeru.png",
      tamlinhasaereas: "img/LogosAerolineas/TAM.png",
      americanairlines: "img/LogosAerolineas/AmericanAirlines.png",
      avianca: "img/LogosAerolineas/Avianca.png",
      skyairline: "img/LogosAerolineas/SKY.png",
      aireuropa: "img/LogosAerolineas/AirEuropa.png",
      klm: "img/LogosAerolineas/KLM.png",
      itaairways: "img/LogosAerolineas/ITAAirways.png",
      deltaairlines: "img/LogosAerolineas/Delta.png",
      unitedairlines: "img/LogosAerolineas/United.png",
      lufthansa: "img/LogosAerolineas/Lufthansa.png",
      andeslineasaereas: "img/LogosAerolineas/Andes.png",
      aeromexico: "img/LogosAerolineas/Aeromexico.png",
      airfrance: "img/LogosAerolineas/AirFrance.png",
      bolivianadeaviacion: "img/LogosAerolineas/BoA.png",
      turkishairlines: "img/LogosAerolineas/Turkish.png",
      arajet: "img/LogosAerolineas/Arajet.png",
      britishairways: "img/LogosAerolineas/BritishAirways.png",
      ethiopianairlines: "img/LogosAerolineas/Ethiopian.png",
      emiratesairline: "img/LogosAerolineas/Emirates.png",
      aircanada: "img/LogosAerolineas/AirCanada.png",
      latamecuador: "img/LogosAerolineas/LATAMEcuador.png",
      aviancacostarica: "img/LogosAerolineas/AviancaCostaRica.png",
      amaszonas: "img/LogosAerolineas/Amaszonas.png",
      swissinternationalairlines: "img/LogosAerolineas/SWISS.png",
      azullinhasaereasbrasileiras: "img/LogosAerolineas/Azul.png",
      lade: "img/LogosAerolineas/LADE.png",
      americanjet: "img/LogosAerolineas/AmericanJet.png",
      fuerzaaerea: "img/LogosAerolineas/FuerzaAerea.png",
      ejercito: "img/LogosAerolineas/Ejercito.png"
    };

    if (logos[key]) return logos[key];
    if (key.includes("aerolineasargentinas")) return logos.aerolineasargentinas;
    if (key.includes("jetsmart")) return logos.jetsmartairlines;
    if (key.includes("flybondi")) return logos.flybondi;
    if (key.includes("gol")) return logos.goltransportesaereos;
    if (key.startsWith("latamperu")) return logos.latamperu;
    if (key.startsWith("latamecuador")) return logos.latamecuador;
    if (key.includes("latam")) return logos.latam;
    if (key.includes("copa")) return logos.copaairlines;
    if (key.includes("iberia")) return logos.iberiaairlines;
    if (key.includes("tam")) return logos.tamlinhasaereas;
    if (key.includes("americanjet")) return logos.americanjet;
    if (key.includes("american")) return logos.americanairlines;
    if (key.includes("aviancacostarica")) return logos.aviancacostarica;
    if (key.includes("avianca")) return logos.avianca;
    if (key.includes("sky")) return logos.skyairline;
    if (key.includes("aireuropa")) return logos.aireuropa;
    if (key.includes("klm")) return logos.klm;
    if (key.includes("ita")) return logos.itaairways;
    if (key.includes("delta")) return logos.deltaairlines;
    if (key.includes("united")) return logos.unitedairlines;
    if (key.includes("lufthansa")) return logos.lufthansa;
    if (key.includes("andes")) return logos.andeslineasaereas;
    if (key.includes("aeromexico")) return logos.aeromexico;
    if (key.includes("airfrance")) return logos.airfrance;
    if (key.includes("boliviana") || key === "boa") return logos.bolivianadeaviacion;
    if (key.includes("turkish")) return logos.turkishairlines;
    if (key.includes("arajet")) return logos.arajet;
    if (key.includes("british")) return logos.britishairways;
    if (key.includes("ethiopian")) return logos.ethiopianairlines;
    if (key.includes("emirates")) return logos.emiratesairline;
    if (key.includes("aircanada")) return logos.aircanada;
    if (key.includes("amaszonas")) return logos.amaszonas;
    if (key.includes("swiss")) return logos.swissinternationalairlines;
    if (key.includes("azul")) return logos.azullinhasaereasbrasileiras;
    if (key.includes("lade")) return logos.lade;
    if (key.includes("fuerzaaerea")) return logos.fuerzaaerea;
    if (key.includes("ejercito")) return logos.ejercito;
    return "";
  }

  function buildNiceScale(maxValue, ticks = 4) {
    const rawMax = Math.max(1, Number(maxValue) || 1);
    const rawStep = rawMax / ticks;
    const exponent = Math.floor(Math.log10(rawStep));
    const base = Math.pow(10, exponent);
    const fraction = rawStep / base;
    let niceFraction = 1;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
    const step = niceFraction * base;
    const niceMax = Math.ceil(rawMax / step) * step;
    const values = [];
    for (let v = 0; v <= niceMax + step * 0.5; v += step) values.push(v);
    return { step, niceMax, values };
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

function extractYearFlexible(row) {
  const directYear = parseNumber(firstNonEmpty(row, [
    "anio", "ano", "year", "año"
  ]));
  if (Number.isFinite(directYear)) return Number(directYear);

  const candidates = [
    firstNonEmpty(row, ["fecha"]),
    firstNonEmpty(row, ["anomes", "año_mes", "periodo_id", "mes_ano"])
  ].filter(Boolean);

  for (const raw of candidates) {
    const d = parseFechaFlexible(raw);
    if (d && !Number.isNaN(d.getTime())) return d.getFullYear();

    const m = String(raw).match(/^(\d{4})/);
    if (m) return Number(m[1]);
  }

  return NaN;
}
  function parseTransporteCSV(text) {
    const rows = parseCSV(text);
    const result = {};
    rows.forEach(r => {
      const iata = clean(firstNonEmpty(r, ["iata", "aeropuerto_iata", "airport_iata"])) .toUpperCase();
      if (!iata) return;
      result[iata] = {
        linea: clean(firstNonEmpty(r, ["linea", "lineas", "lineas_colectivo"])),
        parada: clean(firstNonEmpty(r, ["parada", "paradaaep", "parada_principal"]))
      };
    });
    return result;
  }

  function parsePasajerosMensualCSV(text) {
    return parseCSV(text).map(r => ({
      iata: clean(firstNonEmpty(r, ["iata"])) .toUpperCase(),
      dataset: clean(firstNonEmpty(r, ["dataset"])),
      date: parseFechaFlexible(firstNonEmpty(r, ["fecha"])),
      valor: parseNumber(firstNonEmpty(r, ["valor_pax", "valor", "pasajeros"]))
    })).filter(r => r.iata && r.date && Number.isFinite(r.valor)).sort((a, b) => a.date - b.date);
  }

function parseMovimientosMensualCSV(text) {
  return parseCSV(text).map(r => ({
    iata: clean(firstNonEmpty(r, ["iata"])).toUpperCase(),
    dataset: clean(firstNonEmpty(r, ["dataset"])),
    date: parseFechaFlexible(firstNonEmpty(r, ["fecha"])),
    valor: parseNumber(firstNonEmpty(r, ["valor_movimientos", "valor", "movimientos"]))
  })).filter(r => r.iata && r.date && Number.isFinite(r.valor)).sort((a, b) => a.date - b.date);
}
  
function parseVuelosCSV(text) {
  return parseCSV(text).map(r => {
    const year = extractYearFlexible(r);

    return {
      iata: clean(firstNonEmpty(r, [
        "iata",
        "aeropuerto_iata",
        "airport_iata",
        "origen_iata"
      ])).toUpperCase(),

      year,

      valor: parseNumber(firstNonEmpty(r, [
        "vuelos",
        "cantidad_vuelos",
        "vuelos_totales",
        "movimientos",
        "movimientos_totales",
        "valor_vuelos",
        "valor_movimientos",
        "valor",
        "cantidad",
        "total_vuelos",
        "totalvuelos"
      ]))
    };
  }).filter(r => r.iata && Number.isFinite(r.year) && Number.isFinite(r.valor));
}

function parseRutasCSV(text) {
  return parseCSV(text).map(r => {
    const date = parseFechaFlexible(firstNonEmpty(r, ["fecha", "anomes", "año_mes"]));
    const yearNum = parseNumber(firstNonEmpty(r, ["anio", "ano", "year", "año"]));

    const cityPair = clean(firstNonEmpty(r, ["citypair_iata"])).toUpperCase();
    let endpointA = "";
    let endpointB = "";

    if (cityPair.includes("-")) {
      const parts = cityPair.split("-").map(s => s.trim());
      endpointA = parts[0] || "";
      endpointB = parts[1] || "";
    }

    const volume = parseNumber(firstNonEmpty(r, [
      "totalpasajeros",
      "pasajeros",
      "valor_pax",
      "valor",
      "cantidad",
      "vuelos",
      "cantidad_vuelos",
      "movimientos",
      "frecuencias",
      "total_vuelos",
      "totalvuelos"
    ]));

    return {
      cityPair,
      endpointA,
      endpointB,

      airline: clean(firstNonEmpty(r, [
        "aerolinea",
        "aerolinea_nombre",
        "aerolinea_nombre_1",
        "linea_aerea",
        "airline",
        "compania"
      ])),
  commercialType: clean(firstNonEmpty(r, [
    "comercial_av_gral",
    "comercial_av_general",
    "comercial_av_gral_",
    "comercial_av_gral__",
    "comercial_av_gral_av_general"
  ])),
      volume,

      year: Number.isFinite(yearNum)
        ? Number(yearNum)
        : (date ? date.getFullYear() : 2025)
    };
  }).filter(r =>
    r.endpointA &&
    r.endpointB &&
    Number.isFinite(r.volume)
  );
}

  function buildPaxSeries(iataUpper, mode) {
    const rowsAll = pasajerosMensualRows.filter(r => r.iata === iataUpper);
    if (!rowsAll.length) return [];
    if (mode === "cabotaje" || mode === "internacional") {
      const target = mode === "cabotaje" ? PAX_DATASET_CAB : PAX_DATASET_INT;
      return rowsAll.filter(r => r.dataset === target).sort((a, b) => a.date - b.date);
    }
    const acc = new Map();
    rowsAll.forEach(r => {
      if (r.dataset !== PAX_DATASET_CAB && r.dataset !== PAX_DATASET_INT) return;
      const year = r.date.getFullYear();
      const month = r.date.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      if (!acc.has(key)) acc.set(key, { date: new Date(year, month - 1, 1), valor: 0 });
      acc.get(key).valor += Number(r.valor) || 0;
    });
    return Array.from(acc.values()).sort((a, b) => a.date - b.date);
  }

function buildMovSeries(iataUpper, mode = "total") {
  const rowsAll = movimientosMensualRows.filter(r => r.iata === iataUpper);
  if (!rowsAll.length) return [];

  if (mode === "cabotaje" || mode === "internacional") {
    const target = mode === "cabotaje"
      ? "movimientos_comerciales_cabotaje_aeropuerto"
      : "movimientos_comerciales_internacional_aeropuerto";

    return rowsAll
      .filter(r => r.dataset === target)
      .sort((a, b) => a.date - b.date);
  }

  const acc = new Map();

  rowsAll.forEach(r => {
    const year = r.date.getFullYear();
    const month = r.date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    if (!acc.has(key)) {
      acc.set(key, { date: new Date(year, month - 1, 1), valor: 0 });
    }

    acc.get(key).valor += Number(r.valor) || 0;
  });

  return Array.from(acc.values()).sort((a, b) => a.date - b.date);
}
  
function annualMovementTotals(iata) {
  return annualTotals(buildMovSeries(iata, "total"));
}
  function annualTotals(rows) {
    const acc = new Map();
    rows.forEach(r => {
      const y = r.date.getFullYear();
      acc.set(y, (acc.get(y) || 0) + (Number(r.valor) || 0));
    });
    return Array.from(acc.entries()).map(([year, valor]) => ({ year, valor })).sort((a, b) => a.year - b.year);
  }

  function sumYear(rows, year) {
    return rows.filter(r => r.date.getFullYear() === year).reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
  }

function initPredioMap() {                         // Declara una función que inicializa el mapa Leaflet del predio aeroportuario.
  const el = q("mapPredio");                      // Busca en el HTML el elemento con id="mapPredio" y lo guarda en la variable el.
  if (!el || typeof L === "undefined" || mapPredio) return; 
                                                   // Corta la ejecución si:
                                                   // 1) no existe ese contenedor en el DOM,
                                                   // 2) Leaflet no está cargado (L undefined),
                                                   // 3) el mapa ya fue creado antes (evita inicializarlo dos veces).

  mapPredio = L.map(el, {                         // Crea una nueva instancia de mapa Leaflet dentro del elemento el y la guarda en mapPredio.
    zoomControl: false,                           // Oculta los botones + / - de zoom.
    attributionControl: false,                    // Oculta la atribución típica del mapa (créditos en esquina).
    dragging: false,                              // Impide arrastrar el mapa con mouse o touch.
    scrollWheelZoom: false,                       // Impide hacer zoom con la rueda del mouse.
    doubleClickZoom: false,                       // Impide hacer zoom con doble clic.
    boxZoom: false,                               // Impide usar zoom por recuadro.
    keyboard: false,                              // Impide interacción por teclado.
    tap: false,                                   // Desactiva eventos táctiles tipo "tap" en dispositivos compatibles.
    touchZoom: false                              // Impide hacer zoom con gesto táctil.
  }).setView([-34.6, -58.4], 5);                  // Define una vista inicial provisional: centro en esas coordenadas y nivel de zoom 5.
                                                   // Luego suele ser reemplazada por fitBounds o setView al aeropuerto real.

  mapPredio.createPane("panePredio");             // Crea un pane (capa visual separada) llamado panePredio.
  mapPredio.getPane("panePredio").style.zIndex = 410; 
                                                   // Le asigna orden de apilamiento 410: se dibuja por encima de panes con z-index menor.

  mapPredio.createPane("panePistas");             // Crea otro pane específico para las pistas.
  mapPredio.getPane("panePistas").style.zIndex = 420; 
                                                   // Le da prioridad visual sobre panePredio, porque 420 > 410.

  mapPredio.createPane("paneTerminales");         // Crea un tercer pane para las terminales.
  mapPredio.getPane("paneTerminales").style.zIndex = 430; 
                                                   // Lo pone por encima de predio y pistas, porque 430 es el mayor de los tres.

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { 
                                                   // Define la capa base raster de OpenStreetMap.
    maxZoom: 18,                                  // Establece el nivel máximo de zoom permitido para esa capa base.
    crossOrigin: true,                            // Habilita CORS; sirve sobre todo para exportación/canvas y evitar problemas con recursos externos.
    opacity: 0.50                                 // Hace la base semitransparente para que no compita tanto con polígonos, pistas y terminales.
  }).addTo(mapPredio);                            // Agrega esa capa base al mapa recién creado.
}

  
  function getEquivalentDestinationCode(selectedIata, otherCode) {
  const sel = clean(selectedIata).toUpperCase();
  const other = clean(otherCode).toUpperCase();

  const selectedIsBA = sel === "AEP" || sel === "EZE";
  const otherIsBA = other === "AEP" || other === "EZE";

  /* Solo consolida AEP/EZE como destino, nunca como origen */
  if (!selectedIsBA && otherIsBA) return "BUE";

  return other;
}
  function getAirportCenterLatLng(a) {
    const iata = clean(a.IATA).toUpperCase();
    if (poligonos.length && iata) {
      const feats = poligonos.filter(f => {
        const p = f.properties || {};
        const code = clean(p.IATA || p.iata || p.iata_code).toUpperCase();
        return code === iata;
      });
      if (feats.length) {
        const temp = L.geoJSON(feats);
        const bounds = temp.getBounds();
        if (bounds.isValid()) {
          const c = bounds.getCenter();
          return [c.lat, c.lng];
        }
      }
    }
    const lat = firstNonEmpty(a, ["Lat", "LAT"]);
    const lon = firstNonEmpty(a, ["Lon", "LON", "Long"]);
    if (lat !== "" && lon !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
      return [Number(lat), Number(lon)];
    }
    return null;
  }

  function featureMatchesIATA(feature, iata) {
  const p = feature?.properties || {};
  const code = clean(
    p.IATA ||
    p.iata ||
    p.iata_code ||
    p.iata_cod ||
    p.codigo_iata
  ).toUpperCase();

  return code === clean(iata).toUpperCase();
}
  
function updatePredioMap(a) {
  if (!mapPredio) return;

  if (predioLayer) {
    mapPredio.removeLayer(predioLayer);
    predioLayer = null;
  }
  if (pistasLayer) {
    mapPredio.removeLayer(pistasLayer);
    pistasLayer = null;
  }
  if (terminalesLayer) {
    mapPredio.removeLayer(terminalesLayer);
    terminalesLayer = null;
  }
  if (predioMarker) {
    mapPredio.removeLayer(predioMarker);
    predioMarker = null;
  }

  const iata = clean(a.IATA).toUpperCase();

  const predioFeats = poligonos.filter(f => featureMatchesIATA(f, iata));
  const pistaFeats = pistasFeatures.filter(f => featureMatchesIATA(f, iata));
  const terminalFeats = terminalesFeatures.filter(f => featureMatchesIATA(f, iata));

if (predioFeats.length) {
  predioLayer = L.geoJSON(predioFeats, {
    pane: "panePredio",
    style: {
      color: "#8cd100",
      weight: 2.4,
      fillColor: "#b8e26b",
      fillOpacity: 0.10
    }
  }).addTo(mapPredio);
}

if (pistaFeats.length) {
  pistasLayer = L.geoJSON(pistaFeats, {
    pane: "panePistas",
    style: {
      color: "#6a7280",
      weight: 1,
      fillColor: "#7b848f",
      fillOpacity: 0.60
    }
  }).addTo(mapPredio);
}

if (terminalFeats.length) {
  terminalesLayer = L.geoJSON(terminalFeats, {
    pane: "paneTerminales",
    style: {
      color: "#2a5fa0",
      weight: 1.2,
      fillColor: "#4b86c5",
      fillOpacity: 0.30
    }
  }).addTo(mapPredio);
}

  const boundsGroup = L.featureGroup(
    [predioLayer, pistasLayer, terminalesLayer].filter(Boolean)
  );

  const bounds = boundsGroup.getBounds();
  if (bounds.isValid()) {
    setTimeout(() => {
      mapPredio.invalidateSize();
      mapPredio.fitBounds(bounds, { padding: [0, 0] });
    }, 0);
    return;
  }

  const center = getAirportCenterLatLng(a);
  if (center) {
    predioMarker = L.circleMarker(center, {
      radius: 6,
      color: "#6aa84f",
      weight: 2,
      fillColor: "#8cd100",
      fillOpacity: 0.8
    }).addTo(mapPredio);
    mapPredio.setView(center, 12);
  }
}

  function setText(id, value) {
    const el = q(id);
    if (el) el.textContent = value;
  }

  function setHTML(id, value) {
    const el = q(id);
    if (el) el.innerHTML = value;
  }

  function setBadgeNumber(id, value) {
    const el = q(id);
    if (!el) return;
    el.textContent = value;
    if (String(value).length >= 4) el.setAttribute("data-wide", "1");
    else el.removeAttribute("data-wide");
  }

  function loadImageWithFallback(imgEl, candidates) {
    if (!imgEl) return;
    let idx = 0;
    const list = candidates.filter(Boolean);
    const tryNext = () => {
      if (idx >= list.length) {
        imgEl.classList.add("is-hidden");
        return;
      }
      imgEl.src = list[idx++];
      imgEl.onerror = tryNext;
      imgEl.onload = () => imgEl.classList.remove("is-hidden");
    };
    tryNext();
  }

  function buildRunways(orientationValue, dimensionValue, materialValue) {
    const oriArr = splitField(orientationValue);
    const dimArr = splitField(dimensionValue);
    const matArr = splitField(materialValue);
    let count = Math.max(oriArr.length, dimArr.length, matArr.length);
    if (!count && (clean(orientationValue) || clean(dimensionValue) || clean(materialValue))) count = 1;

    return Array.from({ length: count }, (_, idx) => ({
      orientation: clean(oriArr[idx] || (idx === 0 ? orientationValue : "")),
      dimension: clean(dimArr[idx] || (idx === 0 ? dimensionValue : "")),
      material: clean(matArr[idx] || (idx === 0 ? materialValue : ""))
    })).filter(item => item.orientation || item.dimension || item.material);
  }

function renderRunways(runways) {
  const listEl = q("runwaysList");
  if (!listEl) return;

  if (!runways.length) {
    listEl.innerHTML = `
      <div class="movement-runway-card">
        <div class="movement-runway-badge">–</div>
        <div class="movement-runway-orientation">Sin dato</div>
        <div class="movement-runway-plane">
          <img src="img/icons/runway.png" alt="Pista">
        </div>
        <div class="movement-runway-length">–</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = runways.map((runway, idx) => `
    <div class="movement-runway-card">
      <div class="movement-runway-badge">${idx + 1}</div>
      <div class="movement-runway-orientation">${escapeHtml(runway.orientation || "–")}</div>
      <div class="movement-runway-plane">
        <img src="img/icons/runway.png" alt="Pista">
      </div>
      <div class="movement-runway-length">${escapeHtml(runway.dimension || "–")}</div>
    </div>
  `).join("");
}



function renderAnnualChart(passengerSeries, flightSeries, currentYear) {
  const svg = q("paxHistoryChart");
  const note = q("paxHistoryNote");
  if (!svg) return;

  if (!passengerSeries.length) {
    svg.innerHTML = "";
    if (note) note.textContent = "No hay datos históricos de pasajeros.";
    return;
  }

  const W = 820, H = 260;
  const padL = 66, padR = 56, padT = 18, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const years = passengerSeries.map(s => s.year);
  const fltMap = new Map((flightSeries || []).map(d => [d.year, d.valor]));

  const paxMax = Math.max(...passengerSeries.map(s => s.valor), 1);
  const fltMax = Math.max(...(flightSeries?.length ? flightSeries : [{ valor: 1 }]).map(s => s.valor), 1);

  const paxScale = buildNiceScale(paxMax, 4);
  const fltScale = buildNiceScale(fltMax, 4);

  const x = i => padL + (innerW * i / Math.max(1, years.length - 1));
  const yPax = v => padT + innerH - (innerH * (v / paxScale.niceMax));
  const yFlt = v => padT + innerH - (innerH * (v / fltScale.niceMax));

  let grid = "";
  paxScale.values.forEach(v => {
    const yy = yPax(v);
    grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${CHART_COLORS.grid}" stroke-width="1"></line>`;
    grid += `<text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="10" fill="${CHART_COLORS.label}">${formatNumber(Math.round(v))}</text>`;
  });

  let rightAxis = "";
  fltScale.values.forEach(v => {
    const yy = yFlt(v);
    rightAxis += `<text x="${W - padR + 8}" y="${yy + 4}" text-anchor="start" font-size="10" fill="${CHART_COLORS.label}">${formatNumber(Math.round(v))}</text>`;  });
const leftAxisLabel = `
  <text x="10" y="${padT + innerH / 2}" transform="rotate(-90 10 ${padT + innerH / 2})"
        text-anchor="middle" font-size="10" fill="#7a838c">Pasajeros</text>
`;

const rightAxisLabel = `
  <text x="${W - 12}" y="${padT + innerH / 2}" transform="rotate(90 ${W - 12} ${padT + innerH / 2})"
        text-anchor="middle" font-size="10" fill="${CHART_COLORS.label}">Movimientos</text>
`;
  let xLabels = "";
  passengerSeries.forEach((d, i) => {
    const xx = x(i);
xLabels += `<text x="${xx}" y="${H - 12}" text-anchor="middle" font-size="10" fill="${CHART_COLORS.label}">${d.year}</text>`;
if (i > 0 && i < passengerSeries.length - 1) {
  xLabels += `<line x1="${xx}" y1="${padT}" x2="${xx}" y2="${padT + innerH}" stroke="${CHART_COLORS.grid}" stroke-width="1"></line>`;
}
  });

  const paxPoints = passengerSeries.map((d, i) => `${x(i)},${yPax(d.valor)}`).join(" ");
  const paxArea = `${padL},${padT + innerH} ${paxPoints} ${x(passengerSeries.length - 1)},${padT + innerH}`;

const flightBarsData = years
  .filter(y => fltMap.has(y))
  .map(y => {
    const i = years.indexOf(y);
    const value = fltMap.get(y);
    return {
      x: x(i),
      y: yFlt(value),
      value,
      year: y
    };
  });

const flightBarWidth = Math.max(6, Math.min(14, innerW / Math.max(1, years.length) * 0.42));

let flightBars = "";
if (flightBarsData.length) {
  flightBars = flightBarsData.map(p => {
    const barHeight = (padT + innerH) - p.y;
    return `<rect x="${p.x - flightBarWidth / 2}" y="${p.y}" width="${flightBarWidth}" height="${barHeight}" rx="1.5" fill="${CHART_COLORS.aircraftBarFill}" stroke="${CHART_COLORS.aircraftBar}" stroke-width="1"></rect>`;  }).join("");
}

  let markers = "";
  passengerSeries.forEach((d, i) => {
    const xx = x(i);
    const yy = yPax(d.valor);
    const isCurrent = d.year === currentYear;
    const isLast = i === passengerSeries.length - 1;

    markers += `<circle cx="${xx}" cy="${yy}" r="${isCurrent ? 4.3 : 3.2}" fill="${isCurrent ? CHART_COLORS.passengersLineDark : CHART_COLORS.passengersLine}"></circle>`;
    if (isCurrent || isLast) {
      const labelX = isLast ? Math.min(xx - 4, W - padR - 2) : xx;
      const anchor = isLast ? "end" : "middle";
      markers += `<text x="${labelX}" y="${yy - 8}" text-anchor="${anchor}" font-size="10" fill="${CHART_COLORS.value}">${formatNumber(Math.round(d.valor))}</text>`;
    }
  });

  svg.innerHTML = `
    <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"></rect>
    ${grid}
    ${xLabels}
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${CHART_COLORS.axis}" stroke-width="1"></line>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="${CHART_COLORS.axis}" stroke-width="1"></line>
${leftAxisLabel}
${rightAxisLabel}
${rightAxis}
${flightBars}
<polygon points="${paxArea}" fill="${CHART_COLORS.passengersArea}" opacity="0.72"></polygon>
<polyline points="${paxPoints}" fill="none" stroke="${CHART_COLORS.passengersLine}" stroke-width="3"></polyline>
${markers}
  `;

  if (note) note.textContent = "Fuente: elaborado por ORSNA con datos de SIAC ANAC.";
}

function getFlightsStats(iata) {
  const movSeries = buildMovSeries(iata, "total");

  if (movSeries.length) {
    const total = sumYear(movSeries, YEAR_REF);
    const daysInYear = (YEAR_REF % 4 === 0 && (YEAR_REF % 100 !== 0 || YEAR_REF % 400 === 0)) ? 366 : 365;
    const weeksInYear = daysInYear / 7;

    return {
      total: total || null,
      weekly: total ? Math.round(total / weeksInYear) : null,
      daily: total ? Math.round(total / daysInYear) : null
    };
  }

  const rowsAll = vuelosRows.filter(r => r.iata === iata);
  if (!rowsAll.length) return { total: null, weekly: null, daily: null };

  let rows = rowsAll;
  const yearRows = rowsAll.filter(r => r.year === YEAR_REF);
  if (yearRows.length) rows = yearRows;

  const total = rows.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
  return {
    total,
    weekly: total ? Math.round(total / 52) : null,
    daily: total ? Math.round(total / 365) : null
  };
}

function getRoutesSummary(iata) {
  const selected = clean(iata).toUpperCase();

  const rowsAll = rutasRows.filter(r =>
    r.endpointA === selected || r.endpointB === selected
  );

  if (!rowsAll.length) {
    return {
      airlinesCount: 0,
      topAirlines: [],
      topDestinationsIntl: [],
      topDestinationsCab: [],
      hasInternational: false
    };
  }

  let rows = rowsAll;
  const yearRows = rowsAll.filter(r => r.year === YEAR_REF);
  if (yearRows.length) rows = yearRows;

  const airlineMap = new Map();
  const countableAirlines = new Set();
  const destMapIntl = new Map();
  const destMapCab = new Map();

  rows.forEach(r => { //cambio desde aqui
const airlineRaw = clean(r.airline);
const forcedCommercialName = getForcedCommercialAirlineName(airlineRaw);
const isGeneralAviation = isGeneralAviationType(r.commercialType);

let airlineLabel = "";

if (forcedCommercialName) {
  /*
    Regla de corrección:
    American Jet, Andes y LADE se consideran aerolíneas comerciales.
    Si Comercial Av Gral = Av. General, se toma como error de clasificación.
  */
  airlineLabel = forcedCommercialName;
} else if (isGeneralAviation || isUnnamedAirline(airlineRaw)) {
  airlineLabel = GENERAL_AVIATION_LABEL;
} else {
  airlineLabel = airlineRaw;
}

airlineMap.set(airlineLabel, (airlineMap.get(airlineLabel) || 0) + r.volume);

/*
  Conteo:
  - American Jet, Andes y LADE cuentan siempre como líneas aéreas.
  - Aviación general / privada no cuenta como línea aérea.
  - Las demás aerolíneas comerciales con nombre válido cuentan normalmente.
*/
if (forcedCommercialName || (!isGeneralAviation && !isUnnamedAirline(airlineRaw))) {
  countableAirlines.add(airlineLabel);
}

    const otherCodeRaw = (r.endpointA === selected) ? r.endpointB : r.endpointA;
    if (!otherCodeRaw || otherCodeRaw === selected) return;

    const otherMeta = getRouteMeta(otherCodeRaw);
    const otherNormalizedCode = clean(otherMeta?.iata || otherCodeRaw).toUpperCase();

    const destinationCode = getEquivalentDestinationCode(selected, otherNormalizedCode);
    if (!destinationCode || destinationCode === selected) return;

    let isCabotaje;
    if (otherMeta) {
      isCabotaje = isArgentinaCountry(otherMeta.pais);
    } else {
      isCabotaje = domesticIATAs.has(otherNormalizedCode);
    }

    const targetMap = isCabotaje ? destMapCab : destMapIntl;
    const key = destinationCode;

    if (!targetMap.has(key)) {
      targetMap.set(key, {
        code: destinationCode,
        volume: 0
      });
    }

    targetMap.get(key).volume += r.volume;
  });

  const airlinesArray = Array.from(airlineMap.entries())
    .map(([name, volume]) => ({ name, volume }))
    .filter(d => d.volume >= MIN_PAX_TO_SHOW)
    .sort((a, b) => b.volume - a.volume);

  const airlinesCount = Array.from(countableAirlines)
    .filter(name => (airlineMap.get(name) || 0) >= MIN_PAX_TO_SHOW)
    .length;

  const intlArray = Array.from(destMapIntl.values())
    .filter(d => d.volume >= MIN_PAX_TO_SHOW)
    .sort((a, b) => b.volume - a.volume);

  const cabArray = Array.from(destMapCab.values())
    .filter(d => d.volume >= MIN_PAX_TO_SHOW)
    .sort((a, b) => b.volume - a.volume);

  return {
    airlinesCount,
    topAirlines: airlinesArray.slice(0, 5),
    topDestinationsIntl: intlArray.slice(0, 5),
    topDestinationsCab: cabArray.slice(0, 5),
    hasInternational: intlArray.length > 0
  };
}
  
function hasRegularFlightsData(iata, year = YEAR_REF) {
  const paxRows = pasajerosMensualRows.filter(r =>
    r.iata === iata &&
    r.date &&
    r.date.getFullYear() === year &&
    Number.isFinite(r.valor) &&
    r.valor > 0
  );

  const movRows = movimientosMensualRows.filter(r =>
    r.iata === iata &&
    r.date &&
    r.date.getFullYear() === year &&
    Number.isFinite(r.valor) &&
    r.valor > 0
  );

  return paxRows.length > 0 || movRows.length > 0;
}
function renderFlights(iata) {
  const stats = getFlightsStats(iata);
  const hasRegularData = hasRegularFlightsData(iata, YEAR_REF);

  if (!hasRegularData) {
    setText("vuelosAnuales", "sin vuelos regulares");
    setText("vuelosSemanales", "–");
    setText("vuelosDiarios", "–");
    return;
  }

  setText("vuelosAnuales", stats.total ? formatNumber(Math.round(stats.total)) : "–");
  setText("vuelosSemanales", stats.weekly ? formatNumber(stats.weekly) : "–");
  setText("vuelosDiarios", stats.daily ? formatNumber(stats.daily) : "–");
}

  function renderRoutes(iata) {
    const {
      airlinesCount,
      topAirlines,
      topDestinationsIntl,
      topDestinationsCab,
      hasInternational
    } = getRoutesSummary(iata);

    setText("airlinesCount", airlinesCount ? String(airlinesCount) : "–");

    const airlinesEl = q("topAirlinesList");
    if (airlinesEl) {
      airlinesEl.innerHTML = topAirlines.length
        ? topAirlines.map(a => {
            const logoSrc = getAirlineLogoSrc(a.name);
            return `
              <div class="airline-item">
                <div class="airline-logo-wrap">
                  ${logoSrc ? `<img class="airline-logo" src="${logoSrc}" alt="${escapeHtml(a.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : ""}
                  <div class="airline-name-fallback"${logoSrc ? ` style="display:none"` : ""}>${escapeHtml(a.name)}</div>
                </div>
                <div class="airline-volume">${formatNumber(Math.round(a.volume))} pasajeros</div>
              </div>
            `;
          }).join("")
        : '<div class="airline-empty">Sin datos</div>';
    }

    const destEl = q("topDestinationsList");
    if (!destEl) return;

const renderDestList = (list, isInternational = false) =>
  list.length
    ? list.map(d => {
        const label = getDestinationLabel(d.code, isInternational);

        return `
          <div class="destination-item">
            <div class="destination-pill">${escapeHtml(clean(d.code) || "—")}</div>
            <div class="destination-text">
              <div class="destination-title-line">
                <strong>${escapeHtml(label.ciudad || clean(d.code) || "Sin dato")}</strong>${label.pais ? `<span class="destination-meta"> · ${escapeHtml(label.pais)}</span>` : ""}
              </div>
              <span class="destination-volume">${formatNumber(Math.round(d.volume))} pasajeros</span>
            </div>
          </div>
        `;
      }).join("")
    : '<div class="destination-text">Sin datos</div>';

    if (hasInternational) {
      destEl.innerHTML = `
        <div class="destinations-columns">
          <div class="destinations-column">
            <div class="destinations-column-title">Internacionales</div>
        ${renderDestList(topDestinationsIntl, true)}
    </div>
          <div class="destinations-column">
            <div class="destinations-column-title">Cabotaje</div>
            ${renderDestList(topDestinationsCab, false)}
          </div>
        </div>
      `;
    } else {
      destEl.innerHTML = `
        <div class="destinations-column">
          ${renderDestList(topDestinationsCab, false)}
        </div>
      `;
    }
  }
function ensurePassengerMixDonutHost() {
  const pill = document.querySelector(".passengers-hero-pill");
  if (!pill) return null;

  let host = pill.querySelector(".passenger-split-donut");
  if (!host) {
    host = document.createElement("div");
    host.className = "passenger-split-donut";
    pill.appendChild(host);
  }
  return host;
}

function formatPct1(n) {
  return Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function renderPassengerMixDonut(cab, intl) {
  const host = ensurePassengerMixDonutHost();
  if (!host) return;

  const cabVal = Number(cab) || 0;
  const intlVal = Number(intl) || 0;
  const total = cabVal + intlVal;

  if (!total) {
    host.style.display = "none";
    host.innerHTML = "";
    host.removeAttribute("title");
    return;
  }

  host.style.display = "flex";

  const cabPct = (cabVal / total) * 100;
  const intlPct = (intlVal / total) * 100;

  const r = 24;
  const cx = 40;
  const cy = 40;
  const stroke = 8;
  const circ = 2 * Math.PI * r;

  const cabLen = circ * (cabPct / 100);
  const intlLen = circ * (intlPct / 100);

  const cabPctRound = Math.round(cabPct);
  const intlPctRound = Math.round(intlPct);

  host.title = `Cabotaje ${formatPct1(cabPct)}% · Internacional ${formatPct1(intlPct)}%`;

  host.innerHTML = `
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <circle
        cx="${cx}" cy="${cy}" r="${r}"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        stroke-width="${stroke}">
      </circle>

      <g transform="rotate(-90 ${cx} ${cy})">
        <circle
          cx="${cx}" cy="${cy}" r="${r}"
          fill="none"
          stroke="#c7e4ff"
          stroke-width="${stroke}"
          stroke-linecap="butt"
          stroke-dasharray="${cabLen} ${circ - cabLen}"
          stroke-dashoffset="0">
        </circle>

        <circle
          cx="${cx}" cy="${cy}" r="${r}"
          fill="none"
          stroke="#d5f76d"
          stroke-width="${stroke}"
          stroke-linecap="butt"
          stroke-dasharray="${intlLen} ${circ - intlLen}"
          stroke-dashoffset="${-cabLen}">
        </circle>
      </g>
    </svg>

    <div class="passenger-split-donut-label">
      <strong>${cabPctRound}/${intlPctRound}</strong>
      <span>CAB · INT</span>
    </div>
  `;
}
  function renderPassengers(iata) {
    const totalSeries = buildPaxSeries(iata, "total");
    const cabSeries = buildPaxSeries(iata, "cabotaje");
    const intSeries = buildPaxSeries(iata, "internacional");
    const hasRegularData = hasRegularFlightsData(iata, YEAR_REF);

    const total = sumYear(totalSeries, YEAR_REF);
    const cab = sumYear(cabSeries, YEAR_REF);
    const intl = sumYear(intSeries, YEAR_REF);

setText("paxTotal2025", hasRegularData
  ? (total ? formatNumber(Math.round(total)) : "–")
  : "sin vuelos regulares"
);
setText("paxCab2025", hasRegularData
  ? (cab ? formatNumber(Math.round(cab)) : "–")
  : "–"
);

setText("paxInt2025", hasRegularData
  ? (intl ? formatNumber(Math.round(intl)) : "–")
  : "–"
);

  if (!hasRegularData) {
    renderPassengerMixDonut(0, 0);
  } else {
    renderPassengerMixDonut(cab, intl);
  }
    const daysInYear = (YEAR_REF % 4 === 0 && (YEAR_REF % 100 !== 0 || YEAR_REF % 400 === 0)) ? 366 : 365;
const weeksInYear = daysInYear / 7;

setText("paxPromSemanal", total ? formatNumber(Math.round(total / weeksInYear)) : "–");
setText("paxPromDiario", total ? formatNumber(Math.round(total / daysInYear)) : "–");

renderAnnualChart(
  annualTotals(totalSeries),
  annualMovementTotals(iata),
  YEAR_REF
);
}

  function renderAirport(iataCode) {
    const iata = clean(iataCode).toUpperCase();
    const a = aeropuertos.find(x => clean(x.IATA).toUpperCase() === iata);
    if (!a) return;
    currentIATA = iata;

const ciudadBase = clean(firstNonEmpty(a, [
  "Ciudad",
  "Localidad",
  "Municipio",
  "Ciudad / Localidad",
  "Aeropuerto"
]));

const nombreOficialBase = clean(firstNonEmpty(a, [
  "Nombre del Aeropuerto",
  "Aeropuerto",
  "Denominacion"
]));

let ciudad = ciudadBase;
let nombreOficial = nombreOficialBase;

let tituloFinal = "";

if (iata === "AEP") {
  tituloFinal = "Aeroparque Jorge Newbery (AEP)";
} else if (ciudad && nombreOficial && ciudad !== nombreOficial) {
  tituloFinal = `Aeropuerto de ${ciudad} – ${nombreOficial} (${iata})`;
} else if (ciudad) {
  tituloFinal = `Aeropuerto de ${ciudad} (${iata})`;
} else if (nombreOficial) {
  tituloFinal = `${nombreOficial} (${iata})`;
} else {
  tituloFinal = `Aeropuerto (${iata})`;
}

setText("sheetTitle", "Datos clave por aeropuerto");
q("airportName").innerHTML = `${escapeHtml(tituloFinal)} <span class="sheet-title-year-inline">${YEAR_REF}</span>`;
    const supPredioRaw = firstNonEmpty(a, ["SupPredioHa", "SupPredio"]);
    setText("sumSupPredio", safeValue(supPredioRaw));
    setText("sumTerminal", safeValue(firstNonEmpty(a, ["TerminalM2"])));
    setText("sumSupConcesionada", formatAreaHectares(firstNonEmpty(a, ["SupConcesionadaHa"])));

setText("predioExplotador", clean(firstNonEmpty(a, ["Explotador"])) || "–");

setText(
  "predioSupAreasConcesionadas",
  formatAreaHectares(firstNonEmpty(a, ["SupConcesionadaHa", "Superficie concesionada"]))
);

setText(
  "predioAreasConcesionadas",
  clean(firstNonEmpty(a, ["AreasConcesionadas", "Áreas concesionadas"])) || "–"
);

const concesionHastaRaw = clean(firstNonEmpty(a, ["ConcesionHasta", "Concesionado hasta"]));
const concesionHastaYear = (concesionHastaRaw.match(/\b(19|20)\d{2}\b/) || [])[0] || concesionHastaRaw || "–";
setText("predioConcesionHasta", concesionHastaYear);

setText("predioGrupoConcesion", clean(firstNonEmpty(a, ["Grupo", "GrupoConcesion"])) || "–");

const codigosEl = q("predioCodigos");
const oaci = clean(firstNonEmpty(a, ["OACI"]));
const anac = clean(firstNonEmpty(a, ["ANAC"]));

if (codigosEl) {
  if (oaci || anac || iata) {
    codigosEl.innerHTML = `
      <div class="predio-codes">
        <div class="predio-code-row">
          <span class="predio-code-label">OACI</span>
          <span class="predio-code-value">${escapeHtml(oaci || "–")}</span>
        </div>
        <div class="predio-code-row">
          <span class="predio-code-label">ANAC</span>
          <span class="predio-code-value">${escapeHtml(anac || "–")}</span>
        </div>
        <div class="predio-code-row">
          <span class="predio-code-label">IATA</span>
          <span class="predio-code-value">${escapeHtml(iata || "–")}</span>
        </div>
      </div>
    `;
  } else {
    codigosEl.textContent = "–";
  }
}

setText("predioHabilitacion", clean(firstNonEmpty(a, ["Habilitación", "Habilitacion"])) || "–");

loadImageWithFallback(q("imgTerminal"), [
  clean(firstNonEmpty(a, ["imagenAeropuerto"])),
  `img/Terminales/${iata}_terminal.png`,
  `img/Terminales/${iata}.png`,
  `img/Terminales/${iata}.jpg`,
  `img/Terminales/${iata}.jpeg`
]);

    const orientRaw = clean(firstNonEmpty(a, ["PistaOrientacion"]));
    const dimsRaw = clean(firstNonEmpty(a, ["Dimensiones"]));
    const matRaw = clean(firstNonEmpty(a, ["MaterialPista"]));
    const runways = buildRunways(orientRaw, dimsRaw, matRaw);
    const runwayCount = runways.length;
    setBadgeNumber("badgeCantPistas", runwayCount ? formatNumber(runwayCount) : "–");
    renderRunways(runways);

const psnCom = (parseNumber(firstNonEmpty(a, ["PSNRemotasC"], 0)) || 0) + (parseNumber(firstNonEmpty(a, ["PSNRemotasC_1"], 0)) || 0);
const psnGen = parseNumber(firstNonEmpty(a, ["PSN_C"], 0)) || 0;
const psnTotal = psnCom + psnGen;

setBadgeNumber("badgePsnTotal", psnTotal ? formatNumber(psnTotal) : "–");

const psnComTxt = formatNumber(psnCom);
const psnGenTxt = formatNumber(psnGen);
setText("psnDetalleCompacto", `Comerciales ${psnComTxt} - Av. General ${psnGenTxt}`);
    
    setText("mangasValorBottom", safeValue(firstNonEmpty(a, ["Mangas telescópicas"])));

    setText("horarioOperacion", clean(firstNonEmpty(a, ["Horario de operación", "Horario de operacion"])) || "–");
    setText("claveRef", clean(firstNonEmpty(a, ["CLAVE DE REFERENCIA DE AERÓDROMO", "Clave de referencia", "ClaveRef"])) || "–");

    const radioayudas = clean(firstNonEmpty(a, ["Radioayudas", "Radio ayudas", "Ayudas radioeléctricas"]));
    const ayudasVisuales = clean(firstNonEmpty(a, ["Ayudas visuales", "AyudasVisuales"]));
    setText("radioayudas", radioayudas || "–");
    setText("ayudasVisuales", ayudasVisuales || "–");

    setBadgeNumber("mostradoresCheckin", safeValue(firstNonEmpty(a, ["Mostradores Check in"])));
    setBadgeNumber("kioscosSelf", safeValue(firstNonEmpty(a, ["Kioscos         (self check In)", "Kioscos self check in"])));
    setBadgeNumber("psaTotal", safeValue(firstNonEmpty(a, ["PSAScanTotal"])));
    const psaInter = safeValue(firstNonEmpty(a, ["PSAScanInter"]));
    const psaCab = safeValue(firstNonEmpty(a, ["PSAScanCabot"]));
    setText("psaDetalle", [`Internacional: ${psaInter}`, `Cabotaje: ${psaCab}`].join(" · "));
    setBadgeNumber("aduanaPuestos", safeValue(firstNonEmpty(a, ["Puestos de Aduanas"])));
    setBadgeNumber("migracionesTotal", safeValue(firstNonEmpty(a, ["PuestosMigracionesTot"])));

    const migrDetParts = [];
    if (clean(a["PuestosMigracionesPartidas"])) migrDetParts.push(`Partidas: ${safeValue(a["PuestosMigracionesPartidas"])}`);
    if (clean(a["PuestosMigracionesArribos"])) migrDetParts.push(`Arribos: ${safeValue(a["PuestosMigracionesArribos"])}`);
    setText("migracionesDetalle", migrDetParts.join(" · ") || "–");

    setBadgeNumber("puertasEmbarque", safeValue(firstNonEmpty(a, ["PuertasEmbarqueTotal"])));
    const puertasParts = [];
    if (clean(a["PuertasEmbarqueInter"])) puertasParts.push(`Internacional: ${safeValue(a["PuertasEmbarqueInter"])}`);
    if (clean(a["PuertasEmbarqueCabot"])) puertasParts.push(`Cabotaje: ${safeValue(a["PuertasEmbarqueCabot"])}`);
    if (clean(a["PuertasEmbarqueFlex"])) puertasParts.push(`Flex: ${safeValue(a["PuertasEmbarqueFlex"])}`);
    setText("puertasDetalle", puertasParts.join(" · ") || "–");

    setBadgeNumber("cintasEquipaje", safeValue(firstNonEmpty(a, ["CintasTotal"])));
    const cintasParts = [];
    if (clean(a["CintasInter"])) cintasParts.push(`Internacional: ${safeValue(a["CintasInter"])}`);
    if (clean(a["CintasCabot"])) cintasParts.push(`Cabotaje: ${safeValue(a["CintasCabot"])}`);
    if (clean(a["CintasFlex"])) cintasParts.push(`Flex: ${safeValue(a["CintasFlex"])}`);
    setText("cintasDetalle", cintasParts.join(" · ") || "–");

    setBadgeNumber("carritos", safeValue(firstNonEmpty(a, ["Carritos porta equipajes"])));
    setBadgeNumber("estacionamientoVeh", safeValue(firstNonEmpty(a, ["Estacionamiento Vehicular"])));

    const tr = transportePorIATA[iata] || {};
    const transporteParts = [];
    if (clean(tr.linea)) transporteParts.push(`Líneas: ${clean(tr.linea)}`);
    if (clean(tr.parada)) transporteParts.push(`Parada: ${clean(tr.parada)}`);
    setText("transportePublico", transporteParts.join(" · ") || "Sin dato");

    renderPassengers(iata);
    renderFlights(iata);
    renderRoutes(iata);
    updatePredioMap(a);
  }

  async function loadData() {
    const select = q("airportSelect");
    try {
      const [airportsResp, polygonsResp, pistasResp, terminalesResp, transpResp, paxResp, movimientosResp, vuelosResp, rutasResp, iataWorldResp] = await Promise.all([
        fetch("fuentes/Datos_aeropuertos.geojson"),
        fetch("fuentes/poligonos_aeropuertos.geojson").catch(() => null),
        fetch("fuentes/pistas.geojson").catch(() => null),
        fetch("fuentes/terminalpax.geojson").catch(() => null),
        fetch("fuentes/Paradasapp.csv").catch(() => null),
        fetch("fuentes/pasajeros_aeropuerto_mensual.csv").catch(() => null),
        fetch("fuentes/movimientos_aeropuerto_mensual.csv").catch(() => null),
        fetch("fuentes/vuelos.csv").catch(() => null),
        fetch("fuentes/rutasaereas.csv").catch(() => null),
        fetch("fuentes/ListadoIATAmundo.csv").catch(() => null)
      ]);

      const geojson = await airportsResp.json();
      aeropuertos = (geojson.features || []).map(f => f.properties || {}).filter(p => clean(p.IATA));
      aeropuertos.sort((a, b) => clean(a.IATA).localeCompare(clean(b.IATA), "es"));
      domesticIATAs = new Set(aeropuertos.map(a => clean(a.IATA).toUpperCase()).filter(Boolean));

      if (polygonsResp && polygonsResp.ok) {
        const gj = await polygonsResp.json();
        poligonos = gj.features || [];
      }

      if (pistasResp && pistasResp.ok) {
        const gj = await pistasResp.json();
        pistasFeatures = gj.features || [];
      }

      if (terminalesResp && terminalesResp.ok) {
        const gj = await terminalesResp.json();
        terminalesFeatures = gj.features || [];
      }

      if (transpResp && transpResp.ok) transportePorIATA = parseTransporteCSV(await readTextSmart(transpResp));
      if (paxResp && paxResp.ok) pasajerosMensualRows = parsePasajerosMensualCSV(await readTextSmart(paxResp));
      if (movimientosResp && movimientosResp.ok) movimientosMensualRows = parseMovimientosMensualCSV(await readTextSmart(movimientosResp));
      if (vuelosResp && vuelosResp.ok) vuelosRows = parseVuelosCSV(await readTextSmart(vuelosResp));
      if (rutasResp && rutasResp.ok) rutasRows = parseRutasCSV(await readTextSmart(rutasResp));
      
if (iataWorldResp && iataWorldResp.ok) {
  const parsedWorld = parseIATAMundoCSV(await readTextSmart(iataWorldResp));
  iataWorldIndex = parsedWorld.byIata;
  routeCodeIndex = parsedWorld.byCode;
}
      if (select) {
        select.innerHTML = "";
        aeropuertos.forEach(a => {
          const opt = document.createElement("option");
          const airportName = clean(firstNonEmpty(a, ["Aeropuerto", "Nombre del Aeropuerto", "IATA"]));
            opt.value = clean(a.IATA).toUpperCase();
          opt.textContent = `${airportName} (${clean(a.IATA).toUpperCase()})`;
          select.appendChild(opt);
        });
      }

const params = new URLSearchParams(window.location.search);
const initial = clean(params.get("airport")).toUpperCase() || clean(aeropuertos[0]?.IATA).toUpperCase();

select?.addEventListener("change", e => {
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

if (select) select.value = initial;

try {
  renderAirport(initial);
} catch (err) {
  console.error("Error al renderizar aeropuerto inicial:", err);
}




      
    } catch (err) {
      console.error(err);
      if (select) select.innerHTML = "<option>Error al cargar datos</option>";
    }
  }
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

function getRouteMeta(code) {
  const key = clean(code).toUpperCase();
  if (!key) return null;
  return routeCodeIndex[key] || iataWorldIndex[key] || null;
}

function isArgentinaCountry(value) {
  const p = clean(value).toUpperCase();
  return p === "AR" || p === "ARG" || p === "ARGENTINA" || p.startsWith("AR-");
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
  function initExport() {
    q("btnPrint")?.addEventListener("click", () => window.print());

    q("btnExportPng")?.addEventListener("click", async () => {
      const button = q("btnExportPng");
      const sheet = q("sheetA4");
      if (!sheet || typeof html2canvas === "undefined") return;
      const prev = button.textContent;
      button.disabled = true;
      button.textContent = "Exportando...";
      try {
        const canvas = await html2canvas(sheet, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false
        });
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `datos-clave-${currentIATA || "aeropuerto"}.png`;
        link.click();
      } catch (e) {
        console.error("No se pudo exportar la lámina.", e);
      } finally {
        button.disabled = false;
        button.textContent = prev;
      }
    });
  }

function bootLamina() {
  if (laminaBooted) return;
  if (!q("sheetA4")) return;

  laminaBooted = true;

  initPredioMap();
  initExport();
  loadData();
}

document.addEventListener("DOMContentLoaded", bootLamina);
document.addEventListener("report:partials-ready", bootLamina);
})();
