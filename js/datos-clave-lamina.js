/* global html2canvas */
(() => {
  "use strict";

  const YEAR_REF = 2025;
  const PAX_DATASET_CAB = "pasajeros_comerciales_cabotaje_aeropuerto";
  const PAX_DATASET_INT = "pasajeros_comerciales_internacional_aeropuerto";

  let aeropuertos = [];
  let pasajerosMensualRows = [];
  let transportePorIATA = {};
  let vuelosRows = [];
  let rutasRows = [];
  let currentIATA = "";

  const q = (id) => document.getElementById(id);

  function clean(v) {
    return v === null || v === undefined ? "" : String(v).trim();
  }

  function normalizeHeader(v) {
    return clean(v)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function formatNumber(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("es-AR");
  }

  function parseNumber(raw) {
    if (raw === null || raw === undefined) return NaN;
    let s = String(raw).trim();
    if (!s) return NaN;
    s = s.replace(/\s+/g, "");
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
      s = s.replace(/,/g, "");
    } else if (s.includes(",") && !s.includes(".")) {
      s = s.replace(/,/g, ".");
    } else if (s.includes(",") && s.includes(".")) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function firstNonEmpty(obj, keys, fallback = "") {
    for (const key of keys) {
      if (!obj) continue;
      const v = obj[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return fallback;
  }

  function splitField(str) {
    if (!str) return [];
    return String(str)
      .split(/[;|]+| {2,}|\t+/)
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
    const rawHeaders = lines[0].split(sep);
    const headers = rawHeaders.map(normalizeHeader);

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep);
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });
      rows.push(row);
    }
    return rows;
  }

  function parseFechaFlexible(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function parseTransporteCSV(text) {
    const rows = parseCSV(text);
    const result = {};
    rows.forEach(r => {
      const iata = clean(firstNonEmpty(r, ["iata", "aeropuerto_iata", "airport_iata"])).toUpperCase();
      if (!iata) return;
      result[iata] = {
        linea: clean(firstNonEmpty(r, ["linea", "lineas", "lineas_colectivo"])),
        parada: clean(firstNonEmpty(r, ["parada", "paradaaep", "parada_principal"]))
      };
    });
    return result;
  }

  function parsePasajerosMensualCSV(text) {
    const rows = parseCSV(text);
    return rows.map(r => {
      const date = parseFechaFlexible(firstNonEmpty(r, ["fecha"]));
      const valor = parseNumber(firstNonEmpty(r, ["valor_pax", "valor", "pasajeros"]));
      return {
        iata: clean(firstNonEmpty(r, ["iata"])).toUpperCase(),
        dataset: clean(firstNonEmpty(r, ["dataset"])),
        date,
        valor
      };
    }).filter(r => r.iata && r.date && Number.isFinite(r.valor)).sort((a, b) => a.date - b.date);
  }

  function parseVuelosCSV(text) {
    const rows = parseCSV(text);
    return rows.map(r => {
      const date = parseFechaFlexible(firstNonEmpty(r, ["fecha"]));
      const yearNum = parseNumber(firstNonEmpty(r, ["anio", "ano", "year"]));
      const year = Number.isFinite(yearNum) ? Number(yearNum) : (date ? date.getFullYear() : null);
      const valor = parseNumber(firstNonEmpty(r, [
        "vuelos", "cantidad_vuelos", "vuelos_totales", "movimientos", "movimientos_totales",
        "valor_vuelos", "valor_movimientos", "valor", "cantidad", "total_vuelos"
      ]));
      return {
        iata: clean(firstNonEmpty(r, ["iata", "aeropuerto_iata", "airport_iata", "origen_iata"])).toUpperCase(),
        year,
        date,
        valor
      };
    }).filter(r => r.iata && Number.isFinite(r.valor));
  }

  function parseRutasCSV(text) {
    const rows = parseCSV(text);
    return rows.map(r => {
      const date = parseFechaFlexible(firstNonEmpty(r, ["fecha"]));
      const yearNum = parseNumber(firstNonEmpty(r, ["anio", "ano", "year"]));
      const year = Number.isFinite(yearNum) ? Number(yearNum) : (date ? date.getFullYear() : null);
      return {
        iata: clean(firstNonEmpty(r, ["iata", "aeropuerto_iata", "airport_iata", "origen_iata"])).toUpperCase(),
        airline: clean(firstNonEmpty(r, ["aerolinea", "linea_aerea", "airline", "compania"])),
        destinationCode: clean(firstNonEmpty(r, ["destino_iata", "iata_destino", "destination_iata", "ruta_destino_iata"])).toUpperCase(),
        destinationName: clean(firstNonEmpty(r, ["destino_nombre", "destino", "destination_name", "aeropuerto_destino"])),
        flights: parseNumber(firstNonEmpty(r, ["vuelos", "cantidad_vuelos", "movimientos", "frecuencias", "valor", "cantidad"])),
        year
      };
    }).filter(r => r.iata && Number.isFinite(r.flights));
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
    const padL = 64, padR = 18, padT = 16, padB = 34;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const maxV = Math.max(...series.map(s => s.valor), 1);
    const x = i => padL + (innerW * i / Math.max(1, series.length - 1));
    const y = v => padT + innerH - (innerH * (v / maxV));

    let grid = "";
    const tickValues = [0, 0.25, 0.5, 0.75, 1].map(k => maxV * k);
    tickValues.forEach(v => {
      const yy = y(v);
      grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#e4e8ee" stroke-width="1"></line>`;
      grid += `<text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="10" fill="#6f7985">${formatNumber(Math.round(v))}</text>`;
    });

    let xGuides = "";
    series.forEach((d, i) => {
      const xx = x(i);
      xGuides += `<text x="${xx}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#6f7985">${d.year}</text>`;
      if (i > 0 && i < series.length - 1) {
        xGuides += `<line x1="${xx}" y1="${padT}" x2="${xx}" y2="${padT + innerH}" stroke="#f1f4f7" stroke-width="1"></line>`;
      }
    });

    const points = series.map((d, i) => `${x(i)},${y(d.valor)}`).join(" ");
    const area = `${padL},${padT + innerH} ${points} ${x(series.length - 1)},${padT + innerH}`;

    let markers = "";
    series.forEach((d, i) => {
      const xx = x(i);
      const yy = y(d.valor);
      const isCurrent = d.year === currentYear;
      const isLast = i === series.length - 1;
      markers += `<circle cx="${xx}" cy="${yy}" r="${isCurrent ? 4.3 : 3.2}" fill="${isCurrent ? '#ef8a27' : '#4b86c5'}"></circle>`;
      if (isCurrent || isLast) {
        markers += `<text x="${xx}" y="${yy - 8}" text-anchor="middle" font-size="10" fill="#4f5965">${formatNumber(Math.round(d.valor))}</text>`;
      }
    });

    svg.innerHTML = `
      <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"></rect>
      ${grid}
      ${xGuides}
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

    const hasYear = rowsAll.some(r => Number.isFinite(r.year));
    let rows = rowsAll;
    if (hasYear) {
      const yearRows = rowsAll.filter(r => r.year === YEAR_REF);
      if (yearRows.length) rows = yearRows;
    }
    const total = rows.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    return {
      total,
      weekly: total ? Math.round(total / 52) : null,
      daily: total ? Math.round(total / 365) : null
    };
  }

  function getRoutesSummary(iata) {
    const rowsAll = rutasRows.filter(r => r.iata === iata);
    if (!rowsAll.length) {
      return { airlinesCount: null, topAirlines: [], topDestinations: [] };
    }

    const hasYear = rowsAll.some(r => Number.isFinite(r.year));
    let rows = rowsAll;
    if (hasYear) {
      const yearRows = rowsAll.filter(r => r.year === YEAR_REF);
      if (yearRows.length) rows = yearRows;
    }

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

    const topAirlines = Array.from(airlineMap.entries())
      .map(([name, flights]) => ({ name, flights }))
      .sort((a, b) => b.flights - a.flights)
      .slice(0, 3);

    const topDestinations = Array.from(destMap.values())
      .sort((a, b) => b.flights - a.flights)
      .slice(0, 4);

    return {
      airlinesCount: airlineMap.size,
      topAirlines,
      topDestinations
    };
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

  function loadImageWithFallback(imgEl, candidates) {
    if (!imgEl) return;
    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) {
        imgEl.classList.add("is-hidden");
        return;
      }
      const src = candidates[idx++];
      imgEl.onerror = tryNext;
      imgEl.onload = () => imgEl.classList.remove("is-hidden");
      imgEl.src = src;
    };
    tryNext();
  }

  function renderRoutes(iata) {
    const { airlinesCount, topAirlines, topDestinations } = getRoutesSummary(iata);
    setText("airlinesCount", airlinesCount ? String(airlinesCount) : "–");

    const airlinesEl = q("topAirlinesList");
    if (airlinesEl) {
      if (!topAirlines.length) {
        airlinesEl.textContent = "Sin datos";
      } else {
        airlinesEl.textContent = topAirlines.map(a => `${a.name}\n${formatNumber(Math.round(a.flights))} vuelos`).join("\n\n");
      }
    }

    const destEl = q("topDestinationsList");
    if (destEl) {
      if (!topDestinations.length) {
        destEl.textContent = "Sin datos";
      } else {
        destEl.innerHTML = topDestinations.map(d => `
          <div class="destination-item">
            <div class="destination-pill">${clean(d.code) || "—"}</div>
            <div class="destination-text"><strong>${clean(d.name) || clean(d.code) || "Sin dato"}</strong><br>${formatNumber(Math.round(d.flights))} vuelos</div>
          </div>
        `).join("");
      }
    }
  }

  function renderFlights(iata) {
    const stats = getFlightsStats(iata);
    setText("vuelosAnuales", stats.total ? formatNumber(Math.round(stats.total)) : "–");
    setText("vuelosSemanales", stats.weekly ? formatNumber(stats.weekly) : "–");
    setText("vuelosDiarios", stats.daily ? formatNumber(stats.daily) : "–");
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
    setText("paxPromMensual", total ? formatNumber(Math.round(total / 12)) : "–");
    setText("paxPromSemanal", total ? formatNumber(Math.round(total / 52)) : "–");
    setText("paxPromDiario", total ? formatNumber(Math.round(total / 365)) : "–");

    renderAnnualChart(annualTotals(totalSeries), YEAR_REF);
  }

  function renderAirport(iataCode) {
    const iata = clean(iataCode).toUpperCase();
    const a = aeropuertos.find(x => clean(x.IATA).toUpperCase() === iata);
    if (!a) return;
    currentIATA = iata;

    const nombre = clean(firstNonEmpty(a, ["Aeropuerto", "Nombre del Aeropuerto", "IATA"]));
    setText("sheetTitle", `Aeropuerto de ${nombre} (${iata}) – Datos clave del aeropuerto`);

    setText("sumSupPredio", formatNumber(firstNonEmpty(a, ["SupPredioHa"])));
    setText("sumTerminal", formatNumber(firstNonEmpty(a, ["TerminalM2"])));
    setText("sumSupConcesionada", formatNumber(firstNonEmpty(a, ["SupConcesionadaHa"])));

    setText("predioExplotador", clean(firstNonEmpty(a, ["Explotador"])) || "–");
    const concesion = [clean(firstNonEmpty(a, ["Grupo"])), clean(firstNonEmpty(a, ["ConcesionHasta"]))].filter(Boolean).join(" · ");
    setText("predioConcesion", concesion || "–");

    loadImageWithFallback(q("imgPredio"), [
      `img/Predios/${iata}.png`,
      `img/Predios/${iata}.jpg`,
      `img/Predios/${iata}.jpeg`,
      `img/Predios/${iata}.webp`,
      `img/Predios/${iata}_predio.png`,
      `img/Predios/${iata}_predio.jpg`
    ]);

    loadImageWithFallback(q("imgTerminal"), [
      clean(firstNonEmpty(a, ["imagenAeropuerto"])),
      `img/Terminales/${iata}_terminal.png`,
      `img/Terminales/${iata}.png`,
      `img/Terminales/${iata}.jpg`
    ].filter(Boolean));

    const orientRaw = clean(firstNonEmpty(a, ["PistaOrientacion"]));
    const dimsRaw = clean(firstNonEmpty(a, ["Dimensiones"]));
    const matRaw = clean(firstNonEmpty(a, ["MaterialPista"]));
    const oriArr = splitField(orientRaw);
    const dimArr = splitField(dimsRaw);
    const matArr = splitField(matRaw);
    const runwayCount = oriArr.length || (orientRaw ? 1 : 0);
    setText("badgeCantPistas", runwayCount ? formatNumber(runwayCount) : "–");
    setText("runwayOrient", oriArr[0] || orientRaw || "–");
    setText("runwayDim", dimArr[0] || dimsRaw || "–");
    setText("runwayMat", clean(matArr[0] || matRaw || "–").toLowerCase());

    const psnCom = (Number(firstNonEmpty(a, ["PSNRemotasC"], 0)) || 0) + (Number(firstNonEmpty(a, ["PSNRemotasC_1"], 0)) || 0);
    const psnGen = Number(firstNonEmpty(a, ["PSN_C"], 0)) || 0;
    setText("psnComercial", psnCom ? formatNumber(psnCom) : "–");
    setText("psnGeneral", psnGen ? formatNumber(psnGen) : "–");

    const mangas = firstNonEmpty(a, ["Mangas telescópicas"]);
    setText("mangasValor", formatNumber(mangas));
    setText("mangasValorBottom", formatNumber(mangas));

    setText("horarioOperacion", clean(firstNonEmpty(a, ["Horario de operación"])) || "–");
    setText("claveRef", clean(firstNonEmpty(a, ["CLAVE DE REFERENCIA DE AERÓDROMO", "Clave de referencia", "ClaveRef"])) || "–");
    setText("ayudasVisuales", clean(firstNonEmpty(a, ["Ayudas visuales", "AyudasVisuales", "ILS", "ILS_cabecera"])) || "–");

    setBadgeNumber("mostradoresCheckin", formatNumber(firstNonEmpty(a, ["Mostradores Check in"])));
    setBadgeNumber("kioscosSelf", formatNumber(firstNonEmpty(a, ["Kioscos         (self check In)", "Kioscos self check in"])));
    setBadgeNumber("psaTotal", formatNumber(firstNonEmpty(a, ["PSAScanTotal"])));
    const psaInter = clean(firstNonEmpty(a, ["PSAScanInter"]));
    const psaCab = clean(firstNonEmpty(a, ["PSAScanCabot"]));
    setText("psaDetalle", [`Internacional: ${psaInter || "–"}`, `Cabotaje: ${psaCab || "–"}`].join(" · "));
    setBadgeNumber("aduanaPuestos", formatNumber(firstNonEmpty(a, ["Puestos de Aduanas"])));
    setBadgeNumber("migracionesTotal", formatNumber(firstNonEmpty(a, ["PuestosMigracionesTot"])));

    const migrDetParts = [];
    if (clean(a["PuestosMigracionesPartidas"])) migrDetParts.push(`Partidas: ${formatNumber(a["PuestosMigracionesPartidas"])}`);
    if (clean(a["PuestosMigracionesArribos"])) migrDetParts.push(`Arribos: ${formatNumber(a["PuestosMigracionesArribos"])}`);
    setText("migracionesDetalle", migrDetParts.join(" · ") || "–");

    setBadgeNumber("puertasEmbarque", formatNumber(firstNonEmpty(a, ["PuertasEmbarqueTotal"])));
    const puertasParts = [];
    if (clean(a["PuertasEmbarqueInter"])) puertasParts.push(`Internacional: ${formatNumber(a["PuertasEmbarqueInter"])}`);
    if (clean(a["PuertasEmbarqueCabot"])) puertasParts.push(`Cabotaje: ${formatNumber(a["PuertasEmbarqueCabot"])}`);
    if (clean(a["PuertasEmbarqueFlex"])) puertasParts.push(`Flex: ${formatNumber(a["PuertasEmbarqueFlex"])}`);
    setText("puertasDetalle", puertasParts.join(" · ") || "–");

    setBadgeNumber("cintasEquipaje", formatNumber(firstNonEmpty(a, ["CintasTotal"])));
    const cintasParts = [];
    if (clean(a["CintasInter"])) cintasParts.push(`Internacional: ${formatNumber(a["CintasInter"])}`);
    if (clean(a["CintasCabot"])) cintasParts.push(`Cabotaje: ${formatNumber(a["CintasCabot"])}`);
    if (clean(a["CintasFlex"])) cintasParts.push(`Flex: ${formatNumber(a["CintasFlex"])}`);
    setText("cintasDetalle", cintasParts.join(" · ") || "–");

    setBadgeNumber("carritos", formatNumber(firstNonEmpty(a, ["Carritos porta equipajes"])));
    setBadgeNumber("estacionamientoVeh", formatNumber(firstNonEmpty(a, ["Estacionamiento Vehicular"])));

    const tr = transportePorIATA[iata] || {};
    const transporteText = [];
    if (clean(tr.linea)) transporteText.push(`Líneas: ${clean(tr.linea)}`);
    if (clean(tr.parada)) transporteText.push(`Parada: ${clean(tr.parada)}`);
    setText("transportePublico", transporteText.join(" · ") || "Sin dato");

    renderPassengers(iata);
    renderFlights(iata);
    renderRoutes(iata);
  }

  async function loadData() {
    const select = q("airportSelect");
    try {
      const [airportsResp, transpResp, paxResp, vuelosResp, rutasResp] = await Promise.all([
        fetch("fuentes/Datos_aeropuertos.geojson"),
        fetch("fuentes/Paradasapp.csv").catch(() => null),
        fetch("fuentes/pasajeros_aeropuerto_mensual.csv").catch(() => null),
        fetch("fuentes/vuelos.csv").catch(() => null),
        fetch("fuentes/rutasaereas.csv").catch(() => null)
      ]);

      const geojson = await airportsResp.json();
      aeropuertos = (geojson.features || []).map(f => f.properties || {}).filter(p => clean(p.IATA));
      aeropuertos.sort((a, b) => clean(a.IATA).localeCompare(clean(b.IATA), "es"));

      if (transpResp && transpResp.ok) transportePorIATA = parseTransporteCSV(await transpResp.text());
      if (paxResp && paxResp.ok) pasajerosMensualRows = parsePasajerosMensualCSV(await paxResp.text());
      if (vuelosResp && vuelosResp.ok) vuelosRows = parseVuelosCSV(await vuelosResp.text());
      if (rutasResp && rutasResp.ok) rutasRows = parseRutasCSV(await rutasResp.text());

      select.innerHTML = "";
      aeropuertos.forEach(a => {
        const opt = document.createElement("option");
        const nombre = clean(firstNonEmpty(a, ["Aeropuerto", "Nombre del Aeropuerto", "IATA"]));
        opt.value = clean(a.IATA).toUpperCase();
        opt.textContent = `${nombre} (${clean(a.IATA).toUpperCase()})`;
        select.appendChild(opt);
      });

      const params = new URLSearchParams(window.location.search);
      const initial = clean(params.get("airport")).toUpperCase() || clean(aeropuertos[0]?.IATA).toUpperCase();
      select.value = initial;
      renderAirport(initial);

      select.addEventListener("change", e => {
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
    initExport();
    loadData();
  });
})();
