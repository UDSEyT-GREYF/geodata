/* global L, html2canvas */
(() => {
  "use strict";

  let aeropuertos = [];
  let poligonos = [];
  let pasajerosMensualRows = [];
  let vuelosRows = [];
  let rutasRows = [];
  let transportePorIATA = {};
  let currentIATA = "";

  let mapPredio = null;
  let predioLayer = null;
  let predioMarker = null;

  const YEAR_REF = 2025;
  const PAX_DATASET_CAB = "pasajeros_comerciales_cabotaje_aeropuerto";
  const PAX_DATASET_INT = "pasajeros_comerciales_internacional_aeropuerto";

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

function parseVuelosCSV(text) {
  return parseCSV(text).map(r => {
    const date = parseFechaFlexible(firstNonEmpty(r, ["fecha", "anomes", "año_mes"]));
    const yearNum = parseNumber(firstNonEmpty(r, ["anio", "ano", "year", "año"]));

    return {
      iata: clean(firstNonEmpty(r, [
        "iata",
        "aeropuerto_iata",
        "airport_iata",
        "origen_iata"
      ])).toUpperCase(),

      year: Number.isFinite(yearNum)
        ? Number(yearNum)
        : (date ? date.getFullYear() : 2025),

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
  }).filter(r => r.iata && Number.isFinite(r.valor));
}

function parseRutasCSV(text) {
  return parseCSV(text).map(r => {
    const date = parseFechaFlexible(firstNonEmpty(r, ["fecha", "anomes", "año_mes"]));
    const yearNum = parseNumber(firstNonEmpty(r, ["anio", "ano", "year", "año"]));

    const cityPair = clean(firstNonEmpty(r, ["citypair_iata"])).toUpperCase();
    let originIata = "";
    let destIata = "";

    if (cityPair.includes("-")) {
      const parts = cityPair.split("-").map(s => s.trim());
      originIata = parts[0] || "";
      destIata = parts[1] || "";
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
      iata: clean(firstNonEmpty(r, [
        "iata",
        "aeropuerto_iata",
        "airport_iata",
        "origen_iata"
      ]) || originIata).toUpperCase(),

      airline: clean(firstNonEmpty(r, [
        "aerolinea",
        "aerolinea_nombre",
        "aerolinea_nombre_1",
        "linea_aerea",
        "airline",
        "compania"
      ])),

      destinationCode: clean(firstNonEmpty(r, [
        "destino_iata",
        "iata_destino",
        "destination_iata",
        "ruta_destino_iata"
      ]) || destIata).toUpperCase(),

      destinationName: clean(firstNonEmpty(r, [
        "destino_nombre",
        "destino",
        "destination_name",
        "aeropuerto_destino"
      ]) || destIata),

      volume,

      year: Number.isFinite(yearNum)
        ? Number(yearNum)
        : (date ? date.getFullYear() : 2025)
    };
  }).filter(r => r.iata && Number.isFinite(r.volume));
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

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      crossOrigin: true,
      opacity: 0.45
    }).addTo(mapPredio);
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

  function updatePredioMap(a) {
    if (!mapPredio) return;
    if (predioLayer) {
      mapPredio.removeLayer(predioLayer);
      predioLayer = null;
    }
    if (predioMarker) {
      mapPredio.removeLayer(predioMarker);
      predioMarker = null;
    }

    const iata = clean(a.IATA).toUpperCase();
    const feats = poligonos.filter(f => {
      const p = f.properties || {};
      const code = clean(p.IATA || p.iata || p.iata_code).toUpperCase();
      return code === iata;
    });

    if (feats.length) {
      predioLayer = L.geoJSON(feats, {
        style: {
          color: "#8cd100",
          weight: 2,
          fillColor: "#b8e26b",
          fillOpacity: 0.18
        }
      }).addTo(mapPredio);
      const bounds = predioLayer.getBounds();
      if (bounds.isValid()) {
        setTimeout(() => {
          mapPredio.invalidateSize();
          mapPredio.fitBounds(bounds, { padding: [10, 10] });
        }, 0);
      }
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
      listEl.innerHTML = '<div class="movement-runway-row"><span class="movement-runway-name">Sin información de pistas</span><span></span><span></span></div>';
      return;
    }

    listEl.innerHTML = runways.map((runway, idx) => `
      <div class="movement-runway-row">
        <span class="movement-runway-name">Pista ${escapeHtml(runway.orientation || `#${idx + 1}`)}</span>
        <span class="runway-size-chip">${escapeHtml(runway.dimension || "–")}</span>
        <span class="runway-mat">${escapeHtml(runway.material || "–")}</span>
      </div>
    `).join("");
  }

  function renderAnnualChart(series, currentYear) {
    const svg = q("paxHistoryChart");
    const note = q("paxHistoryNote");
    if (!svg) return;
    if (!series.length) {
      svg.innerHTML = "";
      if (note) note.textContent = "No hay datos históricos de pasajeros.";
      return;
    }

    const W = 820, H = 260;
    const padL = 64, padR = 18, padT = 18, padB = 34;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const maxV = Math.max(...series.map(s => s.valor), 1);
    const x = i => padL + (innerW * i / Math.max(1, series.length - 1));
    const y = v => padT + innerH - (innerH * (v / maxV));

    const tickValues = [0, 0.25, 0.5, 0.75, 1].map(k => maxV * k);
    let grid = "";
    tickValues.forEach(v => {
      const yy = y(v);
      grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#e4e8ee" stroke-width="1"></line>`;
      grid += `<text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="10" fill="#6f7985">${formatNumber(Math.round(v))}</text>`;
    });

    let xLabels = "";
    series.forEach((d, i) => {
      const xx = x(i);
      xLabels += `<text x="${xx}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#6f7985">${d.year}</text>`;
      if (i > 0 && i < series.length - 1) xLabels += `<line x1="${xx}" y1="${padT}" x2="${xx}" y2="${padT + innerH}" stroke="#f1f4f7" stroke-width="1"></line>`;
    });

    const points = series.map((d, i) => `${x(i)},${y(d.valor)}`).join(" ");
    const area = `${padL},${padT + innerH} ${points} ${x(series.length - 1)},${padT + innerH}`;

    let markers = "";
    series.forEach((d, i) => {
      const xx = x(i);
      const yy = y(d.valor);
      const isCurrent = d.year === currentYear;
      const isLast = i === series.length - 1;
      markers += `<circle cx="${xx}" cy="${yy}" r="${isCurrent ? 4.3 : 3.2}" fill="${isCurrent ? "#ef8a27" : "#4b86c5"}"></circle>`;
      if (isCurrent || isLast) {
        markers += `<text x="${xx}" y="${yy - 8}" text-anchor="middle" font-size="10" fill="#4f5965">${formatNumber(Math.round(d.valor))}</text>`;
      }
    });

    svg.innerHTML = `
      <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"></rect>
      ${grid}
      ${xLabels}
      <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="#d1d8e2" stroke-width="1"></line>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#d1d8e2" stroke-width="1"></line>
      <polygon points="${area}" fill="#d7e6f8" opacity="0.70"></polygon>
      <polyline points="${points}" fill="none" stroke="#4b86c5" stroke-width="3"></polyline>
      ${markers}
    `;

    if (note) note.textContent = "Fuente: elaborado por ORSNA con datos de SIAC ANAC.";
  }

  function getFlightsStats(iata) {
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
    const rowsAll = rutasRows.filter(r => r.iata === iata);
    if (!rowsAll.length) return { airlinesCount: null, topAirlines: [], topDestinations: [] };
    let rows = rowsAll;
    const yearRows = rowsAll.filter(r => r.year === YEAR_REF);
    if (yearRows.length) rows = yearRows;

    const airlineMap = new Map();
    const destMap = new Map();

    rows.forEach(r => {
      const airline = r.airline || "Sin dato";
      airlineMap.set(airline, (airlineMap.get(airline) || 0) + r.flights);
      const code = r.destinationCode || "—";
      const name = r.destinationName || code || "Sin dato";
      const key = `${code}|${name}`;
      if (!destMap.has(key)) destMap.set(key, { code, name, flights: 0 });
      destMap.get(key).flights += r.flights;
    });

    return {
      airlinesCount: airlineMap.size,
      topAirlines: Array.from(airlineMap.entries()).map(([name, flights]) => ({ name, flights })).sort((a, b) => b.flights - a.flights).slice(0, 3),
      topDestinations: Array.from(destMap.values()).sort((a, b) => b.flights - a.flights).slice(0, 4)
    };
  }

  function renderFlights(iata) {
    const stats = getFlightsStats(iata);
    setText("vuelosAnuales", stats.total ? formatNumber(Math.round(stats.total)) : "–");
    setText("vuelosSemanales", stats.weekly ? formatNumber(stats.weekly) : "–");
    setText("vuelosDiarios", stats.daily ? formatNumber(stats.daily) : "–");
  }

  function renderRoutes(iata) {
    const { airlinesCount, topAirlines, topDestinations } = getRoutesSummary(iata);
    setText("airlinesCount", airlinesCount ? String(airlinesCount) : "–");

    const airlinesEl = q("topAirlinesList");
    if (airlinesEl) {
      airlinesEl.textContent = topAirlines.length
        ? topAirlines.map(a => `${a.name} · ${formatNumber(Math.round(a.flights))} vuelos`).join("\n")
        : "Sin datos";
    }

    const destEl = q("topDestinationsList");
    if (destEl) {
      destEl.innerHTML = topDestinations.length
        ? topDestinations.map(d => `
          <div class="destination-item">
            <div class="destination-pill">${clean(d.code) || "—"}</div>
            <div class="destination-text"><strong>${clean(d.name) || clean(d.code) || "Sin dato"}</strong><br>${formatNumber(Math.round(d.flights))} vuelos</div>
          </div>
        `).join("")
        : "<div class=\"destination-text\">Sin datos</div>";
    }
  }

  function renderPassengers(iata) {
    const totalSeries = buildPaxSeries(iata, "total");
    const cabSeries = buildPaxSeries(iata, "cabotaje");
    const intSeries = buildPaxSeries(iata, "internacional");

    const total = sumYear(totalSeries, YEAR_REF);
    const cab = sumYear(cabSeries, YEAR_REF);
    const intl = sumYear(intSeries, YEAR_REF);

    setText("paxTotal2025", total ? formatNumber(Math.round(total)) : "–");
    setText("paxCab2025", cab ? formatNumber(Math.round(cab)) : "–");
    setText("paxInt2025", intl ? formatNumber(Math.round(intl)) : "–");
    setText("paxPromSemanal", total ? formatNumber(Math.round(total / 52)) : "–");
    setText("paxPromDiario", total ? formatNumber(Math.round(total / 365)) : "–");

    renderAnnualChart(annualTotals(totalSeries), YEAR_REF);
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

// Ajuste puntual para AEP si no viniera bien desagregado en la tabla
if (iata === "AEP") {
  ciudad = ciudad || "Buenos Aires";
  nombreOficial = "Aeroparque Jorge Newbery";
}

let tituloFinal = "";
if (ciudad && nombreOficial && ciudad !== nombreOficial) {
  tituloFinal = `Aeropuerto de ${ciudad} – ${nombreOficial} (${iata})`;
} else if (ciudad) {
  tituloFinal = `Aeropuerto de ${ciudad} (${iata})`;
} else if (nombreOficial) {
  tituloFinal = `${nombreOficial} (${iata})`;
} else {
  tituloFinal = `Aeropuerto (${iata})`;
}

setText("sheetTitle", "Datos clave por aeropuerto");
setText("airportName", tituloFinal);

    const supPredioRaw = firstNonEmpty(a, ["SupPredioHa", "SupPredio"]);
    setText("sumSupPredio", safeValue(supPredioRaw));
    setText("sumTerminal", safeValue(firstNonEmpty(a, ["TerminalM2"])));
    setText("sumSupConcesionada", formatAreaHectares(firstNonEmpty(a, ["SupConcesionadaHa"])));

    setText("predioExplotador", clean(firstNonEmpty(a, ["Explotador"])) || "–");
    setText("predioAreasConcesionadas", clean(firstNonEmpty(a, ["AreasConcesionadas", "Áreas concesionadas"])) || "–");
    setText("predioGrupoConcesion", clean(firstNonEmpty(a, ["Grupo", "GrupoConcesion"])) || "–");
    setText("predioConcesionHasta", clean(firstNonEmpty(a, ["ConcesionHasta", "Concesionado hasta"])) || "–");

    const codigos = [];
    const oaci = clean(firstNonEmpty(a, ["OACI"]));
    const anac = clean(firstNonEmpty(a, ["ANAC"]));
    if (oaci) codigos.push(`OACI: ${oaci}`);
    if (anac) codigos.push(`ANAC: ${anac}`);
    if (iata) codigos.push(`IATA: ${iata}`);
    setText("predioCodigos", codigos.length ? codigos.join(" · ") : "–");
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
    setText("pistasSubtitulo", runwayCount ? (runwayCount === 1 ? "1 pista registrada" : `${formatNumber(runwayCount)} pistas registradas`) : "Sin información de pistas");
    renderRunways(runways);

    const psnCom = (parseNumber(firstNonEmpty(a, ["PSNRemotasC"], 0)) || 0) + (parseNumber(firstNonEmpty(a, ["PSNRemotasC_1"], 0)) || 0);
    const psnGen = parseNumber(firstNonEmpty(a, ["PSN_C"], 0)) || 0;
    const psnTotal = psnCom + psnGen;
    setBadgeNumber("badgePsnTotal", psnTotal ? formatNumber(psnTotal) : "–");
    setBadgeNumber("psnComercial", psnCom ? formatNumber(psnCom) : "–");
    setBadgeNumber("psnGeneral", psnGen ? formatNumber(psnGen) : "–");
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
      const [airportsResp, polygonsResp, transpResp, paxResp, vuelosResp, rutasResp] = await Promise.all([
        fetch("fuentes/Datos_aeropuertos.geojson"),
        fetch("fuentes/poligonos_aeropuertos.geojson").catch(() => null),
        fetch("fuentes/Paradasapp.csv").catch(() => null),
        fetch("fuentes/pasajeros_aeropuerto_mensual.csv").catch(() => null),
        fetch("fuentes/vuelos.csv").catch(() => null),
        fetch("fuentes/rutasaereas.csv").catch(() => null)
      ]);

      const geojson = await airportsResp.json();
      aeropuertos = (geojson.features || []).map(f => f.properties || {}).filter(p => clean(p.IATA));
      aeropuertos.sort((a, b) => clean(a.IATA).localeCompare(clean(b.IATA), "es"));

      if (polygonsResp && polygonsResp.ok) {
        const gj = await polygonsResp.json();
        poligonos = gj.features || [];
      }
      if (transpResp && transpResp.ok) transportePorIATA = parseTransporteCSV(await transpResp.text());
      if (paxResp && paxResp.ok) pasajerosMensualRows = parsePasajerosMensualCSV(await paxResp.text());
      if (vuelosResp && vuelosResp.ok) vuelosRows = parseVuelosCSV(await vuelosResp.text());
      if (rutasResp && rutasResp.ok) rutasRows = parseRutasCSV(await rutasResp.text());

      if (select) {
        select.innerHTML = "";
        aeropuertos.forEach(a => {
          const opt = document.createElement("option");
          const airportName = clean(firstNonEmpty(a, ["Aeropuerto", "Nombre del Aeropuerto", "IATA"]));          opt.value = clean(a.IATA).toUpperCase();
          opt.textContent = `${airportName} (${clean(a.IATA).toUpperCase()})`;
          select.appendChild(opt);
        });
      }

      const params = new URLSearchParams(window.location.search);
      const initial = clean(params.get("airport")).toUpperCase() || clean(aeropuertos[0]?.IATA).toUpperCase();
      if (select) select.value = initial;
      renderAirport(initial);

      select?.addEventListener("change", e => {
        const value = clean(e.target.value).toUpperCase();
        renderAirport(value);
        const url = new URL(window.location.href);
        url.searchParams.set("airport", value);
        window.history.replaceState({}, "", url);
      });
    } catch (err) {
      console.error(err);
      if (select) select.innerHTML = "<option>Error al cargar datos</option>";
    }
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

  document.addEventListener("DOMContentLoaded", () => {
    initPredioMap();
    initExport();
    loadData();
  });
})();
