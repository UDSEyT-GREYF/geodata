/* ============================================================
   OFERTA / DEMANDA - RUTAS
   misma lógica conceptual que la lámina
   ============================================================ */

let rutasOfertaRows = [];
let iataWorldIndex = {};
let routeCodeIndex = {};

const DEST_OVERRIDES = {
  BUE: { ciudad: "Buenos Aires AEP+EZE", pais: "Argentina" },
  GRU: { ciudad: "São Paulo", pais: "Brasil" },
  GIG: { ciudad: "Río de Janeiro", pais: "Brasil" },
  FLN: { ciudad: "Florianópolis", pais: "Brasil" },
  LIM: { ciudad: "Lima", pais: "Perú" },
  SCL: { ciudad: "Santiago", pais: "Chile" }
};

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
    const anioMesRaw = clean(firstNonEmpty(r, ["añomes", "anomes", "año_mes", "fecha"]));
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
      tipoOperacion: clean(firstNonEmpty(r, ["comercial_av_gral"])),

      pax: parseNumber(firstNonEmpty(r, ["pax", "pasajeros", "valor_pax"])),
      asientos: parseNumber(firstNonEmpty(r, ["asientos_pax", "asientos"])),
      vuelos: parseNumber(firstNonEmpty(r, ["vuelos", "cantidad_vuelos"])),
      frecuenciaSemanal: parseNumber(firstNonEmpty(r, ["frecuencia_semanal", "frecuencias"])),
      distanciaKm: parseNumber(firstNonEmpty(r, ["distanciakm", "distancia_km"]))
    };
  }).filter(r =>
    r.endpointA &&
    r.endpointB &&
    Number.isFinite(r.year)
  );
}

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
    rows = rows.filter(r => clean(r.tipoOperacion).toLowerCase() === "comercial");
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

function renderOfertaDemanda(iata) {
  const summary = getOfertaDemandaSummary(iata, YEAR_REF, { soloComercial: true });

  setText("odTotalPax", summary.totalPax ? formatNumber(Math.round(summary.totalPax)) : "–");
  setText("odTotalAsientos", summary.totalAsientos ? formatNumber(Math.round(summary.totalAsientos)) : "–");
  setText("odTotalVuelos", summary.totalVuelos ? formatNumber(Math.round(summary.totalVuelos)) : "–");
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
          ${d.pais ? `<span class="od-route-country">· ${escapeHtml(d.pais)}</span>` : ""}
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
}

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
          data: asientos
        },
        {
          type: "line",
          label: "Pasajeros",
          data: pax,
          tension: 0.25
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
