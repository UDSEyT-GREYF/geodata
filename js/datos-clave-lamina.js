/* global L, html2canvas */
(() => {
  "use strict";

  let aeropuertos = [];
  let poligonos = [];
  let pasajerosMensualRows = [];
  let transportePorIATA = {};
  let currentIATA = "";

  let mapPredio = null;
  let mapMarker = null;
  let poligonoLayer = null;

  const PAX_DATASET_CAB = "pasajeros_comerciales_cabotaje_aeropuerto";
  const PAX_DATASET_INT = "pasajeros_comerciales_internacional_aeropuerto";

  function q(id) { return document.getElementById(id); }

  function formatNumber(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("es-AR");
  }

  function formatNumberCompact(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 });
  }

  function clean(v) {
    return v === null || v === undefined ? "" : String(v).trim();
  }

  function parseMonto(raw) {
    if (raw === null || raw === undefined) return 0;
    let s = String(raw).trim();
    if (!s) return 0;
    s = s.replace(/\./g, "").replace(/,/g, ".");
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  }

  function firstNonEmpty(obj, keys, fallback = "") {
    for (const key of keys) {
      if (!obj) continue;
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  }

  function splitField(str) {
    if (!str) return [];
    return String(str)
      .split(/[;]+| {2,}|\t+|\|/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function parseFechaFlexible(raw) {
    if (!raw) return null;
    const m1 = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
    const m2 = String(raw).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  function parseTransporteCSV(text) {
    const result = {};
    if (!text) return result;
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return result;
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().toUpperCase());
    const idxIATA = headers.indexOf("IATA");
    const idxLINEA = headers.indexOf("LINEA");
    let idxPARADA = headers.indexOf("PARADA");
    if (idxPARADA === -1) idxPARADA = headers.indexOf("PARADAAEP");
    if (idxIATA === -1) return result;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep);
      const iata = clean(cols[idxIATA]).toUpperCase();
      if (!iata) continue;
      result[iata] = {
        linea: idxLINEA !== -1 ? clean(cols[idxLINEA]) : "",
        parada: idxPARADA !== -1 ? clean(cols[idxPARADA]) : ""
      };
    }
    return result;
  }

  function parsePasajerosMensualCSV(text) {
    const rows = [];
    if (!text) return rows;
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return rows;

    let sep = ",";
    if (lines[0].includes("\t")) sep = "\t";
    else if (lines[0].includes(";")) sep = ";";

    const headers = lines[0].split(sep).map(h => h.trim());
    const idxIATA = headers.findIndex(h => h.toLowerCase() === "iata");
    const idxFecha = headers.findIndex(h => h.toLowerCase() === "fecha");
    const idxValorPax = headers.findIndex(h => h.toLowerCase() === "valor_pax");
    const idxDataset = headers.findIndex(h => h.toLowerCase() === "dataset");
    if (idxIATA === -1 || idxFecha === -1 || idxValorPax === -1) return rows;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep);
      const iata = clean(cols[idxIATA]).toUpperCase();
      const date = parseFechaFlexible(clean(cols[idxFecha]));
      const valor = Number(clean(cols[idxValorPax]));
      if (!iata || !date || isNaN(valor)) continue;
      rows.push({
        iata,
        dataset: idxDataset !== -1 ? clean(cols[idxDataset]) : "",
        date,
        valor
      });
    }

    rows.sort((a, b) => a.date - b.date);
    return rows;
  }

  function buildPaxSeries(iataUpper, mode) {
    const rowsAll = pasajerosMensualRows.filter(r => r.iata === iataUpper);
    if (!rowsAll.length) return [];

    if (mode === "cabotaje" || mode === "internacional") {
      const target = mode === "cabotaje" ? PAX_DATASET_CAB : PAX_DATASET_INT;
      return rowsAll.filter(r => r.dataset === target).sort((a, b) => a.date - b.date);
    }

    const acc = new Map();
    for (const r of rowsAll) {
      if (r.dataset !== PAX_DATASET_CAB && r.dataset !== PAX_DATASET_INT) continue;
      const year = r.date.getFullYear();
      const month = r.date.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      if (!acc.has(key)) {
        acc.set(key, { date: new Date(year, month - 1, 1), valor: 0 });
      }
      acc.get(key).valor += Number(r.valor) || 0;
    }
    return Array.from(acc.values()).sort((a, b) => a.date - b.date);
  }

  function annualTotals(rows) {
    const acc = new Map();
    rows.forEach(r => {
      const y = r.date.getFullYear();
      acc.set(y, (acc.get(y) || 0) + (Number(r.valor) || 0));
    });
    return Array.from(acc.entries())
      .map(([year, valor]) => ({ year, valor }))
      .sort((a, b) => a.year - b.year);
  }

  function initMap() {
    mapPredio = L.map("mapPredio", {
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
      maxZoom: 19,
      attribution: ""
    }).addTo(mapPredio);

    mapMarker = L.circleMarker([-34.6, -58.4], {
      radius: 6,
      color: "#175d9f",
      weight: 2,
      fillColor: "#2d8cf0",
      fillOpacity: 0.95
    }).addTo(mapPredio);
  }

  function updateMapForAirport(a) {
    if (!mapPredio) return;

    if (poligonoLayer) {
      mapPredio.removeLayer(poligonoLayer);
      poligonoLayer = null;
    }

    const iata = clean(a.IATA).toUpperCase();
    const feats = poligonos.filter(f => {
      const p = f.properties || {};
      const code = clean(p.IATA || p.iata || p.iata_code).toUpperCase();
      return code === iata;
    });

    if (feats.length) {
      poligonoLayer = L.geoJSON(feats, {
        style: {
          color: "#90d400",
          weight: 2,
          fillColor: "#dff4aa",
          fillOpacity: 0.25
        }
      }).addTo(mapPredio);
      const bounds = poligonoLayer.getBounds();
      if (bounds.isValid()) {
        mapPredio.fitBounds(bounds, { padding: [10, 10] });
      }
      if (mapMarker) mapPredio.removeLayer(mapMarker);
      return;
    }

    const lat = firstNonEmpty(a, ["Lat", "LAT"]);
    const lon = firstNonEmpty(a, ["Lon", "LON", "Long"]);
    if (lat !== "" && lon !== "" && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      const ll = [Number(lat), Number(lon)];
      if (!mapMarker) {
        mapMarker = L.circleMarker(ll, {
          radius: 6,
          color: "#175d9f",
          weight: 2,
          fillColor: "#2d8cf0",
          fillOpacity: 0.95
        }).addTo(mapPredio);
      } else {
        mapMarker.addTo(mapPredio).setLatLng(ll);
      }
      mapPredio.setView(ll, 12);
    } else {
      if (mapMarker) mapPredio.addLayer(mapMarker).setLatLng([-34.6, -58.4]);
      mapPredio.setView([-34.6, -58.4], 5);
    }
  }

  function renderAnnualChart(series, currentYear) {
    const svg = q("paxHistoryChart");
    if (!svg) return;
    if (!series.length) {
      svg.innerHTML = "";
      return;
    }

    const W = 720, H = 210;
    const padL = 56, padR = 14, padT = 16, padB = 32;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const values = series.map(s => s.valor);
    const maxV = Math.max(...values);
    const minV = 0;
    const range = Math.max(1, maxV - minV);

    const x = i => padL + (innerW * i / Math.max(1, series.length - 1));
    const y = v => padT + innerH - (innerH * ((v - minV) / range));

    const ticks = 4;
    let grid = "";
    for (let i = 0; i <= ticks; i++) {
      const v = maxV * (i / ticks);
      const yy = y(v);
      grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#e5edf6" stroke-width="1"></line>`;
      grid += `<text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="10" fill="#6b7785">${formatNumber(Math.round(v))}</text>`;
    }

    const points = series.map((d, i) => `${x(i)},${y(d.valor)}`).join(" ");
    const areaPoints = `${padL},${padT + innerH} ${points} ${x(series.length - 1)},${padT + innerH}`;

    let xLabels = "";
    series.forEach((d, i) => {
      const xx = x(i);
      const isFirst = i === 0;
      const isLast = i === series.length - 1;
      const highlight = d.year === currentYear;
      xLabels += `<text x="${xx}" y="${H - 12}" text-anchor="middle" font-size="10" fill="${highlight ? '#1f4f85' : '#6b7785'}" font-weight="${highlight ? '700' : '400'}">${d.year}</text>`;
      if (!isFirst && !isLast) {
        xLabels += `<line x1="${xx}" y1="${padT}" x2="${xx}" y2="${padT + innerH}" stroke="#f4f7fb" stroke-width="1"></line>`;
      }
    });

    let markers = "";
    series.forEach((d, i) => {
      const xx = x(i);
      const yy = y(d.valor);
      const highlight = d.year === currentYear;
      markers += `<circle cx="${xx}" cy="${yy}" r="${highlight ? 4.4 : 3.1}" fill="${highlight ? '#ef8a27' : '#306fb0'}"></circle>`;
      if (highlight || i === series.length - 1) {
        markers += `<text x="${xx}" y="${yy - 8}" text-anchor="middle" font-size="10" fill="#4b5563">${formatNumber(Math.round(d.valor))}</text>`;
      }
    });

    svg.innerHTML = `
      <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"></rect>
      ${grid}
      ${xLabels}
      <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="#d4deea" stroke-width="1"></line>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#d4deea" stroke-width="1"></line>
      <polygon points="${areaPoints}" fill="#d9e9fb" opacity="0.65"></polygon>
      <polyline points="${points}" fill="none" stroke="#306fb0" stroke-width="2.4"></polyline>
      ${markers}
    `;
  }

  function renderPassengers(iata) {
    const totalSeries = buildPaxSeries(iata, "total");
    const cabSeries = buildPaxSeries(iata, "cabotaje");
    const intSeries = buildPaxSeries(iata, "internacional");
    const year = 2025;

    const sumYear = (rows, y) => rows.filter(r => r.date.getFullYear() === y).reduce((acc, r) => acc + r.valor, 0);

    const total2025 = sumYear(totalSeries, year);
    const cab2025 = sumYear(cabSeries, year);
    const int2025 = sumYear(intSeries, year);

    q("passengersTitle").textContent = `Pasajeros ${year}`;
    q("paxTotal2025").textContent = formatNumber(Math.round(total2025));
    q("paxCab2025").textContent = formatNumber(Math.round(cab2025));
    q("paxInt2025").textContent = formatNumber(Math.round(int2025));
    q("paxPromMensual").textContent = total2025 ? formatNumberCompact(Math.round(total2025 / 12)) : "–";
    q("paxPromDiario").textContent = total2025 ? formatNumberCompact(Math.round(total2025 / 365)) : "–";

    const annual = annualTotals(totalSeries);
    renderAnnualChart(annual, year);
  }

  function renderAirport(iataCode) {
    const a = aeropuertos.find(x => clean(x.IATA).toUpperCase() === clean(iataCode).toUpperCase());
    if (!a) return;
    currentIATA = clean(a.IATA).toUpperCase();

    const nombre = clean(firstNonEmpty(a, ["Aeropuerto", "Nombre del Aeropuerto", "IATA"]));
    q("sheetTitle").textContent = `${nombre} (${currentIATA}) – Datos clave del aeropuerto`;
    q("sheetSubtitle").textContent = `Síntesis operativa e infraestructura · Año 2025`;

    q("sumSupPredio").textContent = `${formatNumber(firstNonEmpty(a, ["SupPredioHa"]))} ha`;
    q("sumSupConcesionada").textContent = `${formatNumber(firstNonEmpty(a, ["SupConcesionadaHa"]))} ha`;
    q("sumTerminal").innerHTML = `${formatNumber(firstNonEmpty(a, ["TerminalM2"]))} m²`;

    q("predioExplotador").textContent = clean(firstNonEmpty(a, ["Explotador"])) || "–";
    const loc = `${clean(firstNonEmpty(a, ["Localidad"]))}${clean(firstNonEmpty(a, ["Provincia"])) ? " · " + clean(firstNonEmpty(a, ["Provincia"])) : ""}`;
    q("predioUbicacion").textContent = loc || "–";

    const orientRaw = clean(firstNonEmpty(a, ["PistaOrientacion"]));
    const dimsRaw = clean(firstNonEmpty(a, ["Dimensiones"]));
    const matRaw = clean(firstNonEmpty(a, ["MaterialPista"]));
    const oriArr = splitField(orientRaw);
    const dimArr = splitField(dimsRaw);
    const matArr = splitField(matRaw);
    q("runwayOrient").textContent = oriArr[0] || orientRaw || "–";
    q("runwayDim").textContent = dimArr[0] || dimsRaw || "–";
    q("runwayMat").textContent = clean(matArr[0] || matRaw || "–").toLowerCase();

    const psnCom = (Number(firstNonEmpty(a, ["PSNRemotasC"], 0)) || 0) + (Number(firstNonEmpty(a, ["PSNRemotasC_1"], 0)) || 0);
    const psnGen = Number(firstNonEmpty(a, ["PSN_C"], 0)) || 0;
    q("psnComercial").textContent = psnCom ? formatNumber(psnCom) : "–";
    q("psnGeneral").textContent = psnGen ? formatNumber(psnGen) : "–";
    q("mangasValor").textContent = formatNumber(firstNonEmpty(a, ["Mangas telescópicas"]));

    q("horarioOperacion").textContent = clean(firstNonEmpty(a, ["Horario de operación"])) || "–";
    q("claveRef").textContent = clean(firstNonEmpty(a, ["CLAVE DE REFERENCIA DE AERÓDROMO", "Clave de referencia", "ClaveRef"])) || "–";

    const elev = firstNonEmpty(a, ["Elevación del aeropuerto", "Elevacion del aeropuerto", "Elevación", "Elevacion", "Elevación (msnm)", "Elevacion (msnm)", "ElevacionMsnm", "Elevación aeropuerto"]);
    q("elevacionAero").innerHTML = elev ? `${formatNumberCompact(parseMonto(elev) || elev)} <span style="font-size:.9rem;font-weight:700;">msnm</span>` : "–";

    const ayudas = clean(firstNonEmpty(a, ["Ayudas visuales", "AyudasVisuales", "ILS", "ILS (cabecera)"])) || "–";
    q("ayudasVisuales").textContent = ayudas;

    q("mostradoresCheckin").textContent = formatNumber(firstNonEmpty(a, ["Mostradores Check in"]));
    q("psaTotal").textContent = formatNumber(firstNonEmpty(a, ["PSAScanTotal"]));
    q("estacionamientoVeh").textContent = formatNumber(firstNonEmpty(a, ["Estacionamiento Vehicular"]));
    q("aduanaPuestos").textContent = formatNumber(firstNonEmpty(a, ["Puestos de Aduanas"]));
    q("puertasEmbarque").textContent = formatNumber(firstNonEmpty(a, ["PuertasEmbarqueTotal"]));
    q("cintasEquipaje").textContent = formatNumber(firstNonEmpty(a, ["CintasTotal"]));
    q("migracionesTotal").textContent = formatNumber(firstNonEmpty(a, ["PuestosMigracionesTot"]));

    const tr = transportePorIATA[currentIATA] || {};
    const transporteText = [
      clean(tr.linea) ? `Líneas: ${clean(tr.linea)}` : "",
      clean(tr.parada) ? `Parada: ${clean(tr.parada)}` : ""
    ].filter(Boolean).join(" · ");
    q("transportePublico").textContent = transporteText || "Sin dato";

    renderPassengers(currentIATA);
    updateMapForAirport(a);
  }

  async function loadData() {
    const select = q("airportSelect");
    try {
      const [mainResp, polyResp, transpResp, paxResp] = await Promise.all([
        fetch("fuentes/Datos_aeropuertos.geojson"),
        fetch("fuentes/poligonos_aeropuertos.geojson").catch(() => null),
        fetch("fuentes/Paradasapp.csv").catch(() => null),
        fetch("fuentes/pasajeros_aeropuerto_mensual.csv").catch(() => null)
      ]);

      const geojson = await mainResp.json();
      aeropuertos = (geojson.features || []).map(f => f.properties || {}).filter(p => clean(p.IATA));
      aeropuertos.sort((a, b) => clean(a.IATA).localeCompare(clean(b.IATA), "es"));

      if (polyResp && polyResp.ok) {
        const gjPoly = await polyResp.json();
        poligonos = gjPoly.features || [];
      }

      if (transpResp && transpResp.ok) {
        const transpText = await transpResp.text();
        transportePorIATA = parseTransporteCSV(transpText);
      }

      if (paxResp && paxResp.ok) {
        const paxText = await paxResp.text();
        pasajerosMensualRows = parsePasajerosMensualCSV(paxText);
      }

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
      select.innerHTML = `<option>Error al cargar datos</option>`;
    }
  }

  function initExport() {
    q("btnPrint").addEventListener("click", () => window.print());

    q("btnExportPng").addEventListener("click", async () => {
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
    initMap();
    initExport();
    loadData();
  });
})();
