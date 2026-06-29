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

    turismoReceptivo: ["TurismoReceptivo", "turismo_receptivo", "ImpactoTurismoReceptivo", "Impacto turismo receptivo", "Turismo receptivo total"],
    turismoReceptivoNacional: ["TurismoReceptivoNacional", "TurismoInternoReceptivo", "turismo_receptivo_nacional", "turismo_interno_receptivo", "GastoTurismoInternoReceptivo"],
    turismoReceptivoInternacional: ["TurismoReceptivoInternacional", "TurismoExtranjeroReceptivo", "turismo_receptivo_internacional", "turismo_extranjero_receptivo", "GastoTurismoExtranjeroReceptivo"],
    turismoEmisivo: ["TurismoEmisivo", "turismo_emisivo", "ImpactoTurismoEmisivo", "Impacto turismo emisivo", "Turismo emisivo total", "ImpactoNegativoTurismo"],
    turismoEmisivoNacional: ["TurismoEmisivoNacional", "TurismoInternoEmisivo", "turismo_emisivo_nacional", "turismo_interno_emisivo", "GastoTurismoInternoEmisivo"],
    turismoEmisivoInternacional: ["TurismoEmisivoInternacional", "TurismoExtranjeroEmisivo", "turismo_emisivo_internacional", "turismo_extranjero_emisivo", "GastoTurismoExtranjeroEmisivo"],
    saldoTurismo: ["SaldoTurismo", "saldo_turismo", "Saldo de turismo", "SaldoTuristico", "saldo_turistico"],
    beneficioPasajeros: ["BeneficioPasajeros", "BeneficiosPasajeros", "beneficio_pasajeros", "beneficios_pasajeros", "ExcedenteConsumidor", "excedente_consumidor", "Excedente del consumidor"],

    impactoPositivo: ["ImpactoPositivoTotal", "ImpactoTotalPositivo", "impacto_positivo_total", "impacto_total_positivo", "Impactos positivos", "Impacto positivo total"],
    impactoNegativo: ["ImpactoNegativoTotal", "ImpactoTotalNegativo", "impacto_negativo_total", "impacto_total_negativo", "Impactos negativos", "Impacto negativo total"],
    saldoImpacto: ["SaldoImpacto", "saldo_impacto", "Saldo de impactos", "ImpactoNeto", "impacto_neto", "Saldo total"],

    empleoDirecto: ["EmpleoDirecto", "empleo_directo", "Empleo directo", "EmpleoDirecto2024", "EmpleoDirecto2025"],
    empleoIndirecto: ["EmpleoIndirecto", "empleo_indirecto", "Empleo indirecto"],
    empleoInducido: ["EmpleoInducido", "empleo_inducido", "Empleo inducido"],
    empleoCatalitico: ["EmpleoCatalitico", "EmpleoCatalítico", "empleo_catalitico", "Empleo catalítico"],
    empleoTotal: ["EmpleoTotal", "empleo_total", "EmpleosTotal", "PuestosEmpleoTotal", "Total empleos", "Empleo total"],
    empleoMujeres: ["EmpleoDirectoMujeres", "empleo_directo_mujeres", "Mujeres", "PorcentajeMujeres", "pct_mujeres", "% Mujeres"],
    empleoVarones: ["EmpleoDirectoVarones", "empleo_directo_varones", "Varones", "PorcentajeVarones", "pct_varones", "% Varones"],
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
  let passengersPromise = null;
const NO_AERO_DATA_URL = "geodata/data/ingresos_no_aeronauticos_2025_web.min.geojson";
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
        "stroke-width": 28,
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
      "font-size": 14,
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
    const svg = svgElement("svg", { viewBox: "0 0 620 300", role: "img" });
    const baseline = 170;
    const scale = 110 / maxAbs;
    const bars = [
      { label: "Turismo receptivo", value: positive, x: 85, color: COLORS.teal },
      { label: "Turismo emisivo", value: -negative, x: 275, color: COLORS.red },
      { label: "Saldo turístico", value: net, x: 465, color: net >= 0 ? COLORS.blue : COLORS.orange }
    ];

    svg.appendChild(svgElement("line", { x1: 35, y1: baseline, x2: 585, y2: baseline, stroke: COLORS.grid, "stroke-width": 2 }));

    bars.forEach((bar) => {
      const barHeight = Math.abs(bar.value) * scale;
      const y = bar.value >= 0 ? baseline - barHeight : baseline;
      svg.appendChild(svgElement("rect", { x: bar.x, y, width: 90, height: Math.max(2, barHeight), rx: 6, fill: bar.color }));
      svg.appendChild(svgElement("text", { x: bar.x + 45, y: bar.value >= 0 ? y - 10 : y + barHeight + 18, "text-anchor": "middle", fill: COLORS.navy, "font-size": 13, "font-weight": 800 }, formatCompact(Math.abs(bar.value))));
      const label = svgElement("text", { x: bar.x + 45, y: 265, "text-anchor": "middle", fill: COLORS.navy, "font-size": 12, "font-weight": 700 });
      const words = bar.label.split(" ");
      label.appendChild(svgElement("tspan", { x: bar.x + 45, dy: 0 }, words.slice(0, 2).join(" ")));
      if (words.length > 2) label.appendChild(svgElement("tspan", { x: bar.x + 45, dy: 15 }, words.slice(2).join(" ")));
      svg.appendChild(label);
    });

    container.appendChild(svg);
  }

  function renderTourismComposition(container, data) {
    if (!container) return;
    const categories = [
      {
        label: "Receptivo",
        national: data.receptiveNational,
        international: data.receptiveInternational
      },
      {
        label: "Emisivo",
        national: data.emissiveNational,
        international: data.emissiveInternational
      }
    ];

    const hasData = categories.some((category) => Number.isFinite(category.national) || Number.isFinite(category.international));
    if (!hasData) {
      clearChart(container, "No hay desagregación nacional/internacional");
      return;
    }

    container.innerHTML = "";
    const svg = svgElement("svg", { viewBox: "0 0 300 300", role: "img" });
    const maxTotal = Math.max(...categories.map((category) => (category.national || 0) + (category.international || 0)), 1);

    categories.forEach((category, index) => {
      const x = 58 + index * 132;
      const total = (category.national || 0) + (category.international || 0);
      const nationalHeight = ((category.national || 0) / maxTotal) * 155;
      const internationalHeight = ((category.international || 0) / maxTotal) * 155;
      const yBase = 225;

      svg.appendChild(svgElement("rect", { x, y: yBase - nationalHeight, width: 68, height: Math.max(0, nationalHeight), fill: COLORS.sky }));
      svg.appendChild(svgElement("rect", { x, y: yBase - nationalHeight - internationalHeight, width: 68, height: Math.max(0, internationalHeight), fill: COLORS.orange }));
      svg.appendChild(svgElement("text", { x: x + 34, y: yBase - nationalHeight - internationalHeight - 9, "text-anchor": "middle", fill: COLORS.navy, "font-size": 11, "font-weight": 800 }, formatCompact(total)));
      svg.appendChild(svgElement("text", { x: x + 34, y: 247, "text-anchor": "middle", fill: COLORS.navy, "font-size": 11, "font-weight": 700 }, category.label));
    });

    const legend = [
      { label: "Nacional", color: COLORS.sky, y: 275 },
      { label: "Internacional", color: COLORS.orange, y: 292 }
    ];
    legend.forEach((item) => {
      svg.appendChild(svgElement("rect", { x: 66, y: item.y - 10, width: 10, height: 10, fill: item.color }));
      svg.appendChild(svgElement("text", { x: 82, y: item.y, fill: COLORS.muted, "font-size": 10 }, item.label));
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
    ];
    renderHorizontalBars(container, items, formatCompact);
  }

  function normalizePercentOrCount(value, total) {
    if (!Number.isFinite(value)) return null;
    if (value >= 0 && value <= 100 && Number.isFinite(total) && total > 100) return (value / 100) * total;
    return value;
  }

  function buildData(properties) {
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
    const empleoTotal = valueOrSum(readNumber(properties, "empleoTotal"), [empleoDirecto, empleoIndirecto, empleoInducido, empleoCatalitico]);

    const empleoMujeres = normalizePercentOrCount(readNumber(properties, "empleoMujeres"), empleoDirecto);
    const empleoVarones = normalizePercentOrCount(readNumber(properties, "empleoVarones"), empleoDirecto);

    return {
      iata: String(readRaw(properties, "iata") || "").trim().toUpperCase(),
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
    const airportLine = data.iata ? `${data.airportName} (${data.iata})` : data.airportName;
    setText("airportLine", airportLine);
    setText("impactYear", `Año ${data.year}`);

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
        tourismInsight.textContent = `El turismo facilitado por la conectividad aérea produjo un saldo ${direction} de ${formatCurrency(Math.abs(data.saldoTurismo))}. El excedente del consumidor se presenta por separado porque constituye un beneficio del pasajero y no un derrame económico local.`;
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
        employmentInsight.textContent = `La actividad aerocomercial y aeroportuaria se vinculó con ${formatInteger(data.empleoTotal)} puestos de trabajo${main ? `; la categoría con mayor participación fue la de empleos ${main.label}` : ""}.`;
      } else {
        employmentInsight.textContent = "No se encontró una estimación completa del empleo vinculado al aeropuerto seleccionado.";
      }
    }
  }

  function renderCharts(data) {
    renderDonut(
      root.querySelector("#impactoPbaDonut"),
      [
        { label: "Aeronáuticos", value: data.pbaAeronautico, color: COLORS.teal },
        { label: "No aeronáuticos", value: data.pbaNoAeronautico, color: COLORS.sky }
      ],
      formatCompact(data.pbaTotal),
      "PBA total"
    );

    renderHorizontalBars(
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

    renderHorizontalBars(
      root.querySelector("#impactoEmploymentBars"),
      [
        { label: "Directo", value: data.empleoDirecto, color: COLORS.lime },
        { label: "Indirecto", value: data.empleoIndirecto, color: COLORS.teal },
        { label: "Inducido", value: data.empleoInducido, color: COLORS.cyan },
        { label: "Catalítico", value: data.empleoCatalitico, color: COLORS.blue }
      ],
      formatInteger
    );

    renderDonut(
      root.querySelector("#impactoGenderDonut"),
      [
        { label: "Mujeres", value: data.empleoMujeres, color: COLORS.sky },
        { label: "Varones", value: data.empleoVarones, color: COLORS.blue }
      ],
      Number.isFinite(data.empleoDirecto) ? formatInteger(data.empleoDirecto) : "–",
      "empleos directos"
    );

    renderSummaryFallback(root.querySelector("#impactoSummaryFallback"), data);
  }

  function trySummaryImages(candidates, image, fallback, index = 0) {
    if (!image || !fallback || index >= candidates.length) {
      if (image) image.hidden = true;
      if (fallback) fallback.hidden = false;
      return;
    }

    const src = candidates[index];
    if (!src) {
      trySummaryImages(candidates, image, fallback, index + 1);
      return;
    }

    image.onload = () => {
      image.hidden = false;
      fallback.hidden = true;
    };
    image.onerror = () => trySummaryImages(candidates, image, fallback, index + 1);
    image.src = src;
  }

  function renderSummaryImage(data) {
    const image = root.querySelector("#impactoSummaryImg");
    const fallback = root.querySelector("#impactoSummaryFallback");
    const existingSummary = document.querySelector("#summaryImgAirport");
    const existingSrc = existingSummary && (existingSummary.currentSrc || existingSummary.getAttribute("src"));
    const iata = data.iata;

    const candidates = [
      existingSrc,
      data.summaryImage,
      iata ? `img/resumenejecutivo/${iata}.png` : null,
      iata ? `img/resumenejecutivo/${iata}_impacto.png` : null,
      iata ? `img/resumenejecutivo/impacto_${iata}.png` : null,
      iata ? `img/resumenejecutivo/Impacto_${iata}.png` : null,
      iata ? `img/resumenejecutivo/${iata.toLowerCase()}.png` : null
    ].filter(Boolean);

    trySummaryImages([...new Set(candidates)], image, fallback);
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
    if (passengersPromise) return passengersPromise;
    passengersPromise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Pasajeros: ${response.status}`);
        return response.text();
      })
      .then(parseCsv)
      .catch(() => []);
    return passengersPromise;
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

  function parseDateFlexible(value) {
    const text = String(value || "").trim();
    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function summarizePassengerRows(rows, iata) {
    const target = String(iata || "").toUpperCase();
    const validDatasets = new Set([
      "pasajeroscomercialescabotajeaeropuerto",
      "pasajeroscomercialesinternacionalaeropuerto"
    ]);

    const parsed = rows.map((row) => {
      const rowIata = String(row.iata || row.codigoiata || row.codiata || "").trim().toUpperCase();
      const date = parseDateFlexible(row.fecha || row.date || row.periodo);
      const value = parseNumber(row.valorpax || row.pasajeros || row.valor || row.pax);
      const dataset = normalizeKey(row.dataset || row.serie || "");
      return { rowIata, date, value, dataset };
    }).filter((row) => row.rowIata === target && row.date && Number.isFinite(row.value));

    const hasKnownDatasets = parsed.some((row) => validDatasets.has(row.dataset));
    const filtered = hasKnownDatasets ? parsed.filter((row) => validDatasets.has(row.dataset)) : parsed;

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

  async function resolvePassengerData(data) {
    if (Number.isFinite(data.passengersH12026)) {
      const yoy = Number.isFinite(data.passengersH1Yoy)
        ? data.passengersH1Yoy
        : (Number.isFinite(data.passengersH12025) && data.passengersH12025 !== 0
          ? ((data.passengersH12026 - data.passengersH12025) / data.passengersH12025) * 100
          : null);
      return {
        current: data.passengersH12026,
        previous: data.passengersH12025,
        yoy,
        lastMonth: 5
      };
    }

    const passengerUrl = root?.dataset?.passengerUrl || "fuentes/pasajeros_aeropuerto_mensual.csv";
    const rows = await loadPassengerCsv(passengerUrl);
    return summarizePassengerRows(rows, data.iata);
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
    setText("passengerPeriodLabel", isFullSemester ? "Primer semestre de 2026" : `Enero–${periodEnd} de 2026`);
    setText("passengers2026", formatInteger(passengerData.current));
    setText("passengers2026Yoy", formatPercent(passengerData.yoy));
    setText("passengers2026Comparison", Number.isFinite(passengerData.previous) ? `Comparación con enero–${periodEnd} de 2025` : "Sin base comparable disponible");

    const conclusion = root.querySelector("#impactoConclusionText");
    if (!conclusion) return;

    const sentences = [];
    if (Number.isFinite(data.saldoImpacto)) {
      sentences.push(`En ${data.year}, ${data.airportName}${data.iata ? ` (${data.iata})` : ""} generó un saldo socioeconómico estimado de ${formatCurrency(data.saldoImpacto)}.`);
    } else if (Number.isFinite(data.impactoPositivo)) {
      sentences.push(`En ${data.year}, los impactos positivos estimados del aeropuerto alcanzaron ${formatCurrency(data.impactoPositivo)}.`);
    }
    if (Number.isFinite(data.empleoTotal)) sentences.push(`La actividad se vinculó con ${formatInteger(data.empleoTotal)} puestos de trabajo.`);
    const mainImpact = buildMainImpactSentence(data);
    if (mainImpact) sentences.push(mainImpact);
    if (Number.isFinite(passengerData.current)) {
      const variationText = Number.isFinite(passengerData.yoy) ? `, una variación interanual de ${formatPercent(passengerData.yoy)}` : "";
      sentences.push(`Entre enero y ${periodEnd} de 2026 se registraron ${formatInteger(passengerData.current)} pasajeros comerciales${variationText}.`);
    }
    sentences.push(buildPerspective(passengerData.yoy));
    conclusion.textContent = sentences.join(" ");
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
  return String(readRaw(feature.properties || {}, "iata") || "")
    .trim()
    .toUpperCase();
}

function mergeNoAeroData(baseGeojson, noAeroGeojson) {
  if (!baseGeojson?.features?.length || !noAeroGeojson?.features?.length) return;

  const noAeroByIata = new Map();

  noAeroGeojson.features.forEach((feature) => {
    const iata = getFeatureIata(feature);
    if (iata) noAeroByIata.set(iata, feature.properties || {});
  });

  let matched = 0;

  baseGeojson.features.forEach((feature) => {
    const iata = getFeatureIata(feature);
    const noAeroProps = noAeroByIata.get(iata);
    if (!noAeroProps) return;

    feature.properties = {
      ...(feature.properties || {}),
      ingresos_no_aeronauticos_2025_usd: noAeroProps.ingresos_no_aeronauticos_2025_usd,
      actividades_conexas_transporte_aerocomercial_2025_usd: noAeroProps.actividades_conexas_transporte_aerocomercial_2025_usd,
      actividades_secundarias_aeropuerto_2025_usd: noAeroProps.actividades_secundarias_aeropuerto_2025_usd,
      explotacion_comercial_aeropuerto_2025_usd: noAeroProps.explotacion_comercial_aeropuerto_2025_usd,
      metodo_proporciones: noAeroProps.metodo_proporciones,
      iata_proporcion_usada: noAeroProps.iata_proporcion_usada,
      aeropuerto_proporcion_usada: noAeroProps.aeropuerto_proporcion_usada
    };

    matched += 1;
  });

  console.info(`[Impacto] Datos no aeronáuticos 2025 incorporados en ${matched} aeropuertos.`);
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
  document.addEventListener("report:airport-changed", (event) => {
    const iata = event.detail?.iata || event.detail?.airport || "";
    if (iata) renderAirport(iata);
  });

  window.ImpactoSocioeconomico = {
    initialize,
    render: renderAirport,
    getCurrentFeature: () => currentFeature,
    getAvailableFields: () => Object.keys(currentFeature?.properties || {}),
    aliases: FIELD_ALIASES
  };
})();
