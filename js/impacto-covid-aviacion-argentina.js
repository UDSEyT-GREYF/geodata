(() => {
  "use strict";

  const DATA_PATHS = {
    paxSna: "fuentes/pasajeros_SNA_mensual.csv",
    vuelosSna: "fuentes/vuelos_SNA_mensual.csv",
    airports: "fuentes/Datos_aeropuertos.geojson",
    paxAirport: "fuentes/pasajeros_aeropuerto_mensual.csv",
    movAirport: "fuentes/movimientos_aeropuerto_mensual.csv"
  };

  const YEARS = Array.from({ length: 2025 - 2015 + 1 }, (_, i) => 2015 + i);
  const BASE_YEAR = 2019;
  const DROP_YEAR = 2020;
  const COMPARE_YEAR = 2025;
  const INTERNATIONAL_SIGNIFICANCE = {
    minAnnualPax: 10000,
    minAnnualPaxSecondary: 5000,
    minShareOfTotal: 0.02,
    minYearsAboveSecondary: 2
  };
  
  let rawPaxSnaRows = [];
  let rawVuelosSnaRows = [];
  let rawPaxAirportRows = [];
  let rawMovAirportRows = [];
  let airportOptions = [];
  let currentScope = { kind: "sna", iata: "SNA", label: "SNA Sistema Nacional de Aeropuertos" };

  const $ = id => document.getElementById(id);

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

  function normalizeText(v) {
    return clean(v)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function firstNonEmpty(obj, keys, fallback = "") {
    for (const key of keys) {
      if (!obj) continue;
      const normalizedKey = normalizeHeader(key);
      const value = obj[key] !== undefined ? obj[key] : obj[normalizedKey];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  }

  function detectSep(headerLine) {
    if (headerLine.includes("\t")) return "\t";
    const semi = (headerLine.match(/;/g) || []).length;
    const comma = (headerLine.match(/,/g) || []).length;
    return semi >= comma ? ";" : ",";
  }

  function splitDelimitedLine(line, sep) {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
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
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return [];

    const sep = detectSep(lines[0]);
    const headers = splitDelimitedLine(lines[0], sep).map(normalizeHeader);

    return lines.slice(1).map(line => {
      const cols = splitDelimitedLine(line, sep);
      const row = {};
      headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
      return row;
    });
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
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (commaCount) {
      if (commaCount > 1) {
        s = s.replace(/,/g, "");
      } else {
        const decimals = s.length - s.indexOf(",") - 1;
        s = decimals === 3 ? s.replace(",", "") : s.replace(",", ".");
      }
    } else if (dotCount) {
      if (dotCount > 1) {
        s = s.replace(/\./g, "");
      } else {
        const decimals = s.length - s.indexOf(".") - 1;
        if (decimals === 3) s = s.replace(".", "");
      }
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  async function readTextSmart(response) {
    const buffer = await response.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    return text;
  }

  async function fetchText(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`No se pudo cargar ${url}: HTTP ${resp.status}`);
    return readTextSmart(resp);
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`No se pudo cargar ${url}: HTTP ${resp.status}`);
    return resp.json();
  }

  async function fetchOptional(url, type = "text") {
    try {
      return type === "json" ? await fetchJson(url) : await fetchText(url);
    } catch (err) {
      console.warn(`No se pudo cargar ${url}`, err);
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(message, type = "ok") {
    const el = $("status");
    if (!el) return;
    el.className = `status ${type}`;
    el.innerHTML = message;
  }

  function fmt(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "–";
    return value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }

  function fmtM(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "–";
    return (value / 1_000_000).toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + " M";
  }

  function fmtPct(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "–";
    const sign = value > 0 ? "+" : "";
    return sign + value.toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + "%";
  }

  function fmtIdx(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "–";
    return value.toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  function pct(value, base) {
    if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) return NaN;
    return ((value / base) - 1) * 100;
  }

  function idx(value, base) {
    if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) return NaN;
    return (value / base) * 100;
  }

  function classForPct(v) {
    if (!Number.isFinite(v)) return "";
    if (v >= 0) return "good";
    if (v <= -20) return "bad";
    return "warn";
  }

  function getYear(row) {
    const y = parseNumber(firstNonEmpty(row, ["anio", "ano", "year", "año"]));
    if (Number.isFinite(y)) return Number(y);

    const raw = firstNonEmpty(row, ["fecha", "periodo_id", "anomes", "año_mes", "ano_mes"]);
    const m = String(raw || "").match(/^(\d{4})/);
    return m ? Number(m[1]) : NaN;
  }

  function getSegment(row) {
    const direct = normalizeText(firstNonEmpty(row, ["region", "segmento", "segment"]));
    const dataset = normalizeText(firstNonEmpty(row, ["dataset"]));
    const value = `${direct} ${dataset}`;

    if (value.includes("internacional")) return "internacional";
    if (value.includes("cabotaje") || value.includes("domest")) return "cabotaje";
    return "";
  }

  function getIata(row) {
    return clean(firstNonEmpty(row, ["iata", "IATA", "codigo_iata", "aeropuerto_iata"])).toUpperCase();
  }

  function getRowValue(row, preferredCols) {
    for (const col of preferredCols) {
      const normalized = normalizeHeader(col);
      const value = row[normalized] !== undefined ? row[normalized] : row[col];
      const n = parseNumber(value);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function getAnnualValue(rows, valueCols, year, segment, iata = null) {
    const code = iata ? clean(iata).toUpperCase() : null;

    return rows
      .filter(r => Number(getYear(r)) === Number(year))
      .filter(r => !code || getIata(r) === code)
      .filter(r => getSegment(r) === segment)
      .reduce((acc, r) => acc + getRowValue(r, valueCols), 0);
  }

  function buildAnnualRowsFrom(paxRows, vuelosRows, iata = null) {
    return YEARS.map(year => {
      const paxCab = getAnnualValue(paxRows, ["valor_pax", "pasajeros", "pax", "valor"], year, "cabotaje", iata);
      const paxInt = getAnnualValue(paxRows, ["valor_pax", "pasajeros", "pax", "valor"], year, "internacional", iata);
      const vueloCab = getAnnualValue(vuelosRows, ["valor_vuelos", "valor_movimientos", "vuelos", "movimientos", "valor"], year, "cabotaje", iata);
      const vueloInt = getAnnualValue(vuelosRows, ["valor_vuelos", "valor_movimientos", "vuelos", "movimientos", "valor"], year, "internacional", iata);

      return {
        anio: year,
        pax_cabotaje: paxCab,
        pax_internacional: paxInt,
        pax_total: paxCab + paxInt,
        vuelos_cabotaje: vueloCab,
        vuelos_internacional: vueloInt,
        vuelos_total: vueloCab + vueloInt
      };
    });
  }

  function byYearFrom(rows, year) {
    return rows.find(r => Number(r.anio) === Number(year)) || {};
  }

  function setKpi(idValue, idSub, variation, current, base, formatter) {
    const valueEl = $(idValue);
    const subEl = $(idSub);
    if (!valueEl || !subEl) return;

    valueEl.textContent = fmtPct(variation);
    valueEl.className = `kpi-value ${classForPct(variation)}`;
    subEl.textContent = `${formatter(current)} en ${COMPARE_YEAR} vs ${formatter(base)} en ${BASE_YEAR}`;
  }

  function airportDisplayName(props) {
    const iata = clean(firstNonEmpty(props, ["IATA", "iata"])).toUpperCase();
    if (iata === "AEP") return "Aeroparque Jorge Newbery (AEP)";

    const name = clean(firstNonEmpty(props, [
      "Aeropuerto",
      "Nombre del Aeropuerto",
      "Denominacion",
      "Denominación",
      "nombre",
      "name"
    ]));

    return `${name || iata} (${iata})`;
  }

  function buildAirportOptions(geojson) {
    const features = Array.isArray(geojson?.features) ? geojson.features : [];
    const seen = new Set();

    const rows = features
      .map(f => f.properties || {})
      .map(p => {
        const iata = clean(firstNonEmpty(p, ["IATA", "iata"])).toUpperCase();
        if (!iata || seen.has(iata)) return null;
        seen.add(iata);
        return {
          kind: "airport",
          iata,
          label: airportDisplayName(p)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label, "es"));

    return [
      { kind: "sna", iata: "SNA", label: "SNA Sistema Nacional de Aeropuertos" },
      ...rows
    ];
  }

  function populateScopeSelect() {
    const select = $("scopeSelect");
    if (!select) return;

    select.innerHTML = airportOptions.map(item => (
      `<option value="${escapeHtml(item.iata)}">${escapeHtml(item.label)}</option>`
    )).join("");

    select.value = currentScope.iata;
    select.disabled = false;
  }

  function getRowsForScope(scope) {
    if (!scope || scope.kind === "sna") {
      return buildAnnualRowsFrom(rawPaxSnaRows, rawVuelosSnaRows);
    }
    return buildAnnualRowsFrom(rawPaxAirportRows, rawMovAirportRows, scope.iata);
  }
function hasSignificantInternational(rows) {
  const maxAnnualInt = Math.max(...rows.map(r => Number(r.pax_internacional) || 0));

  const yearsAboveSecondary = rows.filter(r =>
    (Number(r.pax_internacional) || 0) >= INTERNATIONAL_SIGNIFICANCE.minAnnualPaxSecondary
  ).length;

  const maxShare = Math.max(...rows.map(r => {
    const total = Number(r.pax_total) || 0;
    const intl = Number(r.pax_internacional) || 0;
    return total > 0 ? intl / total : 0;
  }));

  return (
    maxAnnualInt >= INTERNATIONAL_SIGNIFICANCE.minAnnualPax ||
    (
      yearsAboveSecondary >= INTERNATIONAL_SIGNIFICANCE.minYearsAboveSecondary &&
      maxShare >= INTERNATIONAL_SIGNIFICANCE.minShareOfTotal
    )
  );
}

function buildRecoveryReading(varTotal, varCab, varInt, includeInternational) {
  const recovered = Number.isFinite(varTotal) && varTotal >= 0;
  const totalText = recovered ? "se recuperó" : "no recuperó todavía";

  if (!includeInternational) {
    if (Number.isFinite(varCab) && varCab >= 0) {
      return `El tráfico comercial ${totalText} respecto del escenario prepandemia y la recuperación se explica por el cabotaje.`;
    }
    return `El tráfico comercial ${totalText} respecto del escenario prepandemia y el componente dominante es el cabotaje.`;
  }

  const cabRecovered = Number.isFinite(varCab) && varCab >= 0;
  const intRecovered = Number.isFinite(varInt) && varInt >= 0;
  const diff = Number.isFinite(varCab) && Number.isFinite(varInt) ? Math.abs(varCab - varInt) : NaN;

  if (cabRecovered && intRecovered) {
    if (Number.isFinite(diff) && diff <= 10) {
      return `El tráfico comercial ${totalText} respecto del escenario prepandemia, con una recuperación relativamente pareja entre cabotaje e internacional.`;
    }
    if (varCab > varInt) {
      return `El tráfico comercial ${totalText} respecto del escenario prepandemia, impulsado principalmente por el cabotaje.`;
    }
    return `El tráfico comercial ${totalText} respecto del escenario prepandemia, impulsado principalmente por el tráfico internacional.`;
  }

  if (cabRecovered && !intRecovered) {
    return `El tráfico comercial ${totalText} respecto del escenario prepandemia: el cabotaje superó el nivel de 2019, mientras que el internacional no lo recuperó.`;
  }

  if (!cabRecovered && intRecovered) {
    return `El tráfico comercial ${totalText} respecto del escenario prepandemia: el internacional superó el nivel de 2019, pero el cabotaje no lo recuperó.`;
  }

  return `El tráfico comercial ${totalText} respecto del escenario prepandemia: ni cabotaje ni internacional alcanzaron los niveles de 2019.`;
}
  
function buildSummaryText(scope, rows, includeInternational) {
  const label = scope.label;
  const y2019 = byYearFrom(rows, BASE_YEAR);
  const y2020 = byYearFrom(rows, DROP_YEAR);
  const y2025 = byYearFrom(rows, COMPARE_YEAR);

  const dropPax = pct(y2020.pax_total, y2019.pax_total);
  const varPax = pct(y2025.pax_total, y2019.pax_total);
  const varCab = pct(y2025.pax_cabotaje, y2019.pax_cabotaje);
  const varInt = pct(y2025.pax_internacional, y2019.pax_internacional);
  const varVuelos = pct(y2025.vuelos_total, y2019.vuelos_total);
  const recoveryText = buildRecoveryReading(varPax, varCab, varInt, includeInternational);

  let text = `<strong>${escapeHtml(recoveryText)}</strong> ` +
    `En <strong>${escapeHtml(label)}</strong>, en 2025 se registraron <strong>${fmt(y2025.pax_total)}</strong> pasajeros, ` +
    `<strong class="${classForPct(varPax)}">${fmtPct(varPax)}</strong> frente a 2019. ` +
    `El shock de 2020 redujo los pasajeros comerciales a <strong>${fmt(y2020.pax_total)}</strong>, ` +
    `con una variación de <strong class="${classForPct(dropPax)}">${fmtPct(dropPax)}</strong> respecto de 2019. ` +
    `La variación 2025 vs 2019 fue de <strong>${fmtPct(varCab)}</strong> en cabotaje`;

  if (includeInternational) {
    text += `, <strong>${fmtPct(varInt)}</strong> en internacional`;
  } else {
    text += `. El tráfico internacional no se muestra como serie analítica independiente por su baja magnitud relativa en la serie histórica`;
  }

  text += ` y <strong>${fmtPct(varVuelos)}</strong> en ${scope.kind === "airport" ? "movimientos" : "vuelos"} totales.`;

  return text;
}

function renderIndexLines(containerId, metricPrefix, rows, includeInternational) {
  const base = byYearFrom(rows, BASE_YEAR);

  const series = [
    {
      key: "total",
      label: "Total",
      color: "#002855",
      values: rows.map(r => ({
        year: r.anio,
        value: idx(r[`${metricPrefix}_total`], base[`${metricPrefix}_total`])
      }))
    },
    {
      key: "cabotaje",
      label: "Cabotaje",
      color: "#2A6FB0",
      values: rows.map(r => ({
        year: r.anio,
        value: idx(r[`${metricPrefix}_cabotaje`], base[`${metricPrefix}_cabotaje`])
      }))
    }
  ];

  if (includeInternational) {
    series.push({
      key: "internacional",
      label: "Internacional",
      color: "#008000",
      values: rows.map(r => ({
        year: r.anio,
        value: idx(r[`${metricPrefix}_internacional`], base[`${metricPrefix}_internacional`])
      }))
    });
  }

  const width = 760;
  const height = 205;
  const pad = { left: 42, right: 104, top: 12, bottom: 25 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const values = series.flatMap(s => s.values.map(d => d.value)).filter(Number.isFinite);
  const maxV = values.length ? Math.max(120, Math.ceil(Math.max(...values) / 10) * 10) : 120;
  const minV = values.length ? Math.min(0, Math.floor(Math.min(...values) / 10) * 10) : 0;
  const span = maxV - minV || 1;

  const x = year => pad.left + ((year - YEARS[0]) / (YEARS[YEARS.length - 1] - YEARS[0])) * innerW;
  const y = value => pad.top + innerH - ((value - minV) / span) * innerH;

  const ticks = [];
  for (let t = Math.ceil(minV / 25) * 25; t <= maxV; t += 25) ticks.push(t);
  if (!ticks.includes(100)) ticks.push(100);
  ticks.sort((a, b) => a - b);

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Índice 2019 igual 100">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>`;

  ticks.forEach(t => {
    const yy = y(t);
    const strong = t === 100;
    svg += `<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="${strong ? "#002855" : "#e5ebf2"}" stroke-dasharray="${strong ? "4,3" : "0"}" opacity="${strong ? ".72" : "1"}"/>
            <text x="${pad.left - 6}" y="${yy + 3}" text-anchor="end" font-size="8.5" fill="#657384">${t}</text>`;
  });

  const yearTicks = [2015, 2019, 2020, 2025];
  yearTicks.forEach(year => {
    const xx = x(year);
    svg += `<line x1="${xx}" y1="${pad.top}" x2="${xx}" y2="${pad.top + innerH}" stroke="#f0f3f7"/>
            <text x="${xx}" y="${height - 8}" text-anchor="middle" font-size="8.5" fill="#657384">${year}</text>`;
  });

  series.forEach((s, sIdx) => {
    const pts = s.values
      .filter(d => Number.isFinite(d.value))
      .map(d => `${x(d.year)},${y(d.value)}`)
      .join(" ");

    svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`;

    s.values
      .filter(d => [BASE_YEAR, DROP_YEAR, COMPARE_YEAR].includes(d.year) && Number.isFinite(d.value))
      .forEach(d => {
        svg += `<circle cx="${x(d.year)}" cy="${y(d.value)}" r="2.3" fill="${s.color}">
          <title>${d.year}: ${fmtIdx(d.value)}</title>
        </circle>`;
      });

    const last = s.values.find(d => d.year === COMPARE_YEAR && Number.isFinite(d.value));
    if (last) {
      const labelX = x(COMPARE_YEAR) + 7;
      let labelY = y(last.value) + (sIdx - 1) * 9;
      labelY = Math.max(11, Math.min(height - 18, labelY));
      svg += `<text x="${labelX}" y="${labelY}" font-size="9" fill="${s.color}" font-weight="800">${s.label}: ${fmtIdx(last.value)}</text>`;
    }
  });

  svg += `<text x="${x(BASE_YEAR) + 4}" y="${y(100) - 5}" font-size="8.5" fill="#002855" font-weight="800">2019 = 100</text>
          <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="#cfd8e3"/>
          <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="#cfd8e3"/>
          </svg>`;

  const el = $(containerId);
  if (el) el.innerHTML = svg;
}

function renderCompareTable(rows, label, includeInternational) {
  const table = $("compareTable");
  if (!table) return;

  const base = byYearFrom(rows, BASE_YEAR);
  const cur = byYearFrom(rows, COMPARE_YEAR);
  const drop = byYearFrom(rows, DROP_YEAR);

  const metrics = [
    ["Pasajeros totales", "pax_total", fmt],
    ["Pasajeros cabotaje", "pax_cabotaje", fmt]
  ];

  if (includeInternational) {
    metrics.push(["Pasajeros internacional", "pax_internacional", fmt]);
  }

  metrics.push(
    ["Vuelos totales", "vuelos_total", fmt],
    ["Vuelos cabotaje", "vuelos_cabotaje", fmt]
  );

  if (includeInternational) {
    metrics.push(["Vuelos internacional", "vuelos_internacional", fmt]);
  }

  table.querySelector("thead").innerHTML = `
    <tr>
      <th>Indicador · ${escapeHtml(label)}</th>
      <th>2019</th>
      <th>2020</th>
      <th>2025</th>
      <th>Var. 2025/2019</th>
      <th>Índice 2025</th>
    </tr>`;

  table.querySelector("tbody").innerHTML = metrics.map(([name, key, formatter]) => {
    const variation = pct(cur[key], base[key]);
    const indexValue = idx(cur[key], base[key]);

    return `<tr>
      <td class="metric-name">${escapeHtml(name)}</td>
      <td>${formatter(base[key])}</td>
      <td>${formatter(drop[key])}</td>
      <td>${formatter(cur[key])}</td>
      <td class="${classForPct(variation)}"><strong>${fmtPct(variation)}</strong></td>
      <td>${fmtIdx(indexValue)}</td>
    </tr>`;
  }).join("");
}

  function renderScope(scope) {
    currentScope = scope;
    const label = scope.label;
    const rows = getRowsForScope(scope);

    const y2019 = byYearFrom(rows, BASE_YEAR);
    const y2025 = byYearFrom(rows, COMPARE_YEAR);

    const paxTotalVar = pct(y2025.pax_total, y2019.pax_total);
    const paxCabVar = pct(y2025.pax_cabotaje, y2019.pax_cabotaje);
    const paxIntVar = pct(y2025.pax_internacional, y2019.pax_internacional);
    const vuelosTotalVar = pct(y2025.vuelos_total, y2019.vuelos_total);
    const includeInternational = hasSignificantInternational(rows);
    const vuelosChartLabel = scope.kind === "airport" ? "Movimientos (aterrizajes y despegues)" : "Vuelos";
    
    $("scopeBadge").textContent = label;
    $("summaryTitle").textContent = `Resumen · ${label}`;
    $("summaryText").innerHTML = buildSummaryText(scope, rows, includeInternational);
    $("paxChartTitle").textContent = `Pasajeros · ${label}`;
    
    const vuelosChartLabel = scope.kind === "airport" ? "Movimientos (aterrizajes y despegues)" : "Vuelos";
    $("vuelosChartTitle").textContent = `${vuelosChartLabel} · ${label}`;
    
    $("tableTitle").textContent = `Comparación 2025 vs 2019 · ${label}`;
    $("footerScope").textContent = `Ámbito: ${label}.`;
          document.querySelectorAll(".legend-int").forEach(el => {
        el.classList.toggle("is-hidden", !includeInternational);
      });
      
      const kpiPaxIntCard = $("kpiPaxIntCard");
      if (kpiPaxIntCard) {
        kpiPaxIntCard.style.display = includeInternational ? "block" : "none";
      }

    setKpi("kpiPaxTotal", "kpiPaxTotalSub", paxTotalVar, y2025.pax_total, y2019.pax_total, fmt);
    setKpi("kpiPaxCab", "kpiPaxCabSub", paxCabVar, y2025.pax_cabotaje, y2019.pax_cabotaje, fmt);
    setKpi("kpiPaxInt", "kpiPaxIntSub", paxIntVar, y2025.pax_internacional, y2019.pax_internacional, fmt);
    setKpi("kpiVuelosTotal", "kpiVuelosTotalSub", vuelosTotalVar, y2025.vuelos_total, y2019.vuelos_total, fmt);

    renderIndexLines("chartPaxIndex", "pax", rows, includeInternational);
    renderIndexLines("chartVuelosIndex", "vuelos", rows, includeInternational);
    renderCompareTable(rows, label, includeInternational);

    const url = new URL(window.location.href);
    if (scope.kind === "airport") url.searchParams.set("iata", scope.iata);
    else url.searchParams.delete("iata");
    window.history.replaceState({}, "", url.toString());
  }

  function selectScopeFromValue(value) {
    const code = clean(value).toUpperCase();
    const scope = airportOptions.find(item => item.iata === code) || airportOptions[0];
    if (!scope) return;
    renderScope(scope);
  }

  function resolveInitialScope() {
    const params = new URLSearchParams(window.location.search);
    const requested = clean(params.get("iata") || params.get("airport")).toUpperCase();
    if (requested) {
      const found = airportOptions.find(item => item.iata === requested);
      if (found) return found;
    }
    return airportOptions[0];
  }

 async function exportPdfA4() {
  const node = $("sheetA4");
  const btn = $("btnPdf");
  if (!node) return window.print();

  const suffix = currentScope.kind === "airport" ? currentScope.iata : "SNA";
  const filename = `impacto_covid_aviacion_argentina_${suffix}_a4.pdf`;

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generando PDF…";
    }

    window.scrollTo(0, 0);
    document.documentElement.classList.add("pdf-exporting");
    document.body.classList.add("pdf-exporting");

    await new Promise(resolve => setTimeout(resolve, 250));

    if (window.html2canvas && window.jspdf?.jsPDF) {
      const canvas = await window.html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: node.offsetWidth,
        height: node.offsetHeight,
        windowWidth: node.offsetWidth,
        windowHeight: node.offsetHeight,
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      const pdf = new window.jspdf.jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
      });

      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      pdf.save(filename);
    } else {
      window.print();
    }
  } catch (err) {
    console.error(err);
    window.print();
  } finally {
    document.documentElement.classList.remove("pdf-exporting");
    document.body.classList.remove("pdf-exporting");

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Descargar PDF A4";
    }
  }
}

  async function load() {
    try {
      setStatus("Cargando datos…", "warn");

      const [paxSnaText, vuelosSnaText, airportsGJ, paxAirportText, movAirportText] = await Promise.all([
        fetchText(DATA_PATHS.paxSna),
        fetchText(DATA_PATHS.vuelosSna),
        fetchJson(DATA_PATHS.airports),
        fetchOptional(DATA_PATHS.paxAirport, "text"),
        fetchOptional(DATA_PATHS.movAirport, "text")
      ]);

      rawPaxSnaRows = parseCSV(paxSnaText);
      rawVuelosSnaRows = parseCSV(vuelosSnaText);
      rawPaxAirportRows = paxAirportText ? parseCSV(paxAirportText) : [];
      rawMovAirportRows = movAirportText ? parseCSV(movAirportText) : [];
      airportOptions = buildAirportOptions(airportsGJ);

      populateScopeSelect();

      const initialScope = resolveInitialScope();
      if (initialScope) {
        const select = $("scopeSelect");
        if (select) select.value = initialScope.iata;
        renderScope(initialScope);
      }

      const airportCount = Math.max(0, airportOptions.length - 1);
      setStatus(`Datos cargados · selector con ${airportCount} aeropuertos + SNA.`, "ok");
    } catch (err) {
      console.error(err);
      setStatus(`Error al cargar el informe: ${escapeHtml(err.message || err)}.`, "err");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const select = $("scopeSelect");
    if (select) {
      select.addEventListener("change", evt => selectScopeFromValue(evt.target.value));
    }

    const btn = $("btnPdf");
    if (btn) btn.addEventListener("click", exportPdfA4);

    load();
  });
})();
