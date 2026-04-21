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
    const ciudad = clean(firstNonEmpty(a, [
      "Ciudad",
      "Localidad",
      "Municipio",
      "Ciudad / Localidad",
      "Aeropuerto"
    ]));
    const nombreOficial = clean(firstNonEmpty(a, [
      "Nombre del Aeropuerto",
      "Aeropuerto",
      "Denominacion"
    ]));

    if (iata === "AEP") return "Aeroparque Jorge Newbery (AEP)";
    if (ciudad && nombreOficial && ciudad !== nombreOficial) {
      return `Aeropuerto de ${ciudad} – ${nombreOficial} (${iata})`;
    }
    if (ciudad) return `Aeropuerto de ${ciudad} (${iata})`;
    if (nombreOficial) return `${nombreOficial} (${iata})`;
    return `Aeropuerto (${iata})`;
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
        monthly: []
      };
    }

    const destinosMap = new Map();
    const airlinesMap = new Map();
    const monthlyMap = new Map();
    const countableAirlines = new Set();

    let totalPax = 0;
    let totalAsientos = 0;
    let totalVuelos = 0;
    let totalFrecuenciaSemanal = 0;
    let totalASK = 0;
    let totalRPK = 0;
    let weightedDistSeats = 0;
    let seatsForWeightedDist = 0;

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
      const freq = Number.isFinite(r.frecuenciaSemanal) ? r.frecuenciaSemanal : 0;
      const dist = Number.isFinite(r.distanciaKm) ? r.distanciaKm : null;

      d.pax += pax;
      d.asientos += asientos;
      d.vuelos += vuelos;
      d.frecuenciaSemanal += freq;

      if (dist !== null) {
        d.distanciaKm = dist;
        d.ask += asientos * dist;
        d.rpk += pax * dist;
      }

      const airlineRaw = clean(r.airline);
      const airlineLabel = isUnnamedAirline(airlineRaw)
        ? "Aviación general / privada"
        : airlineRaw;

      if (!airlinesMap.has(airlineLabel)) {
        airlinesMap.set(airlineLabel, {
          name: airlineLabel,
          pax: 0,
          asientos: 0,
          vuelos: 0
        });
      }

      const a = airlinesMap.get(airlineLabel);
      a.pax += pax;
      a.asientos += asientos;
      a.vuelos += vuelos;

      if (!isUnnamedAirline(airlineRaw)) {
        countableAirlines.add(airlineLabel);
      }

      if (r.anioMes) {
        if (!monthlyMap.has(r.anioMes)) {
          monthlyMap.set(r.anioMes, {
            anioMes: r.anioMes,
            pax: 0,
            asientos: 0,
            vuelos: 0
          });
        }
        const m = monthlyMap.get(r.anioMes);
        m.pax += pax;
        m.asientos += asientos;
        m.vuelos += vuelos;
      }

      totalPax += pax;
      totalAsientos += asientos;
      totalVuelos += vuelos;
      totalFrecuenciaSemanal += freq;

      if (dist !== null) {
        totalASK += asientos * dist;
        totalRPK += pax * dist;
        weightedDistSeats += asientos * dist;
        seatsForWeightedDist += asientos;
      }
    });

    const destinos = Array.from(destinosMap.values())
      .filter(d => (d.pax > 0 || d.asientos > 0 || d.vuelos > 0))
      .sort((a, b) => b.pax - a.pax);

    const airlines = Array.from(airlinesMap.values())
      .filter(a => (a.pax > minValueToShow || a.asientos > minValueToShow || a.vuelos > minValueToShow))
      .sort((a, b) => b.asientos - a.asientos);

    const monthly = Array.from(monthlyMap.values()).sort((a, b) => {
      const da = parseFechaFlexible(a.anioMes);
      const db = parseFechaFlexible(b.anioMes);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
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
      monthly
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

    const labels = rows.map(r => r.anioMes);
    const pax = rows.map(r => Math.round(r.pax || 0));
    const asientos = rows.map(r => Math.round(r.asientos || 0));

    canvas._chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Asientos",
            data: asientos,
            backgroundColor: "rgba(42, 111, 176, 0.22)",
            borderColor: "rgba(42, 111, 176, 1)",
            borderWidth: 1
          },
          {
            type: "line",
            label: "Pasajeros",
            data: pax,
            tension: 0.25,
            borderColor: "#2a6fb0",
            pointRadius: 2.5,
            pointHoverRadius: 4,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          y: {
            beginAtZero: true
          }
        }
      }
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
    setText("odAirlinesCount", summary.airlinesCount ? String(summary.airlinesCount) : "–");
    setText(
      "odFrecuenciaSemanal",
      summary.totalFrecuenciaSemanal ? formatNumber(Math.round(summary.totalFrecuenciaSemanal)) : "–"
    );
    setText(
      "odDistMedia",
      summary.routeDistanceAvgBySeats ? `${formatNumber(Math.round(summary.routeDistanceAvgBySeats))} km` : "–"
    );
    setText(
      "odLoadFactor",
      summary.loadFactor !== null
        ? `${(summary.loadFactor * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`
        : "–"
    );

    const topRoutesEl = q("odTopRoutes");
    if (topRoutesEl) {
      topRoutesEl.innerHTML = summary.destinos.slice(0, 6).map(d => `
        <div class="od-route-row">
          <div class="od-route-main">
            <strong>${escapeHtml(d.ciudad || d.code)}</strong>
            ${d.pais ? `<span class="od-route-country"> · ${escapeHtml(d.pais)}</span>` : ""}
          </div>
          <div class="od-route-metrics">
            <span>${formatNumber(Math.round(d.pax))} pax</span>
            <span>${formatNumber(Math.round(d.asientos))} asientos</span>
            <span>${formatNumber(Math.round(d.vuelos))} vuelos</span>
          </div>
        </div>
      `).join("") || '<div class="od-empty">Sin datos</div>';
    }

    const topAirlinesEl = q("odTopAirlines");
    if (topAirlinesEl) {
      topAirlinesEl.innerHTML = summary.airlines.slice(0, 6).map(a => `
        <div class="od-airline-row">
          <div class="od-airline-name">${escapeHtml(a.name)}</div>
          <div class="od-airline-metrics">
            <span>${formatNumber(Math.round(a.asientos))} asientos</span>
            <span>${formatNumber(Math.round(a.pax))} pax</span>
          </div>
        </div>
      `).join("") || '<div class="od-empty">Sin datos</div>';
    }

    renderOfertaDemandaMonthlyChart(summary.monthly);
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
  iataWorldResp
] = await Promise.all([
  fetch(AEROPUERTOS_GEOJSON_PATH),
  fetch(RUTAS_CSV_PATH).catch(() => null),
  fetch(RUTAS_KM_CSV_PATH).catch(() => null),
  fetch(IATA_MUNDO_CSV_PATH).catch(() => null)
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
          renderAirport(value);

          const url = new URL(window.location.href);
          url.searchParams.set("airport", value);
          window.history.replaceState({}, "", url);
        });
      }

      renderAirport(initial);

    } catch (err) {
      console.error("Error cargando oferta-demanda:", err);
      if (select) select.innerHTML = "<option>Error al cargar datos</option>";
    }
  }

  /* ============================================================
     INIT
     ============================================================ */
  document.addEventListener("DOMContentLoaded", loadData);
})();
