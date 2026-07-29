(() => {
  "use strict";

  const DATA_PATHS = {
    paxSna: "fuentes/pasajeros_SNA_mensual.csv",
    airports: "fuentes/Datos_aeropuertos.geojson",
    paxAirport: "fuentes/pasajeros_aeropuerto_mensual.csv",
    rutasHistoricas: "fuentes/rutasaereas.csv",
    rutasH12026: "fuentes/Tabla rutasaereas2026_semestre1.csv"
  };

  const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const BASE_YEAR = 2019;
  const H1_YEAR = 2026;
  const H1_MONTH_LIMIT = 6;
  const H1_LABEL = "2026 1S";

  const EXTRA_ROUTE_IATAS = new Set([
    "TTG", "RYO", "SST", "NEC", "LPG", "GNR", "JNI", "PMQ", "AOL", "LGS", "EPA", "COC",
    "RCQ", "RLO", "TDL", "VLG", "VME"
  ]);

  const INTERNATIONAL_SIGNIFICANCE = {
    minAnnualPax: 10000,
    minAnnualPaxSecondary: 5000,
    minShareOfTotal: 0.02,
    minYearsAboveSecondary: 2
  };

  let rawPaxSnaRows = [];
  let rawPaxAirportRows = [];
  let rawRouteHistoricalRows = [];
  let rawRouteH12026Rows = [];
  let airportOptions = [];
  let domesticIATAs = new Set();
  let routeAliasLookup = new Map();

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
      .replace(/\b(aeropuerto|internacional|nacional|de|del|la|el|comandante|brigadier|mayor|general)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
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
      if (commaCount > 1) s = s.replace(/,/g, "");
      else {
        const decimals = s.length - s.indexOf(",") - 1;
        s = decimals === 3 ? s.replace(",", "") : s.replace(",", ".");
      }
    } else if (dotCount) {
      if (dotCount > 1) s = s.replace(/\./g, "");
      else {
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

  function fmtPct(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "–";
    const sign = value > 0 ? "+" : "";
    return sign + value.toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + "%";
  }

  function pct(value, base) {
    if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) return NaN;
    return ((value / base) - 1) * 100;
  }

  function classForPct(v) {
    if (!Number.isFinite(v)) return "";
    if (v >= 0) return "good";
    return "bad";
  }

  function getYear(row) {
    const y = parseNumber(firstNonEmpty(row, ["anio", "ano", "year", "año"]));
    if (Number.isFinite(y)) return Number(y);

    const raw = firstNonEmpty(row, ["fecha", "periodo_id", "anomes", "año_mes", "ano_mes", "mes_ano"]);
    const s = String(raw || "").trim();

    let m = s.match(/^(\d{4})/);
    if (m) return Number(m[1]);

    m = s.match(/\b(\d{4})\b/);
    return m ? Number(m[1]) : NaN;
  }

  function getMonth(row) {
    const m0 = parseNumber(firstNonEmpty(row, ["mes", "month"]));
    if (Number.isFinite(m0) && m0 >= 1 && m0 <= 12) return Number(m0);

    const raw = firstNonEmpty(row, ["fecha", "periodo_id", "anomes", "año_mes", "ano_mes", "mes_ano"]);
    const s = String(raw || "").trim();

    let m = s.match(/^\d{4}[-/](\d{1,2})/);
    if (m) return Number(m[1]);

    m = s.match(/^(\d{4})(\d{2})$/);
    if (m) return Number(m[2]);

    m = s.match(/^\d{1,2}[-/](\d{1,2})[-/]\d{4}$/);
    if (m) return Number(m[1]);

    return NaN;
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

  function getPassengerValue(row) {
    return getRowValue(row, [
      "valor_pax", "totalpasajeros", "pasajeros", "valor", "pax", "pax_total",
      "total_pax", "pasajeros_totales", "total_pasajeros"
    ]);
  }

  function getAnnualValue(rows, year, segment, iata = null) {
    const code = iata ? clean(iata).toUpperCase() : null;

    return rows
      .filter(r => Number(getYear(r)) === Number(year))
      .filter(r => !code || getIata(r) === code)
      .filter(r => getSegment(r) === segment)
      .reduce((acc, r) => acc + getPassengerValue(r), 0);
  }

  function getPeriodValue(rows, year, segment, iata = null, maxMonth = 12) {
    const code = iata ? clean(iata).toUpperCase() : null;

    return rows
      .filter(r => Number(getYear(r)) === Number(year))
      .filter(r => {
        const month = getMonth(r);
        return Number.isFinite(month) && month >= 1 && month <= maxMonth;
      })
      .filter(r => !code || getIata(r) === code)
      .filter(r => getSegment(r) === segment)
      .reduce((acc, r) => acc + getPassengerValue(r), 0);
  }

  function airportDisplayName(props) {
    const iata = clean(firstNonEmpty(props, ["IATA", "iata"])).toUpperCase();
    if (iata === "AEP") return "Aeroparque Jorge Newbery (AEP)";

    const name = clean(firstNonEmpty(props, [
      "Aeropuerto", "Nombre del Aeropuerto", "Denominacion", "Denominación", "nombre", "name",
      "Ciudad", "Localidad"
    ]));

    return `${name || iata} (${iata})`;
  }

  function buildAirportOptions(geojson) {
    const features = Array.isArray(geojson?.features) ? geojson.features : [];
    const seen = new Set();

    const airports = features
      .map(f => f.properties || {})
      .map(p => {
        const iata = clean(firstNonEmpty(p, ["IATA", "iata"])).toUpperCase();
        if (!iata || seen.has(iata)) return null;
        seen.add(iata);
        return { kind: "airport", iata, label: airportDisplayName(p), props: p };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label, "es"));

    domesticIATAs = new Set(airports.map(a => a.iata));
    EXTRA_ROUTE_IATAS.forEach(iata => domesticIATAs.add(iata));

    return [
      { kind: "sna", iata: "SNA", label: "SNA Sistema Nacional de Aeropuertos" },
      { kind: "airportGroup", iata: "BUE", label: "AEP + EZE Región Buenos Aires", iatas: ["AEP", "EZE"] },
      ...airports
    ];
  }

  function buildRouteAliasLookup() {
    const lookup = new Map();

    airportOptions
      .filter(item => item.kind === "airport")
      .forEach(item => {
        const p = item.props || {};
        [
          item.iata,
          firstNonEmpty(p, ["OACI", "oaci", "icao"]),
          firstNonEmpty(p, ["Aeropuerto", "Nombre del Aeropuerto", "nombre", "name"]),
          firstNonEmpty(p, ["Ciudad", "Localidad", "Municipio"])
        ].forEach(v => {
          const key = normalizeText(v);
          if (key) lookup.set(key, item.iata);
        });
      });

    const manual = {
      TTG: ["Tartagal", "General Enrique Mosconi", "Gral Enrique Mosconi"],
      RYO: ["Rio Turbio", "Río Turbio", "28 de Noviembre"],
      SST: ["Santa Teresita"],
      NEC: ["Necochea"],
      LPG: ["La Plata"],
      GNR: ["General Roca", "Gral Roca"],
      JNI: ["Junin", "Junín"],
      PMQ: ["Perito Moreno"],
      AOL: ["Paso de los Libres"],
      LGS: ["Malargue", "Malargüe"],
      EPA: ["El Palomar", "Palomar"],
      COC: ["Concordia"],
      RCQ: ["Reconquista"],
      RLO: ["Valle del Conlara", "Conlara", "Merlo", "Villa de Merlo"],
      TDL: ["Tandil"],
      VLG: ["Villa Gesell"],
      VME: ["Villa Mercedes"]
    };

    Object.entries(manual).forEach(([iata, names]) => {
      lookup.set(normalizeText(iata), iata);
      names.forEach(name => lookup.set(normalizeText(name), iata));
    });

    return lookup;
  }

  function resolveRouteTerm(value) {
    const raw = clean(value).toUpperCase();
    if (!raw) return "";
    if (/^[A-Z0-9]{2,4}$/.test(raw)) return raw;

    const paren = raw.match(/\(([A-Z0-9]{2,4})\)/);
    if (paren) return paren[1];

    return routeAliasLookup.get(normalizeText(value)) || raw;
  }

  function splitRoutePair(raw) {
    const route = clean(raw);
    if (!route) return ["", ""];

    const parts = route
      .split(/\s*(?:-|–|—|→|>|\/|\\)\s*/)
      .map(p => p.trim())
      .filter(Boolean);

    return [resolveRouteTerm(parts[0] || ""), resolveRouteTerm(parts[1] || "")];
  }

  function getRouteEndpoints(row) {
    const cityPair = firstNonEmpty(row, [
      "citypair_iata", "city_pair_iata", "citypair", "city_pair", "city pair",
      "ruta_iata", "origen_destino"
    ]);

    let [a, b] = splitRoutePair(cityPair);

    if (!a || !b) {
      const routeText = firstNonEmpty(row, [
        "ruta_completa", "ruta completa", "ruta", "descripcion_ruta", "descripción_ruta"
      ]);
      [a, b] = splitRoutePair(routeText);
    }

    const origen = resolveRouteTerm(firstNonEmpty(row, ["origen_iata", "origen", "origin"]));
    const destino = resolveRouteTerm(firstNonEmpty(row, ["destino_iata", "destino", "destination"]));

    if ((!a || !b) && origen && destino) return [origen, destino];

    return [clean(a).toUpperCase(), clean(b).toUpperCase()];
  }

  function classifyRouteSegment(selectedIata, otherCode) {
    const selected = clean(selectedIata).toUpperCase();
    const other = clean(otherCode).toUpperCase();

    if (!other || other === selected) return "cabotaje";

    if (domesticIATAs.has(other)) return "cabotaje";

    return "internacional";
  }

  function getRouteYear(row) {
    return getYear(row);
  }

  function getRouteMonth(row) {
    return getMonth(row);
  }

  function getRoutePax(row) {
    return getPassengerValue(row);
  }

  function getRouteValueForAirport(routeRows, iata, year, segment, maxMonth = null) {
    const selected = clean(iata).toUpperCase();
    if (!selected) return 0;

    return (routeRows || []).reduce((acc, row) => {
      const routeYear = getRouteYear(row);
      if (Number(routeYear) !== Number(year)) return acc;

      if (maxMonth !== null) {
        const month = getRouteMonth(row);
        if (Number.isFinite(month) && (month < 1 || month > maxMonth)) return acc;
      }

      const [a, b] = getRouteEndpoints(row);
      if (a !== selected && b !== selected) return acc;

      const other = a === selected ? b : a;
      const routeSegment = classifyRouteSegment(selected, other);
      if (routeSegment !== segment) return acc;

      return acc + getRoutePax(row);
    }, 0);
  }

  function getAirportAnnualValue(iata, year, segment) {
    const code = clean(iata).toUpperCase();

    if (EXTRA_ROUTE_IATAS.has(code)) {
      const fromRoutes = getRouteValueForAirport(rawRouteHistoricalRows, code, year, segment, null);
      if (fromRoutes > 0) return fromRoutes;
    }

    return getAnnualValue(rawPaxAirportRows, year, segment, code);
  }

  function getAirportPeriodValue(iata, year, segment, maxMonth) {
    const code = clean(iata).toUpperCase();

    if (EXTRA_ROUTE_IATAS.has(code) && Number(year) === H1_YEAR) {
      const fromRoutesH1 = getRouteValueForAirport(rawRouteH12026Rows, code, year, segment, maxMonth);
      if (fromRoutesH1 > 0) return fromRoutesH1;
    }

    if (EXTRA_ROUTE_IATAS.has(code)) {
      const fromRoutes = getRouteValueForAirport(rawRouteHistoricalRows, code, year, segment, maxMonth);
      if (fromRoutes > 0) return fromRoutes;
    }

    return getPeriodValue(rawPaxAirportRows, year, segment, code, maxMonth);
  }

  function buildAnnualRowsForAirport(iata) {
    return YEARS.map(year => {
      const cab = getAirportAnnualValue(iata, year, "cabotaje");
      const intl = getAirportAnnualValue(iata, year, "internacional");
      return {
        anio: year,
        pax_cabotaje: cab,
        pax_internacional: intl,
        pax_total: cab + intl
      };
    });
  }

  function buildAnnualRowsForSna() {
    return YEARS.map(year => {
      const cab = getAnnualValue(rawPaxSnaRows, year, "cabotaje");
      const intl = getAnnualValue(rawPaxSnaRows, year, "internacional");
      return {
        anio: year,
        pax_cabotaje: cab,
        pax_internacional: intl,
        pax_total: cab + intl
      };
    });
  }

  function buildAnnualRowsForAirportGroup(iatas) {
    return YEARS.map(year => {
      let cab = 0;
      let intl = 0;
      (iatas || []).forEach(iata => {
        cab += getAirportAnnualValue(iata, year, "cabotaje");
        intl += getAirportAnnualValue(iata, year, "internacional");
      });
      return {
        anio: year,
        pax_cabotaje: cab,
        pax_internacional: intl,
        pax_total: cab + intl
      };
    });
  }

  function getPeriodRowForAirport(iata, year, maxMonth) {
    const cab = getAirportPeriodValue(iata, year, "cabotaje", maxMonth);
    const intl = getAirportPeriodValue(iata, year, "internacional", maxMonth);
    return { anio: year, meses: maxMonth, pax_cabotaje: cab, pax_internacional: intl, pax_total: cab + intl };
  }

  function getPeriodRowForSna(year, maxMonth) {
    const cab = getPeriodValue(rawPaxSnaRows, year, "cabotaje", null, maxMonth);
    const intl = getPeriodValue(rawPaxSnaRows, year, "internacional", null, maxMonth);
    return { anio: year, meses: maxMonth, pax_cabotaje: cab, pax_internacional: intl, pax_total: cab + intl };
  }

  function getPeriodRowForAirportGroup(iatas, year, maxMonth) {
    let cab = 0;
    let intl = 0;
    (iatas || []).forEach(iata => {
      const row = getPeriodRowForAirport(iata, year, maxMonth);
      cab += row.pax_cabotaje;
      intl += row.pax_internacional;
    });
    return { anio: year, meses: maxMonth, pax_cabotaje: cab, pax_internacional: intl, pax_total: cab + intl };
  }

  function getRowsForScope(scope) {
    if (!scope || scope.kind === "sna") return buildAnnualRowsForSna();
    if (scope.kind === "airportGroup") return buildAnnualRowsForAirportGroup(scope.iatas);
    return buildAnnualRowsForAirport(scope.iata);
  }

  function getPeriodRowForScope(scope, year, maxMonth) {
    if (!scope || scope.kind === "sna") return getPeriodRowForSna(year, maxMonth);
    if (scope.kind === "airportGroup") return getPeriodRowForAirportGroup(scope.iatas, year, maxMonth);
    return getPeriodRowForAirport(scope.iata, year, maxMonth);
  }

  function byYearFrom(rows, year) {
    return rows.find(r => Number(r.anio) === Number(year)) || {};
  }

  function hasSignificantInternational(scope) {
    if (scope.kind === "sna" || scope.kind === "airportGroup") return true;

    const rows = getRowsForScope(scope);
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

  function buildCell(value, variation, isBase = false) {
    const varClass = isBase ? "cell-base" : classForPct(variation);
    const varText = isBase ? "base 2019" : fmtPct(variation);

    return `
      <span class="cell-main">${fmt(value)}</span>
      <span class="cell-var ${varClass}">${varText}</span>
    `;
  }

  function buildH1Cell(scope, metricKey) {
    const baseH1 = getPeriodRowForScope(scope, BASE_YEAR, H1_MONTH_LIMIT);
    const curH1 = getPeriodRowForScope(scope, H1_YEAR, H1_MONTH_LIMIT);

    const base = Number(baseH1?.[metricKey]) || 0;
    const value = Number(curH1?.[metricKey]) || 0;
    const variation = pct(value, base);

    return buildCell(value, variation, false);
  }

  function valuationText(var2025, varH1, segmentName) {
    const v2025 = Number(var2025);
    const vh1 = Number(varH1);

    if (Number.isFinite(v2025) && v2025 >= 20) return `Recuperación amplia en ${segmentName}`;
    if (Number.isFinite(v2025) && v2025 >= 5) return `Recuperación consolidada en ${segmentName}`;
    if (Number.isFinite(v2025) && v2025 >= 0) return `Recuperación leve en ${segmentName}`;
    if (Number.isFinite(v2025) && v2025 > -5) return "Igualó prácticamente 2019";
    if (Number.isFinite(v2025) && v2025 > -20) return "Recuperación incompleta";
    if (Number.isFinite(v2025)) return "No recuperó niveles de 2019";

    if (Number.isFinite(vh1) && vh1 >= 0) return `Recuperación parcial en ${H1_LABEL}`;
    return "Sin base comparable suficiente";
  }

  function rowObjectForScope(scope, metricKey) {
    const rows = getRowsForScope(scope);
    const base = byYearFrom(rows, BASE_YEAR);
    const values = {};
    YEARS.forEach(year => {
      const row = byYearFrom(rows, year);
      values[year] = Number(row?.[metricKey]) || 0;
    });

    const baseValue = Number(base?.[metricKey]) || 0;

    const hBase = getPeriodRowForScope(scope, BASE_YEAR, H1_MONTH_LIMIT);
    const hCur = getPeriodRowForScope(scope, H1_YEAR, H1_MONTH_LIMIT);
    const hBaseValue = Number(hBase?.[metricKey]) || 0;
    const hCurValue = Number(hCur?.[metricKey]) || 0;

    return {
      scope,
      baseValue,
      values,
      hBaseValue,
      hCurValue,
      variation2025: pct(values[2025], baseValue),
      variationH1: pct(hCurValue, hBaseValue)
    };
  }

  function airportScopes() {
    return airportOptions.filter(scope => scope.kind === "airport");
  }

  function tableScopesForCabotage() {
    return [
      airportOptions.find(s => s.kind === "sna"),
      airportOptions.find(s => s.kind === "airportGroup"),
      ...airportScopes()
    ].filter(Boolean);
  }

  function tableScopesForInternational() {
    return [
      airportOptions.find(s => s.kind === "sna"),
      airportOptions.find(s => s.kind === "airportGroup"),
      ...airportScopes().filter(hasSignificantInternational)
    ].filter(Boolean);
  }

  function renderPassengerTable(tableId, scopes, metricKey, segmentName) {
    const table = $(tableId);
    if (!table) return [];

    const rows = scopes
      .map(scope => rowObjectForScope(scope, metricKey))
      .filter(row => row.baseValue > 0 || row.values[2025] > 0 || row.hCurValue > 0)
      .sort((a, b) => {
        if (a.scope.kind === "sna") return -1;
        if (b.scope.kind === "sna") return 1;
        if (a.scope.kind === "airportGroup") return -1;
        if (b.scope.kind === "airportGroup") return 1;
        return b.values[2025] - a.values[2025];
      });

    table.querySelector("thead").innerHTML = `
      <tr>
        <th>Aeropuerto</th>
        ${YEARS.map(y => `<th>${y}</th>`).join("")}
        <th>${H1_LABEL}</th>
        <th>Valoración</th>
      </tr>
    `;

    table.querySelector("tbody").innerHTML = rows.map(row => {
      const valuation = valuationText(row.variation2025, row.variationH1, segmentName);
      return `
        <tr>
          <td class="airport-name">${escapeHtml(row.scope.label)}</td>
          ${YEARS.map(year => {
            const value = row.values[year];
            const variation = pct(value, row.baseValue);
            return `<td>${buildCell(value, variation, year === BASE_YEAR)}</td>`;
          }).join("")}
          <td>${buildCell(row.hCurValue, row.variationH1, false)}</td>
          <td class="valuation">${escapeHtml(valuation)}</td>
        </tr>
      `;
    }).join("");

    return rows;
  }

  function topLabels(rows, predicate, limit = 6) {
    return rows
      .filter(predicate)
      .filter(r => r.scope.kind === "airport")
      .slice(0, limit)
      .map(r => r.scope.label);
  }

  function renderConclusions(cabRows, intRows) {
    const cabWide = topLabels(cabRows, r => Number(r.variation2025) >= 20);
    const cabMild = topLabels(cabRows, r => Number(r.variation2025) >= 0 && Number(r.variation2025) < 20);
    const cabNotRecovered = topLabels(cabRows, r => Number(r.variation2025) < 0);
    const cabFallBack = topLabels(cabRows, r => Number(r.variation2025) >= 0 && Number(r.variationH1) < -5);

    const intRecovered = topLabels(intRows, r => Number(r.variation2025) >= 0);
    const intNotRecovered = topLabels(intRows, r => Number(r.variation2025) < 0);
    const intFallBack = topLabels(intRows, r => Number(r.variation2025) >= 0 && Number(r.variationH1) < -5);

    const cabConclusions = $("cabConclusions");
    if (cabConclusions) {
      cabConclusions.innerHTML = `
        <p><strong>Recuperación amplia:</strong> ${cabWide.length ? escapeHtml(cabWide.join("; ")) : "no se identifican casos destacados con el umbral aplicado"}.</p>
        <p><strong>Recuperación leve o nivelación:</strong> ${cabMild.length ? escapeHtml(cabMild.join("; ")) : "sin casos relevantes"}.</p>
        <p><strong>Recuperación incompleta en 2025:</strong> ${cabNotRecovered.length ? escapeHtml(cabNotRecovered.join("; ")) : "sin casos destacados"}.</p>
        <p><strong>Alerta 2026 1S:</strong> ${cabFallBack.length ? `recuperaron en 2025 pero vuelven a caer frente al primer semestre de 2019: ${escapeHtml(cabFallBack.join("; "))}.` : "no se observan retrocesos marcados entre los casos recuperados."}</p>
      `;
    }

    const intConclusions = $("intConclusions");
    if (intConclusions) {
      intConclusions.innerHTML = `
        <p><strong>Recuperación internacional:</strong> ${intRecovered.length ? escapeHtml(intRecovered.join("; ")) : "no se identifican aeropuertos con recuperación plena dentro del universo significativo"}.</p>
        <p><strong>Internacional aún por debajo de 2019:</strong> ${intNotRecovered.length ? escapeHtml(intNotRecovered.join("; ")) : "sin casos destacados"}.</p>
        <p><strong>Alerta 2026 1S:</strong> ${intFallBack.length ? `casos recuperados en 2025 que muestran retroceso frente al primer semestre de 2019: ${escapeHtml(intFallBack.join("; "))}.` : "sin retrocesos marcados en los casos recuperados."}</p>
        <p class="covid-note">La tabla internacional excluye aeropuertos con registros residuales o no significativos, para evitar interpretar variaciones porcentuales extremas sobre bases muy bajas.</p>
      `;
    }

    const cabSummary = $("cabSummaryText");
    if (cabSummary) {
      const sna = cabRows.find(r => r.scope.kind === "sna");
      const bue = cabRows.find(r => r.scope.kind === "airportGroup");
      cabSummary.innerHTML =
        `La tabla sintetiza la recuperación del cabotaje tomando 2019 como base. ` +
        (sna ? `En el SNA, el cabotaje 2025 muestra <strong class="${classForPct(sna.variation2025)}">${fmtPct(sna.variation2025)}</strong> respecto de 2019. ` : "") +
        (bue ? `Para AEP+EZE, la variación 2025/2019 es <strong class="${classForPct(bue.variation2025)}">${fmtPct(bue.variation2025)}</strong>.` : "");
    }

    const intSummary = $("intSummaryText");
    if (intSummary) {
      const sna = intRows.find(r => r.scope.kind === "sna");
      const bue = intRows.find(r => r.scope.kind === "airportGroup");
      intSummary.innerHTML =
        `La tabla internacional muestra solo el SNA, AEP+EZE y aeropuertos con tráfico internacional significativo. ` +
        (sna ? `En el SNA, el tráfico internacional 2025 registra <strong class="${classForPct(sna.variation2025)}">${fmtPct(sna.variation2025)}</strong> respecto de 2019. ` : "") +
        (bue ? `En AEP+EZE, la lectura conjunta permite distinguir recuperación de demanda y redistribución metropolitana del tráfico regional: <strong class="${classForPct(bue.variation2025)}">${fmtPct(bue.variation2025)}</strong> en 2025 vs 2019.` : "");
    }
  }

  function renderReport() {
    const cabRows = renderPassengerTable("cabTable", tableScopesForCabotage(), "pax_cabotaje", "cabotaje");
    const intRows = renderPassengerTable("intTable", tableScopesForInternational(), "pax_internacional", "internacional");
    renderConclusions(cabRows, intRows);
  }

  async function exportPdfA4() {
    const pages = Array.from(document.querySelectorAll(".sheet-a4"));
    const btn = $("btnPdf");

    if (!pages.length) {
      window.print();
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Generando PDF…";
      }

      window.scrollTo(0, 0);
      document.documentElement.classList.add("pdf-exporting");
      document.body.classList.add("pdf-exporting");

      await new Promise(resolve => setTimeout(resolve, 350));

      if (!window.html2canvas || !window.jspdf?.jsPDF) {
        window.print();
        return;
      }

      const pdf = new window.jspdf.jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
      });

      for (let i = 0; i < pages.length; i++) {
        const canvas = await window.html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: pages[i].scrollWidth,
          windowHeight: pages[i].scrollHeight
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.98);

        if (i > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      }

      pdf.save("impacto_covid_aviacion_argentina_pasajeros_a4.pdf");
    } catch (err) {
      console.error("Error exportando PDF A4:", err);
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

      const [
        paxSnaText,
        airportsGJ,
        paxAirportText,
        rutasHistoricasText,
        rutasH12026Text
      ] = await Promise.all([
        fetchText(DATA_PATHS.paxSna),
        fetchJson(DATA_PATHS.airports),
        fetchOptional(DATA_PATHS.paxAirport, "text"),
        fetchOptional(DATA_PATHS.rutasHistoricas, "text"),
        fetchOptional(DATA_PATHS.rutasH12026, "text")
      ]);

      rawPaxSnaRows = parseCSV(paxSnaText);
      rawPaxAirportRows = paxAirportText ? parseCSV(paxAirportText) : [];
      rawRouteHistoricalRows = rutasHistoricasText ? parseCSV(rutasHistoricasText) : [];
      rawRouteH12026Rows = rutasH12026Text ? parseCSV(rutasH12026Text) : [];

      airportOptions = buildAirportOptions(airportsGJ);
      routeAliasLookup = buildRouteAliasLookup();

      renderReport();

      const airportCount = airportOptions.filter(item => item.kind === "airport").length;
      const routeStatus = rawRouteH12026Rows.length
        ? ` · rutas especiales 2026 1S: ${rawRouteH12026Rows.length} filas`
        : " · sin fuente especial 2026 1S";

      setStatus(`Datos cargados · ${airportCount} aeropuertos + SNA + AEP/EZE${routeStatus}.`, "ok");
    } catch (err) {
      console.error(err);
      setStatus(`Error al cargar el informe: ${escapeHtml(err.message || err)}.`, "err");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = $("btnPdf");
    if (btn) btn.addEventListener("click", exportPdfA4);
    load();
  });
})();
