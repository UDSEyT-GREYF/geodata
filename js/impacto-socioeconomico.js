(() => {
  "use strict";

  const COLORS = {
    navy: "#002855",
    blue: "#2f77c8",
    sky: "#48b9dc",
    cyan: "#35c3d4",
    teal: "#42cda7",
    lime: "#9bd633",
    orange: "#e9943a",
    red: "#c94e55",
    muted: "#66717e",
    grid: "#dce3eb",
    light: "#eef3f7"
  };

  
  const FIELD_ALIASES = {
    iata: ["IATA", "iata", "codigo_iata", "cod_iata", "Código IATA"],
    airportName: ["Aeropuerto", "aeropuerto", "NombreAeropuerto", "nombre_aeropuerto", "Nombre del Aeropuerto", "Nombre del aeropuerto"],
    year: ["Año", "año", "anio", "year", "AñoImpacto", "anio_impacto", "Año de referencia"],

pbaTotal: [
  "PBA",
  "PBATotal",
  "PBA_Total",
  "pba_total",
  "ProductoBrutoAeroportuario",
  "Producto Bruto Aeroportuario",
  "Producto Bruto Aeroportuario Total",
  "PBA 2025 USD"
],

pbaAeronautico: [
  "PBAAeronautico",
  "PBA_Aeronautico",
  "PBAAeronáutico",
  "ServiciosAeronauticos",
  "Servicios Aeronáuticos",
  "ingresos aeronáuticos 2025 USD"
],

pbaNoAeronautico: [
  "PBANoAeronautico",
  "PBA_No_Aeronautico",
  "PBANoAeronáutico",
  "pba_no_aeronautico",
  "ServiciosNoAeronauticos",
  "Servicios no aeronáuticos",
  "servicios_no_aeronauticos",
  "ingresos_no_aeronauticos_2025_usd",
  "Ingresos no aeronáuticos 2025 USD"
],

pbaConexas: [
  "PBAConexas",
  "PBA_Conexas",
  "pba_conexas",
  "ActividadesConexas",
  "Actividades conexas al transporte aerocomercial",
  "Conexas",
  "actividades_conexas_transporte_aerocomercial_2025_usd",
  "actividades_conexas_al_transporte_aerocomercial_2025_usd",
  "Actividades conexas transporte aerocomercial 2025 USD",
  "Actividades conexas al transporte aerocomercial 2025 USD"
],

pbaComercial: [
  "PBAExplotacionComercial",
  "PBA_Explotacion_Comercial",
  "pba_explotacion_comercial",
  "ExplotacionComercial",
  "Explotación comercial",
  "explotacion_comercial_aeropuerto_2025_usd",
  "Explotación comercial aeropuerto 2025 USD",
  "Explotacion comercial aeropuerto 2025 USD"
],

pbaSecundarias: [
  "PBAActividadesSecundarias",
  "PBA_Actividades_Secundarias",
  "pba_actividades_secundarias",
  "ActividadesSecundarias",
  "Actividades secundarias",
  "actividades_secundarias_aeropuerto_2025_usd",
  "Actividades secundarias aeropuerto 2025 USD",
  "Actividades secundarias desarrolladas en el aeropuerto 2025 USD"
],

turismoReceptivo: [
  "TurismoReceptivo",
  "turismo_receptivo",
  "ImpactoTurismoReceptivo",
  "Impacto turismo receptivo",
  "Turismo receptivo total",
  "Saldo del Turismo Receptivo (USD)2025",
  "Saldo del Turismo Receptivo USD 2025"
],

turismoReceptivoNacional: [
  "TurismoReceptivoNacional",
  "TurismoInternoReceptivo",
  "turismo_receptivo_nacional",
  "turismo_interno_receptivo",
  "GastoTurismoInternoReceptivo",
  "TNR (USD)2025",
  "TNR USD 2025"
],

turismoReceptivoInternacional: [
  "TurismoReceptivoInternacional",
  "TurismoExtranjeroReceptivo",
  "turismo_receptivo_internacional",
  "turismo_extranjero_receptivo",
  "GastoTurismoExtranjeroReceptivo",
  "TIR (USD)2025",
  "TIR USD 2025"
],

turismoEmisivo: [
  "TurismoEmisivo",
  "turismo_emisivo",
  "ImpactoTurismoEmisivo",
  "Impacto turismo emisivo",
  "Turismo emisivo total",
  "ImpactoNegativoTurismo",
  "Saldo del Turismo Emisivo (USD)2025",
  "Saldo del Turismo Emisivo USD 2025"
],

turismoEmisivoNacional: [
  "TurismoEmisivoNacional",
  "TurismoInternoEmisivo",
  "turismo_emisivo_nacional",
  "turismo_interno_emisivo",
  "GastoTurismoInternoEmisivo",
  "TNE (USD)2025",
  "TNE USD 2025"
],

turismoEmisivoInternacional: [
  "TurismoEmisivoInternacional",
  "TurismoExtranjeroEmisivo",
  "turismo_emisivo_internacional",
  "turismo_extranjero_emisivo",
  "GastoTurismoExtranjeroEmisivo",
  "TIE (USD)2025",
  "TIE USD 2025"
],

saldoTurismo: [
  "SaldoTurismo",
  "saldo_turismo",
  "Saldo de turismo",
  "SaldoTuristico",
  "saldo_turistico",
  "Saldo del Turismo (USD)2025",
  "Saldo del Turismo USD 2025"
],

beneficioPasajeros: [
  "BeneficioPasajeros",
  "BeneficiosPasajeros",
  "beneficio_pasajeros",
  "beneficios_pasajeros",
  "ExcedenteConsumidor",
  "excedente_consumidor",
  "Excedente del consumidor",
  "Beneficios al pax 2025 (USD)",
  "Beneficios al pax 2025 USD"
],

impactoPositivo: [
  "ImpactoPositivoTotal",
  "ImpactoTotalPositivo",
  "impacto_positivo_total",
  "impacto_total_positivo",
  "Impactos positivos",
  "Impacto positivo total",
  "Impacto económico positivo"
],

impactoNegativo: [
  "ImpactoNegativoTotal",
  "ImpactoTotalNegativo",
  "impacto_negativo_total",
  "impacto_total_negativo",
  "Impactos negativos",
  "Impacto negativo total",
  "Impacto económico negativo (USD)",
  "Impacto económico negativo USD"
],

saldoImpacto: [
  "SaldoImpacto",
  "saldo_impacto",
  "Saldo de impactos",
  "ImpactoNeto",
  "impacto_neto",
  "Saldo total",
  "Saldo de impactos totales (USD)",
  "Saldo de impactos totales USD"
],

empleoDirecto: [
  "EmpleoDirecto",
  "empleo_directo",
  "Empleo directo",
  "EmpleoDirecto2024",
  "EmpleoDirecto2025"
],

empleoIndirecto: [
  "EmpleoIndirecto",
  "empleo_indirecto",
  "Empleo indirecto",
  "EmpleoIndirecto2025"
],

empleoInducido: [
  "EmpleoInducido",
  "empleo_inducido",
  "Empleo inducido",
  "EmpleoInducido2025"
],

empleoCatalitico: [
  "EmpleoCatalitico",
  "EmpleoCatalítico",
  "empleo_catalitico",
  "Empleo catalítico",
  "EmpleoCatalitico2025",
  "EmpleoCatalítico2025"
],

empleoTotal: [
  "EmpleoTotal",
  "empleo_total",
  "EmpleosTotal",
  "PuestosEmpleoTotal",
  "Total empleos",
  "Empleo total",
  "EmpleoAeropTotal2025",
  "EmpleoAeroTotal2025"
],

empleoMujeres: [
  "EmpleoDirectoMujeres",
  "empleo_directo_mujeres",
  "Mujeres",
  "mujeres",
  "pct_mujeres",
  "PorcentajeMujeres",
  "pct_mujeres_directo",
  "% Mujeres"
],

empleoVarones: [
  "EmpleoDirectoVarones",
  "empleo_directo_varones",
  "Varones",
  "varones",
  "pct_varones",
  "PorcentajeVarones",
  "pct_varones_directo",
  "% Varones"
],
    poblacionInfluencia: ["PoblacionAreaInfluencia", "PoblaciónAreaInfluencia", "poblacion_area_influencia", "Población del Área de Influencia (Censo 2022)", "Población del área de influencia", "PoblacionInfluencia"],

    passengersH12026: ["PasajerosPrimerSemestre2026", "Pax1Sem2026", "PaxH12026", "pasajeros_h1_2026", "pasajeros_1sem_2026"],
    passengersH12025: ["PasajerosPrimerSemestre2025", "Pax1Sem2025", "PaxH12025", "pasajeros_h1_2025", "pasajeros_1sem_2025"],
    passengersH1Yoy: ["VariacionPasajerosPrimerSemestre2026", "VarPax1Sem2026", "PaxH1YoY2026", "variacion_pasajeros_h1_2026", "variacion_1sem_2026"],

    summaryImage: ["ImagenResumenImpacto", "imagen_resumen_impacto", "ImagenResumenEjecutivo", "imagen_resumen_ejecutivo", "summaryImage", "summary_image", "imagenImpacto", "imagen_impacto"]
  };

let root = null;
let geojson = null;
let currentFeature = null;
let initializationPromise = null;
let summaryImageRequestId = 0;
  
const passengerCacheByUrl = new Map();
let passengerSemesterData = null;
let employmentGenderByIata = new Map();

const NO_AERO_DATA_URL = "data/ingresos_no_aeronauticos_2025_web.geojson";
const AIRPORT_DATA_URL = "fuentes/Datos_aeropuertos.geojson";
const EMPLOYMENT_GENDER_URL = "data/empleo_genero_2025.json";

const PASSENGER_MAIN_URL = "fuentes/pasajeros_aeropuerto_mensual.csv";
const PASSENGER_EXTRA_URL = "fuentes/pasajeros_movimientos_extra_9aeropuertos.csv";
const PASSENGER_SEMESTER_URL = "data/pasajeros_semestre_2025_2026.json";

  // Misma regla usada en Oferta y demanda / tabla de tráfico:
  // estos aeropuertos no deben depender únicamente de la serie mensual principal.
  const EXTRA_PASSENGER_IATAS = new Set([
    "TTG", "RYO", "SST", "NEC", "LPG", "GNR", "JNI", "PMQ", "AOL",
    "LGS", "EPA", "COC", "RCQ", "RLO", "TDL", "VLG", "VME"
  ]);

  const FDO_IATA = "FDO";
  function normalizeKey(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function buildPropertyIndex(properties) {
    const index = new Map();
    Object.keys(properties || {}).forEach((key) => {
      index.set(normalizeKey(key), key);
    });
    return index;
  }

  function readRaw(properties, aliasName) {
    const aliases = FIELD_ALIASES[aliasName] || [];
    const index = buildPropertyIndex(properties);
    for (const alias of aliases) {
      const originalKey = index.get(normalizeKey(alias));
      if (!originalKey) continue;
      const value = properties[originalKey];
      if (value !== null && value !== undefined && String(value).trim() !== "") return value;
    }
    return null;
  }

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined) return null;

    let text = String(value).trim();
    if (!text || text === "–" || /^n\/?d$/i.test(text)) return null;

    const isPercent = text.includes("%");
    text = text.replace(/[^0-9,.-]/g, "");
    if (!text) return null;

    const comma = text.lastIndexOf(",");
    const dot = text.lastIndexOf(".");

    if (comma !== -1 && dot !== -1) {
      if (comma > dot) text = text.replace(/\./g, "").replace(",", ".");
      else text = text.replace(/,/g, "");
    } else if (comma !== -1) {
      const decimals = text.length - comma - 1;
      text = decimals > 0 && decimals <= 2 ? text.replace(",", ".") : text.replace(/,/g, "");
    } else if ((text.match(/\./g) || []).length > 1) {
      text = text.replace(/\./g, "");
    } else if (dot !== -1) {
      const decimals = text.length - dot - 1;
      if (decimals === 3) text = text.replace(".", "");
    }

    const number = Number(text);
    if (!Number.isFinite(number)) return null;
    return isPercent ? number : number;
  }

  function readNumber(properties, aliasName) {
    return parseNumber(readRaw(properties, aliasName));
  }

  function valueOrSum(value, parts) {
    if (Number.isFinite(value)) return value;
    const valid = parts.filter(Number.isFinite);
    return valid.length ? valid.reduce((sum, item) => sum + item, 0) : null;
  }

  function valueOrDifference(value, minuend, subtrahend) {
    if (Number.isFinite(value)) return value;
    if (Number.isFinite(minuend) && Number.isFinite(subtrahend)) return minuend - subtrahend;
    return null;
  }

  function formatInteger(value) {
    return Number.isFinite(value)
      ? Math.round(value).toLocaleString("es-AR")
      : "–";
  }

  function formatCurrency(value) {
    return Number.isFinite(value)
      ? `$ ${Math.round(value).toLocaleString("es-AR")}`
      : "–";
  }

  function formatCompact(value) {
    if (!Number.isFinite(value)) return "–";
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) {
      return `$ ${(value / 1_000_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} mil M`;
    }
    if (abs >= 1_000_000) {
      return `$ ${(value / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
    }
    if (abs >= 1_000) {
      return `$ ${(value / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} mil`;
    }
    return formatCurrency(value);
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "–";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  function ratioPercent(part, total) {
    return Number.isFinite(part) && Number.isFinite(total) && total !== 0
      ? (part / total) * 100
      : null;
  }

  function setText(bindName, value) {
    if (!root) return;
    root.querySelectorAll(`[data-bind="${bindName}"]`).forEach((element) => {
      element.textContent = value;
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function svgElement(tag, attributes = {}, text = "") {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== "") element.textContent = text;
    return element;
  }

  function appendMultilineText(parent, x, y, lines, attributes = {}, lineHeight = 13) {
    const text = svgElement("text", { x, y, ...attributes });
    const rows = Array.isArray(lines) ? lines : [lines];
    rows.filter(Boolean).forEach((line, index) => {
      text.appendChild(svgElement("tspan", {
        x,
        dy: index === 0 ? 0 : lineHeight
      }, String(line)));
    });
    parent.appendChild(text);
    return text;
  }
function getEmploymentIconCount(value, maxValue, maxIcons = 10, minIcons = 2) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maxValue) || maxValue <= 0) {
    return 0;
  }
  return Math.max(minIcons, Math.round((value / maxValue) * maxIcons));
}

function drawEmploymentPeopleInline(parent, x, y, count, color, options = {}) {
  const scale = options.scale || 0.54;
  const gapX = options.gapX || 11;

  for (let i = 0; i < count; i += 1) {
    const tx = x + i * gapX;
    const ty = y;

    const g = svgElement("g", {
      transform: `translate(${tx} ${ty}) scale(${scale})`
    });

    g.appendChild(svgElement("circle", {
      cx: 8,
      cy: 5,
      r: 4.2,
      fill: color
    }));

    g.appendChild(svgElement("path", {
      d: "M 1 24 C 1 16, 6 11, 14 11 C 22 11, 27 16, 27 24 L 27 28 L 1 28 Z",
      fill: color
    }));

    parent.appendChild(g);
  }
}
  function clearChart(container, message = "Sin datos disponibles") {
    if (!container) return;
    container.innerHTML = `<div class="impacto-chart-empty">${escapeHtml(message)}</div>`;
  }

  function renderDonut(container, items, centerTop, centerBottom) {
    if (!container) return;
    const validItems = items.filter((item) => Number.isFinite(item.value) && item.value > 0);
    const total = validItems.reduce((sum, item) => sum + item.value, 0);
    if (!validItems.length || total <= 0) {
      clearChart(container);
      return;
    }

    container.innerHTML = "";
    const svg = svgElement("svg", { viewBox: "0 0 280 220", role: "img" });
    const cx = 92;
    const cy = 105;
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    validItems.forEach((item) => {
      const fraction = item.value / total;
      const circle = svgElement("circle", {
        cx,
        cy,
        r: radius,
        fill: "none",
        stroke: item.color,
        "stroke-width": 32,
        "stroke-dasharray": `${fraction * circumference} ${circumference}`,
        "stroke-dashoffset": -offset,
        transform: `rotate(-90 ${cx} ${cy})`
      });
      svg.appendChild(circle);
      offset += fraction * circumference;
    });

    svg.appendChild(svgElement("text", {
      x: cx,
      y: cy - 3,
      "text-anchor": "middle",
      fill: COLORS.navy,
      "font-size": 18,
      "font-weight": 800
    }, centerTop));
    svg.appendChild(svgElement("text", {
      x: cx,
      y: cy + 15,
      "text-anchor": "middle",
      fill: COLORS.muted,
      "font-size": 10
    }, centerBottom));

    validItems.forEach((item, index) => {
      const y = 45 + index * 42;
      svg.appendChild(svgElement("rect", { x: 176, y: y - 10, width: 12, height: 12, rx: 2, fill: item.color }));
      svg.appendChild(svgElement("text", { x: 194, y, fill: COLORS.navy, "font-size": 10.5, "font-weight": 700 }, item.label));
      svg.appendChild(svgElement("text", { x: 194, y: y + 15, fill: COLORS.muted, "font-size": 10 }, `${ratioPercent(item.value, total).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`));
    });

    container.appendChild(svg);
  }
function renderGenderDonut(container, items, centerTop, centerBottom) {
  if (!container) return;

  const validItems = items.filter((item) => Number.isFinite(item.value) && item.value > 0);
  const total = validItems.reduce((sum, item) => sum + item.value, 0);

  if (!validItems.length || total <= 0) {
    clearChart(container);
    return;
  }

  container.innerHTML = "";

  const svg = svgElement("svg", {
    viewBox: "0 0 220 300",
    role: "img"
  });

  const cx = 110;
  const cy = 98;
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  validItems.forEach((item) => {
    const fraction = item.value / total;

    svg.appendChild(svgElement("circle", {
      cx,
      cy,
      r: radius,
      fill: "none",
      stroke: item.color,
      "stroke-width": 28,
      "stroke-dasharray": `${fraction * circumference} ${circumference}`,
      "stroke-dashoffset": -offset,
      transform: `rotate(-90 ${cx} ${cy})`
    }));

    offset += fraction * circumference;
  });

  svg.appendChild(svgElement("text", {
    x: cx,
    y: cy - 2,
    "text-anchor": "middle",
    fill: COLORS.navy,
    "font-size": 18,
    "font-weight": 900
  }, centerTop));

  svg.appendChild(svgElement("text", {
    x: cx,
    y: cy + 17,
    "text-anchor": "middle",
    fill: COLORS.muted,
    "font-size": 12
  }, centerBottom));

  validItems.forEach((item, index) => {
    const y = 222 + index * 38;
    const pct = ratioPercent(item.value, total);

    svg.appendChild(svgElement("rect", {
      x: 58,
      y: y - 11,
      width: 14,
      height: 14,
      rx: 2,
      fill: item.color
    }));

    svg.appendChild(svgElement("text", {
      x: 78,
      y,
      fill: COLORS.navy,
      "font-size": 13,
      "font-weight": 800
    }, item.label));

    svg.appendChild(svgElement("text", {
      x: 84,
      y: y + 16,
      fill: COLORS.muted,
      "font-size": 13
    }, `${pct.toLocaleString("es-AR", {
      maximumFractionDigits: 1
    })}%`));
  });

  container.appendChild(svg);
}
  function renderHorizontalBars(container, items, valueFormatter = formatCompact) {
    if (!container) return;
    const validItems = items.filter((item) => Number.isFinite(item.value) && item.value >= 0);
    const maxValue = Math.max(0, ...validItems.map((item) => item.value));
    if (!validItems.length || maxValue <= 0) {
      clearChart(container);
      return;
    }

    container.innerHTML = "";
    const rowHeight = 54;
    const height = 30 + validItems.length * rowHeight;
    const svg = svgElement("svg", { viewBox: `0 0 520 ${height}`, role: "img" });
    const left = 174;
    const right = 26;
    const width = 520 - left - right;

    validItems.forEach((item, index) => {
      const y = 24 + index * rowHeight;
      const barWidth = (item.value / maxValue) * width;
      svg.appendChild(svgElement("text", { x: 0, y: y + 14, fill: COLORS.navy, "font-size": 12, "font-weight": 700 }, item.label));
      svg.appendChild(svgElement("rect", { x: left, y, width, height: 20, rx: 5, fill: COLORS.light }));
      svg.appendChild(svgElement("rect", { x: left, y, width: Math.max(2, barWidth), height: 20, rx: 5, fill: item.color }));
      svg.appendChild(svgElement("text", { x: 514, y: y + 14, "text-anchor": "end", fill: COLORS.navy, "font-size": 11, "font-weight": 700 }, valueFormatter(item.value)));
    });

    container.appendChild(svg);
  }
function renderPbaStacked100(container, items, totalValue) {
  if (!container) return;

  const validItems = items
    .map(item => ({
      ...item,
      value: Number.isFinite(item.value) ? item.value : 0
    }))
    .filter(item => item.value > 0);

  const total = Number.isFinite(totalValue) && totalValue > 0
    ? totalValue
    : validItems.reduce((sum, item) => sum + item.value, 0);

  if (!validItems.length || total <= 0) {
    clearChart(container);
    return;
  }

  container.innerHTML = "";

  const svg = svgElement("svg", {
    viewBox: "0 0 620 68",
    role: "img"
  });

  const barX = 28;
  const barY = 6;
  const barW = 564;
  const barH = 22;

  svg.appendChild(svgElement("rect", {
    x: barX,
    y: barY,
    width: barW,
    height: barH,
    rx: 8,
    fill: COLORS.light
  }));

  let cursorX = barX;

  validItems.forEach((item, index) => {
    const pct = ratioPercent(item.value, total);
    const segmentW = Math.max(3, (item.value / total) * barW);

    svg.appendChild(svgElement("rect", {
      x: cursorX,
      y: barY,
      width: segmentW,
      height: barH,
      rx: index === 0 || index === validItems.length - 1 ? 8 : 0,
      fill: item.color
    }));

    if (segmentW > 54) {
      svg.appendChild(svgElement("text", {
        x: cursorX + segmentW / 2,
        y: barY + 15,
        "text-anchor": "middle",
        fill: "#ffffff",
        "font-size": 11,
        "font-weight": 900
      }, `${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`));
    }

    cursorX += segmentW;
  });

  validItems.forEach((item, index) => {
    const pct = ratioPercent(item.value, total);
    const legendX = index === 0 ? barX : barX + 300;
    const legendY = 48;

    svg.appendChild(svgElement("rect", {
      x: legendX,
      y: legendY - 11,
      width: 12,
      height: 12,
      rx: 3,
      fill: item.color
    }));

    svg.appendChild(svgElement("text", {
      x: legendX + 18,
      y: legendY,
      fill: COLORS.navy,
      "font-size": 11.5,
      "font-weight": 850
    }, item.label));

    svg.appendChild(svgElement("text", {
      x: legendX + 18,
      y: legendY + 12,
      fill: COLORS.muted,
      "font-size": 10.5,
      "font-weight": 650
    }, `${pct.toLocaleString("es-AR", {
      maximumFractionDigits: 1
    })}% del PBA`));
  });

  container.appendChild(svg);
}

function renderNoAeroRankBars(container, items) {
  if (!container) return;

  const validItems = items
    .filter(item => Number.isFinite(item.value) && item.value >= 0)
    .sort((a, b) => b.value - a.value);

  const total = validItems.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(...validItems.map(item => item.value), 1);

  if (!validItems.length || total <= 0) {
    clearChart(container);
    return;
  }

  container.innerHTML = "";

  const svg = svgElement("svg", {
    viewBox: "0 0 720 118",
    role: "img"
  });

  const labelX = 22;
  const barX = 250;
  const barW = 340;
  const valueX = 690;
  const top = 7;
  const rowGap = 36;
  const barH = 16;

  validItems.forEach((item, index) => {
    const y = top + index * rowGap;
    const barWidth = Math.max(3, (item.value / maxValue) * barW);
    const pct = ratioPercent(item.value, total);

    svg.appendChild(svgElement("text", {
      x: labelX,
      y: y + 12,
      fill: COLORS.navy,
      "font-size": 11.6,
      "font-weight": 850
    }, item.label));

    svg.appendChild(svgElement("text", {
      x: labelX,
      y: y + 24,
      fill: COLORS.muted,
      "font-size": 10,
      "font-weight": 650
    }, `${pct.toLocaleString("es-AR", {
      maximumFractionDigits: 1
    })}% del no aeronáutico`));

    svg.appendChild(svgElement("rect", {
      x: barX,
      y,
      width: barW,
      height: barH,
      rx: 5,
      fill: COLORS.light
    }));

    svg.appendChild(svgElement("rect", {
      x: barX,
      y,
      width: barWidth,
      height: barH,
      rx: 5,
      fill: item.color
    }));

    svg.appendChild(svgElement("text", {
      x: valueX,
      y: y + 12,
      "text-anchor": "end",
      fill: COLORS.navy,
      "font-size": 11,
      "font-weight": 900
    }, formatCompact(item.value)));
  });

  container.appendChild(svg);
}
  function renderTourismBalance(container, receptive, emissive, balance) {
    if (!container) return;
    if (![receptive, emissive].some(Number.isFinite)) {
      clearChart(container);
      return;
    }

    const positive = Number.isFinite(receptive) ? receptive : 0;
    const negative = Number.isFinite(emissive) ? emissive : 0;
    const net = Number.isFinite(balance) ? balance : positive - negative;
    const maxAbs = Math.max(Math.abs(positive), Math.abs(negative), Math.abs(net), 1);

    container.innerHTML = "";
const svg = svgElement("svg", { viewBox: "0 0 640 240", role: "img" });
const chartLeft = 58;
const chartRight = 598;
const baseline = 114;
const chartBottom = 220;
const scale = 66 / maxAbs;
    const barWidth = 96;
    const bars = [
      { label: "Turismo receptivo", note: "Ingreso al área", value: positive, x: 88, color: COLORS.teal },
      { label: "Turismo emisivo", note: "Gasto fuera del área", value: -negative, x: 272, color: COLORS.red },
      { label: "Saldo turístico", note: "Resultado neto", value: net, x: 456, color: net >= 0 ? COLORS.blue : COLORS.orange }
    ];

    [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].forEach((tick) => {
      const y = baseline - (tick * scale);
      svg.appendChild(svgElement("line", {
        x1: chartLeft,
        y1: y,
        x2: chartRight,
        y2: y,
        stroke: tick === 0 ? COLORS.grid : "#e7edf4",
        "stroke-width": tick === 0 ? 2 : 1
      }));
      svg.appendChild(svgElement("text", {
        x: chartLeft - 8,
        y: y + 4,
        "text-anchor": "end",
        fill: COLORS.muted,
        "font-size": 10
      }, tick === 0 ? "0" : formatCompact(Math.abs(tick))));
    });

    bars.forEach((bar) => {
      const barHeight = Math.abs(bar.value) * scale;
      const y = bar.value >= 0 ? baseline - barHeight : baseline;
      svg.appendChild(svgElement("rect", {
        x: bar.x,
        y,
        width: barWidth,
        height: Math.max(2, barHeight),
        rx: 8,
        fill: bar.color,
        opacity: 0.96
      }));
const valueInsideBar = bar.value < 0 && barHeight > 28;
const valueY = bar.value >= 0
  ? y - 8
  : valueInsideBar
    ? y + barHeight - 9
    : y + barHeight + 14;

svg.appendChild(svgElement("text", {
  x: bar.x + (barWidth / 2),
  y: valueY,
  "text-anchor": "middle",
  fill: valueInsideBar ? "#ffffff" : COLORS.navy,
  "font-size": 14,
  "font-weight": 800
}, formatCompact(Math.abs(bar.value))));
      appendMultilineText(svg, bar.x + (barWidth / 2), chartBottom - 18, [bar.label, bar.note], {
        "text-anchor": "middle",
        fill: COLORS.navy,
        "font-size": 11.5,
        "font-weight": 700
      }, 14);
    });

    container.appendChild(svg);
  }


function renderTourismComposition(container, data) {
  if (!container) return;

  const categories = [
    {
      label: "Turismo receptivo",
      note: "Ingreso al área",
      national: data.receptiveNational,
      international: data.receptiveInternational
    },
    {
      label: "Turismo emisivo",
      note: "Gasto fuera del área",
      national: data.emissiveNational,
      international: data.emissiveInternational
    }
  ];

  const hasData = categories.some((category) =>
    Number.isFinite(category.national) || Number.isFinite(category.international)
  );

  if (!hasData) {
    clearChart(container, "No hay desagregación nacional/internacional");
    return;
  }

  container.innerHTML = "";

  const svg = svgElement("svg", {
    viewBox: "0 0 720 160",
    role: "img",
    preserveAspectRatio: "xMidYMin meet"
  });

  const labelX = 32;
  const barX = 230;
  const barW = 380;
  const valueX = 690;
  const top = 38;
  const rowGap = 56;
  const barH = 18;

  const legend = [
    { label: "Nacional", color: COLORS.sky },
    { label: "Internacional", color: COLORS.orange }
  ];

  const legendItemWidth = 120;
  const legendGap = 26;
  const legendTotalWidth =
    (legend.length * legendItemWidth) + ((legend.length - 1) * legendGap);

  const legendStartX = barX + ((barW - legendTotalWidth) / 2);

  legend.forEach((item, index) => {
    const x = legendStartX + index * (legendItemWidth + legendGap);

    svg.appendChild(svgElement("rect", {
      x,
      y: 18,
      width: 12,
      height: 12,
      rx: 2,
      fill: item.color
    }));

    svg.appendChild(svgElement("text", {
      x: x + 18,
      y: 28,
      fill: COLORS.muted,
      "font-size": 11,
      "font-weight": 650
    }, item.label));
  });

  categories.forEach((category, index) => {
    const y = top + index * rowGap;
    const national = Number.isFinite(category.national) ? category.national : 0;
    const international = Number.isFinite(category.international) ? category.international : 0;
    const total = national + international;

    if (total <= 0) return;

    const nationalPct = ratioPercent(national, total);
    const internationalPct = ratioPercent(international, total);

    const nationalW = (national / total) * barW;
    const internationalW = (international / total) * barW;

    svg.appendChild(svgElement("text", {
      x: labelX,
      y: y + 2,
      fill: COLORS.navy,
      "font-size": 13,
      "font-weight": 900
    }, category.label));

    svg.appendChild(svgElement("text", {
      x: labelX,
      y: y + 18,
      fill: COLORS.muted,
      "font-size": 10.7,
      "font-weight": 650
    }, category.note));

    svg.appendChild(svgElement("text", {
      x: valueX,
      y: y + 2,
      "text-anchor": "end",
      fill: COLORS.navy,
      "font-size": 13,
      "font-weight": 900
    }, formatCompact(total)));

    svg.appendChild(svgElement("rect", {
      x: barX,
      y: y + 16,
      width: barW,
      height: barH,
      rx: 6,
      fill: COLORS.light
    }));

    if (nationalW > 0) {
      svg.appendChild(svgElement("rect", {
        x: barX,
        y: y + 16,
        width: nationalW,
        height: barH,
        rx: 6,
        fill: COLORS.sky
      }));
    }

    if (internationalW > 0) {
      svg.appendChild(svgElement("rect", {
        x: barX + nationalW,
        y: y + 16,
        width: internationalW,
        height: barH,
        rx: 6,
        fill: COLORS.orange
      }));
    }

    if (nationalW > 44) {
      svg.appendChild(svgElement("text", {
        x: barX + nationalW / 2,
        y: y + 29,
        "text-anchor": "middle",
        fill: "#ffffff",
        "font-size": 10.5,
        "font-weight": 900
      }, `${nationalPct.toLocaleString("es-AR", { maximumFractionDigits: 0 })}%`));
    }

    if (internationalW > 44) {
      svg.appendChild(svgElement("text", {
        x: barX + nationalW + internationalW / 2,
        y: y + 29,
        "text-anchor": "middle",
        fill: COLORS.navy,
        "font-size": 10.5,
        "font-weight": 900
      }, `${internationalPct.toLocaleString("es-AR", { maximumFractionDigits: 0 })}%`));
    }

    svg.appendChild(svgElement("text", {
      x: barX,
      y: y + 45,
      fill: COLORS.muted,
      "font-size": 10.5,
      "font-weight": 650
    }, `Nacional: ${formatCompact(national)} · ${nationalPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`));

    svg.appendChild(svgElement("text", {
      x: barX + 210,
      y: y + 45,
      fill: COLORS.muted,
      "font-size": 10.5,
      "font-weight": 650
    }, `Internacional: ${formatCompact(international)} · ${internationalPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`));
  });

  container.appendChild(svg);
}


  function renderSummaryFallback(container, data) {
    if (!container) return;
    const items = [
      { label: "Producto Bruto Aeroportuario", value: data.pbaTotal, color: COLORS.sky },
      { label: "Turismo receptivo", value: data.turismoReceptivo, color: COLORS.teal },
      { label: "Beneficios para pasajeros", value: data.beneficioPasajeros, color: COLORS.blue },
      { label: "Turismo emisivo", value: data.turismoEmisivo, color: COLORS.red }
    ].filter((item) => Number.isFinite(item.value) && item.value >= 0);

    if (!items.length) {
      clearChart(container);
      return;
    }

    container.innerHTML = "";
    const svg = svgElement("svg", { viewBox: "0 0 760 320", role: "img" });
    const maxValue = Math.max(...items.map((item) => item.value), 1);
    const left = 300;
    const width = 410;
    const top = 76;
    const rowGap = 52;

    appendMultilineText(svg, 28, 34, [
      "No se encontró la imagen resumen del Resumen Ejecutivo.",
      "Se muestra una síntesis gráfica reconstruida con los datos disponibles."
    ], {
      fill: COLORS.muted,
      "font-size": 11.5
    }, 15);

    items.forEach((item, index) => {
      const y = top + index * rowGap;
      const barWidth = (item.value / maxValue) * width;
      svg.appendChild(svgElement("text", {
        x: 28,
        y: y + 13,
        fill: COLORS.navy,
        "font-size": 13,
        "font-weight": 700
      }, item.label));
      svg.appendChild(svgElement("rect", { x: left, y, width, height: 18, rx: 6, fill: COLORS.light }));
      svg.appendChild(svgElement("rect", { x: left, y, width: Math.max(2, barWidth), height: 18, rx: 6, fill: item.color }));
      svg.appendChild(svgElement("text", {
        x: 736,
        y: y + 13,
        "text-anchor": "end",
        fill: COLORS.navy,
        "font-size": 13,
        "font-weight": 800
      }, formatCompact(item.value)));
    });

    container.appendChild(svg);
  }

function drawGenderDonutInEmploymentSvg(parent, x, y, data) {
  const items = [
    { label: "Mujeres", value: data.empleoMujeres, color: COLORS.sky },
    { label: "Hombres", value: data.empleoVarones, color: COLORS.blue }
  ].filter(item => Number.isFinite(item.value) && item.value > 0);

  const total = items.reduce((sum, item) => sum + item.value, 0);

  appendMultilineText(parent, x, y, [
    "Empleo directo por género"
  ], {
    fill: COLORS.navy,
    "font-size": 13.5,
    "font-weight": 900
  }, 15);

  if (!items.length || total <= 0) {
    appendMultilineText(parent, x, y + 40, [
      "Sin datos disponibles"
    ], {
      fill: COLORS.muted,
      "font-size": 12
    }, 14);
    return;
  }

  const cx = x + 92;
  const cy = y + 92;
  const radius = 46;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  let startFraction = 0;

  items.forEach(item => {
    const fraction = item.value / total;

    parent.appendChild(svgElement("circle", {
      cx,
      cy,
      r: radius,
      fill: "none",
      stroke: item.color,
      "stroke-width": strokeWidth,
      "stroke-dasharray": `${fraction * circumference} ${circumference}`,
      "stroke-dashoffset": -offset,
      transform: `rotate(-90 ${cx} ${cy})`
    }));

    const midAngle = (-Math.PI / 2) + ((startFraction + fraction / 2) * Math.PI * 2);
    const labelRadius = radius + 22;
    const lx = cx + Math.cos(midAngle) * labelRadius;
    const ly = cy + Math.sin(midAngle) * labelRadius;
    const anchor = lx >= cx ? "start" : "end";
    const pct = ratioPercent(item.value, total);

    parent.appendChild(svgElement("text", {
      x: lx,
      y: ly - 2,
      "text-anchor": anchor,
      fill: item.color,
      "font-size": 11.5,
      "font-weight": 800
    }, item.label));

    parent.appendChild(svgElement("text", {
      x: lx,
      y: ly + 13,
      "text-anchor": anchor,
      fill: COLORS.navy,
      "font-size": 11
    }, `${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`));

    offset += fraction * circumference;
    startFraction += fraction;
  });

  parent.appendChild(svgElement("text", {
    x: cx,
    y: cy - 4,
    "text-anchor": "middle",
    fill: COLORS.navy,
    "font-size": 13,
    "font-weight": 900
  }, formatInteger(data.empleoDirecto)));

  parent.appendChild(svgElement("text", {
    x: cx,
    y: cy + 12,
    "text-anchor": "middle",
    fill: COLORS.muted,
    "font-size": 9.5
  }, "empleos"));

  parent.appendChild(svgElement("text", {
    x: cx,
    y: cy + 24,
    "text-anchor": "middle",
    fill: COLORS.muted,
    "font-size": 9.5
  }, "directos"));
}
function renderEmploymentTree(container, data) {
  if (!container) return;

  const direct = Number.isFinite(data.empleoDirecto) ? data.empleoDirecto : 0;
  const indirect = Number.isFinite(data.empleoIndirecto) ? data.empleoIndirecto : 0;
  const induced = Number.isFinite(data.empleoInducido) ? data.empleoInducido : 0;
  const catalytic = Number.isFinite(data.empleoCatalitico) ? data.empleoCatalitico : 0;
  const total = Number.isFinite(data.empleoTotal)
    ? data.empleoTotal
    : direct + indirect + induced + catalytic;

  if (![direct, indirect, induced, catalytic, total].some((v) => Number.isFinite(v) && v > 0)) {
    clearChart(container);
    return;
  }

  const maxCategory = Math.max(direct, indirect, induced, catalytic, 1);
const directIcons = getEmploymentIconCount(direct, maxCategory, 15, 4);
const indirectIcons = getEmploymentIconCount(indirect, maxCategory, 15, 5);
const inducedIcons = getEmploymentIconCount(induced, maxCategory, 15, 5);
const catalyticIcons = getEmploymentIconCount(catalytic, maxCategory, 15, 5);
  container.innerHTML = "";

  const svg = svgElement("svg", {
    viewBox: "0 0 650 555",
    role: "img"
  });

  const connector = (d, stroke = "#4f8bd6") => {
    svg.appendChild(svgElement("path", {
      d,
      fill: "none",
      stroke,
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }));
  };

function makeNode({
  x,
  y,
  w,
  h,
  title,
  value,
  color,
  lines = [],
  fill = "#ffffff",
  valueSize = 19,
  iconCount = 0,
  iconX = null,
  titleSize = 12.8,
  textSize = 12.4,
  exampleSize = 12.4,
  lineHeight = 14.4
}) {
  svg.appendChild(svgElement("rect", {
    x,
    y,
    width: w,
    height: h,
    rx: 12,
    fill,
    stroke: color,
    "stroke-width": 2
  }));

    appendMultilineText(svg, x + 14, y + 22, title, {
      fill: color,
      "font-size": titleSize,
      "font-weight": 900
    }, 14);

    const numberX = x + 14;
    const numberY = y + 52;

    svg.appendChild(svgElement("text", {
      x: numberX,
      y: numberY,
      fill: COLORS.navy,
      "font-size": valueSize,
      "font-weight": 900
    }, formatInteger(value)));

    if (iconCount > 0) {
      drawEmploymentPeopleInline(
        svg,
        iconX !== null ? iconX : x + 120,
        numberY - 14,
        iconCount,
        color,
        {
          scale: 0.56,
          gapX: 12
        }
      );
    }

    const textLines = Array.isArray(lines) ? lines : [lines];
    let exampleStarted = false;

    textLines.filter(Boolean).forEach((line, index) => {
      const text = String(line);

      if (text.trim().startsWith("Ej.:")) {
        exampleStarted = true;
      }

      const isExample = exampleStarted;

      svg.appendChild(svgElement("text", {
        x: x + 14,
        y: y + 78 + index * lineHeight,
        fill: isExample ? color : COLORS.muted,
        "font-size": isExample ? exampleSize : textSize,
        "font-weight": isExample ? 800 : 500
      }, text));
    });
  }

  // Marco general de empleo total
svg.appendChild(svgElement("rect", {
  x: 4,
  y: 8,
  width: 640,
  height: 548,
  rx: 14,
  fill: "none",
  stroke: COLORS.navy,
  "stroke-width": 2.2
}));

  appendMultilineText(svg, 18, 34, "EMPLEO TOTAL", {
    fill: COLORS.navy,
    "font-size": 13,
    "font-weight": 900
  }, 13);

  svg.appendChild(svgElement("text", {
    x: 18,
    y: 64,
    fill: COLORS.navy,
    "font-size": 20,
    "font-weight": 900
  }, formatInteger(total)));

let totalIconX = 116;
const totalIconY = 50;
const totalIconScale = 0.54;
const totalIconGap = 9.5;
const totalSegmentGap = 6;

[
  { count: directIcons, color: COLORS.lime },
  { count: indirectIcons, color: COLORS.teal },
  { count: inducedIcons, color: COLORS.cyan },
  { count: catalyticIcons, color: COLORS.blue }
].forEach((item) => {
  if (!Number.isFinite(item.count) || item.count <= 0) return;

  drawEmploymentPeopleInline(
    svg,
    totalIconX,
    totalIconY,
    item.count,
    item.color,
    {
      scale: totalIconScale,
      gapX: totalIconGap
    }
  );

  totalIconX += item.count * totalIconGap + totalSegmentGap;
});

  makeNode({
    x: 15,
    y: 150,
    w: 250,
    h: 170,
    title: ["EMPLEO DIRECTO AEROPORTUARIO"],
    value: direct,
    color: COLORS.lime,
    valueSize: 20,
    titleSize: 12.8, //aca
    textSize: 12.2,
    exampleSize: 12.2,
    lineHeight: 14,
    iconCount: directIcons,
    iconX: 100,
    lines: [
      "Empleo generado por las actividades",
      "dentro del aeropuerto.",
      "Ej.: administración aeroportuaria,",
      "líneas aéreas, locales comerciales,",
      "control aéreo, aerocombustibles,",
      "handling, logística, depósitos,",
      "rampa y catering."
      ]
  });

  drawGenderDonutInEmploymentSvg(svg, 30, 350, data);

  makeNode({
x: 280,
y: 78,
w: 350,
h: 150,
    title: "EMPLEO INDIRECTO",
    value: indirect,
    color: COLORS.teal,
    valueSize: 20,
    titleSize: 12.8,
    textSize: 12.2,
    exampleSize: 12.2,
    lineHeight: 13.4,
    iconCount: indirectIcons,
    iconX: 410,
    lines: [
      "Originados en el área de influencia, como parte de la",
      "cadena de bienes y servicios de las actividades directas.",
      "Estos empleos no tendrían lugar sin la infraestructura",
      "aeroportuaria y la conectividad aérea",
      "Ej.: insumos, mercaderías, publicidad y logística",
      "vinculados al funcionamientos aeropuerto."
    ]
  });

  makeNode({
x: 280,
y: 240,
w: 350,
h: 132,
    title: "EMPLEO INDUCIDO",
    value: induced,
    color: COLORS.cyan,
    valueSize: 20,
    titleSize: 12.8,
    textSize: 12.2,
    exampleSize: 12.2,
    lineHeight: 13.4,
    iconCount: inducedIcons,
    iconX: 410,
    lines: [
      "Generados por el consumo de trabajadores de las",
      "empresas incluidas en el impacto directo e indirecto.",
      "Ej.: comercios y servicios donde consumen los",
      "empleados directos e indirectos."
    ]
  });

  makeNode({
x: 280,
y: 386,
w: 350,
h: 146,
    title: "EMPLEO CATALÍTICO",
    value: catalytic,
    color: COLORS.blue,
    valueSize: 20,
    titleSize: 12.8,
    textSize: 12.2,
    exampleSize: 12.2,
    lineHeight: 13.4,
    iconCount: catalyticIcons,
    iconX: 410,
    lines: [
      "Generados por la atracción, retención y expansión",
      "de la actividad económica local, fruto de la",
      "accesibilidad provista por la conectividad aérea.",
      "Ej.: turismo receptivo, inversiones atraídas,",
      "nuevas empresas e incremento de productividad."
    ]
  });

//connector("M 238 288 C 246 288, 246 153, 248 153");
//connector("M 238 288 C 246 288, 246 306, 248 306");
//connector("M 238 288 C 246 288, 246 459, 248 459");

  container.appendChild(svg);
}

function normalizeShareOrCount(value, total) {
  if (!Number.isFinite(value)) return null;

  if (Number.isFinite(total) && total > 0) {
    // Proporción: 0,1946 = 19,46%
    if (value >= 0 && value <= 1) return value * total;

    // Porcentaje: 19,46 = 19,46%
    if (value > 1 && value <= 100) return (value / 100) * total;
  }

  // Cantidad absoluta
  return value;
}

  function buildData(properties) {
    const iata = String(readRaw(properties, "iata") || "").trim().toUpperCase();
    const pbaConexas = readNumber(properties, "pbaConexas");
    const pbaComercial = readNumber(properties, "pbaComercial");
    const pbaSecundarias = readNumber(properties, "pbaSecundarias");
    const pbaAeronautico = readNumber(properties, "pbaAeronautico");
    const pbaNoAeronautico = valueOrSum(readNumber(properties, "pbaNoAeronautico"), [pbaConexas, pbaComercial, pbaSecundarias]);
    const pbaTotal = valueOrSum(readNumber(properties, "pbaTotal"), [pbaAeronautico, pbaNoAeronautico]);

    const turismoReceptivoNacional = readNumber(properties, "turismoReceptivoNacional");
    const turismoReceptivoInternacional = readNumber(properties, "turismoReceptivoInternacional");
    const turismoReceptivo = valueOrSum(readNumber(properties, "turismoReceptivo"), [turismoReceptivoNacional, turismoReceptivoInternacional]);

    const turismoEmisivoNacional = readNumber(properties, "turismoEmisivoNacional");
    const turismoEmisivoInternacional = readNumber(properties, "turismoEmisivoInternacional");
    const turismoEmisivo = valueOrSum(readNumber(properties, "turismoEmisivo"), [turismoEmisivoNacional, turismoEmisivoInternacional]);
    const saldoTurismo = valueOrDifference(readNumber(properties, "saldoTurismo"), turismoReceptivo, turismoEmisivo);
    const beneficioPasajeros = readNumber(properties, "beneficioPasajeros");

    const impactoPositivo = valueOrSum(readNumber(properties, "impactoPositivo"), [pbaTotal, turismoReceptivo, beneficioPasajeros]);
    const impactoNegativo = Number.isFinite(readNumber(properties, "impactoNegativo"))
      ? readNumber(properties, "impactoNegativo")
      : turismoEmisivo;
    const saldoImpacto = valueOrDifference(readNumber(properties, "saldoImpacto"), impactoPositivo, impactoNegativo);

const empleoDirecto = readNumber(properties, "empleoDirecto");
const empleoIndirecto = readNumber(properties, "empleoIndirecto");
const empleoInducido = readNumber(properties, "empleoInducido");
const empleoCatalitico = readNumber(properties, "empleoCatalitico");

const empleoTotal = valueOrSum(
  readNumber(properties, "empleoTotal"),
  [empleoDirecto, empleoIndirecto, empleoInducido, empleoCatalitico]
);

const gender = getEmploymentGenderForIata(iata);

const empleoMujeres = normalizeShareOrCount(
  readNumber(properties, "empleoMujeres") ?? gender.mujeres,
  empleoDirecto
);

const empleoVarones = normalizeShareOrCount(
  readNumber(properties, "empleoVarones") ?? gender.varones,
  empleoDirecto
);

    return {
      iata,
      airportName: String(readRaw(properties, "airportName") || "Aeropuerto").trim(),
      year: readRaw(properties, "year") || 2025,
      pbaTotal,
      pbaAeronautico,
      pbaNoAeronautico,
      pbaConexas,
      pbaComercial,
      pbaSecundarias,
      turismoReceptivo,
      turismoReceptivoNacional,
      turismoReceptivoInternacional,
      turismoEmisivo,
      turismoEmisivoNacional,
      turismoEmisivoInternacional,
      saldoTurismo,
      beneficioPasajeros,
      impactoPositivo,
      impactoNegativo,
      saldoImpacto,
      empleoDirecto,
      empleoIndirecto,
      empleoInducido,
      empleoCatalitico,
      empleoTotal,
      empleoMujeres,
      empleoVarones,
      poblacionInfluencia: readNumber(properties, "poblacionInfluencia"),
      passengersH12026: readNumber(properties, "passengersH12026"),
      passengersH12025: readNumber(properties, "passengersH12025"),
      passengersH1Yoy: readNumber(properties, "passengersH1Yoy"),
      summaryImage: readRaw(properties, "summaryImage")
    };
  }

  function renderText(data) {
const airportNameOverrides = {
  AEP: "Aeroparque Jorge Newbery"
};

const airportNameOnly = airportNameOverrides[data.iata] || data.airportName;
const airportLine = data.iata ? `${airportNameOnly} (${data.iata})` : airportNameOnly;

setText("airportLine", airportLine);
setText("airportNameOnly", airportNameOnly);
setText("impactYear", `Año ${data.year}`);
setText("impactYearNumber", data.year);

    setText("pbaTotal", formatCurrency(data.pbaTotal));
    setText("pbaAeronautico", formatCurrency(data.pbaAeronautico));
    setText("pbaNoAeronautico", formatCurrency(data.pbaNoAeronautico));
    setText("pbaAeronauticoPct", Number.isFinite(ratioPercent(data.pbaAeronautico, data.pbaTotal)) ? `${ratioPercent(data.pbaAeronautico, data.pbaTotal).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% del PBA` : "–");
    setText("pbaNoAeronauticoPct", Number.isFinite(ratioPercent(data.pbaNoAeronautico, data.pbaTotal)) ? `${ratioPercent(data.pbaNoAeronautico, data.pbaTotal).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% del PBA` : "–");

    setText("turismoReceptivo", formatCurrency(data.turismoReceptivo));
    setText("turismoEmisivo", formatCurrency(data.turismoEmisivo));
    setText("saldoTurismo", formatCurrency(data.saldoTurismo));
    setText("beneficioPasajeros", formatCurrency(data.beneficioPasajeros));

    setText("impactoPositivo", formatCurrency(data.impactoPositivo));
    setText("impactoNegativo", formatCurrency(data.impactoNegativo));
    setText("saldoImpacto", formatCurrency(data.saldoImpacto));

    setText("empleoDirecto", formatInteger(data.empleoDirecto));
    setText("empleoTotal", formatInteger(data.empleoTotal));
    setText("poblacionInfluencia", formatInteger(data.poblacionInfluencia));
  }

  function renderInsights(data) {
    const pbaInsight = root.querySelector("#impactoPbaInsight");
    if (pbaInsight) {
      const noAeroPct = ratioPercent(data.pbaNoAeronautico, data.pbaTotal);
      const mainNonAero = [
        { label: "las actividades conexas al transporte aerocomercial", value: data.pbaConexas },
        { label: "la explotación comercial", value: data.pbaComercial },
        { label: "las actividades secundarias", value: data.pbaSecundarias }
      ].filter((item) => Number.isFinite(item.value)).sort((a, b) => b.value - a.value)[0];

      if (Number.isFinite(data.pbaTotal)) {
        const clauses = [`En ${data.year}, el PBA estimado del aeropuerto alcanzó ${formatCurrency(data.pbaTotal)}.`];
        if (Number.isFinite(noAeroPct)) clauses.push(`Los servicios no aeronáuticos representaron ${noAeroPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% del total.`);
        if (mainNonAero) clauses.push(`Dentro de este grupo predominó ${mainNonAero.label}.`);
        pbaInsight.textContent = clauses.join(" ");
      } else {
        pbaInsight.textContent = "No se encontró un valor de Producto Bruto Aeroportuario para el aeropuerto seleccionado.";
      }
    }

    const tourismInsight = root.querySelector("#impactoTourismInsight");
    if (tourismInsight) {
      if (Number.isFinite(data.saldoTurismo)) {
        const direction = data.saldoTurismo >= 0 ? "positivo" : "negativo";
        tourismInsight.textContent = `El turismo facilitado por la conectividad aérea produjo un saldo ${direction}, entendido como la diferencia entre el turismo receptivo y el emisivo, de ${formatCurrency(Math.abs(data.saldoTurismo))}.`;
      } else {
        tourismInsight.textContent = "No se dispone de valores suficientes para calcular el saldo entre turismo receptivo y emisivo.";
      }
    }

    const employmentInsight = root.querySelector("#impactoEmploymentInsight");
    if (employmentInsight) {
      const employmentParts = [
        { label: "directos", value: data.empleoDirecto },
        { label: "indirectos", value: data.empleoIndirecto },
        { label: "inducidos", value: data.empleoInducido },
        { label: "catalíticos", value: data.empleoCatalitico }
      ].filter((item) => Number.isFinite(item.value));
      const main = employmentParts.sort((a, b) => b.value - a.value)[0];
      if (Number.isFinite(data.empleoTotal)) {
        const additional = [data.empleoIndirecto, data.empleoInducido, data.empleoCatalitico].filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
        const multiplier = Number.isFinite(data.empleoDirecto) && data.empleoDirecto > 0 ? data.empleoTotal / data.empleoDirecto : null;
        employmentInsight.textContent = `La actividad aerocomercial y aeroportuaria se vinculó con ${formatInteger(data.empleoTotal)} puestos de trabajo. A los ${formatInteger(data.empleoDirecto)} empleos directos se sumaron ${formatInteger(additional)} empleos adicionales asociados a la cadena de abastecimiento, el consumo de las personas trabajadoras y las actividades favorecidas por la conectividad aérea${multiplier ? `, equivalente a ${multiplier.toLocaleString("es-AR", { maximumFractionDigits: 1 })} veces el empleo directo` : ""}.`;
      } else {
        employmentInsight.textContent = "No se encontró una estimación completa del empleo vinculado al aeropuerto seleccionado.";
      }
    }
  }

  function renderCharts(data) {
renderPbaStacked100(
  root.querySelector("#impactoPbaDonut"),
  [
    { label: "Servicios aeronáuticos", value: data.pbaAeronautico, color: COLORS.teal },
    { label: "Servicios no aeronáuticos", value: data.pbaNoAeronautico, color: COLORS.sky }
  ],
  data.pbaTotal
);

renderNoAeroRankBars(
  root.querySelector("#impactoPbaNoAeroBars"),
  [
    { label: "Actividades conexas", value: data.pbaConexas, color: COLORS.teal },
    { label: "Explotación comercial", value: data.pbaComercial, color: COLORS.sky },
    { label: "Actividades secundarias", value: data.pbaSecundarias, color: COLORS.blue }
  ]
);

    renderTourismBalance(root.querySelector("#impactoTourismBalance"), data.turismoReceptivo, data.turismoEmisivo, data.saldoTurismo);
    renderTourismComposition(root.querySelector("#impactoTourismComposition"), {
      receptiveNational: data.turismoReceptivoNacional,
      receptiveInternational: data.turismoReceptivoInternacional,
      emissiveNational: data.turismoEmisivoNacional,
      emissiveInternational: data.turismoEmisivoInternacional
    });

    renderEmploymentTree(root.querySelector("#impactoEmploymentBars"), data);



    renderSummaryFallback(root.querySelector("#impactoSummaryFallback"), data);
  }

function trySummaryImages(candidates, image, fallback, requestId, index = 0) {
  if (!image || !fallback) return;
  if (requestId !== summaryImageRequestId) return;

  if (index === 0) {
    image.hidden = true;
    image.removeAttribute("src");
    fallback.hidden = false;
  }

  if (index >= candidates.length) {
    image.hidden = true;
    fallback.hidden = false;
    return;
  }

  const src = candidates[index];

  if (!src) {
    trySummaryImages(candidates, image, fallback, requestId, index + 1);
    return;
  }

  const probe = new Image();

  probe.onload = () => {
    if (requestId !== summaryImageRequestId) return;

    image.src = src;
    image.hidden = false;
    fallback.hidden = true;
  };

  probe.onerror = () => {
    if (requestId !== summaryImageRequestId) return;

    trySummaryImages(candidates, image, fallback, requestId, index + 1);
  };

  probe.src = src;
}

function renderSummaryImage(data) {
  const image = root.querySelector("#impactoSummaryImg");
  const fallback = root.querySelector("#impactoSummaryFallback");
  const iata = String(data?.iata || "").trim().toUpperCase();

  const candidates = [
    iata ? `img/resumenejecutivo/resumen(${iata}).PNG` : null,
    iata ? `img/resumenejecutivo/resumen(${iata}).png` : null,

    iata ? `img/resumenejecutivo/Resumen(${iata}).PNG` : null,
    iata ? `img/resumenejecutivo/Resumen(${iata}).png` : null,
    iata ? `img/resumenejecutivo/${iata}.png` : null,
    iata ? `img/resumenejecutivo/${iata}.PNG` : null,
    iata ? `img/resumenejecutivo/${iata}_impacto.png` : null,
    iata ? `img/resumenejecutivo/impacto_${iata}.png` : null,
    iata ? `img/resumenejecutivo/Impacto_${iata}.png` : null,
    iata ? `img/resumenejecutivo/${iata.toLowerCase()}.png` : null,

    data.summaryImage
  ].filter(Boolean);

  const requestId = ++summaryImageRequestId;

  trySummaryImages([...new Set(candidates)], image, fallback, requestId);
}


  function findFeature(iata) {
    const features = geojson?.features || [];
    const target = String(iata || "").trim().toUpperCase();
    if (!target) return features[0] || null;
    return features.find((feature) => String(readRaw(feature.properties || {}, "iata") || "").trim().toUpperCase() === target) || null;
  }

  function resolveInitialIata() {
    const params = new URLSearchParams(window.location.search);
    return params.get("airport")
      || params.get("iata")
      || window.REPORT_AIRPORT_IATA
      || document.body?.dataset?.airport
      || document.querySelector("#airportSelect")?.value
      || "";
  }

  function fillAirportSelect() {
    const select = document.querySelector("#impactoAirportSelect");
    if (!select || !geojson) return;

    const features = (geojson.features || []).slice().sort((a, b) => {
      const nameA = String(readRaw(a.properties || {}, "airportName") || readRaw(a.properties || {}, "iata") || "");
      const nameB = String(readRaw(b.properties || {}, "airportName") || readRaw(b.properties || {}, "iata") || "");
      return nameA.localeCompare(nameB, "es");
    });

    select.innerHTML = "";
    features.forEach((feature) => {
      const properties = feature.properties || {};
      const iata = String(readRaw(properties, "iata") || "").trim().toUpperCase();
      const name = String(readRaw(properties, "airportName") || iata || "Aeropuerto").trim();
      if (!iata) return;
      const option = document.createElement("option");
      option.value = iata;
      option.textContent = `${name} (${iata})`;
      select.appendChild(option);
    });

    if (!select.dataset.bound) {
      select.dataset.bound = "1";
      select.addEventListener("change", () => {
        renderAirport(select.value);
        const url = new URL(window.location.href);
        url.searchParams.set("airport", select.value);
        window.history.replaceState({}, "", url);
      });
    }
  }

  async function loadPassengerCsv(url) {
    if (!url) return [];
    if (passengerCacheByUrl.has(url)) return passengerCacheByUrl.get(url);

    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Pasajeros: ${response.status} (${url})`);
        return response.text();
      })
      .then(parseCsv)
      .catch((error) => {
        console.warn(`[Impacto] No se pudo cargar la fuente de pasajeros ${url}.`, error);
        return [];
      });

    passengerCacheByUrl.set(url, promise);
    return promise;
  }

  function detectDelimiter(header) {
    const options = ["\t", ";", ","];
    return options.sort((a, b) => header.split(b).length - header.split(a).length)[0];
  }

  function parseCsv(text) {
    if (!text || !text.trim()) return [];
    const firstLine = text.split(/\r?\n/, 1)[0];
    const delimiter = detectDelimiter(firstLine);
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(field);
        field = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(field);
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
    if (rows.length < 2) return [];

    const headers = rows[0].map((header) => normalizeKey(header));
    return rows.slice(1).map((values) => {
      const object = {};
      headers.forEach((header, index) => { object[header] = values[index] ?? ""; });
      return object;
    });
  }

  function readFirstRowValue(row, aliases) {
    for (const alias of aliases) {
      const key = normalizeKey(alias);
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
        return row[key];
      }
    }
    return "";
  }

  function parseDateFlexible(value) {
    const text = String(value || "").trim();
    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    match = text.match(/^(\d{4})-(\d{1,2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1);
    match = text.match(/^(\d{1,2})\/(\d{4})$/);
    if (match) return new Date(Number(match[2]), Number(match[1]) - 1, 1);
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function passengerRowIata(row, target) {
    const direct = readFirstRowValue(row, [
      "iata", "IATA", "codigo_iata", "cod_iata", "codIATA", "Código IATA",
      "aeropuerto_iata", "iata_aeropuerto"
    ]);
    if (direct) return String(direct).trim().toUpperCase();

    // Fallback para fuentes de vuelos/movimientos: cuenta el registro si el aeropuerto
    // aparece como origen o destino. No se usa si la fuente ya trae IATA de aeropuerto.
    const origin = String(readFirstRowValue(row, ["origen_iata", "Origen IATA", "origen", "iata_origen"])).trim().toUpperCase();
    const dest = String(readFirstRowValue(row, ["destino_iata", "Destino IATA", "destino", "iata_destino"])).trim().toUpperCase();
    if (origin === target || dest === target) return target;
    return "";
  }

  function passengerRowDate(row) {
    return parseDateFlexible(readFirstRowValue(row, [
      "fecha", "Fecha", "date", "Date", "periodo", "Periodo", "mes", "Mes",
      "fecha_hora", "FechaHora", "FechaHora_Local", "Fecha Hora Local", "fechaHoraLocal"
    ]));
  }

  function passengerRowValue(row) {
    return parseNumber(readFirstRowValue(row, [
      "valor_pax", "valor pax", "Valor_Pax", "pasajeros", "Pasajeros", "pax", "Pax",
      "total_pax", "total pasajeros", "valor", "Valor", "Asientos_Pax"
    ]));
  }

  function passengerRowDataset(row) {
    return normalizeKey(readFirstRowValue(row, ["dataset", "Dataset", "serie", "Serie", "tipo", "Tipo"]));
  }

  function passengerRowClass(row) {
    return normalizeKey(readFirstRowValue(row, [
      "clase", "Clase", "tipo_de_trafico", "Tipo de tráfico", "tipo_trafico",
      "tipo_de_vuelo", "Tipo de vuelo", "servicio", "Servicio"
    ]));
  }

  function isValidPassengerTrafficRow(row) {
    const cls = passengerRowClass(row);
    const dataset = passengerRowDataset(row);
    const joined = `${cls} ${dataset}`;

    // Misma consideración aplicada a FDO: se excluyen cargas/correo.
    if (joined.includes("carga") || joined.includes("correo")) return false;

    // Si la fuente identifica explícitamente pasajeros comerciales, se admite.
    // Si no lo identifica, no se descarta: varias fuentes extra no traen dataset SIAC.
    return true;
  }

  function normalizePassengerRows(rows, iata) {
    const target = String(iata || "").trim().toUpperCase();
    const validDatasets = new Set([
      "pasajeroscomercialescabotajeaeropuerto",
      "pasajeroscomercialesinternacionalaeropuerto"
    ]);

    const parsed = rows.map((row) => {
      const rowIata = passengerRowIata(row, target);
      const date = passengerRowDate(row);
      const value = passengerRowValue(row);
      const dataset = passengerRowDataset(row);
      return { rowIata, date, value, dataset, row };
    }).filter((row) => row.rowIata === target && row.date && Number.isFinite(row.value) && isValidPassengerTrafficRow(row.row));

    const hasKnownDatasets = parsed.some((row) => validDatasets.has(row.dataset));
    return hasKnownDatasets ? parsed.filter((row) => validDatasets.has(row.dataset)) : parsed;
  }

  function summarizePassengerRows(rows, iata) {
    const filtered = normalizePassengerRows(rows, iata);

    function period(year) {
      const monthly = new Map();
      filtered.filter((row) => row.date.getFullYear() === year && row.date.getMonth() <= 5).forEach((row) => {
        const month = row.date.getMonth();
        monthly.set(month, (monthly.get(month) || 0) + row.value);
      });
      const months = [...monthly.keys()].sort((a, b) => a - b);
      return {
        total: months.length ? [...monthly.values()].reduce((sum, value) => sum + value, 0) : null,
        months,
        lastMonth: months.length ? months[months.length - 1] : null
      };
    }

    const current = period(2026);
    const previous = period(2025);
    const commonLastMonth = Number.isInteger(current.lastMonth) && Number.isInteger(previous.lastMonth)
      ? Math.min(current.lastMonth, previous.lastMonth)
      : null;

    function sumThrough(year, lastMonth) {
      if (!Number.isInteger(lastMonth)) return null;
      const byMonth = new Map();
      filtered.filter((row) => row.date.getFullYear() === year && row.date.getMonth() <= lastMonth).forEach((row) => {
        const month = row.date.getMonth();
        byMonth.set(month, (byMonth.get(month) || 0) + row.value);
      });
      return byMonth.size ? [...byMonth.values()].reduce((sum, value) => sum + value, 0) : null;
    }

    const currentComparable = sumThrough(2026, commonLastMonth);
    const previousComparable = sumThrough(2025, commonLastMonth);
    const yoy = Number.isFinite(currentComparable) && Number.isFinite(previousComparable) && previousComparable !== 0
      ? ((currentComparable - previousComparable) / previousComparable) * 100
      : null;

    return {
      current: currentComparable ?? current.total,
      previous: previousComparable ?? previous.total,
      yoy,
      lastMonth: commonLastMonth ?? current.lastMonth
    };
  }

  function monthName(index) {
    if (!Number.isInteger(index)) return "junio";
    return new Date(2026, index, 1).toLocaleString("es-AR", { month: "long" });
  }

  async function loadPassengerSemesterData() {
  if (passengerSemesterData) return passengerSemesterData;

  const url = root?.dataset?.passengerSemesterUrl || PASSENGER_SEMESTER_URL;
  const json = await loadOptionalJson(url, "pasajeros del primer semestre 2025/2026");

  passengerSemesterData = json || { aeropuertos: {} };

  return passengerSemesterData;
}

function semesterNumber(item, year, field) {
  const block = item?.[String(year)];
  if (!block) return null;

  const value = Number(block[field]);
  return Number.isFinite(value) ? value : null;
}

function semesterPctChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

function semesterMetric(item, field) {
  const current = semesterNumber(item, 2026, field);
  const previous = semesterNumber(item, 2025, field);

  return {
    current,
    previous,
    yoy: semesterPctChange(current, previous)
  };
}

function buildSemesterPassengerData(item) {
  const metrics = {
    total: semesterMetric(item, "pax_total"),
    commercial: semesterMetric(item, "pax_comercial"),
    avGeneral: semesterMetric(item, "pax_av_general"),

    cabotaje: semesterMetric(item, "pax_cabotaje"),
    international: semesterMetric(item, "pax_internacional"),

    commercialCabotaje: semesterMetric(item, "pax_comercial_cabotaje"),
    commercialInternational: semesterMetric(item, "pax_comercial_internacional"),

    avGeneralCabotaje: semesterMetric(item, "pax_av_general_cabotaje"),
    avGeneralInternational: semesterMetric(item, "pax_av_general_internacional")
  };

  return {
    current: metrics.total.current,
    previous: metrics.total.previous,
    yoy: metrics.total.yoy,
    lastMonth: 5,
    source: "pasajeros_semestre_2025_2026",
    trafficLabel: "pasajeros totales registrados",
    metrics
  };
}

function passengerMetricChangeView(metric) {
  const current = Number(metric?.current);
  const previous = Number(metric?.previous);
  const yoy = Number(metric?.yoy);

  // Sin dato comparable o base demasiado chica:
  // evita casos engañosos como -100% cuando había 1 pasajero en 2025 y 0 en 2026.
  if (
    !Number.isFinite(current)
    || !Number.isFinite(previous)
    || !Number.isFinite(yoy)
    || previous <= 0
    || previous < 10
  ) {
    return {
      text: "—",
      state: "empty"
    };
  }

  if (Math.abs(yoy) < 0.05) {
    return {
      text: `● ${formatPercent(0)}`,
      state: "flat"
    };
  }

  if (yoy > 0) {
    return {
      text: `▲ ${formatPercent(yoy)}`,
      state: "positive"
    };
  }

  return {
    text: `▼ ${formatPercent(yoy)}`,
    state: "negative"
  };
}

function setBoundTextAndState(bindName, text, state) {
  const scope = root || document;

  scope.querySelectorAll(`[data-bind="${bindName}"]`).forEach((node) => {
    node.textContent = text;

    node.classList.remove(
      "is-positive",
      "is-negative",
      "is-flat",
      "is-empty"
    );

    node.classList.add(`is-${state}`);
  });
}

function setPassengerMetric(prefix, metric) {
  const current = Number(metric?.current);

  setText(
    `${prefix}2026`,
    Number.isFinite(current) ? formatInteger(current) : "–"
  );

  const change = passengerMetricChangeView(metric);

  setBoundTextAndState(
    `${prefix}Yoy`,
    change.text,
    change.state
  );
}

function renderPassengerTrafficKpis(passengerData) {
  const metrics = passengerData?.metrics || {};

  setPassengerMetric("passengerTotal", metrics.total);
  setPassengerMetric("passengerCabotaje", metrics.cabotaje);
  setPassengerMetric("passengerInternational", metrics.international);

  setPassengerMetric("passengerCommercial", metrics.commercial);
  setPassengerMetric("passengerCommercialCabotaje", metrics.commercialCabotaje);
  setPassengerMetric("passengerCommercialInternational", metrics.commercialInternational);

  setPassengerMetric("passengerAvGeneral", metrics.avGeneral);
  setPassengerMetric("passengerAvGeneralCabotaje", metrics.avGeneralCabotaje);
  setPassengerMetric("passengerAvGeneralInternational", metrics.avGeneralInternational);
}
  
  async function resolvePassengerRowsForAirport(iata) {
    const target = String(iata || "").trim().toUpperCase();
    const mainUrl = root?.dataset?.passengerUrl || PASSENGER_MAIN_URL;
    const extraUrl = root?.dataset?.passengerExtraUrl || PASSENGER_EXTRA_URL;
    const fdoUrl = root?.dataset?.passengerFdoUrl || extraUrl;

    const mainRowsPromise = loadPassengerCsv(mainUrl);

    if (target === FDO_IATA) {
      const fdoRows = await loadPassengerCsv(fdoUrl);
      if (normalizePassengerRows(fdoRows, target).length) {
        return { rows: fdoRows, source: "aeropuertos_argentina_fdo", url: fdoUrl };
      }
      const mainRows = await mainRowsPromise;
      return { rows: mainRows, source: "siac_anac", url: mainUrl };
    }

    if (EXTRA_PASSENGER_IATAS.has(target)) {
      const extraRows = await loadPassengerCsv(extraUrl);
      if (normalizePassengerRows(extraRows, target).length) {
        return { rows: extraRows, source: "fuente_extra", url: extraUrl };
      }
      const mainRows = await mainRowsPromise;
      return { rows: mainRows, source: "siac_anac", url: mainUrl };
    }

    const mainRows = await mainRowsPromise;
    return { rows: mainRows, source: "siac_anac", url: mainUrl };
  }

async function resolvePassengerData(data) {
  const iata = String(data?.iata || "").trim().toUpperCase();

  const semesterData = await loadPassengerSemesterData();
  const semesterItem = semesterData?.aeropuertos?.[iata];

  if (semesterItem) {
    return buildSemesterPassengerData(semesterItem);
  }

  if (Number.isFinite(data.passengersH12026)) {
    const yoy = Number.isFinite(data.passengersH1Yoy)
      ? data.passengersH1Yoy
      : (Number.isFinite(data.passengersH12025) && data.passengersH12025 !== 0
        ? ((data.passengersH12026 - data.passengersH12025) / data.passengersH12025) * 100
        : null);

    const fallback = {
      current: data.passengersH12026,
      previous: data.passengersH12025,
      yoy,
      lastMonth: 5,
      source: "ResumenImpacto2025.geojson",
      trafficLabel: "pasajeros comerciales",
      metrics: {
        total: {
          current: data.passengersH12026,
          previous: data.passengersH12025,
          yoy
        },
        commercial: {
          current: data.passengersH12026,
          previous: data.passengersH12025,
          yoy
        }
      }
    };

    return fallback;
  }

  const passengerSource = await resolvePassengerRowsForAirport(data.iata);
  const summary = summarizePassengerRows(passengerSource.rows, data.iata);

  return {
    ...summary,
    source: passengerSource.source,
    url: passengerSource.url,
    trafficLabel: "pasajeros comerciales",
    metrics: {
      total: {
        current: summary.current,
        previous: summary.previous,
        yoy: summary.yoy
      },
      commercial: {
        current: summary.current,
        previous: summary.previous,
        yoy: summary.yoy
      }
    }
  };
}

  function buildPerspective(yoy) {
    if (!Number.isFinite(yoy)) {
      return "La perspectiva de crecimiento dependerá de sostener la oferta regular, fortalecer la conectividad y acompañar la demanda con infraestructura y servicios adecuados.";
    }
    if (yoy >= 10) return "La evolución configura una perspectiva de crecimiento favorable, cuya consolidación dependerá de sostener la oferta regular y acompañar la expansión de la demanda con capacidad e infraestructura adecuadas.";
    if (yoy >= 3) return "La evolución indica una expansión moderada y una perspectiva favorable, condicionada por la continuidad de las frecuencias y la consolidación de la conectividad.";
    if (yoy > -3) return "La evolución muestra un escenario de relativa estabilidad; el crecimiento futuro dependerá de ampliar o consolidar la oferta y mejorar la conectividad.";
    if (yoy > -10) return "La evolución muestra una moderación de la demanda. La recuperación requerirá sostener la oferta, reforzar la conectividad y estimular los flujos turísticos y productivos.";
    return "La evolución muestra una contracción relevante. La perspectiva exige recuperar demanda y frecuencias, además de fortalecer la conectividad del aeropuerto con su área de influencia.";
  }

  function buildMainImpactSentence(data) {
    const components = [
      { label: "el turismo receptivo", value: data.turismoReceptivo },
      { label: "el Producto Bruto Aeroportuario", value: data.pbaTotal },
      { label: "los beneficios económicos para los pasajeros", value: data.beneficioPasajeros }
    ].filter((item) => Number.isFinite(item.value)).sort((a, b) => b.value - a.value);
    return components.length ? `El principal componente positivo fue ${components[0].label}.` : "";
  }

  async function renderConclusion(data) {
const passengerData = await resolvePassengerData(data);
const periodEnd = monthName(passengerData.lastMonth);
const isFullSemester = passengerData.lastMonth === 5;
const periodLabel = isFullSemester ? "Primer semestre de 2026" : `Enero–${periodEnd} de 2026`;
const comparisonLabel = "Δ primer semestre de 2025";

setText("passengerPeriodLabel", periodLabel);
setText("passengerComparisonLabel", comparisonLabel);

setText("passengers2026", formatInteger(passengerData.current));
setText("passengers2026Yoy", formatPercent(passengerData.yoy));
setText("passengers2026Comparison", comparisonLabel);

renderPassengerTrafficKpis(passengerData);

   const conclusion = root.querySelector("#impactoConclusionText");
if (!conclusion) return;

const metrics = passengerData?.metrics || {};
const sentences = [];

function metricCurrent(metric) {
  const value = Number(metric?.current);
  return Number.isFinite(value) ? value : null;
}

function metricPrevious(metric) {
  const value = Number(metric?.previous);
  return Number.isFinite(value) ? value : null;
}

function metricYoy(metric) {
  const value = Number(metric?.yoy);
  return Number.isFinite(value) ? value : null;
}

function isComparable(metric, minPrevious = 10) {
  const previous = metricPrevious(metric);
  const yoy = metricYoy(metric);

  return (
    Number.isFinite(previous) &&
    previous >= minPrevious &&
    Number.isFinite(yoy)
  );
}

function formatAbsPercent(value) {
  if (!Number.isFinite(value)) return "–";
  return formatPercent(Math.abs(value)).replace("+", "");
}

function buildTotalPassengerSentence(metric, current, airportLabel) {
  const previous = metricPrevious(metric);
  const trend = trendPhrase(metric);

  const baseText =
    `En ${airportLabel}, durante el primer semestre de 2026 se registraron ` +
    `<strong>${formatInteger(current)} pasajeros totales</strong>`;

  if (Number.isFinite(previous) && previous > 0 && current > 0 && trend) {
    return `${baseText}, lo que representa ${trend} respecto del primer semestre de 2025 que alcanzó ` +
      `${formatInteger(previous)} pasajeros totales.`;
  }

  if (Number.isFinite(previous) && previous === 0 && current > 0) {
    return `${baseText}, frente a un primer semestre de 2025 sin pasajeros registrados.`;
  }

  if (Number.isFinite(previous) && previous > 0 && current === 0) {
    return `En ${airportLabel}, durante el primer semestre de 2026 no se registraron pasajeros, ` +
      `frente a <strong>${formatInteger(previous)} pasajeros totales</strong> en el primer semestre de 2025.`;
  }

  if (Number.isFinite(previous) && previous === 0 && current === 0) {
    return `En ${airportLabel}, no se registraron pasajeros en el primer semestre de 2026 ni en el primer semestre de 2025.`;
  }

  return `${baseText}. No se dispone de una base interanual completa para comparar con el primer semestre de 2025.`;
}
    
function trendPhrase(metric) {
  const previous = metricPrevious(metric);
  const yoy = metricYoy(metric);

  if (!Number.isFinite(previous) || previous <= 0) {
    return null;
  }

  if (!Number.isFinite(yoy)) {
    return null;
  }

  if (yoy > 0.05) {
    return `un aumento de ${formatAbsPercent(yoy)}`;
  }

  if (yoy < -0.05) {
    return `una disminución de ${formatAbsPercent(yoy)}`;
  }

  return "una variación prácticamente estable";
}

function shareText(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return null;
  }

  const share = (value / total) * 100;

  return `${share.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function metricDelta(metric) {
  const current = metricCurrent(metric);
  const previous = metricPrevious(metric);

  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }

  return current - previous;
}

function dominantVariation(candidates) {
  const valid = candidates
    .map((item) => ({
      ...item,
      delta: metricDelta(item.metric),
      yoy: metricYoy(item.metric)
    }))
    .filter((item) => (
      Number.isFinite(item.delta) &&
      isComparable(item.metric)
    ))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return valid[0] || null;
}

const total = metrics.total || {
  current: passengerData.current,
  previous: passengerData.previous,
  yoy: passengerData.yoy
};

const commercial = metrics.commercial;
const avGeneral = metrics.avGeneral;
const cabotaje = metrics.cabotaje;
const international = metrics.international;

const totalCurrent = metricCurrent(total);
const commercialCurrent = metricCurrent(commercial);
const avGeneralCurrent = metricCurrent(avGeneral);
const cabotajeCurrent = metricCurrent(cabotaje);
const internationalCurrent = metricCurrent(international);
const airportName = data.iata === "AEP"
  ? "Aeroparque Jorge Newbery"
  : (data.airportNameOnly || data.airportName || data.aeropuerto || data.name || "El aeropuerto");

const airportLabel = data.iata
  ? `${airportName} (${data.iata})`
  : airportName;
    
if (Number.isFinite(totalCurrent)) {
  sentences.push(
    buildTotalPassengerSentence(total, totalCurrent, airportLabel)
  );
}

if (
  Number.isFinite(commercialCurrent) ||
  Number.isFinite(avGeneralCurrent)
) {
  const commercialShare = shareText(commercialCurrent, totalCurrent);
  const avGeneralShare = shareText(avGeneralCurrent, totalCurrent);

const commercialPart = Number.isFinite(commercialCurrent)
  ? `<strong>${formatInteger(commercialCurrent)} pasajeros comerciales</strong>${commercialShare ? ` (${commercialShare} del total)` : ""}`
  : null;

const avGeneralPart = Number.isFinite(avGeneralCurrent)
  ? `<strong>${formatInteger(avGeneralCurrent)} de aviación general</strong>${avGeneralShare ? ` (${avGeneralShare} del total)` : ""}`
  : null;

  sentences.push(
    `La apertura por clase de vuelo muestra ${[commercialPart, avGeneralPart].filter(Boolean).join(" y ")}.`
  );
}

if (
  Number.isFinite(cabotajeCurrent) ||
  Number.isFinite(internationalCurrent)
) {
  const cabotajeShare = shareText(cabotajeCurrent, totalCurrent);
  const internationalShare = shareText(internationalCurrent, totalCurrent);

  const cabotajePart = Number.isFinite(cabotajeCurrent)
    ? cabotajeCurrent > 0
      ? `<strong>${formatInteger(cabotajeCurrent)} de cabotaje</strong>${cabotajeShare ? ` (${cabotajeShare} del total)` : ""}`
      : `<strong>sin pasajeros de cabotaje</strong>`
    : null;

  const internationalPart = Number.isFinite(internationalCurrent)
    ? internationalCurrent > 0
      ? `<strong>${formatInteger(internationalCurrent)} internacionales</strong>${internationalShare ? ` (${internationalShare} del total)` : ""}`
      : `<strong>sin pasajeros internacionales</strong>`
    : null;

  sentences.push(
    `Por alcance de vuelo, los pasajeros se distribuyeron en ${[cabotajePart, internationalPart].filter(Boolean).join(" y ")}.`
  );
}

const dominantScope = dominantVariation([
  { label: "cabotaje", metric: cabotaje },
  { label: "internacional", metric: international }
]);

const cabotajeDelta = metricDelta(cabotaje);
const internationalPrevious = metricPrevious(international);
const noInternationalCurrent =
  Number.isFinite(internationalCurrent) && internationalCurrent <= 0;
const noInternationalPrevious =
  Number.isFinite(internationalPrevious) && internationalPrevious <= 0;

function deltaMovementText(delta) {
  if (!Number.isFinite(delta)) return null;

  if (delta > 0) {
    return `creció en ${formatInteger(Math.abs(delta))} pasajeros`;
  }

  if (delta < 0) {
    return `retrocedió en ${formatInteger(Math.abs(delta))} pasajeros`;
  }

  return "no registró variación";
}

if (noInternationalCurrent && noInternationalPrevious && Number.isFinite(cabotajeDelta)) {
  const movementText = deltaMovementText(cabotajeDelta);

  sentences.push(
    `Al no registrarse pasajeros internacionales en ninguno de los dos semestres comparados, la diferencia interanual se explica por el componente cabotaje, que ${movementText} frente al primer semestre de 2025.`
  );
} else if (noInternationalCurrent && Number.isFinite(cabotajeDelta)) {
  const movementText = deltaMovementText(cabotajeDelta);

  sentences.push(
    `Al no registrarse pasajeros internacionales en el primer semestre de 2026, la lectura interanual se concentra en el componente cabotaje, que ${movementText} frente al primer semestre de 2025.`
  );
} else if (dominantScope) {
  const delta = dominantScope.delta;
  const movementText = deltaMovementText(delta);

  sentences.push(
    `La diferencia interanual estuvo explicada principalmente por el componente ${dominantScope.label}, que ${movementText} frente al primer semestre de 2025.`
  );
}

if (
  Number.isFinite(totalCurrent) &&
  Number.isFinite(commercialCurrent) &&
  Number.isFinite(avGeneralCurrent) &&
  totalCurrent > 0 &&
  commercialCurrent < 10 &&
  avGeneralCurrent > 0
) {
  sentences.push(
    "En este caso, la lectura debe centrarse en la actividad total registrada y en la aviación general, dado que la base comercial regular es reducida o inexistente."
  );
}

if (!sentences.length) {
  sentences.push(
    "No se dispone de información suficiente para construir una comparación interanual del primer semestre de 2026."
  );
}

conclusion.innerHTML = sentences.join(" ");
  }

  async function renderAirport(iata) {
    if (!root || !geojson) return;
    const feature = findFeature(iata);
    if (!feature) {
      console.warn(`[Impacto] No se encontró el aeropuerto ${iata}.`);
      return;
    }

    currentFeature = feature;
    const properties = feature.properties || {};
    const data = buildData(properties);

    renderText(data);
    renderInsights(data);
    renderCharts(data);
    renderSummaryImage(data);
    await renderConclusion(data);

    const select = document.querySelector("#impactoAirportSelect");
    if (select && data.iata) select.value = data.iata;

    if (![data.pbaTotal, data.turismoReceptivo, data.empleoTotal].some(Number.isFinite)) {
      console.info("[Impacto] No se reconocieron métricas principales. Campos disponibles:", Object.keys(properties));
    }

    document.dispatchEvent(new CustomEvent("impacto:rendered", { detail: { iata: data.iata, feature, data } }));
  }
async function loadOptionalGeojson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Impacto] No se pudo cargar ${url} (${response.status}). Se continúa con el GeoJSON principal.`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`[Impacto] No se pudo cargar ${url}. Se continúa con el GeoJSON principal.`, error);
    return null;
  }
}

function getFeatureIata(feature) {
  const properties = feature.properties || {};
  const index = buildPropertyIndex(properties);

  const possibleIataFields = [
    "iata",
    "IATA",
    "codigo_iata",
    "cod_iata",
    "Código IATA",
    "Codigo IATA",
    "codigoIATA",
    "codIATA"
  ];

  for (const field of possibleIataFields) {
    const originalKey = index.get(normalizeKey(field));
    if (!originalKey) continue;

    const value = properties[originalKey];
    if (value === null || value === undefined) continue;

    const iata = String(value).trim().toUpperCase();

    if (/^[A-Z0-9]{3}$/.test(iata)) {
      return iata;
    }
  }

  return "";
}
async function loadOptionalJson(url, label = "archivo JSON") {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Impacto] No se pudo cargar ${url} (${response.status}). Se continúa sin ${label}.`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`[Impacto] No se pudo cargar ${url}. Se continúa sin ${label}.`, error);
    return null;
  }
}

function readAnyNumber(object, keys) {
  if (!object) return null;

  const index = buildPropertyIndex(object);

  for (const key of keys) {
    const originalKey = index.get(normalizeKey(key));
    if (!originalKey) continue;

    const value = parseNumber(object[originalKey]);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

function mergeAirportPopulationData(baseGeojson, airportGeojson) {
  if (!baseGeojson?.features?.length || !airportGeojson?.features?.length) {
    console.warn("[Impacto] No se incorporó población: archivo base o fuente de aeropuertos vacía.");
    return;
  }

  const airportByIata = new Map();

  airportGeojson.features.forEach((feature) => {
    const iata = getFeatureIata(feature);
    if (!iata) return;
    airportByIata.set(iata, feature.properties || {});
  });

  let matched = 0;
  let withPopulation = 0;

  baseGeojson.features.forEach((feature) => {
    const iata = getFeatureIata(feature);
    if (!iata) return;

    const airportProps = airportByIata.get(iata);
    if (!airportProps) return;

    matched += 1;

    const population = readAnyNumber(airportProps, [
      "Población del Área de Influencia (Censo 2022)",
      "Poblacion del Area de Influencia Censo 2022",
      "PoblacionAreaInfluencia",
      "PoblaciónAreaInfluencia",
      "poblacion_area_influencia",
      "Población del área de influencia",
      "PoblacionInfluencia"
    ]);

    if (Number.isFinite(population)) {
      feature.properties = {
        ...(feature.properties || {}),
        "Población del Área de Influencia (Censo 2022)": population
      };
      withPopulation += 1;
    }
  });

  console.info(
    `[Impacto] Población por IATA: ${matched} aeropuertos cruzados; ${withPopulation} con población válida.`
  );
}

function buildEmploymentGenderIndex(json) {
  employmentGenderByIata = new Map();

  if (!json) {
    console.warn("[Impacto] No se cargó empleo_genero_2025.json.");
    return;
  }

  let rows = [];

  if (Array.isArray(json)) {
    rows = json;
  } else if (Array.isArray(json.features)) {
    rows = json.features.map((feature) => feature.properties || {});
  } else if (typeof json === "object") {
    rows = Object.entries(json).map(([key, value]) => ({
      iata: key,
      ...(value || {})
    }));
  }

  rows.forEach((row) => {
    const iata = String(
      row.iata ||
      row.IATA ||
      row.codigo_iata ||
      row.cod_iata ||
      ""
    ).trim().toUpperCase();

    if (!iata) return;

    employmentGenderByIata.set(iata, row);
  });

  console.info(
    "[Impacto] IATA disponibles en empleo_genero_2025.json:",
    [...employmentGenderByIata.keys()].sort()
  );
}

function getEmploymentGenderForIata(iata) {
  const row = employmentGenderByIata.get(String(iata || "").trim().toUpperCase());
  if (!row) return { mujeres: null, varones: null };

  const mujeres = readAnyNumber(row, [
    "mujeres",
    "Mujeres",
    "pct_mujeres",
    "PctMujeres",
    "PorcentajeMujeres",
    "porcentaje_mujeres",
    "% Mujeres"
  ]);

  const varones = readAnyNumber(row, [
    "varones",
    "Varones",
    "pct_varones",
    "PctVarones",
    "PorcentajeVarones",
    "porcentaje_varones",
    "% Varones"
  ]);

  return { mujeres, varones };
}
function mergeNoAeroData(baseGeojson, noAeroGeojson) {
  if (!baseGeojson?.features?.length || !noAeroGeojson?.features?.length) {
    console.warn("[Impacto] No se incorporaron datos no aeronáuticos: archivo base o archivo adicional vacío.");
    return;
  }

  const noAeroByIata = new Map();

  noAeroGeojson.features.forEach((feature) => {
    const iata = getFeatureIata(feature);

    if (!iata) {
      console.warn("[Impacto] Feature del GeoJSON no aeronáutico sin IATA válido:", feature.properties);
      return;
    }

    noAeroByIata.set(iata, feature.properties || {});
  });

  let matched = 0;
  let matchedWithCategories = 0;
  const missingInNoAero = [];

  baseGeojson.features.forEach((feature) => {
    const iata = getFeatureIata(feature);

    if (!iata) {
      console.warn("[Impacto] Feature del GeoJSON principal sin IATA válido:", feature.properties);
      return;
    }

    const noAeroProps = noAeroByIata.get(iata);

    if (!noAeroProps) {
      missingInNoAero.push(iata);
      return;
    }

    const totalNoAero = readNumber(noAeroProps, "pbaNoAeronautico");
    const conexas = readNumber(noAeroProps, "pbaConexas");
    const comercial = readNumber(noAeroProps, "pbaComercial");
    const secundarias = readNumber(noAeroProps, "pbaSecundarias");

    feature.properties = {
      ...(feature.properties || {}),

      ...(Number.isFinite(totalNoAero)
        ? { ingresos_no_aeronauticos_2025_usd: totalNoAero }
        : {}),

      ...(Number.isFinite(conexas)
        ? { actividades_conexas_transporte_aerocomercial_2025_usd: conexas }
        : {}),

      ...(Number.isFinite(comercial)
        ? { explotacion_comercial_aeropuerto_2025_usd: comercial }
        : {}),

      ...(Number.isFinite(secundarias)
        ? { actividades_secundarias_aeropuerto_2025_usd: secundarias }
        : {})
    };

    matched += 1;

    if ([conexas, comercial, secundarias].some(Number.isFinite)) {
      matchedWithCategories += 1;
    }
  });

  console.info(
    `[Impacto] Merge no aeronáutico por IATA: ${matched} aeropuertos cruzados; ${matchedWithCategories} con categorías válidas.`
  );

  if (missingInNoAero.length) {
    console.warn(
      "[Impacto] IATA presentes en el GeoJSON principal pero no encontrados en ingresos_no_aeronauticos_2025_web.geojson:",
      missingInNoAero
    );
  }

  console.info(
    "[Impacto] IATA disponibles en ingresos_no_aeronauticos_2025_web.geojson:",
    [...noAeroByIata.keys()].sort()
  );
}
  async function initialize() {
    root = document.querySelector("#impactoSocioeconomico");
    if (!root) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
const dataUrl = root.dataset.url || "data/ResumenImpacto2025.geojson";
const response = await fetch(dataUrl);
if (!response.ok) throw new Error(`No se pudo cargar ${dataUrl} (${response.status})`);

geojson = await response.json();

const noAeroUrl = root.dataset.noAeroUrl || NO_AERO_DATA_URL;
const noAeroGeojson = await loadOptionalGeojson(noAeroUrl);
mergeNoAeroData(geojson, noAeroGeojson);

const airportDataUrl = root.dataset.airportDataUrl || AIRPORT_DATA_URL;
const airportGeojson = await loadOptionalGeojson(airportDataUrl);
mergeAirportPopulationData(geojson, airportGeojson);

const employmentGenderUrl = root.dataset.employmentGenderUrl || EMPLOYMENT_GENDER_URL;
const employmentGenderJson = await loadOptionalJson(employmentGenderUrl, "género del empleo directo");
buildEmploymentGenderIndex(employmentGenderJson);

fillAirportSelect();
await renderAirport(resolveInitialIata());
    })().catch((error) => {
      console.error("[Impacto] Error de inicialización:", error);
      root.querySelectorAll(".impacto-chart").forEach((container) => clearChart(container, "No se pudo cargar el archivo de datos"));
      const conclusion = root.querySelector("#impactoConclusionText");
      if (conclusion) conclusion.textContent = "No fue posible cargar los datos del capítulo. Verifique la ruta data/ResumenImpacto2025.geojson.";
      initializationPromise = null;
    });

    return initializationPromise;
  }

  document.addEventListener("DOMContentLoaded", initialize);
  document.addEventListener("impacto:mounted", () => {
    initializationPromise = null;
    initialize();
  });
document.addEventListener("report:airport-changed", async (event) => {
  const iata = String(event.detail?.iata || event.detail?.airport || "").trim().toUpperCase();
  if (!iata) return;

  window.REPORT_AIRPORT_IATA = iata;

  await initialize();
  await renderAirport(iata);
});

window.ImpactoSocioeconomico = {
  initialize,
  render: renderAirport,
  getCurrentFeature: () => currentFeature,
  getAvailableFields: () => Object.keys(currentFeature?.properties || {}),
  getEmploymentDebug: () => {
    const data = buildData(currentFeature?.properties || {});
    return {
      iata: data.iata,
      empleoDirecto: data.empleoDirecto,
      empleoIndirecto: data.empleoIndirecto,
      empleoInducido: data.empleoInducido,
      empleoCatalitico: data.empleoCatalitico,
      empleoTotal: data.empleoTotal,
      poblacionInfluencia: data.poblacionInfluencia,
      empleoMujeres: data.empleoMujeres,
      empleoVarones: data.empleoVarones,
      generoFuente: employmentGenderByIata.get(data.iata) || null
    };
  },
  aliases: FIELD_ALIASES
};
})();
