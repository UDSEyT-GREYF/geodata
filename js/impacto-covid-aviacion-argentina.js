
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
    const COMPARE_YEAR = 2025;

    let annualRows = [];
    let rawPaxRows = [];
    let rawVuelosRows = [];
    let rawAirportPaxRows = [];
    let rawAirportMovRows = [];
    let airportOptions = [];
    let selectedAirport = null;
    let selectedAirportRows = [];

    const $ = id => document.getElementById(id);

    function clean(v){ return v === null || v === undefined ? "" : String(v).trim(); }

    function normalizeHeader(v){
      return clean(v)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"")
        .replace(/[^a-z0-9]+/g,"_")
        .replace(/^_+|_+$/g,"");
    }

    function normalizeText(v){
      return clean(v)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"")
        .replace(/[^a-z0-9]+/g," ")
        .replace(/\s+/g," ")
        .trim();
    }

    function firstNonEmpty(obj, keys, fallback = ""){
      for (const key of keys){
        if (!obj) continue;
        const normalized = normalizeHeader(key);
        const value = obj[key] !== undefined ? obj[key] : obj[normalized];
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
      }
      return fallback;
    }

    function detectSep(headerLine){
      if (headerLine.includes("\t")) return "\t";
      const semi = (headerLine.match(/;/g) || []).length;
      const comma = (headerLine.match(/,/g) || []).length;
      return semi >= comma ? ";" : ",";
    }

    function splitDelimitedLine(line, sep){
      const out = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++){
        const ch = line[i];
        if (ch === '"'){
          if (inQuotes && line[i + 1] === '"'){
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === sep && !inQuotes){
          out.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out;
    }

    function parseCSV(text){
      if (!text) return [];
      const lines = text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length < 2) return [];
      const sep = detectSep(lines[0]);
      const headers = splitDelimitedLine(lines[0], sep).map(normalizeHeader);
      return lines.slice(1).map(line => {
        const cols = splitDelimitedLine(line, sep);
        const row = {};
        headers.forEach((h, i) => row[h] = cols[i] ?? "");
        return row;
      });
    }

    function parseNumber(v){
      if (v === null || v === undefined) return NaN;
      let s = String(v).trim();
      if (!s) return NaN;
      s = s.replace(/\s+/g,"").replace(/[^\d,.-]/g,"");
      if (!s) return NaN;
      const comma = (s.match(/,/g) || []).length;
      const dot = (s.match(/\./g) || []).length;
      if (comma && dot){
        if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g,"").replace(",",".");
        else s = s.replace(/,/g,"");
      } else if (comma){
        if (comma > 1){
          s = s.replace(/,/g,"");
        } else {
          const decimals = s.length - s.indexOf(",") - 1;
          s = decimals === 3 ? s.replace(",","") : s.replace(",",".");
        }
      } else if (dot){
        if (dot > 1) s = s.replace(/\./g,"");
        else {
          const decimals = s.length - s.indexOf(".") - 1;
          if (decimals === 3) s = s.replace(".","");
        }
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    }

    async function readTextSmart(response){
      const buffer = await response.arrayBuffer();
      let text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
      return text;
    }

    async function fetchText(url){
      const resp = await fetch(url, { cache:"no-store" });
      if (!resp.ok) throw new Error(`No se pudo cargar ${url}: HTTP ${resp.status}`);
      return readTextSmart(resp);
    }

    async function fetchOptional(url, type = "text"){
      try{
        const resp = await fetch(url, { cache:"no-store" });
        if (!resp.ok) return null;
        return type === "json" ? await resp.json() : await readTextSmart(resp);
      }catch(err){
        console.warn(`No se pudo cargar ${url}`, err);
        return null;
      }
    }

    function escapeHtml(value){
      return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#39;");
    }

    function setStatus(message, type = "ok"){
      const el = $("status");
      el.className = `status ${type}`;
      el.innerHTML = message;
    }

    function fmt(n){
      const value = Number(n);
      if (!Number.isFinite(value)) return "—";
      return value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
    }

    function fmtM(n){
      const value = Number(n);
      if (!Number.isFinite(value)) return "—";
      return (value / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " M";
    }

    function fmtPct(n){
      const value = Number(n);
      if (!Number.isFinite(value)) return "—";
      const sign = value > 0 ? "+" : "";
      return sign + value.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
    }

    function fmtIdx(n){
      const value = Number(n);
      if (!Number.isFinite(value)) return "—";
      return value.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }

    function pct(value, base){
      if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) return NaN;
      return ((value / base) - 1) * 100;
    }

    function idx(value, base){
      if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) return NaN;
      return (value / base) * 100;
    }

    function getYear(row){
      const y = parseNumber(firstNonEmpty(row, ["anio", "ano", "year", "año"]));
      if (Number.isFinite(y)) return Number(y);
      const raw = firstNonEmpty(row, ["fecha", "periodo_id", "anomes", "año_mes", "ano_mes"]);
      const m = String(raw || "").match(/^(\d{4})/);
      return m ? Number(m[1]) : NaN;
    }

    function getSegment(row){
      const direct = normalizeText(firstNonEmpty(row, ["region", "segmento", "segment"]));
      const dataset = normalizeText(firstNonEmpty(row, ["dataset"]));
      const value = direct || dataset;
      if (value.includes("internacional")) return "internacional";
      if (value.includes("cabotaje") || value.includes("domest")) return "cabotaje";
      return "";
    }

    function getIata(row){
      return clean(firstNonEmpty(row, ["iata", "IATA", "codigo_iata", "aeropuerto_iata"])).toUpperCase();
    }

    function getRowValue(row, preferredCols){
      for (const col of preferredCols){
        const v = row[normalizeHeader(col)] !== undefined ? row[normalizeHeader(col)] : row[col];
        const n = parseNumber(v);
        if (Number.isFinite(n)) return n;
      }
      return 0;
    }

    function getAnnualValue(rows, valueCols, year, segment, iata = null){
      const code = iata ? clean(iata).toUpperCase() : null;
      return rows
        .filter(r => Number(getYear(r)) === Number(year))
        .filter(r => !code || getIata(r) === code)
        .filter(r => getSegment(r) === segment)
        .reduce((acc, r) => acc + getRowValue(r, valueCols), 0);
    }

    function buildAnnualRowsFrom(paxRows, vuelosRows, iata = null){
      return YEARS.map(year => {
        const paxCab = getAnnualValue(paxRows, ["valor_pax", "pasajeros", "valor"], year, "cabotaje", iata);
        const paxInt = getAnnualValue(paxRows, ["valor_pax", "pasajeros", "valor"], year, "internacional", iata);
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

    function byYearFrom(rows, year){
      return rows.find(r => Number(r.anio) === Number(year)) || {};
    }

    function byYear(year){ return byYearFrom(annualRows, year); }

    function classForPct(v){
      if (!Number.isFinite(v)) return "";
      if (v >= 0) return "good";
      if (v <= -20) return "bad";
      return "warn";
    }

    function setKpi(idValue, idSub, variation, current, base, metricLabel){
      $(idValue).textContent = fmtPct(variation);
      $(idValue).className = `value ${classForPct(variation)}`;
      $(idSub).textContent = `${metricLabel(current)} en ${COMPARE_YEAR} vs ${metricLabel(base)} en ${BASE_YEAR}`;
    }

    function updateTextAndKPIs(){
      const y2019 = byYear(BASE_YEAR);
      const y2020 = byYear(2020);
      const y2021 = byYear(2021);
      const y2025 = byYear(COMPARE_YEAR);

      const paxTotalVar = pct(y2025.pax_total, y2019.pax_total);
      const paxCabVar = pct(y2025.pax_cabotaje, y2019.pax_cabotaje);
      const paxIntVar = pct(y2025.pax_internacional, y2019.pax_internacional);
      const vuelosTotalVar = pct(y2025.vuelos_total, y2019.vuelos_total);
      const vuelosCabVar = pct(y2025.vuelos_cabotaje, y2019.vuelos_cabotaje);
      const vuelosIntVar = pct(y2025.vuelos_internacional, y2019.vuelos_internacional);

      const pax2020Var = pct(y2020.pax_total, y2019.pax_total);
      const pax2021Var = pct(y2021.pax_total, y2019.pax_total);

      $("execText").innerHTML =
        `En 2020 el tráfico comercial de pasajeros del SNA cayó a <strong>${fmtM(y2020.pax_total)}</strong>, ` +
        `equivalente a una variación de <strong class="${classForPct(pax2020Var)}">${fmtPct(pax2020Var)}</strong> respecto de 2019. ` +
        `En 2021 la recuperación todavía fue parcial, con <strong>${fmtM(y2021.pax_total)}</strong> ` +
        `(<strong class="${classForPct(pax2021Var)}">${fmtPct(pax2021Var)}</strong> frente a 2019). ` +
        `Para 2025, el sistema alcanzó <strong>${fmtM(y2025.pax_total)}</strong> pasajeros, ` +
        `<strong class="${classForPct(paxTotalVar)}">${fmtPct(paxTotalVar)}</strong> respecto de 2019. ` +
        `La variación de pasajeros fue de <strong>${fmtPct(paxCabVar)}</strong> en cabotaje ` +
        `y <strong>${fmtPct(paxIntVar)}</strong> en internacional.`;

      setKpi("kpiPaxTotal", "kpiPaxTotalSub", paxTotalVar, y2025.pax_total, y2019.pax_total, fmtM);
      setKpi("kpiPaxCab", "kpiPaxCabSub", paxCabVar, y2025.pax_cabotaje, y2019.pax_cabotaje, fmtM);
      setKpi("kpiPaxInt", "kpiPaxIntSub", paxIntVar, y2025.pax_internacional, y2019.pax_internacional, fmtM);
      setKpi("kpiVuelosTotal", "kpiVuelosTotalSub", vuelosTotalVar, y2025.vuelos_total, y2019.vuelos_total, v => `${fmt(v)} vuelos`);

      $("compareText").innerHTML =
        `En vuelos comerciales, el total de 2025 quedó <strong class="${classForPct(vuelosTotalVar)}">${fmtPct(vuelosTotalVar)}</strong> ` +
        `frente a 2019. La variación fue de <strong>${fmtPct(vuelosCabVar)}</strong> en cabotaje ` +
        `y de <strong>${fmtPct(vuelosIntVar)}</strong> en internacional.`;
    }

    function renderStackedBars(containerId, metricPrefix, rows, titleFormatter){
      const data = rows.map(r => ({
        year: r.anio,
        cab: r[`${metricPrefix}_cabotaje`],
        intl: r[`${metricPrefix}_internacional`],
        total: r[`${metricPrefix}_total`]
      }));

      const width = 720;
      const height = 310;
      const pad = { left: 58, right: 18, top: 18, bottom: 42 };
      const innerW = width - pad.left - pad.right;
      const innerH = height - pad.top - pad.bottom;
      const maxTotal = Math.max(...data.map(d => d.total), 1);
      const barGap = 8;
      const barW = Math.max(4, innerW / data.length - barGap);

      const y = value => pad.top + innerH - (value / maxTotal) * innerH;
      const x = i => pad.left + i * (innerW / data.length) + barGap / 2;
      const yTicks = [0, .25, .5, .75, 1].map(t => Math.round(maxTotal * t));

      let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de barras apiladas">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>`;

      yTicks.forEach(t => {
        const yy = y(t);
        svg += `<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="#e5ebf2"/>
                <text x="${pad.left - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#657384">${titleFormatter(t)}</text>`;
      });

      data.forEach((d, i) => {
        const xx = x(i);
        const cabH = (d.cab / maxTotal) * innerH;
        const intH = (d.intl / maxTotal) * innerH;
        const baseY = pad.top + innerH;
        svg += `<rect x="${xx}" y="${baseY - cabH}" width="${barW}" height="${cabH}" rx="3" fill="#2A6FB0">
                  <title>${d.year} cabotaje: ${fmt(d.cab)}</title>
                </rect>`;
        svg += `<rect x="${xx}" y="${baseY - cabH - intH}" width="${barW}" height="${intH}" rx="3" fill="#7bb7e5">
                  <title>${d.year} internacional: ${fmt(d.intl)}</title>
                </rect>`;
        svg += `<text x="${xx + barW/2}" y="${height - 18}" text-anchor="middle" font-size="11" fill="#657384">${String(d.year).slice(2)}</text>`;
        if (d.year === BASE_YEAR) {
          svg += `<line x1="${xx + barW/2}" y1="${pad.top}" x2="${xx + barW/2}" y2="${height - 32}" stroke="#002855" stroke-dasharray="3,3" opacity=".55"/>
                  <text x="${xx + barW/2}" y="${pad.top + 10}" text-anchor="middle" font-size="10" fill="#002855" font-weight="700">2019</text>`;
        }
      });

      svg += `<line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="#cfd8e3"/>
              </svg>`;

      $(containerId).innerHTML = svg;
    }

    function renderIndexLines(containerId, metricPrefix, rows){
      const base = byYearFrom(rows, BASE_YEAR);
      const series = [
        { key:"total", label:"Total", color:"#002855", values: rows.map(r => ({ year:r.anio, value:idx(r[`${metricPrefix}_total`], base[`${metricPrefix}_total`]) })) },
        { key:"cabotaje", label:"Cabotaje", color:"#2A6FB0", values: rows.map(r => ({ year:r.anio, value:idx(r[`${metricPrefix}_cabotaje`], base[`${metricPrefix}_cabotaje`]) })) },
        { key:"internacional", label:"Internacional", color:"#7bb7e5", values: rows.map(r => ({ year:r.anio, value:idx(r[`${metricPrefix}_internacional`], base[`${metricPrefix}_internacional`]) })) }
      ];

      const width = 720;
      const height = 310;
      const pad = { left: 48, right: 20, top: 20, bottom: 42 };
      const innerW = width - pad.left - pad.right;
      const innerH = height - pad.top - pad.bottom;
      const vals = series.flatMap(s => s.values.map(d => d.value)).filter(Number.isFinite);
      const maxV = vals.length ? Math.max(120, Math.ceil(Math.max(...vals) / 10) * 10) : 120;
      const minV = vals.length ? Math.min(0, Math.floor(Math.min(...vals) / 10) * 10) : 0;
      const span = maxV - minV || 1;
      const x = year => pad.left + ((year - YEARS[0]) / (YEARS[YEARS.length - 1] - YEARS[0])) * innerW;
      const y = value => pad.top + innerH - ((value - minV) / span) * innerH;
      const ticks = [];
      for (let t = Math.ceil(minV / 20) * 20; t <= maxV; t += 20) ticks.push(t);

      let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de índice 2019 igual 100">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>`;

      ticks.forEach(t => {
        const yy = y(t);
        const strong = t === 100;
        svg += `<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="${strong ? "#002855" : "#e5ebf2"}" stroke-dasharray="${strong ? "5,4" : "0"}" opacity="${strong ? ".75" : "1"}"/>
                <text x="${pad.left - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#657384">${t}</text>`;
      });

      series.forEach(s => {
        const pts = s.values.filter(d => Number.isFinite(d.value));
        if (!pts.length) return;
        const path = pts.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year).toFixed(2)} ${y(d.value).toFixed(2)}`).join(" ");
        svg += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
        pts.forEach(d => {
          svg += `<circle cx="${x(d.year)}" cy="${y(d.value)}" r="3.4" fill="${s.color}">
                    <title>${s.label} ${d.year}: ${fmtIdx(d.value)}</title>
                  </circle>`;
        });
      });

      YEARS.forEach(year => {
        const xx = x(year);
        svg += `<text x="${xx}" y="${height - 18}" text-anchor="middle" font-size="11" fill="#657384">${String(year).slice(2)}</text>`;
      });

      svg += `<line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="#cfd8e3"/>
              </svg>`;

      $(containerId).innerHTML = svg;
    }

    function renderCompareTableFor(tableId, rows){
      const base = byYearFrom(rows, BASE_YEAR);
      const comp = byYearFrom(rows, COMPARE_YEAR);
      const dataRows = [
        ["Pasajeros", "Total", base.pax_total, comp.pax_total],
        ["Pasajeros", "Cabotaje", base.pax_cabotaje, comp.pax_cabotaje],
        ["Pasajeros", "Internacional", base.pax_internacional, comp.pax_internacional],
        ["Vuelos", "Total", base.vuelos_total, comp.vuelos_total],
        ["Vuelos", "Cabotaje", base.vuelos_cabotaje, comp.vuelos_cabotaje],
        ["Vuelos", "Internacional", base.vuelos_internacional, comp.vuelos_internacional],
      ];

      $(tableId).querySelector("thead").innerHTML =
        `<tr><th>Indicador</th><th>Segmento</th><th>2019</th><th>2025</th><th>Dif. absoluta</th><th>Variación %</th><th>Índice 2019=100</th></tr>`;

      $(tableId).querySelector("tbody").innerHTML = dataRows.map(([ind, seg, b, c]) => {
        const v = pct(c, b);
        const index = idx(c, b);
        return `<tr>
          <td>${ind}</td>
          <td>${seg}</td>
          <td>${fmt(b)}</td>
          <td>${fmt(c)}</td>
          <td>${fmt(c - b)}</td>
          <td class="${classForPct(v)}"><strong>${fmtPct(v)}</strong></td>
          <td>${fmtIdx(index)}</td>
        </tr>`;
      }).join("");
    }

    function renderAnnualTableFor(tableId, rows){
      $(tableId).querySelector("thead").innerHTML =
        `<tr>
          <th>Año</th>
          <th>Pasajeros total</th>
          <th>Pasajeros cabotaje</th>
          <th>Pasajeros internacional</th>
          <th>Índice pax total</th>
          <th>Vuelos total</th>
          <th>Vuelos cabotaje</th>
          <th>Vuelos internacional</th>
          <th>Índice vuelos total</th>
        </tr>`;

      const base = byYearFrom(rows, BASE_YEAR);

      $(tableId).querySelector("tbody").innerHTML = rows.map(r => `
        <tr>
          <td>${r.anio}</td>
          <td>${fmt(r.pax_total)}</td>
          <td>${fmt(r.pax_cabotaje)}</td>
          <td>${fmt(r.pax_internacional)}</td>
          <td>${fmtIdx(idx(r.pax_total, base.pax_total))}</td>
          <td>${fmt(r.vuelos_total)}</td>
          <td>${fmt(r.vuelos_cabotaje)}</td>
          <td>${fmt(r.vuelos_internacional)}</td>
          <td>${fmtIdx(idx(r.vuelos_total, base.vuelos_total))}</td>
        </tr>
      `).join("");
    }

    function renderSnaAll(){
      updateTextAndKPIs();
      renderStackedBars("chartPax", "pax", annualRows, fmtM);
      renderStackedBars("chartVuelos", "vuelos", annualRows, v => fmt(v));
      renderIndexLines("chartPaxIndex", "pax", annualRows);
      renderIndexLines("chartVuelosIndex", "vuelos", annualRows);
      renderCompareTableFor("compareTable", annualRows);
      renderAnnualTableFor("annualTable", annualRows);
    }

    function getAirportTitleFromProps(p){
      const iata = clean(firstNonEmpty(p, ["IATA", "iata"])).toUpperCase();
      const ciudad = clean(firstNonEmpty(p, ["Ciudad", "Localidad", "Municipio", "Ciudad / Localidad", "Ciudad/Localidad", "Aeropuerto"]));
      const nombre = clean(firstNonEmpty(p, ["Nombre del Aeropuerto", "Aeropuerto", "Denominacion", "Denominación", "nombre", "name"]));
      if (iata === "AEP") return "Aeroparque Jorge Newbery";
      if (ciudad && nombre && normalizeText(ciudad) !== normalizeText(nombre)) return `Aeropuerto de ${ciudad} – ${nombre}`;
      if (ciudad) return `Aeropuerto de ${ciudad}`;
      if (nombre) return nombre;
      return iata;
    }

    function buildAirportOptions(geojson){
      const fromGeo = (geojson?.features || [])
        .map(f => f.properties || {})
        .map(p => {
          const iata = clean(firstNonEmpty(p, ["IATA", "iata"])).toUpperCase();
          if (!iata) return null;
          const ciudad = clean(firstNonEmpty(p, ["Ciudad", "Localidad", "Municipio", "Ciudad / Localidad", "Ciudad/Localidad"]));
          const provincia = clean(firstNonEmpty(p, ["Provincia", "provincia"]));
          const nombre = getAirportTitleFromProps(p);
          return { iata, nombre, ciudad, provincia, search: normalizeText(`${iata} ${nombre} ${ciudad} ${provincia}`) };
        })
        .filter(Boolean);

      const byIata = new Map();
      fromGeo.forEach(a => byIata.set(a.iata, a));

      // Respaldo: si hay IATA en las series por aeropuerto que no figuran en el GeoJSON, los agrega.
      [...rawAirportPaxRows, ...rawAirportMovRows].forEach(r => {
        const iata = getIata(r);
        if (!iata || iata === "SNA" || byIata.has(iata)) return;
        byIata.set(iata, { iata, nombre:`Aeropuerto ${iata}`, ciudad:"", provincia:"", search:normalizeText(iata) });
      });

      return Array.from(byIata.values()).sort((a,b) => a.iata.localeCompare(b.iata, "es"));
    }

    function airportLabel(a){
      if (!a) return "";
      return `${a.nombre} (${a.iata})`;
    }

    function renderAirportOptions(term = ""){
      const list = $("airportList");
      const normalized = normalizeText(term);
      const matches = airportOptions
        .filter(a => !normalized || a.search.includes(normalized))
        .slice(0, 80);

      if (!matches.length){
        list.innerHTML = normalized ? `<div class="combo-item" style="cursor:default;">No se encontraron aeropuertos</div>` : "";
      } else {
        list.innerHTML = matches.map(a => `
          <button type="button" class="combo-item" data-iata="${escapeHtml(a.iata)}">
            ${escapeHtml(a.nombre)} (${escapeHtml(a.iata)})
            <small>${escapeHtml([a.ciudad, a.provincia].filter(Boolean).join(" · "))}</small>
          </button>
        `).join("");
      }
      list.classList.add("open");
    }

    function hideAirportOptions(){
      setTimeout(() => $("airportList").classList.remove("open"), 120);
    }

    function clearAirportVisuals(){
      selectedAirportRows = [];
      $("airportTitle").textContent = "Aeropuerto seleccionado";
      $("airportMeta").textContent = "—";
      $("airportText").textContent = "Seleccione un aeropuerto para ver la comparación.";
      ["airportKpiPaxTotal","airportKpiPaxCab","airportKpiPaxInt","airportKpiVuelosTotal"].forEach(id => { $(id).textContent = "—"; $(id).className = "value"; });
      ["airportKpiPaxTotalSub","airportKpiPaxCabSub","airportKpiPaxIntSub","airportKpiVuelosTotalSub"].forEach(id => $(id).textContent = "—");
      ["airportChartPax","airportChartPaxIndex","airportChartVuelos","airportChartVuelosIndex"].forEach(id => $(id).innerHTML = "");
      ["airportCompareTable","airportAnnualTable"].forEach(id => { $(id).querySelector("thead").innerHTML = ""; $(id).querySelector("tbody").innerHTML = ""; });
      $("btnAirportCsv").disabled = true;
    }

    function updateAirportSection(iata){
      const airport = airportOptions.find(a => a.iata === clean(iata).toUpperCase());
      if (!airport) return;
      selectedAirport = airport;
      selectedAirportRows = buildAnnualRowsFrom(rawAirportPaxRows, rawAirportMovRows, airport.iata);

      $("airportInput").value = airportLabel(airport);
      $("airportTitle").textContent = airport.nombre;
      $("airportMeta").textContent = [airport.iata, airport.ciudad, airport.provincia].filter(Boolean).join(" · ");

      const y2019 = byYearFrom(selectedAirportRows, BASE_YEAR);
      const y2025 = byYearFrom(selectedAirportRows, COMPARE_YEAR);
      const y2020 = byYearFrom(selectedAirportRows, 2020);

      const paxTotalVar = pct(y2025.pax_total, y2019.pax_total);
      const paxCabVar = pct(y2025.pax_cabotaje, y2019.pax_cabotaje);
      const paxIntVar = pct(y2025.pax_internacional, y2019.pax_internacional);
      const vuelosTotalVar = pct(y2025.vuelos_total, y2019.vuelos_total);
      const pax2020Var = pct(y2020.pax_total, y2019.pax_total);

      $("airportText").innerHTML =
        `En <strong>${escapeHtml(airport.nombre)} (${escapeHtml(airport.iata)})</strong>, el tráfico de pasajeros de 2020 fue ` +
        `<strong>${fmt(y2020.pax_total)}</strong>, con una variación de ` +
        `<strong class="${classForPct(pax2020Var)}">${fmtPct(pax2020Var)}</strong> respecto de 2019. ` +
        `En 2025 se registraron <strong>${fmt(y2025.pax_total)}</strong> pasajeros, ` +
        `<strong class="${classForPct(paxTotalVar)}">${fmtPct(paxTotalVar)}</strong> frente al nivel prepandemia. ` +
        `La variación 2025 vs 2019 fue de <strong>${fmtPct(paxCabVar)}</strong> en cabotaje ` +
        `y <strong>${fmtPct(paxIntVar)}</strong> en internacional.`;

      setKpi("airportKpiPaxTotal", "airportKpiPaxTotalSub", paxTotalVar, y2025.pax_total, y2019.pax_total, v => fmt(v));
      setKpi("airportKpiPaxCab", "airportKpiPaxCabSub", paxCabVar, y2025.pax_cabotaje, y2019.pax_cabotaje, v => fmt(v));
      setKpi("airportKpiPaxInt", "airportKpiPaxIntSub", paxIntVar, y2025.pax_internacional, y2019.pax_internacional, v => fmt(v));
      setKpi("airportKpiVuelosTotal", "airportKpiVuelosTotalSub", vuelosTotalVar, y2025.vuelos_total, y2019.vuelos_total, v => `${fmt(v)} vuelos`);

      renderStackedBars("airportChartPax", "pax", selectedAirportRows, v => fmt(v));
      renderIndexLines("airportChartPaxIndex", "pax", selectedAirportRows);
      renderStackedBars("airportChartVuelos", "vuelos", selectedAirportRows, v => fmt(v));
      renderIndexLines("airportChartVuelosIndex", "vuelos", selectedAirportRows);
      renderCompareTableFor("airportCompareTable", selectedAirportRows);
      renderAnnualTableFor("airportAnnualTable", selectedAirportRows);

      $("btnAirportCsv").disabled = false;
      $("airportHint").innerHTML = `Aeropuerto seleccionado: <strong>${escapeHtml(airportLabel(airport))}</strong>. Podés escribir otra ciudad, nombre o IATA para cambiar la selección.`;

      const url = new URL(window.location.href);
      url.searchParams.set("iata", airport.iata);
      window.history.replaceState({}, "", url.toString());
    }

    function setupAirportSelector(){
      const input = $("airportInput");
      const clear = $("airportClear");
      const list = $("airportList");

      input.disabled = false;
      clear.disabled = false;

      input.addEventListener("focus", () => {
        input.select();
        renderAirportOptions("");
      });

      input.addEventListener("click", () => {
        if (selectedAirport && input.value === airportLabel(selectedAirport)) input.value = "";
        renderAirportOptions(input.value);
      });

      input.addEventListener("input", () => renderAirportOptions(input.value));
      input.addEventListener("blur", hideAirportOptions);

      clear.addEventListener("click", () => {
        input.value = "";
        input.focus();
        renderAirportOptions("");
      });

      list.addEventListener("click", evt => {
        const btn = evt.target.closest("button[data-iata]");
        if (!btn) return;
        updateAirportSection(btn.dataset.iata);
        list.classList.remove("open");
      });

      const initial = new URLSearchParams(window.location.search).get("iata");
      const defaultIata = (initial && airportOptions.some(a => a.iata === initial.toUpperCase()))
        ? initial.toUpperCase()
        : (airportOptions.some(a => a.iata === "AEP") ? "AEP" : airportOptions[0]?.iata);

      if (defaultIata) updateAirportSection(defaultIata);
      else clearAirportVisuals();
    }

    function csvEscape(value){
      const s = String(value ?? "");
      if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    }

    function downloadBlob(content, filename, mime){
      const blob = new Blob([content], { type:mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function rowsToCsv(rows, filename){
      const cols = [
        "anio",
        "pax_total","pax_cabotaje","pax_internacional",
        "vuelos_total","vuelos_cabotaje","vuelos_internacional",
        "indice_pax_total_2019_100","indice_vuelos_total_2019_100"
      ];
      const base = byYearFrom(rows, BASE_YEAR);
      const lines = [cols.join(";")];
      rows.forEach(r => {
        const row = {
          ...r,
          indice_pax_total_2019_100: fmtIdx(idx(r.pax_total, base.pax_total)).replace(",", "."),
          indice_vuelos_total_2019_100: fmtIdx(idx(r.vuelos_total, base.vuelos_total)).replace(",", ".")
        };
        lines.push(cols.map(c => csvEscape(row[c] ?? "")).join(";"));
      });
      downloadBlob("\uFEFF" + lines.join("\r\n"), filename, "text/csv;charset=utf-8");
    }

    function downloadSummaryCsv(){
      rowsToCsv(annualRows, "impacto_covid_sna_2015_2025_resumen.csv");
    }

    function downloadAirportCsv(){
      if (!selectedAirport || !selectedAirportRows.length) return;
      rowsToCsv(selectedAirportRows, `impacto_covid_${selectedAirport.iata}_2015_2025_resumen.csv`);
    }

    async function load(){
      try{
        setStatus(
          `Cargando series SNA y fuentes por aeropuerto desde la carpeta <strong>fuentes</strong>…`,
          "warn"
        );

        const [paxText, vuelosText, airportsGJ, paxAirportText, movAirportText] = await Promise.all([
          fetchText(DATA_PATHS.paxSna),
          fetchText(DATA_PATHS.vuelosSna),
          fetchOptional(DATA_PATHS.airports, "json"),
          fetchOptional(DATA_PATHS.paxAirport, "text"),
          fetchOptional(DATA_PATHS.movAirport, "text")
        ]);

        rawPaxRows = parseCSV(paxText);
        rawVuelosRows = parseCSV(vuelosText);
        annualRows = buildAnnualRowsFrom(rawPaxRows, rawVuelosRows);

        rawAirportPaxRows = paxAirportText ? parseCSV(paxAirportText) : [];
        rawAirportMovRows = movAirportText ? parseCSV(movAirportText) : [];
        airportOptions = buildAirportOptions(airportsGJ);

        renderSnaAll();
        setupAirportSelector();

        $("btnCsv").disabled = false;

        const warnings = [];
        if (!airportsGJ) warnings.push("Datos_aeropuertos.geojson no cargado");
        if (!paxAirportText) warnings.push("pasajeros_aeropuerto_mensual.csv no cargado");
        if (!movAirportText) warnings.push("movimientos_aeropuerto_mensual.csv no cargado");

        setStatus(
          `Datos cargados correctamente. SNA: <strong>${rawPaxRows.length}</strong> registros de pasajeros y ` +
          `<strong>${rawVuelosRows.length}</strong> registros de vuelos. Aeropuertos disponibles en selector: ` +
          `<strong>${airportOptions.length}</strong>. Período graficado: <strong>2015–2025</strong>.` +
          (warnings.length ? `<br><span>Advertencias: ${warnings.join("; ")}.</span>` : ""),
          warnings.length ? "warn" : "ok"
        );
      }catch(err){
        console.error(err);
        setStatus(`Error al cargar el informe: ${String(err.message || err)}. Verificá que los CSV estén en la carpeta fuentes.`, "err");
      }
    }


    async function exportPdfA4(){
      const node = document.getElementById("reportA4");
      const btn = document.getElementById("btnPrint");
      if (!node) return window.print();

      const filename = selectedAirportIata
        ? `impacto_covid_aviacion_argentina_${selectedAirportIata}_a4.pdf`
        : "impacto_covid_aviacion_argentina_a4.pdf";

      try{
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Generando PDF…";
        }
        document.documentElement.classList.add("pdf-exporting");
        document.body.classList.add("pdf-exporting");
        await new Promise(resolve => setTimeout(resolve, 180));

        if (window.html2pdf){
          const options = {
            margin: 0,
            filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              backgroundColor: "#ffffff",
              windowWidth: node.scrollWidth
            },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["css", "legacy"], after: ".sheet-a4" }
          };
          await window.html2pdf().set(options).from(node).save();
        } else {
          window.print();
        }
      } catch(err){
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

    $("btnCsv").addEventListener("click", downloadSummaryCsv);
    $("btnAirportCsv").addEventListener("click", downloadAirportCsv);
    $("btnPrint").addEventListener("click", exportPdfA4);
    const btnPrintInline = document.getElementById("btnPrintInline");
    if (btnPrintInline) btnPrintInline.addEventListener("click", exportPdfA4);

    load();
  })();
  
