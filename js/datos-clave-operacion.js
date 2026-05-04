/* global L, html2canvas */
(() => {
  "use strict";

  const YEAR_REF = 2025;
  // El gráfico toma automáticamente el primer año disponible en el JSON.
  // No fuerza 2018: si el resumen trae 2022–2025, muestra 2022–2025;
  // si luego el resumen compacto trae 2018–2025, mostrará 2018–2025.
  const CHART_YEAR_FROM = null;
  const TRAFFIC_CLASS_SOURCE = "fuentes/rutas_clase_vuelo_resumen.json";
  const FDO_ROUTES_AA_SOURCE = "fuentes/fdo_rutas_aeropuertos_argentina.json";
  const FDO_AA_SOURCE = "fuentes/fdo_trafico_aeropuertos_argentina.json";
  
  let aeropuertos = [];
  let poligonos = [];
  let pistasFeatures = [];
  let terminalesFeatures = [];
  let operationSummary = { classes: [], routes: [], airlines: [] };
  let fdoRoutesAA = [];
  let fdoTrafficAA = null;
  let iataWorldIndex = {};
  let routeCodeIndex = {};
  let currentIATA = "";

  let mapPredio = null;
  let predioLayer = null;
  let pistasLayer = null;
  let terminalesLayer = null;
  let predioMarker = null;

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

  const FLIGHT_CLASS_ORDER = [
    "Regular Cabotaje",
    "Regular Internacional",
    "No Regular Cabotaje",
    "No Regular Internacional",
    "Av. Gral Cabotaje",
    "Av. Gral Internacional"
  ];

  const CHART_COLORS = {
    regular: "#2A6FB0",
    noRegular: "#C6923A",
    avGral: "#6b2f82",
    grid: "#E4EAF1",
    axis: "#C9D3DF",
    label: "#6F7D8C"
  };

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
        s = decimals === 3 ? s.replace(",", "") : s.replace(",", ".");
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

  function setText(id, value) {
    const el = q(id);
    if (el) el.textContent = value;
  }

  function setBadgeNumber(id, value) {
    const el = q(id);
    if (!el) return;
    el.textContent = value;
    if (String(value).length >= 4) el.setAttribute("data-wide", "1");
    else el.removeAttribute("data-wide");
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

  function parseCSVLine(line, sep) {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === sep && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text) {
    if (!text) return [];
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const sep = detectSep(lines[0]);
    const headers = parseCSVLine(lines[0], sep).map(normalizeHeader);
    return lines.slice(1).map(line => {
      const cols = parseCSVLine(line, sep);
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

  function featureMatchesIATA(feature, iata) {
    const p = feature?.properties || {};
    const code = clean(p.IATA || p.iata || p.iata_code || p.iata_cod || p.codigo_iata).toUpperCase();
    return code === clean(iata).toUpperCase();
  }

  function getAirportCenterLatLng(a) {
    const iata = clean(a.IATA).toUpperCase();
    if (poligonos.length && iata && typeof L !== "undefined") {
      const feats = poligonos.filter(f => featureMatchesIATA(f, iata));
      if (feats.length) {
        const temp = L.geoJSON(feats);
        const bounds = temp.getBounds();
        if (bounds.isValid()) {
          const c = bounds.getCenter();
          return [c.lat, c.lng];
        }
      }
    }
    const lat = firstNonEmpty(a, ["Lat", "LAT", "lat"]);
    const lon = firstNonEmpty(a, ["Lon", "LON", "Long", "long", "lng"]);
    if (lat !== "" && lon !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
      return [Number(lat), Number(lon)];
    }
    return null;
  }

  function initPredioMap() {
    const el = q("mapPredio");
    if (!el || typeof L === "undefined" || mapPredio) return;

    mapPredio = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      touchZoom: false
    }).setView([-34.6, -58.4], 5);

    mapPredio.createPane("panePredio");
    mapPredio.getPane("panePredio").style.zIndex = 410;
    mapPredio.createPane("panePistas");
    mapPredio.getPane("panePistas").style.zIndex = 420;
    mapPredio.createPane("paneTerminales");
    mapPredio.getPane("paneTerminales").style.zIndex = 430;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      crossOrigin: true,
      opacity: 0.50
    }).addTo(mapPredio);
  }

  function updatePredioMap(a) {
    if (!mapPredio) return;

    [predioLayer, pistasLayer, terminalesLayer, predioMarker].forEach(layer => {
      if (layer) mapPredio.removeLayer(layer);
    });
    predioLayer = null;
    pistasLayer = null;
    terminalesLayer = null;
    predioMarker = null;

    const iata = clean(a.IATA).toUpperCase();
    const predioFeats = poligonos.filter(f => featureMatchesIATA(f, iata));
    const pistaFeats = pistasFeatures.filter(f => featureMatchesIATA(f, iata));
    const terminalFeats = terminalesFeatures.filter(f => featureMatchesIATA(f, iata));

    if (predioFeats.length) {
      predioLayer = L.geoJSON(predioFeats, {
        pane: "panePredio",
        style: { color: "#8cd100", weight: 2.4, fillColor: "#b8e26b", fillOpacity: 0.10 }
      }).addTo(mapPredio);
    }

    if (pistaFeats.length) {
      pistasLayer = L.geoJSON(pistaFeats, {
        pane: "panePistas",
        style: { color: "#6a7280", weight: 1, fillColor: "#7b848f", fillOpacity: 0.60 }
      }).addTo(mapPredio);
    }

    if (terminalFeats.length) {
      terminalesLayer = L.geoJSON(terminalFeats, {
        pane: "paneTerminales",
        style: { color: "#2a5fa0", weight: 1.2, fillColor: "#4b86c5", fillOpacity: 0.30 }
      }).addTo(mapPredio);
    }

    const boundsGroup = L.featureGroup([predioLayer, pistasLayer, terminalesLayer].filter(Boolean));
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
          <div class="movement-runway-plane"><img src="img/icons/runway.png" alt="Pista"></div>
          <div class="movement-runway-length">–</div>
        </div>`;
      return;
    }

    listEl.innerHTML = runways.map((runway, idx) => `
      <div class="movement-runway-card">
        <div class="movement-runway-badge">${idx + 1}</div>
        <div class="movement-runway-orientation">${escapeHtml(runway.orientation || "–")}</div>
        <div class="movement-runway-plane"><img src="img/icons/runway.png" alt="Pista"></div>
        <div class="movement-runway-length">${escapeHtml(runway.dimension || "–")}</div>
      </div>
    `).join("");
  }

  function normalizeFlightClass(value) {
    const raw = clean(value);
    const key = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim();

    const isIntl = key.includes("internacional") || key.includes("international");
    const segment = isIntl ? "Internacional" : "Cabotaje";

    if (key.includes("av gral") || key.includes("av general") || key.includes("aviacion general") || key.includes("avgeneral") || key.includes("avgral")) {
      return `Av. Gral ${segment}`;
    }
    if (key.includes("no regular") || key.includes("noregular")) return `No Regular ${segment}`;
    if (key.includes("regular")) return `Regular ${segment}`;
    return raw || "Sin clasificar";
  }

  function operationClassFamily(flightClass) {
    const cls = normalizeFlightClass(flightClass);
    if (cls.startsWith("Av. Gral")) return "Av. Gral";
    if (cls.startsWith("No Regular")) return "No Regular";
    if (cls.startsWith("Regular")) return "Regular";
    return "Sin clasificar";
  }

  function splitRouteCodes(route) {
    return String(route || "").toUpperCase().match(/[A-Z0-9]{3,4}/g) || [];
  }

  function routeHasAirport(route, iata) {
    const selected = clean(iata).toUpperCase();
    return splitRouteCodes(route).includes(selected);
  }

  function getOtherEndpoint(route, selectedIata) {
    const selected = clean(selectedIata).toUpperCase();
    const codes = splitRouteCodes(route);
    const others = codes.filter(code => code !== selected);
    if (others.length) return others[0];
    if (codes.includes(selected)) return selected;
    return "";
  }
  function isFDO(iata) {
    return clean(iata).toUpperCase() === "FDO";
  }

  function fdoShouldUseTrafficRow(row) {
    const cls = clean(row?.clase_vuelo).toLowerCase();
    return cls && !cls.startsWith("cargas");
  }

  function fdoAAOperationClassRows(data) {
    return (data?.anual_clase || [])
      .filter(fdoShouldUseTrafficRow)
      .map(row => ({
        i: "FDO",
        y: Number(row.anio),
        c: normalizeFlightClass(row.clase_vuelo),
        p: Number(row.pasajeros) || 0,
        s: 0,
        v: Number(row.movimientos) || 0,
        source: "aeropuertos_argentina_fdo"
      }))
      .filter(row => Number.isFinite(row.y));
  }

  function getOperationClassRowsAllForAirport(iata) {
    const selected = clean(iata).toUpperCase();

    if (isFDO(selected) && fdoTrafficAA) {
      return fdoAAOperationClassRows(fdoTrafficAA);
    }

    return operationSummary.classes.filter(r => r.i === selected);
  }

  function setOperationTitlesAndNotes(iata) {
    const selected = clean(iata).toUpperCase();
    const isFdoWithAA = isFDO(selected) && fdoTrafficAA;

    const chartNote = document.querySelector(".section-traffic-history .history-note");
    if (chartNote) {
      chartNote.textContent = isFdoWithAA
        ? "Fuente: elaborado por GREyF ORSNA con datos de Aeropuertos Argentina."
        : "Fuente: elaborado por GREyF ORSNA con datos de SIAC ANAC.";
    }

    const routesTitle = q("opTopRoutesList")?.closest(".section-routes")?.querySelector(".section-title");
    if (routesTitle) {
      routesTitle.textContent = isFDO(selected)
        ? "PRINCIPALES RUTAS - FUENTE AEROPUERTOS ARGENTINA"
        : `PRINCIPALES RUTAS ${YEAR_REF}`;
    }

    const airlinesTitle = q("opTopAirlinesList")?.closest(".section-airlines")?.querySelector(".section-title");
    if (airlinesTitle) {
      airlinesTitle.textContent = isFDO(selected)
        ? "PRINCIPALES AEROLÍNEAS"
        : `PRINCIPALES AEROLÍNEAS ${YEAR_REF}`;
    }
  }

function normalizeFDORouteRowKeys(row) {
  const out = {};

  Object.entries(row || {}).forEach(([key, value]) => {
    out[normalizeHeader(key)] = value;
  });

  return out;
}

function getFDORouteRecords(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.routes)) return data.routes;
  if (Array.isArray(data?.rutas)) return data.rutas;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
}

function parseFDORoutesAAJSON(data) {
  const records = getFDORouteRecords(data);

  return records.map(rawRow => {
    const r = normalizeFDORouteRowKeys(rawRow);

    const destino = clean(firstNonEmpty(r, [
      "d",
      "destino",
      "iata_destino",
      "codigo_destino",
      "ruta"
    ])).toUpperCase();

return {
  i: "FDO",
  y: Number(firstNonEmpty(r, [
    "y",
    "anio",
    "ano",
    "año",
    "year"
  ])),
  d: destino,
  p: parseNumber(firstNonEmpty(r, [
        "p",
        "pax",
        "pasajeros",
        "pasajeros_totales",
        "total_pasajeros"
      ])),
      v: parseNumber(firstNonEmpty(r, [
        "v",
        "vuelos",
        "movimientos",
        "vuelos_totales",
        "total_vuelos"
      ])),
      f: parseNumber(firstNonEmpty(r, [
        "f",
        "frecuencia",
        "frecuencias_semanales",
        "frecuencia_semanal"
      ])),
      lf: parseNumber(firstNonEmpty(r, [
        "lf",
        "load_factor",
        "ocupacion",
        "ocupación"
      ]))
    };
}).filter(r =>
  r.i === "FDO" &&
  Number.isFinite(r.y) &&
  r.d &&
  (Number.isFinite(r.p) || Number.isFinite(r.v))
);
}

function getFDORouteDisplayName(code) {
  const c = clean(code).toUpperCase();

  if (!c) return "Sin dato";
  if (c === "FDO") return "Operaciones locales";
  if (c === "-AR") return "Otros destinos de cabotaje";
  if (c === "-EX") return "Otros destinos internacionales";

  if (typeof DEST_OVERRIDES !== "undefined" && DEST_OVERRIDES[c]) {
    const o = DEST_OVERRIDES[c];
    return `${o.ciudad || c} (${c})`;
  }

  const info = routeCodeIndex?.[c] || iataWorldIndex?.[c];

  if (info) {
    const ciudad = clean(info.ciudad || info.city || info.nombre || info.name);
    const pais = clean(info.pais || info.country);

    if (ciudad && pais) return `${ciudad}, ${pais} (${c})`;
    if (ciudad) return `${ciudad} (${c})`;
  }

  return c;
}
  function parseOperationSummaryJSON(data) {
    const normClassRow = d => ({
      i: clean(d.i).toUpperCase(),
      y: Number(d.y),
      c: normalizeFlightClass(d.c),
      p: Number(d.p) || 0,
      s: Number(d.s) || 0,
      v: Number(d.v) || 0
    });

    const normRouteRow = d => ({
      i: clean(d.i).toUpperCase(),
      y: Number(d.y),
      d: clean(d.d).toUpperCase(),
      p: Number(d.p) || 0,
      v: Number(d.v) || 0
    });

    const normAirlineRow = d => ({
      i: clean(d.i).toUpperCase(),
      y: Number(d.y),
      a: clean(d.a),
      p: Number(d.p) || 0,
      v: Number(d.v) || 0
    });

    return {
      classes: Array.isArray(data?.classes) ? data.classes.map(normClassRow).filter(d => d.i && Number.isFinite(d.y)) : [],
      routes: Array.isArray(data?.routes) ? data.routes.map(normRouteRow).filter(d => d.i && Number.isFinite(d.y)) : [],
      airlines: Array.isArray(data?.airlines) ? data.airlines.map(normAirlineRow).filter(d => d.i && Number.isFinite(d.y) && d.a) : []
    };
  }

  function getOperationClassRowsForAirport(iata, year = YEAR_REF) {
    return getOperationClassRowsAllForAirport(iata).filter(r => r.y === year);
  }

  function summarizeOperationTraffic(iata, year = YEAR_REF) {
    const rows = getOperationClassRowsForAirport(iata, year);
    const byClass = new Map();

    FLIGHT_CLASS_ORDER.forEach(cls => {
      byClass.set(cls, { flightClass: cls, pax: 0, seats: 0, flights: 0 });
    });

    rows.forEach(r => {
      const flightClass = normalizeFlightClass(r.c);
      if (!byClass.has(flightClass)) byClass.set(flightClass, { flightClass, pax: 0, seats: 0, flights: 0 });
      const item = byClass.get(flightClass);
      item.pax += Number(r.p) || 0;
      item.seats += Number(r.s) || 0;
      item.flights += Number(r.v) || 0;
    });

    const totalPax = rows.reduce((acc, r) => acc + (Number(r.p) || 0), 0);
    const totalMov = rows.reduce((acc, r) => acc + (Number(r.v) || 0), 0);
    const paxPerMov = totalMov > 0 ? totalPax / totalMov : null;
    return { rows, totalPax, totalMov, paxPerMov, byClass: Array.from(byClass.values()) };
  }

  function renderClassMatrix(iata) {
    const summary = summarizeOperationTraffic(iata, YEAR_REF);
    const el = q("classMatrix");
    if (!el) return;

    const get = cls => summary.byClass.find(d => d.flightClass === cls) || { pax: 0, flights: 0 };
    const rows = [
      { title: "Regular", cab: get("Regular Cabotaje"), intl: get("Regular Internacional") },
      { title: "No regular", cab: get("No Regular Cabotaje"), intl: get("No Regular Internacional") },
      { title: "Av. general", cab: get("Av. Gral Cabotaje"), intl: get("Av. Gral Internacional") }
    ];

    el.innerHTML = `
      <div></div>
      <div class="class-head">Cabotaje</div>
      <div class="class-head">Internacional</div>
      ${rows.map(row => `
        <div class="class-cell class-row-title">${escapeHtml(row.title)}</div>
        <div class="class-cell">
          <div class="class-main-value">${formatNumber(Math.round(row.cab.pax))}</div>
          <div class="class-sub-value">${formatNumber(row.cab.flights)} mov.</div>
        </div>
        <div class="class-cell">
          <div class="class-main-value">${formatNumber(Math.round(row.intl.pax))}</div>
          <div class="class-sub-value">${formatNumber(row.intl.flights)} mov.</div>
        </div>
      `).join("")}
    `;
  }

  function buildOperationFamilyBreakdown(iata, year = YEAR_REF) {
    const summary = summarizeOperationTraffic(iata, year);
    const out = {
      totalPax: summary.totalPax,
      totalMov: summary.totalMov,
      paxPerMov: summary.paxPerMov,
      pax: {
        regular: { total: 0, cab: 0, intl: 0 },
        noRegular: { total: 0, cab: 0, intl: 0 },
        avGral: { total: 0, cab: 0, intl: 0 }
      },
      mov: {
        regular: { total: 0, cab: 0, intl: 0 },
        noRegular: { total: 0, cab: 0, intl: 0 },
        avGral: { total: 0, cab: 0, intl: 0 }
      }
    };

    summary.byClass.forEach(item => {
      const cls = normalizeFlightClass(item.flightClass);
      let family = null;
      if (cls.startsWith("Regular")) family = "regular";
      else if (cls.startsWith("No Regular")) family = "noRegular";
      else if (cls.startsWith("Av. Gral")) family = "avGral";
      if (!family) return;

      const segment = cls.includes("Internacional") ? "intl" : "cab";
      const pax = Number(item.pax) || 0;
      const mov = Number(item.flights) || 0;

      out.pax[family].total += pax;
      out.pax[family][segment] += pax;
      out.mov[family].total += mov;
      out.mov[family][segment] += mov;
    });

    return out;
  }

  function formatIntegerValue(value) {
    const n = Number(value) || 0;
    return n ? formatNumber(Math.round(n)) : "–";
  }

  function formatDecimalValue(value, digits = 1) {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return "–";
    return n.toLocaleString("es-AR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function renderOperationKPIs(iata) {
    const s = buildOperationFamilyBreakdown(iata, YEAR_REF);

    // KPIs superiores: solo totales y promedios. El desglose Regular / No regular / Av. general
    // queda únicamente en el gráfico de evolución, no como tarjetas ni sub-KPIs visibles.
    setText("opPaxTotal2025", formatIntegerValue(s.totalPax));
    setText("opPaxWeekly2025", formatIntegerValue(s.totalPax / 52));
    setText("opPaxDaily2025", formatIntegerValue(s.totalPax / 365));

    setText("opMovTotal2025", formatIntegerValue(s.totalMov));
    setText("opMovWeekly2025", formatIntegerValue(s.totalMov / 52));
    setText("opMovDaily2025", formatIntegerValue(s.totalMov / 365));
    setText("opPaxPorMov2025", formatDecimalValue(s.paxPerMov, 1));
  }
function formatTrafficValue(value, decimals = 0) {
  const n = Number(value) || 0;
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function renderOperationTrafficClassCards(iata) {
  const s = buildOperationFamilyBreakdown(iata, YEAR_REF);
  const el = q("opTrafficClassCards");
  if (!el) return;

  const fmt = value => {
    const n = Number(value) || 0;
    return n ? formatNumber(Math.round(n)) : "–";
  };

  const defs = [
    { key: "regular", title: "Regular", cls: "regular" },
    { key: "noRegular", title: "No regular", cls: "noreg" },
    { key: "avGral", title: "Av. general", cls: "avgral" }
  ];

  el.innerHTML = defs.map(def => {
    const pax = s.pax[def.key];
    const mov = s.mov[def.key];

    return `
      <article class="traffic-class-card traffic-class-${def.cls}">
        <div class="traffic-class-head">${def.title}</div>

        <div class="traffic-class-metrics">
          <div class="traffic-class-metric">
            <div class="traffic-class-label">Pasajeros</div>
            <div class="traffic-class-value">${fmt(pax.total)}</div>
            <div class="traffic-class-sub">Cab. ${fmt(pax.cab)} · Int. ${fmt(pax.intl)}</div>
          </div>

          <div class="traffic-class-metric">
            <div class="traffic-class-label">Movimientos</div>
            <div class="traffic-class-value">${fmt(mov.total)}</div>
            <div class="traffic-class-sub">Cab. ${fmt(mov.cab)} · Int. ${fmt(mov.intl)}</div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}
function getOperationAvailableYears(iata) {
  const selected = clean(iata).toUpperCase();

  const yearsInData = getOperationClassRowsAllForAirport(selected)
    .map(r => Number(r.y))
    .filter(y => Number.isFinite(y) && y <= YEAR_REF && (CHART_YEAR_FROM === null || y >= CHART_YEAR_FROM));

  if (!yearsInData.length) return [YEAR_REF];

  const minYear = CHART_YEAR_FROM === null ? Math.min(...yearsInData) : Math.max(CHART_YEAR_FROM, Math.min(...yearsInData));
  const maxYear = Math.min(YEAR_REF, Math.max(...yearsInData));

  return Array.from(
    { length: maxYear - minYear + 1 },
    (_, idx) => minYear + idx
  );
}

function buildOperationAnnualFamilySeries(iata) {
  const selected = clean(iata).toUpperCase();
  const years = getOperationAvailableYears(selected);

  return years.map(year => {
    const s = buildOperationFamilyBreakdown(selected, year);

    return {
      year,
      regular: s.pax.regular.total,
      noRegular: s.pax.noRegular.total,
      avGral: s.pax.avGral.total,
      paxTotal: s.totalPax,
      movTotal: s.totalMov
    };
  });
}

function renderOperationChart(iata) {
  const svg = q("opTrafficChart");
  if (!svg) return;

  const data = buildOperationAnnualFamilySeries(iata);
  const hasData = data.some(d => d.paxTotal || d.movTotal);

  if (!hasData) {
    svg.innerHTML = `<text x="410" y="105" text-anchor="middle" font-size="14" fill="#6f7d8c">Sin datos para el aeropuerto seleccionado</text>`;
    return;
  }

  const firstYear = data[0]?.year;
  const lastYear = data[data.length - 1]?.year;

  const titleEl = svg.closest(".section-traffic-history")?.querySelector(".section-title");
  if (titleEl && firstYear && lastYear) {
    titleEl.textContent = `EVOLUCIÓN ${firstYear}–${lastYear} POR CLASE DE VUELO`;
  }

  const W = 820;
  const H = 210;
  const padL = 58;
  const padR = 58;
  const padT = 16;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const baseY = padT + innerH;

  const maxPax = Math.max(
    ...data.flatMap(d => [d.regular, d.noRegular, d.avGral]),
    1
  );

  const maxMov = Math.max(...data.map(d => d.movTotal), 1);

  const paxScale = buildNiceScale(maxPax, 4);
  const movScale = buildNiceScale(maxMov, 4);

  const yPax = v => baseY - (innerH * ((Number(v) || 0) / paxScale.niceMax));
  const yMov = v => baseY - (innerH * ((Number(v) || 0) / movScale.niceMax));

  const xGroup = i => {
    if (data.length === 1) return padL + innerW / 2;
    return padL + (innerW * (i / (data.length - 1)));
  };

  const barW = Math.min(28, Math.max(12, innerW / data.length * 0.34));

  let grid = "";
  paxScale.values.forEach(v => {
    const yy = yPax(v);
    grid += `
      <line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${CHART_COLORS.grid}" stroke-width="1"></line>
      <text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="9" fill="${CHART_COLORS.label}">${formatNumber(Math.round(v))}</text>
    `;
  });

  let rightTicks = "";
  movScale.values.forEach(v => {
    const yy = yMov(v);
    rightTicks += `
      <text x="${W - padR + 8}" y="${yy + 4}" text-anchor="start" font-size="9" fill="${CHART_COLORS.label}">${formatNumber(Math.round(v))}</text>
    `;
  });

  let movementBars = "";
  data.forEach((d, i) => {
    const cx = xGroup(i);
    const h = innerH * ((Number(d.movTotal) || 0) / movScale.niceMax);
    const y = baseY - h;

    movementBars += `
      <rect
        x="${cx - barW / 2}"
        y="${y}"
        width="${barW}"
        height="${h}"
        rx="2"
        fill="#f2c983"
        fill-opacity="0.48"
        stroke="#C6923A"
        stroke-width="1">
      </rect>
    `;

    movementBars += `
      <text x="${cx}" y="${H - 10}" text-anchor="middle" font-size="10" fill="${CHART_COLORS.label}">${d.year}</text>
    `;
  });

  function makeLine(key, color) {
    const points = data
      .map((d, i) => `${xGroup(i)},${yPax(d[key])}`)
      .join(" ");

    const dots = data.map((d, i) => {
      const cx = xGroup(i);
      const cy = yPax(d[key]);
      return `<circle cx="${cx}" cy="${cy}" r="2.7" fill="${color}" stroke="#ffffff" stroke-width="1"></circle>`;
    }).join("");

    return `
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></polyline>
      ${dots}
    `;
  }

  const regularLine = makeLine("regular", CHART_COLORS.regular);
  const noRegularLine = makeLine("noRegular", CHART_COLORS.noRegular);
  const avGralLine = makeLine("avGral", CHART_COLORS.avGral);

  svg.innerHTML = `
    <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"></rect>

    ${grid}
    ${rightTicks}

    <line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}" stroke="${CHART_COLORS.axis}" stroke-width="1"></line>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${baseY}" stroke="${CHART_COLORS.axis}" stroke-width="1"></line>
    <line x1="${W - padR}" y1="${padT}" x2="${W - padR}" y2="${baseY}" stroke="${CHART_COLORS.axis}" stroke-width="1"></line>

    <text x="12" y="${padT + innerH / 2}" transform="rotate(-90 12 ${padT + innerH / 2})" text-anchor="middle" font-size="10" fill="${CHART_COLORS.label}">Pasajeros</text>
    <text x="${W - 12}" y="${padT + innerH / 2}" transform="rotate(90 ${W - 12} ${padT + innerH / 2})" text-anchor="middle" font-size="10" fill="${CHART_COLORS.label}">Movimientos</text>

    ${movementBars}
    ${regularLine}
    ${noRegularLine}
    ${avGralLine}
  `;
}

  function getRouteDisplayName(code, selectedIata) {
    const c = clean(code).toUpperCase();
    if (!c) return "Sin dato";
    if (c === clean(selectedIata).toUpperCase()) return "Operaciones locales";
    const override = DEST_OVERRIDES[c];
    if (override) return `${override.ciudad} (${c})`;
    const info = routeCodeIndex[c] || iataWorldIndex[c];
    if (info && info.ciudad) return `${info.ciudad} (${c})`;
    return c;
  }
function getRouteBucket(code, selectedIata) {
  const c = clean(code).toUpperCase();
  const selected = clean(selectedIata).toUpperCase();

  if (!c) return "cabotaje";
  if (c === selected) return "cabotaje";
  if (c === "-AR") return "cabotaje";
  if (c === "-EX") return "internacional";

  if (DEST_OVERRIDES[c]?.pais) {
    return /argentina/i.test(DEST_OVERRIDES[c].pais) ? "cabotaje" : "internacional";
  }

  const info = routeCodeIndex?.[c] || iataWorldIndex?.[c];
  const country = clean(info?.pais || info?.country);

  if (!country) return "cabotaje";
  return /argentina/i.test(country) ? "cabotaje" : "internacional";
}

function formatRouteCardName(name, code) {
  const c = clean(code).toUpperCase();
  const n = clean(name);

  if (!n) return c || "Sin dato";

  const suffix = `(${c})`;
  if (c && n.endsWith(suffix)) {
    return n.slice(0, -suffix.length).trim();
  }
  return n;
}

function buildRouteColumnHTML(title, rows) {
  if (!rows.length) {
    return `
      <div class="route-two-col">
        <div class="route-two-col-title">${escapeHtml(title)}</div>
        <div class="route-two-col-empty">Sin rutas.</div>
      </div>
    `;
  }

  return `
    <div class="route-two-col">
      <div class="route-two-col-title">${escapeHtml(title)}</div>
      <div class="route-two-col-list">
        ${rows.map(d => `
          <div class="route-two-col-item">
            <div class="route-two-col-pill">${escapeHtml(d.code)}</div>
            <div class="route-two-col-body">
              <div class="route-two-col-name">${escapeHtml(formatRouteCardName(d.name, d.code))}</div>
              <div class="route-two-col-meta">
                ${formatNumber(Math.round(d.pax))} pasajeros
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}
function renderOperationTopRoutes(iata) {
  const selected = clean(iata).toUpperCase();
  const el = q("opTopRoutesList");
  if (!el) return;

  let rows = [];
  const isFdoRoutesAA = isFDO(selected) && fdoRoutesAA.length;

  if (isFdoRoutesAA) {
    rows = fdoRoutesAA
      .filter(r => Number(r.y) === YEAR_REF)
      .map(r => ({
        code: r.d,
        name: getFDORouteDisplayName(r.d),
        pax: Number(r.p) || 0,
        flights: Number(r.v) || 0,
        freq: Number(r.f) || null,
        bucket: getRouteBucket(r.d, selected),
        source: "aeropuertos_argentina_fdo"
      }));
  } else {
    rows = (operationSummary.routes || [])
      .filter(r => r.i === selected && r.y === YEAR_REF)
      .map(r => ({
        code: r.d,
        name: getRouteDisplayName(r.d, selected),
        pax: Number(r.p) || 0,
        flights: Number(r.v) || 0,
        freq: Number(r.f) || null,
        bucket: getRouteBucket(r.d, selected),
        source: "rutas_clase_vuelo_resumen"
      }));
  }

  rows = rows
    .filter(d => d.pax > 0 || d.flights > 0)
    .sort((a, b) => b.pax - a.pax);

  if (!rows.length) {
    el.innerHTML = `<div class="operation-empty">Sin datos de rutas para ${YEAR_REF}.</div>`;
    return;
  }

  const intl = rows.filter(d => d.bucket === "internacional").slice(0, 3);
  const cab = rows.filter(d => d.bucket === "cabotaje");

  let leftTitle = "INTERNACIONALES";
  let rightTitle = "CABOTAJE";
  let leftRows = intl;
  let rightRows = cab.slice(0, 3);

  if (!intl.length) {
    const cabTop6 = cab.slice(0, 6);
    leftTitle = "CABOTAJE";
    rightTitle = "CABOTAJE";
    leftRows = cabTop6.slice(0, 3);
    rightRows = cabTop6.slice(3, 6);
  }

  const sourceNote = isFdoRoutesAA
    ? `<div class="operation-source-note">Fuente: elaborado por GREyF ORSNA con datos de Aeropuertos Argentina. Ranking de rutas correspondiente al año ${YEAR_REF}.</div>`
    : `<div class="operation-source-note">Fuente: elaborado por GREyF ORSNA con datos de SIAC ANAC.</div>`;

  el.innerHTML = `
    <div class="routes-two-col-grid">
      ${buildRouteColumnHTML(leftTitle, leftRows)}
      ${buildRouteColumnHTML(rightTitle, rightRows)}
    </div>
    ${sourceNote}
  `;
}

function renderOperationTopAirlines(iata) {
  const selected = clean(iata).toUpperCase();
  const el = q("opTopAirlinesList");
  if (!el) return;

  // FDO: la fuente de Aeropuertos Argentina no trae apertura por aerolínea.
  // Se asume 100% aviación general / privada.
  if (selected === "FDO") {
    const summary = summarizeOperationTraffic(selected, YEAR_REF);
    const pax = Number(summary.totalPax) || 0;
    const mov = Number(summary.totalMov) || 0;

    el.innerHTML = `
      <div class="top-row">
        <div class="top-rank">1</div>
        <div class="top-name">Aviación general / privada</div>
        <div class="top-value">
          ${formatNumber(Math.round(pax))} pax<br>
          ${formatNumber(Math.round(mov))} mov.<br>
          100%
        </div>
      </div>
      <div class="operation-source-note">
        Para FDO se utiliza fuente alternativa de Aeropuertos Argentina. 
        La fuente no cuenta con apertura por línea aérea; por criterio metodológico
        se asigna el 100% a aviación general / privada.
      </div>
    `;
    return;
  }

  const top = operationSummary.airlines
    .filter(d => d.i === selected && d.y === YEAR_REF && d.a)
    .sort((a, b) => (Number(b.p) || 0) - (Number(a.p) || 0))
    .slice(0, 6);

  el.innerHTML = top.length
    ? top.map((d, idx) => `
      <div class="top-row">
        <div class="top-rank">${idx + 1}</div>
        <div class="top-name">${escapeHtml(d.a)}</div>
        <div class="top-value">
          ${formatNumber(Math.round(d.p))} pax<br>
          ${formatNumber(d.v)} mov.
        </div>
      </div>
    `).join("")
    : `<div class="operation-empty">Sin aerolíneas comerciales registradas</div>`;
}

function renderOperationSections(iata) {
  setOperationTitlesAndNotes(iata);
  renderOperationKPIs(iata);
  renderOperationChart(iata);
  renderOperationTopRoutes(iata);
}

  function parseIATAMundoCSV(text) {
    const rows = parseCSV(text);
    const byIata = {};
    const byCode = {};

    rows.forEach(r => {
      const iata = clean(firstNonEmpty(r, ["iata", "codigo_iata", "cod_iata"])).toUpperCase();
      const oaci = clean(firstNonEmpty(r, ["oaci", "icao", "codigo_oaci", "cod_oaci"])).toUpperCase();
      const code = clean(firstNonEmpty(r, ["codigo", "code", "iata_oaci", "cod"])).toUpperCase();
      const ciudad = clean(firstNonEmpty(r, ["ciudad", "city", "localidad", "nombre", "aeropuerto"]));
      const pais = clean(firstNonEmpty(r, ["pais", "país", "country"]));
      const item = { iata, oaci, code, ciudad, pais };
      if (iata) byIata[iata] = item;
      if (iata) byCode[iata] = item;
      if (oaci) byCode[oaci] = item;
      if (code) byCode[code] = item;
    });

    return { byIata, byCode };
  }

  function getAirportTitle(a, iata) {
    const ciudad = clean(firstNonEmpty(a, ["Ciudad", "Localidad", "Municipio", "Ciudad / Localidad", "Aeropuerto"]));
    const nombreOficial = clean(firstNonEmpty(a, ["Nombre del Aeropuerto", "Aeropuerto", "Denominacion"]));

    if (iata === "AEP") return "Aeroparque Jorge Newbery (AEP)";
    if (ciudad && nombreOficial && ciudad !== nombreOficial) return `Aeropuerto de ${ciudad} – ${nombreOficial} (${iata})`;
    if (ciudad) return `Aeropuerto de ${ciudad} (${iata})`;
    if (nombreOficial) return `${nombreOficial} (${iata})`;
    return `Aeropuerto (${iata})`;
  }

function prepareSIGAFrameForSheet(frame) {
  if (!frame) return;

  try {
    const doc = frame.contentDocument || frame.contentWindow?.document;
    const win = frame.contentWindow;
    if (!doc || !win) return;

    const styleId = "siga-sheet-mini-style";
    let style = doc.getElementById(styleId);

    if (!style) {
      style = doc.createElement("style");
      style.id = styleId;
      style.textContent = `
        html,
        body {
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }

        .siga-header,
        .siga-sidebar,
        .siga-layer-panel,
        .siga-basemap-panel,
        .siga-intro,
        .sidebar,
        .map-sidebar,
        .embed-toolbar,
        .map-status {
          display: none !important;
        }

        .siga-layout,
        .mapa-operacion-layout,
        .map-main,
        .siga-map-main,
        .siga-map-shell {
          width: 100vw !important;
          height: 100vh !important;
          display: block !important;
          grid-template-columns: 1fr !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        #sigaMap,
        #map {
          width: 100vw !important;
          height: 100vh !important;
        }

        .leaflet-control-zoom,
        .leaflet-control-layers,
        .leaflet-control-fullscreen,
        .leaflet-control-locate,
        .leaflet-control-geocoder,
        .leaflet-control-measure,
        .leaflet-draw,
        .leaflet-control-minimap,
        .leaflet-control-mouseposition,
        .leaflet-control-easyPrint {
          display: none !important;
        }
      `;
      doc.head.appendChild(style);
    }

    setTimeout(() => {
      win.dispatchEvent(new Event("resize"));
    }, 250);
  } catch (err) {
    console.warn("No se pudo preparar SIGA embebido:", err);
  }
}

function updateSIGAFrame(iata) {
  const frame = q("sigaFrame");
  if (!frame) return;

  const selected = clean(iata).toUpperCase();
  if (!selected) return;

  const src = `siga.html?airport=${encodeURIComponent(selected)}&focus=1&embed=1&mini=1`;

  frame.onload = () => {
    prepareSIGAFrameForSheet(frame);
  };

  if (frame.getAttribute("src") !== src) {
    frame.style.opacity = "0";
    frame.setAttribute("src", src);
  } else {
    prepareSIGAFrameForSheet(frame);
  }

  setTimeout(() => {
    frame.style.opacity = "1";
  }, 450);
}

  function renderAirport(iataCode) {
    const iata = clean(iataCode).toUpperCase();
    const a = aeropuertos.find(x => clean(x.IATA).toUpperCase() === iata);
    if (!a) return;
    currentIATA = iata;
    
    updateSIGAFrame(iata);
    
    const title = getAirportTitle(a, iata);
    setText("sheetTitle", "Datos clave de operación aeroportuaria");
    const airportName = q("airportName");
    if (airportName) airportName.innerHTML = `${escapeHtml(title)} <span class="sheet-title-year-inline">${YEAR_REF}</span>`;

    setText("sumSupPredio", safeValue(firstNonEmpty(a, ["SupPredioHa", "SupPredio"])));
    setText("sumTerminal", safeValue(firstNonEmpty(a, ["TerminalM2"])));
    setText("predioExplotador", clean(firstNonEmpty(a, ["Explotador"])) || "–");
    setText("predioSupAreasConcesionadas", formatAreaHectares(firstNonEmpty(a, ["SupConcesionadaHa", "Superficie concesionada"])));
    setText("predioAreasConcesionadas", clean(firstNonEmpty(a, ["AreasConcesionadas", "Áreas concesionadas"])) || "–");

    const concesionHastaRaw = clean(firstNonEmpty(a, ["ConcesionHasta", "Concesionado hasta"]));
    const concesionHastaYear = (concesionHastaRaw.match(/\b(19|20)\d{2}\b/) || [])[0] || concesionHastaRaw || "–";
    setText("predioConcesionHasta", concesionHastaYear);
    setText("predioGrupoConcesion", clean(firstNonEmpty(a, ["Grupo", "GrupoConcesion"])) || "–");

    const codigosEl = q("predioCodigos");
    const oaci = clean(firstNonEmpty(a, ["OACI"]));
    const anac = clean(firstNonEmpty(a, ["ANAC"]));
    if (codigosEl) {
      codigosEl.innerHTML = `
        <div class="predio-codes">
          <div class="predio-code-row"><span class="predio-code-label">OACI</span><span class="predio-code-value">${escapeHtml(oaci || "–")}</span></div>
          <div class="predio-code-row"><span class="predio-code-label">ANAC</span><span class="predio-code-value">${escapeHtml(anac || "–")}</span></div>
          <div class="predio-code-row"><span class="predio-code-label">IATA</span><span class="predio-code-value">${escapeHtml(iata || "–")}</span></div>
        </div>`;
    }

    setText("predioHabilitacion", clean(firstNonEmpty(a, ["Habilitación", "Habilitacion"])) || "–");

    loadImageWithFallback(q("imgTerminal"), [
      clean(firstNonEmpty(a, ["imagenAeropuerto"])),
      `img/Terminales/${iata}_terminal.png`,
      `img/Terminales/${iata}.png`,
      `img/Terminales/${iata}.jpg`,
      `img/Terminales/${iata}.jpeg`
    ]);

    const runways = buildRunways(
      clean(firstNonEmpty(a, ["PistaOrientacion"])),
      clean(firstNonEmpty(a, ["Dimensiones"])),
      clean(firstNonEmpty(a, ["MaterialPista"]))
    );
    renderRunways(runways);

    const psnCom = (parseNumber(firstNonEmpty(a, ["PSNRemotasC"], 0)) || 0) + (parseNumber(firstNonEmpty(a, ["PSNRemotasC_1"], 0)) || 0);
    const psnGen = parseNumber(firstNonEmpty(a, ["PSN_C"], 0)) || 0;
    const psnTotal = psnCom + psnGen;
    setBadgeNumber("badgePsnTotal", psnTotal ? formatNumber(psnTotal) : "–");
    setText("psnDetalleCompacto", `Comerciales ${formatNumber(psnCom)} - Av. General ${formatNumber(psnGen)}`);

    renderOperationSections(iata);
    updatePredioMap(a);
  }

  function populateSelect(select) {
    if (!select) return;
    select.innerHTML = "";
    aeropuertos.forEach(a => {
      const opt = document.createElement("option");
      const iata = clean(a.IATA).toUpperCase();
      const airportName = clean(firstNonEmpty(a, ["Aeropuerto", "Nombre del Aeropuerto", "Ciudad", "IATA"]));
      opt.value = iata;
      opt.textContent = `${airportName} (${iata})`;
      select.appendChild(opt);
    });
  }

  async function loadData() {
    const select = q("airportSelect");
    try {
 const [
  airportsResp,
  polygonsResp,
  pistasResp,
  terminalesResp,
  operationRoutesResp,
  iataWorldResp,
  fdoRoutesResp,
  fdoAAResp
] = await Promise.all([
  fetch("fuentes/Datos_aeropuertos.geojson"),
  fetch("fuentes/poligonos_aeropuertos.geojson").catch(() => null),
  fetch("fuentes/pistas.geojson").catch(() => null),
  fetch("fuentes/terminalpax.geojson").catch(() => null),
  fetch(TRAFFIC_CLASS_SOURCE).catch(() => null),
  fetch("fuentes/ListadoIATAmundo.csv").catch(() => null),
  fetch(FDO_ROUTES_AA_SOURCE).catch(() => null),
  fetch(FDO_AA_SOURCE).catch(() => null)
]);

      const geojson = await airportsResp.json();
      aeropuertos = (geojson.features || []).map(f => f.properties || {}).filter(p => clean(p.IATA));
      aeropuertos.sort((a, b) => clean(a.IATA).localeCompare(clean(b.IATA), "es"));

      if (polygonsResp && polygonsResp.ok) poligonos = (await polygonsResp.json()).features || [];
      if (pistasResp && pistasResp.ok) pistasFeatures = (await pistasResp.json()).features || [];
      if (terminalesResp && terminalesResp.ok) terminalesFeatures = (await terminalesResp.json()).features || [];
      if (operationRoutesResp && operationRoutesResp.ok) {
        operationSummary = parseOperationSummaryJSON(await operationRoutesResp.json());
      }
      if (fdoRoutesResp && fdoRoutesResp.ok) {
        fdoRoutesAA = parseFDORoutesAAJSON(await fdoRoutesResp.json());
      }
      if (fdoAAResp && fdoAAResp.ok) {
        fdoTrafficAA = await fdoAAResp.json();
      }
      if (iataWorldResp && iataWorldResp.ok) {
        const parsedWorld = parseIATAMundoCSV(await readTextSmart(iataWorldResp));
        iataWorldIndex = parsedWorld.byIata;
        routeCodeIndex = parsedWorld.byCode;
      }

      populateSelect(select);
      initPredioMap();

      const params = new URLSearchParams(window.location.search);
      const initial = clean(params.get("airport")).toUpperCase() || clean(aeropuertos[0]?.IATA).toUpperCase();

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
      console.error(err);
      if (select) select.innerHTML = "<option>Error al cargar datos</option>";
    }
  }

  function bindToolbar() {
    const printBtn = q("btnPrint");
    if (printBtn) printBtn.addEventListener("click", () => window.print());

    const exportBtn = q("btnExportPng");
    if (exportBtn) {
      exportBtn.addEventListener("click", async () => {
        const sheet = q("sheetA4");
        if (!sheet || typeof html2canvas === "undefined") return;
        const canvas = await html2canvas(sheet, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff"
        });
        const a = document.createElement("a");
        a.download = `datos-clave-operacion-${currentIATA || "aeropuerto"}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindToolbar();
    loadData();
  });
})();
