(() => {
  "use strict";
  const REPORT_VARIANT =
    window.COVID_REPORT_VARIANT || {
      scope: "grupo-a",
      versionLabel: "GRUPO A · 2025/2019",
      includeSemester2026: false,
      pdfFileName:
        "recuperacion_postpandemia_grupoA_2025_2019.pdf"
    };
  /*
    Fuente única del informe.
    El JSON ya contiene:
    - serie anual;
    - variaciones contra 2019;
    - comparación 2026 1S vs 2019 1S;
    - SNA;
    - AEP + EZE;
    - aeropuertos individuales;
    - selección de tráfico internacional significativo.
  */
  const DATA_PATH = "data/recuperacion_postpandemia_pasajeros.json";
  const AIRPORTS_PATH =
    "fuentes/Datos_aeropuertos.geojson";
  const CLOSURES_PATH =
  "fuentes/cierres_aeropuertos_anac_2025_2026.json";
  
  /*
    Una variación porcentual se considera no representativa cuando
    tanto el año base como el último año anual tienen menos de
    1.000 pasajeros en ese segmento.

    El umbral queda centralizado para poder modificarlo fácilmente.
  */
    const MARGINAL_MAX_ANNUAL_PAX = 1000;
    const MARGINAL_LABEL = "Volumen marginal";
    
    const CAB_ROWS_FIRST_PAGE = 10;
    const CAB_ROWS_CONTINUATION_SNA = 24;
  
    const INT_ROWS_FIRST_PAGE_SNA = 11;
  /*
  Grupos de aeropuertos incluidos en las tablas
  y en las conclusiones.
  
  Para volver a incorporar el Grupo B:
  new Set(["A", "B"])
*/
const VISIBLE_AIRPORT_GROUPS =
  new Set(["A"]);
  
  let reportData = null;
  let reportConfig = null;
  let airportNameByIata = new Map();
  let airportGroupByIata = new Map();
  let airportClosure2025ByIata = new Map();
  let airportClosure2026H1ByIata = new Map();
  
  const $ = id => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  
function renderReportVariant() {
  document
    .querySelectorAll(".report-version-label")
    .forEach(el => {
      el.textContent =
        REPORT_VARIANT.versionLabel;
    });
}

function isSnaScope() {
  return REPORT_VARIANT.scope === "sna";
}

function reportScopeName() {
  return isSnaScope()
    ? "SNA"
    : "Grupo A";
}

function reportRemainderName() {
  return isSnaScope()
    ? "Resto SNA"
    : "Resto Grupo A";
}

function reportRemainderAirportName() {
  return isSnaScope()
    ? "Resto de aeropuertos del SNA"
    : "Resto de aeropuertos del Grupo A";
}

function reportTotalAirportName() {
  return isSnaScope()
    ? "Total aeropuertos del SNA"
    : "Total aeropuertos del Grupo A";
}
  
function setStatus(message, type = "ok") {
  const el = $("status");

  if (!el) return;

  if (!message) {
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }

  el.style.display = "";
  el.className = `status ${type}`;
  el.innerHTML = message;
}

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) {
      throw new Error(`No se pudo cargar ${url}: HTTP ${resp.status}`);
    }
    return resp.json();
  }

function buildAirportNameIndex(geojson) {
  const index = new Map();

  const features = Array.isArray(geojson?.features)
    ? geojson.features
    : [];

  features.forEach(feature => {
    const properties = feature?.properties || {};

    const iata = String(
      properties.IATA || ""
    )
      .trim()
      .toUpperCase();

    const airportName = String(
      properties.Aeropuerto || ""
    ).trim();

    if (iata && airportName) {
      index.set(iata, airportName);
    }
  });

  return index;
}
function normalizeAirportGroup(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^GRUPO\s+/, "");
}


function buildAirportGroupIndex(geojson) {
  const index = new Map();

  const features = Array.isArray(
    geojson?.features
  )
    ? geojson.features
    : [];

  features.forEach(feature => {
    const properties =
      feature?.properties || {};

    const iata = String(
      properties.IATA || ""
    )
      .trim()
      .toUpperCase();

    const group = normalizeAirportGroup(
      properties.Grupo
    );

    if (iata) {
      index.set(iata, group);
    }
  });

  return index;
}

function buildAirportClosure2025Index(data) {
  const index = new Map();

  const events = Array.isArray(data?.eventos)
    ? data.eventos
    : [];

  events
    .filter(event => {
      if (event?.usar_en_informe !== true) {
        return false;
      }

      const start = String(
        event?.fecha_inicio || ""
      );

      const end = String(
        event?.fecha_fin || ""
      );

      /*
        El evento debe superponerse
        con algún momento de 2025.
      */
      return (
        start <= "2025-12-31" &&
        end >= "2025-01-01"
      );
    })
    .forEach(event => {
      const iata = String(
        event?.iata || ""
      )
        .trim()
        .toUpperCase();

      if (!iata) return;

      if (!index.has(iata)) {
        index.set(iata, []);
      }

      index.get(iata).push(event);
    });

  return index;
}

function buildAirportClosure2026H1Index(data) {
  const index = new Map();

  const events = Array.isArray(data?.eventos)
    ? data.eventos
    : [];

  events
    .filter(event => {
      if (event?.usar_en_informe !== true) {
        return false;
      }

      const start = String(
        event?.fecha_inicio || ""
      );

      const end = String(
        event?.fecha_fin || ""
      );

      return (
        start <= "2026-06-30" &&
        end >= "2026-01-01"
      );
    })
    .forEach(event => {
      const iata = String(
        event?.iata || ""
      )
        .trim()
        .toUpperCase();

      if (!iata) return;

      if (!index.has(iata)) {
        index.set(iata, []);
      }

      index.get(iata).push(event);
    });

  return index;
}
  
function isVisibleAirportRow(row) {
  /*
    SNA y AEP+EZE son filas agregadas.
    Se mantienen siempre.
  */
  if (row?.es_sna || row?.es_aep_eze) {
    return true;
  }

  const iata = String(
    row?.iata || ""
  )
    .trim()
    .toUpperCase();

  if (!iata) {
    return false;
  }

  /*
    Versión SNA:
    no discrimina Grupo A / Grupo B.
  */
  if (REPORT_VARIANT.scope === "sna") {
    return true;
  }

  /*
    Versiones Grupo A.
  */
  const group =
    airportGroupByIata.get(iata) || "";

  return VISIBLE_AIRPORT_GROUPS.has(
    group
  );
}

function getAirportShortName(row) {
  const iata = String(
    row?.iata || ""
  )
    .trim()
    .toUpperCase();

  /*
    Fuente principal:
    campo Aeropuerto de Datos_aeropuertos.geojson.
  */
  const geojsonName =
    airportNameByIata.get(iata);

  if (geojsonName) {
    return geojsonName;
  }

  /*
    Respaldo por si un código no estuviera
    presente en el GeoJSON.
  */
  const rawName = String(
    row?.aeropuerto ||
    row?.iata ||
    ""
  ).trim();

  return rawName
    .replace(
      /\s*\([A-Z0-9]{2,4}\)\s*$/i,
      ""
    )
    .replace(
      /^Aeropuerto\s+de\s+/i,
      ""
    )
    .split(/\s+[–—-]\s+/)[0]
    .trim();
}

  
  function fmt(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "–";

    return value.toLocaleString("es-AR", {
      maximumFractionDigits: 0
    });
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
    const v = Number(value);
    const b = Number(base);

    if (!Number.isFinite(v) || !Number.isFinite(b) || b === 0) {
      return NaN;
    }

    return ((v / b) - 1) * 100;
  }

  function classForPct(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "";
    return v >= 0 ? "good" : "bad";
  }

  function extractYearFromText(value, position = "first") {
    const matches = String(value || "").match(/\b(19|20)\d{2}\b/g) || [];
    if (!matches.length) return NaN;

    const selected =
      position === "last"
        ? matches[matches.length - 1]
        : matches[0];

    return Number(selected);
  }

  function getAnnualYearsFromRows(rows) {
    const years = new Set();

    (rows || []).forEach(row => {
      Object.keys(row || {}).forEach(key => {
        const match = key.match(/^pax_(\d{4})$/);
        if (match) years.add(Number(match[1]));
      });
    });

    return Array.from(years)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }

function buildReportConfig(data) {
  const metadata = data?.metadata || {};

  const allRows = [
    ...(data?.tablas?.cabotaje || []),
    ...(data?.tablas?.internacional || [])
  ];

  const availableYears =
    getAnnualYearsFromRows(allRows);

  const baseYear =
    Number(metadata.base_anual) ||
    2019;

  const lastAnnualYear =
    extractYearFromText(
      metadata.comparacion_anual,
      "first"
    ) ||
    availableYears[
      availableYears.length - 1
    ] ||
    2025;

  /*
    Las tablas comienzan en el año base
    y terminan en el último año completo.
  */
  const years = availableYears.filter(
    year =>
      year >= baseYear &&
      year <= lastAnnualYear
  );

  return {
    baseYear,
    lastAnnualYear,

    years: years.length
      ? years
      : Array.from(
          {
            length:
              lastAnnualYear -
              baseYear +
              1
          },
          (_, i) => baseYear + i
        )
  };
}

  function annualValue(row, year) {
    return Number(row?.[`pax_${year}`]) || 0;
  }

  function annualVariation(row, year, config = reportConfig) {
    const stored = Number(row?.[`var_${year}`]);
    if (Number.isFinite(stored)) return stored;

    return pct(
      annualValue(row, year),
      annualValue(row, config.baseYear)
    );
  }

function semesterValue(row, year) {
  return Number(
    row?.[`pax_${year}_1s`]
  ) || 0;
}

function semesterVariation(
  row,
  compareYear = 2026,
  baseYear = 2019
) {
  const stored = Number(
    row?.[`var_${compareYear}_1s`]
  );

  if (Number.isFinite(stored)) {
    return stored;
  }

  return pct(
    semesterValue(row, compareYear),
    semesterValue(row, baseYear)
  );
}

function isSpecialAggregate(row) {
  return (
    !!row?.es_sna ||
    !!row?.es_aep_eze ||
    !!row?.es_grupo_a_resto ||
    !!row?.es_total_tabla
  );
}
function buildGroupARemainderRow(
  rows,
  tableType
) {
  /*
    El resto del Grupo A excluye:
    - AEP;
    - EZE;
    - agregados;
    - filas de total.
  */
  const sourceRows = (rows || []).filter(
    row => {
      const iata = String(
        row?.iata || ""
      )
        .trim()
        .toUpperCase();

      return (
        iata !== "AEP" &&
        iata !== "EZE" &&
        !row?.es_sna &&
        !row?.es_aep_eze &&
        !row?.es_grupo_a_resto &&
        !row?.es_total_tabla
      );
    }
  );

  if (!sourceRows.length) {
    return null;
  }

  const years =
    getAnnualYearsFromRows(sourceRows);

  const aggregateRow = {
    tipo_tabla: tableType,

    iata: "RESTO_GRUPO_A",

    aeropuerto:
      reportRemainderAirportName(),

    es_sna: false,
    es_aep_eze: false,
    es_grupo_a_resto: true,
    es_total_tabla: false,
    es_volumen_marginal: false
  };

  years.forEach(year => {
    aggregateRow[`pax_${year}`] =
      sourceRows.reduce(
        (sum, row) =>
          sum + annualValue(row, year),
        0
      );
  });
aggregateRow.pax_2019_1s =
  sourceRows.reduce(
    (sum, row) =>
      sum + semesterValue(row, 2019),
    0
  );

aggregateRow.pax_2026_1s =
  sourceRows.reduce(
    (sum, row) =>
      sum + semesterValue(row, 2026),
    0
  );

aggregateRow.var_2026_1s =
  pct(
    aggregateRow.pax_2026_1s,
    aggregateRow.pax_2019_1s
  );
  return aggregateRow;
}

function buildAirportTableTotalRow(
  rows,
  tableType
) {
  /*
    Solo se suman aeropuertos individuales.
    Se excluyen todos los agregados para
    evitar duplicaciones.
  */
  const sourceRows = (rows || []).filter(
    row =>
      !row?.es_sna &&
      !row?.es_aep_eze &&
      !row?.es_grupo_a_resto &&
      !row?.es_total_tabla
  );

  if (!sourceRows.length) {
    return null;
  }

  const years =
    getAnnualYearsFromRows(sourceRows);

  const totalRow = {
    tipo_tabla: tableType,
    iata: "TOTAL_GRUPO_A",

    aeropuerto:
      reportTotalAirportName(),

    es_sna: false,
    es_aep_eze: false,
    es_grupo_a_resto: false,
    es_total_tabla: true,
    es_volumen_marginal: false
  };

  years.forEach(year => {
    totalRow[`pax_${year}`] =
      sourceRows.reduce(
        (sum, row) =>
          sum + annualValue(row, year),
        0
      );
  });
totalRow.pax_2019_1s =
  sourceRows.reduce(
    (sum, row) =>
      sum + semesterValue(row, 2019),
    0
  );

totalRow.pax_2026_1s =
  sourceRows.reduce(
    (sum, row) =>
      sum + semesterValue(row, 2026),
    0
  );

totalRow.var_2026_1s =
  pct(
    totalRow.pax_2026_1s,
    totalRow.pax_2019_1s
  );
  
  return totalRow;
}
  
function isMarginalRow(row, config = reportConfig) {
  if (!row || isSpecialAggregate(row)) {
    return false;
  }

  /*
    Se respeta la marca explícita incluida en el JSON.
  */
  if (row.es_volumen_marginal === true) {
    return true;
  }

  /*
    También se reconoce la valoración escrita en el JSON.
  */
  const storedValuation = String(
    row.valoracion || ""
  )
    .trim()
    .toLowerCase();

  if (storedValuation.includes("volumen marginal")) {
    return true;
  }

  /*
    Como respaldo, se calcula a partir de los pasajeros
    de 2019 y 2025.
  */
  const base = annualValue(
    row,
    config.baseYear
  );

  const current = annualValue(
    row,
    config.lastAnnualYear
  );

  return (
    base < MARGINAL_MAX_ANNUAL_PAX &&
    current < MARGINAL_MAX_ANNUAL_PAX
  );
}

function rowLabel(row) {
  const rawName = String(
    row?.aeropuerto ||
    row?.iata ||
    ""
  ).trim();

const iata = String(
  row?.iata || ""
)
  .trim()
  .toUpperCase();



  
/*
  Agregado del resto del Grupo A.
*/
if (
  row?.es_grupo_a_resto ||
  row?.es_total_tabla
) {
  return rawName;
}

/*
  Las demás filas agregadas conservan
  su denominación completa.
*/
if (iata === "SNA" || iata === "BUE") {
  return rawName;
}

  /*
    Nombre especial para AEP en las tablas.
  */
  if (iata === "AEP") {
    return "Aeroparque Jorge Newbery";
  }

  const shortName =
    getAirportShortName(row);

  if (shortName) {
    return `Aeropuerto de ${shortName}`;
  }

  return rawName;
}


function conclusionLabel(row) {
  const iata = String(
    row?.iata || ""
  )
    .trim()
    .toUpperCase();

  /*
    Filas agregadas creadas por el informe.
    Se conserva exactamente su nombre.
  */
  if (
    row?.es_grupo_a_resto ||
    row?.es_total_tabla
  ) {
    return String(
      row?.aeropuerto || ""
    ).trim();
  }

  /*
    Nombre corto especial para Aeroparque.
  */
  if (iata === "AEP") {
    return "Aeroparque";
  }

  const shortName =
    getAirportShortName(row);

  return (
    shortName ||
    String(
      row?.aeropuerto || iata
    ).trim()
  );
}
  
function valuationText(
  row,
  config = reportConfig
) {
  if (isMarginalRow(row, config)) {
    return MARGINAL_LABEL;
  }

  const annualVar = annualVariation(
    row,
    config.lastAnnualYear,
    config
  );

  if (!Number.isFinite(annualVar)) {
    return `Sin base ${config.baseYear}`;
  }
  const trafficType =
    String(row?.tipo_tabla || "")
      .trim()
      .toLowerCase() === "internacional"
      ? "internacional"
      : "cabotaje";
  
if (annualVar >= 20) {
  return `Recuperación amplia ${trafficType}`;
}

if (annualVar >= 10) {
  return `Recuperación clara ${trafficType}`;
}

if (annualVar >= 3) {
  return `Recuperación leve ${trafficType}`;
}

if (annualVar >= -3) {
  return `Igualó el nivel ${trafficType} de ${config.baseYear}`;
}

if (annualVar >= -20) {
  return `Recuperación incompleta ${trafficType}`;
}

  return `Muy por debajo de ${config.baseYear}`;
}

  function normalizeReportRows(rows, config = reportConfig) {
    return (rows || [])
      .map(row => ({
        source: row,
        iata: String(row?.iata || "").trim().toUpperCase(),
        label: rowLabel(row),
        shortLabel: conclusionLabel(row),
        closureEvents2025:
          airportClosure2025ByIata.get(
            String(row?.iata || "")
              .trim()
              .toUpperCase()
          ) || [],
        closureEvents2026H1:
          airportClosure2026H1ByIata.get(
            String(row?.iata || "")
              .trim()
              .toUpperCase()
          ) || [],
        isSna: !!row?.es_sna,
        isBue: !!row?.es_aep_eze,
        isTableTotal: !!row?.es_total_tabla,
        
        isMarginal: isMarginalRow(row, config),
        currentValue: annualValue(row, config.lastAnnualYear),
        currentVariation: annualVariation(
          row,
          config.lastAnnualYear,
          config
        ),
      semester2019Value:
        semesterValue(row, 2019),
      
      semester2026Value:
        semesterValue(row, 2026),
      
      semester2026Variation:
        semesterVariation(
          row,
          2026,
          2019
        ),
        valuation: valuationText(row, config)
      }))
      .filter(row => {
        const base = annualValue(row.source, config.baseYear);

        return (
          base > 0 ||
          row.currentValue > 0
        );
      })
.sort((a, b) => {
  /*
    El Total siempre se ubica al final.
  */
  if (
    a.isTableTotal !== b.isTableTotal
  ) {
    return a.isTableTotal ? 1 : -1;
  }

  if (a.isSna !== b.isSna) {
    return a.isSna ? -1 : 1;
  }

  if (a.isBue !== b.isBue) {
    return a.isBue ? -1 : 1;
  }

  return (
    b.currentValue -
    a.currentValue
  );
});
  }

  function buildCell(value, variation, isBase = false) {
    const varClass =
      isBase
        ? "cell-base"
        : classForPct(variation);

    const varText =
      isBase
        ? `base ${reportConfig.baseYear}`
        : fmtPct(variation);

    return `
      <span class="cell-main">${fmt(value)}</span>
      <span class="cell-var ${varClass}">${varText}</span>
    `;
  }

function formatOneDecimal(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "–";

  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}


function buildLinePath(series, valueKey, xScale, yScale) {
  return series
    .map((d, i) => {
      const x = xScale(i);
      const y = yScale(d[valueKey]);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}


function getInternationalTerritorialSeries(
  groupARemainderRow
) {
  const intlRows =
    reportData?.tablas?.internacional || [];

  const snaRow =
    intlRows.find(
      row => row.es_sna
    ) || null;

  const bueRow =
    intlRows.find(
      row => row.es_aep_eze
    ) || null;

  /*
    El gráfico utiliza la misma fila
    Resto Grupo A que la tabla síntesis.
  */
  if (
    !snaRow ||
    !bueRow ||
    !groupARemainderRow
  ) {
    return [];
  }

  const years =
    getAnnualYearsFromRows([
      snaRow,
      bueRow,
      groupARemainderRow
    ])
      .filter(
        year =>
          year >= 2015 &&
          year <= 2025
      )
      .sort((a, b) => a - b);

  const baseYear =
    reportConfig.baseYear;

  const snaBase =
    annualValue(
      snaRow,
      baseYear
    );

  const bueBase =
    annualValue(
      bueRow,
      baseYear
    );

  const restoGrupoABase =
    annualValue(
      groupARemainderRow,
      baseYear
    );

  return years.map(year => {
    const sna =
      annualValue(
        snaRow,
        year
      );

    const bue =
      annualValue(
        bueRow,
        year
      );

    const restoGrupoA =
      annualValue(
        groupARemainderRow,
        year
      );

    return {
      year,

      snaIndex:
        snaBase > 0
          ? (sna / snaBase) * 100
          : 0,

      bueIndex:
        bueBase > 0
          ? (bue / bueBase) * 100
          : 0,

      /*
        Se conserva el nombre interno
        restoIndex para no cambiar todo
        el dibujo del gráfico.
      */
      restoIndex:
        restoGrupoABase > 0
          ? (
              restoGrupoA /
              restoGrupoABase
            ) * 100
          : 0
    };
  });
}

function getCabotageTerritorialSeries(
  groupARemainderRow
) {
  const cabRows =
    reportData?.tablas?.cabotaje || [];

  const snaRow =
    cabRows.find(
      row => row.es_sna
    ) || null;

  const bueRow =
    cabRows.find(
      row => row.es_aep_eze
    ) || null;

  /*
    El gráfico usa la misma fila
    Resto Grupo A que la tabla síntesis.
  */
  if (
    !snaRow ||
    !bueRow ||
    !groupARemainderRow
  ) {
    return [];
  }

  const years =
    getAnnualYearsFromRows([
      snaRow,
      bueRow,
      groupARemainderRow
    ])
      .filter(
        year =>
          year >= 2015 &&
          year <= 2025
      )
      .sort((a, b) => a - b);

  const baseYear =
    reportConfig.baseYear;

  const snaBase =
    annualValue(
      snaRow,
      baseYear
    );

  const bueBase =
    annualValue(
      bueRow,
      baseYear
    );

  const restoGrupoABase =
    annualValue(
      groupARemainderRow,
      baseYear
    );

  return years.map(year => {
    const sna =
      annualValue(
        snaRow,
        year
      );

    const bue =
      annualValue(
        bueRow,
        year
      );

    const restoGrupoA =
      annualValue(
        groupARemainderRow,
        year
      );

    return {
      year,

      snaIndex:
        snaBase > 0
          ? (sna / snaBase) * 100
          : 0,

      bueIndex:
        bueBase > 0
          ? (bue / bueBase) * 100
          : 0,

      restoIndex:
        restoGrupoABase > 0
          ? (
              restoGrupoA /
              restoGrupoABase
            ) * 100
          : 0
    };
  });
}
function renderInternationalTerritorialChart(
  containerId,
  groupARemainderRow
) {
  const el = $(containerId);

  if (!el) return;

  const series =
    getInternationalTerritorialSeries(
      groupARemainderRow
    );


  if (!series.length) {
    el.innerHTML = "";
    return;
  }

  const width = 860;
  const height = 215;

  const margin = {
    top: 10,
    right: 100,
    bottom: 28,
    left: 36
  };

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const allValues = series.flatMap(d => [
    d.snaIndex,
    d.bueIndex,
    d.restoIndex
  ]);

  const maxValue =
    Math.max(110, Math.ceil(Math.max(...allValues) / 10) * 10);

  const minValue = 0;

  const xScale = i =>
    margin.left +
    (plotWidth * i) / (series.length - 1);

  const yScale = value =>
    margin.top +
    plotHeight -
    ((value - minValue) / (maxValue - minValue)) * plotHeight;

  const yTicks = [0, 25, 50, 75, 100];

  const snaPath = buildLinePath(
    series,
    "snaIndex",
    xScale,
    yScale
  );

  const buePath = buildLinePath(
    series,
    "bueIndex",
    xScale,
    yScale
  );

  const restoPath = buildLinePath(
    series,
    "restoIndex",
    xScale,
    yScale
  );

  const last = series[series.length - 1];
/*
  Posiciones de las etiquetas finales.
  Se ordenan verticalmente y se obliga
  a dejar una separación mínima.
*/
const endLabels = [
  {
    key: "resto",
    originalY: yScale(last.restoIndex)
  },
  {
    key: "sna",
    originalY: yScale(last.snaIndex)
  },
  {
    key: "bue",
    originalY: yScale(last.bueIndex)
  }
].sort(
  (a, b) => a.originalY - b.originalY
);

const minLabelGap = 13;

endLabels.forEach((label, index) => {
  label.y =
    index === 0
      ? label.originalY
      : Math.max(
          label.originalY,
          endLabels[index - 1].y +
            minLabelGap
        );
});

/*
  Evita que la última etiqueta salga
  por debajo del área del gráfico.
*/
const maxLabelY =
  margin.top + plotHeight - 3;

const overflow =
  endLabels[endLabels.length - 1].y -
  maxLabelY;

if (overflow > 0) {
  endLabels.forEach(label => {
    label.y -= overflow;
  });
}

const labelY = Object.fromEntries(
  endLabels.map(label => [
    label.key,
    label.y
  ])
);
  const baseY = yScale(100);
  const baseIndex = series.findIndex(d => d.year === 2019);
  const baseX = xScale(baseIndex);

  const horizontalGrid = yTicks.map(value => `
    <line
      x1="${margin.left}"
      y1="${yScale(value)}"
      x2="${width - margin.right}"
      y2="${yScale(value)}"
      class="chart-grid-line"
    ></line>

    <text
      x="${margin.left - 8}"
      y="${yScale(value) + 3}"
      text-anchor="end"
      class="chart-axis-text"
    >${value}</text>
  `).join("");

const yearLabels = series.map((d, i) => {
  return `
    <text
      x="${xScale(i)}"
      y="${height - 6}"
      text-anchor="middle"
      class="chart-axis-text"
    >${d.year}</text>
  `;
}).join("");

  const points = series.map((d, i) => `
    <circle
      cx="${xScale(i)}"
      cy="${yScale(d.snaIndex)}"
      r="2.1"
      class="chart-point-sna"
    ></circle>

    <circle
      cx="${xScale(i)}"
      cy="${yScale(d.bueIndex)}"
      r="2.1"
      class="chart-point-bue"
    ></circle>

    <circle
      cx="${xScale(i)}"
      cy="${yScale(d.restoIndex)}"
      r="2.1"
      class="chart-point-resto"
    ></circle>
  `).join("");

  el.innerHTML = `
    <svg
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-label="Evolución del tráfico internacional del SNA, AEP más EZE y resto de aeropuertos del Grupo A. Índice 2019 igual a 100."
    >
      ${horizontalGrid}

      <line
        x1="${baseX}"
        y1="${margin.top}"
        x2="${baseX}"
        y2="${margin.top + plotHeight}"
        class="chart-grid-line"
        style="stroke:#e0e6ec"
      ></line>

      <line
        x1="${margin.left}"
        y1="${baseY}"
        x2="${width - margin.right}"
        y2="${baseY}"
        class="chart-base-line"
      ></line>

      <text
        x="${baseX + 6}"
        y="${baseY - 6}"
        class="chart-base-label"
      >2019 = 100</text>

      <path d="${snaPath}" class="chart-series-sna"></path>
      <path d="${buePath}" class="chart-series-bue"></path>
      <path d="${restoPath}" class="chart-series-resto"></path>

      ${points}

      ${yearLabels}

      <text
        x="${width - margin.right + 12}"
        y="${labelY.sna}"
        class="chart-last-label-sna"
      >SNA: ${formatOneDecimal(last.snaIndex)}</text>

      <text
        x="${width - margin.right + 12}"
        y="${labelY.bue}"
        class="chart-last-label-bue"
      >AEP+EZE: ${formatOneDecimal(last.bueIndex)}</text>

      <text
        x="${width - margin.right + 12}"
        y="${labelY.resto}"
        class="chart-last-label-resto"
      >${reportRemainderName()}: ${formatOneDecimal(last.restoIndex)}</text>
    </svg>
  `;
}

function renderCabotageTerritorialChart(
  containerId,
  groupARemainderRow
) {
  const el = $(containerId);

  if (!el) return;

  const series =
    getCabotageTerritorialSeries(
      groupARemainderRow
    );

  if (!series.length) {
    el.innerHTML = "";
    return;
  }

  const width = 860;
  const height = 215;

  const margin = {
    top: 10,
    right: 140,
    bottom: 28,
    left: 36
  };

  const plotWidth =
    width -
    margin.left -
    margin.right;

  const plotHeight =
    height -
    margin.top -
    margin.bottom;

  const allValues =
    series.flatMap(row => [
      row.snaIndex,
      row.bueIndex,
      row.restoIndex
    ]);

  const maxValue = Math.max(
    110,
    Math.ceil(
      Math.max(...allValues) / 10
    ) * 10
  );

  const minValue = 0;

  const xScale = index =>
    margin.left +
    (
      plotWidth * index
    ) /
    (
      series.length - 1
    );

  const yScale = value =>
    margin.top +
    plotHeight -
    (
      (
        value - minValue
      ) /
      (
        maxValue - minValue
      )
    ) * plotHeight;

  const yTicks = [
    0,
    25,
    50,
    75,
    100
  ];

  const snaPath =
    buildLinePath(
      series,
      "snaIndex",
      xScale,
      yScale
    );

  const buePath =
    buildLinePath(
      series,
      "bueIndex",
      xScale,
      yScale
    );

  const restoPath =
    buildLinePath(
      series,
      "restoIndex",
      xScale,
      yScale
    );

  const last =
    series[series.length - 1];

  const baseY =
    yScale(100);

  const foundBaseIndex =
    series.findIndex(
      row => row.year === 2019
    );

  const baseIndex =
    foundBaseIndex >= 0
      ? foundBaseIndex
      : 0;

  const baseX =
    xScale(baseIndex);

  const horizontalGrid =
    yTicks.map(value => `
      <line
        x1="${margin.left}"
        y1="${yScale(value)}"
        x2="${width - margin.right}"
        y2="${yScale(value)}"
        class="chart-grid-line"
      ></line>

      <text
        x="${margin.left - 8}"
        y="${yScale(value) + 3}"
        text-anchor="end"
        class="chart-axis-text"
      >${value}</text>
    `).join("");

  const yearLabels =
    series.map((row, index) => `
      <text
        x="${xScale(index)}"
        y="${height - 6}"
        text-anchor="middle"
        class="chart-axis-text"
      >${row.year}</text>
    `).join("");

  const points =
    series.map((row, index) => `
      <circle
        cx="${xScale(index)}"
        cy="${yScale(row.snaIndex)}"
        r="2.1"
        class="chart-point-sna"
      ></circle>

      <circle
        cx="${xScale(index)}"
        cy="${yScale(row.bueIndex)}"
        r="2.1"
        class="chart-point-bue"
      ></circle>

      <circle
        cx="${xScale(index)}"
        cy="${yScale(row.restoIndex)}"
        r="2.1"
        class="chart-point-resto"
      ></circle>
    `).join("");

  /*
    Separación automática de las
    etiquetas finales.
  */
  const endLabels = [
    {
      key: "resto",
      originalY:
        yScale(last.restoIndex)
    },
    {
      key: "sna",
      originalY:
        yScale(last.snaIndex)
    },
    {
      key: "bue",
      originalY:
        yScale(last.bueIndex)
    }
  ].sort(
    (a, b) =>
      a.originalY -
      b.originalY
  );

  const minLabelGap = 13;

  endLabels.forEach(
    (label, index) => {
      label.y =
        index === 0
          ? label.originalY
          : Math.max(
              label.originalY,
              endLabels[index - 1].y +
                minLabelGap
            );
    }
  );

  const maxLabelY =
    margin.top +
    plotHeight -
    3;

  const overflow =
    endLabels[
      endLabels.length - 1
    ].y -
    maxLabelY;

  if (overflow > 0) {
    endLabels.forEach(label => {
      label.y -= overflow;
    });
  }

  const labelY =
    Object.fromEntries(
      endLabels.map(label => [
        label.key,
        label.y
      ])
    );

  el.innerHTML = `
    <svg
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-label="Evolución del tráfico de cabotaje del SNA, AEP más EZE y resto de aeropuertos del Grupo A. Índice 2019 igual a 100."
    >
      ${horizontalGrid}

      <line
        x1="${baseX}"
        y1="${margin.top}"
        x2="${baseX}"
        y2="${margin.top + plotHeight}"
        class="chart-grid-line"
        style="stroke:#e0e6ec"
      ></line>

      <line
        x1="${margin.left}"
        y1="${baseY}"
        x2="${width - margin.right}"
        y2="${baseY}"
        class="chart-base-line"
      ></line>

      <text
        x="${baseX + 6}"
        y="${baseY - 6}"
        class="chart-base-label"
      >2019 = 100</text>

      <path
        d="${snaPath}"
        class="chart-series-sna"
      ></path>

      <path
        d="${buePath}"
        class="chart-series-bue"
      ></path>

      <path
        d="${restoPath}"
        class="chart-series-resto"
      ></path>

      ${points}

      ${yearLabels}

      <text
        x="${width - margin.right + 12}"
        y="${labelY.sna}"
        class="chart-last-label-sna"
      >SNA: ${formatOneDecimal(last.snaIndex)}</text>

      <text
        x="${width - margin.right + 12}"
        y="${labelY.bue}"
        class="chart-last-label-bue"
      >AEP+EZE: ${formatOneDecimal(last.bueIndex)}</text>

      <text
        x="${width - margin.right + 12}"
        y="${labelY.resto}"
        class="chart-last-label-resto"
      >${reportRemainderName()}: ${formatOneDecimal(last.restoIndex)}</text>
    </svg>
  `;
}  
function renderPassengerTable(
  tableId,
  sourceRows,
  startIndex = 0,
  endIndex = null
) {
    const table = $(tableId);
    if (!table) return [];

    const rows = normalizeReportRows(
      sourceRows,
      reportConfig
    );
    const visibleRows = rows.slice(
      startIndex,
      Number.isInteger(endIndex)
        ? endIndex
        : rows.length
    );
    table.querySelector("thead").innerHTML = `
      <tr>
        <th>Aeropuerto</th>
    ${reportConfig.years
      .map(year => {
        const yearClass =
          year === reportConfig.baseYear
            ? "year-base-col"
            : year === reportConfig.lastAnnualYear
              ? "year-current-col"
              : "";
    
        return `
          <th class="${yearClass}">
            ${year}
          </th>
        `;
      })
      .join("")}
      
      ${REPORT_VARIANT.includeSemester2026
  ? `
    <th class="semester-current-col">
      1S 2026<br>
      <span class="semester-head-sub">
        vs 1S 2019
      </span>
    </th>
  `
  : ""
}
        <th>Valoración 2025/2019</th>
      </tr>
    `;

    table.querySelector("tbody").innerHTML = visibleRows
      .map(row => {
    const rowClasses = [];
    
    if (row.isMarginal) {
      rowClasses.push("marginal-volume-row");
    }
        
    if (row.isTableTotal) {
      rowClasses.push(
        "table-total-row"
      );
    }


    const normalizedValuation = String(
      row.valuation || ""
    )
      .trim()
      .toLowerCase();
    
    const isNegativeValuation =
      normalizedValuation.includes(
        "recuperación incompleta"
      ) ||
      normalizedValuation.includes(
        "muy por debajo"
      );
    
    if (isNegativeValuation) {
      rowClasses.push("negative-valuation-row");
    }
const hasClosure2025 =
  Array.isArray(row.closureEvents2025) &&
  row.closureEvents2025.length > 0;

const hasClosure2026H1 =
  REPORT_VARIANT.includeSemester2026 &&
  Array.isArray(row.closureEvents2026H1) &&
  row.closureEvents2026H1.length > 0;

if (hasClosure2025) {
  rowClasses.push(
    "airport-closure-2025-row"
  );
}
if (hasClosure2026H1) {
  rowClasses.push(
    "airport-closure-2026-row"
  );
}
return `
      <tr class="${rowClasses.join(" ")}">
        <td class="airport-name">
          ${escapeHtml(row.label)}
        
          ${
            hasClosure2025
              ? `
                <span
                  class="airport-closure-marker"
                  title="${escapeHtml(
                    row.closureEvents2025
                      .map(event =>
                        event.texto_fuente_resumido ||
                        event.motivo ||
                        ""
                      )
                      .filter(Boolean)
                      .join(" ")
                  )}"
                >*</span>
              `
              : ""
          }
          ${
  hasClosure2026H1
    ? `
      <span
        class="airport-closure-marker"
        title="${escapeHtml(
          row.closureEvents2026H1
            .map(event =>
              event.texto_fuente_resumido ||
              event.motivo ||
              ""
            )
            .filter(Boolean)
            .join(" ")
        )}"
      >**</span>
    `
    : ""
}
        </td>

            ${reportConfig.years
              .map(year => {
                const value = annualValue(
                  row.source,
                  year
                );

                const variation = annualVariation(
                  row.source,
                  year,
                  reportConfig
                );

                const yearClass =
                  year === reportConfig.baseYear
                    ? "year-base-col"
                    : year === reportConfig.lastAnnualYear
                      ? "year-current-col"
                      : "";
                
                return `
                  <td class="${yearClass}">
                    ${buildCell(
                      value,
                      variation,
                      year === reportConfig.baseYear
                    )}
                  </td>
                `;
              })
              .join("")}

            ${
  REPORT_VARIANT.includeSemester2026
    ? `
        <td class="semester-current-col">
          <span class="cell-main">
            ${fmt(row.semester2026Value)}
          </span>

          <span
            class="cell-var ${classForPct(
              row.semester2026Variation
            )}"
          >
            ${fmtPct(
              row.semester2026Variation
            )}
          </span>

          ${
            hasClosure2026H1
              ? `
                <span class="airport-closure-note">
                  ** cierre operativo en 1S 2026
                </span>
              `
              : ""
          }
        </td>
      `
    : ""
}

            <td class="valuation">
              ${escapeHtml(row.valuation)}
            
              ${
                hasClosure2025
                  ? `
                    <span class="airport-closure-note">
                      * cierre operativo en 2025
                    </span>
                  `
                  : ""
              }
            </td>
          </tr>
        `;
      })
      .join("");

    return rows;
  }

function topLabels(
  rows,
  predicate
) {
  return (rows || [])
    .filter(row =>
      /*
        Solo aeropuertos individuales.
        Se excluyen agregados, totales
        y registros de volumen marginal.
      */
      !row.isSna &&
      !row.isBue &&
      !row.isMarginal &&
      !row.isTableTotal &&
      !row.source?.es_grupo_a_resto
    )
    .filter(predicate)
    .map(row =>
      row.shortLabel || row.label
    );
}

  function marginalLabels(rows, limit = 10) {
    return (rows || [])
        .filter(row =>
          row.isMarginal &&
          !row.isSna &&
          !row.isBue &&
          !row.isTableTotal
        )
      .slice(0, limit)
      .map(row =>
      row.shortLabel || row.label
    );
  }

function renderConclusions(
  cabRows,
  intRows
) {
  const cabWide = topLabels(
    cabRows,
    row =>
      Number(row.currentVariation) >= 20
  );

  const cabMild = topLabels(
    cabRows,
    row =>
      Number(row.currentVariation) >= 0 &&
      Number(row.currentVariation) < 20
  );

  const cabNotRecovered = topLabels(
    cabRows,
    row =>
      Number(row.currentVariation) < 0
  );

  const intRecovered = topLabels(
    intRows,
    row =>
      Number(row.currentVariation) >= 0
  );

  const intNotRecovered = topLabels(
    intRows,
    row =>
      Number(row.currentVariation) < 0
  );


  const cabConclusions =
    $("cabConclusions");

  if (cabConclusions) {
    cabConclusions.innerHTML = `
      <p>
        <strong>Recuperación amplia:</strong>
        ${
          cabWide.length
            ? escapeHtml(
                cabWide.join("; ")
              )
            : "sin casos destacados"
        }.
      </p>

      <p>
        <strong>Recuperación leve o nivelación:</strong>
        ${
          cabMild.length
            ? escapeHtml(
                cabMild.join("; ")
              )
            : "sin casos destacados"
        }.
      </p>

      <p>
        <strong>Recuperación incompleta en ${reportConfig.lastAnnualYear}:</strong>
        ${
          cabNotRecovered.length
            ? escapeHtml(
                cabNotRecovered.join("; ")
              )
            : "sin casos destacados"
        }.
      </p>
    `;
  }


  const intConclusions =
    $("intConclusions");

  if (intConclusions) {
    intConclusions.innerHTML = `
      <p>
        <strong>Recuperación amplia internacional:</strong>
        ${
          intRecovered.length
            ? escapeHtml(
                intRecovered.join("; ")
              )
            : "sin casos destacados"
        }.
      </p>

      <p>
        <strong>Internacional aún por debajo de ${reportConfig.baseYear}:</strong>
        ${
          intNotRecovered.length
            ? escapeHtml(
                intNotRecovered.join("; ")
              )
            : "sin casos destacados"
        }.
      </p>
    `;
  }


  const cabSummary =
    $("cabSummaryText");

  if (cabSummary) {
    const sna = cabRows.find(
      row => row.isSna
    );

    const bue = cabRows.find(
      row => row.isBue
    );

    
cabSummary.innerHTML =
  (
    sna
      ? `En el SNA, el cabotaje ${reportConfig.lastAnnualYear} muestra <strong class="${classForPct(sna.currentVariation)}">${fmtPct(sna.currentVariation)}</strong> respecto de ${reportConfig.baseYear}. `
      : ""
  ) +
  (
    bue
      ? `Para AEP+EZE, la variación ${reportConfig.lastAnnualYear}/${reportConfig.baseYear} es <strong class="${classForPct(bue.currentVariation)}">${fmtPct(bue.currentVariation)}</strong>. `
      : ""
  ) +
  (
    REPORT_VARIANT.includeSemester2026 &&
    sna &&
    bue
      ? `En el 1S 2026, frente al 1S 2019, las variaciones son <strong class="${classForPct(sna.semester2026Variation)}">${fmtPct(sna.semester2026Variation)}</strong> en el SNA y <strong class="${classForPct(bue.semester2026Variation)}">${fmtPct(bue.semester2026Variation)}</strong> en AEP+EZE. `
      : ""
  ) +
  (
    REPORT_VARIANT.includeSemester2026
      ? `La valoración corresponde a 2025/2019; el primer semestre de 2026 se presenta como comparación adicional.`
      : `La tabla sintetiza la recuperación del cabotaje en ${reportConfig.lastAnnualYear} tomando ${reportConfig.baseYear} como base.`
  );
}

  const intSummary =
    $("intSummaryText");

  if (intSummary) {
    const sna = intRows.find(
      row => row.isSna
    );

    const bue = intRows.find(
      row => row.isBue
    );

    intSummary.innerHTML =
      (
        sna
          ? `En el SNA, el tráfico internacional ${reportConfig.lastAnnualYear} registra <strong class="${classForPct(sna.currentVariation)}">${fmtPct(sna.currentVariation)}</strong> respecto de ${reportConfig.baseYear}. `
          : ""
      ) +
      (
        bue
          ? `En AEP+EZE, la lectura conjunta muestra una variación de <strong class="${classForPct(bue.currentVariation)}">${fmtPct(bue.currentVariation)}</strong> en ${reportConfig.lastAnnualYear} respecto de ${reportConfig.baseYear}. `
          : ""
      ) +
      (
        REPORT_VARIANT.includeSemester2026 &&
        sna &&
        bue
          ? `En el 1S 2026, frente al 1S 2019, las variaciones son <strong class="${classForPct(sna.semester2026Variation)}">${fmtPct(sna.semester2026Variation)}</strong> en el SNA y <strong class="${classForPct(bue.semester2026Variation)}">${fmtPct(bue.semester2026Variation)}</strong> en AEP+EZE. `
          : ""
      ) +
      (
        REPORT_VARIANT.includeSemester2026
          ? `La valoración corresponde a 2025/2019; el primer semestre de 2026 se presenta como comparación adicional.`
          : ""
      );
  }
}
  function validateReportData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("El archivo JSON no contiene un objeto válido");
    }

    if (!Array.isArray(data?.tablas?.cabotaje)) {
      throw new Error("El JSON no contiene tablas.cabotaje");
    }

    if (!Array.isArray(data?.tablas?.internacional)) {
      throw new Error("El JSON no contiene tablas.internacional");        
    }
  }

function renderReport(data) {
  validateReportData(data);

  reportData = data;
  reportConfig =
    buildReportConfig(data);


/*
  Cabotaje:
  Grupo A + agregados SNA y AEP+EZE.
*/
const visibleCabotageRows =
  data.tablas.cabotaje.filter(
    isVisibleAirportRow
  );


/*
  Referencias generales:
  SNA y AEP+EZE.
*/
const cabotageAggregateRows =
  visibleCabotageRows.filter(
    row =>
      row.es_sna ||
      row.es_aep_eze
  );


/*
  Aeropuertos individuales del Grupo A.
  No incluye las filas agregadas.
*/
const cabotageAirportRows =
  visibleCabotageRows.filter(
    row =>
      !row.es_sna &&
      !row.es_aep_eze
  );


/*
  Resto del Grupo A:
  suma de los aeropuertos individuales,
  excluyendo AEP y EZE.
*/
const cabotageGroupARemainderRow =
  buildGroupARemainderRow(
    cabotageAirportRows,
    "cabotaje"
  );


/*
  Filas de la tabla síntesis:
  SNA + AEP/EZE + Resto Grupo A.
*/
const cabotageSummaryRows = [
  ...cabotageAggregateRows,

  ...(
    cabotageGroupARemainderRow
      ? [cabotageGroupARemainderRow]
      : []
  )
];


  /*
    Render de la tabla síntesis de cabotaje.
  */
  const cabAggregateRows =
    renderPassengerTable(
      "cabAggregatesTable",
      cabotageSummaryRows
    );
  /*
    Gráfico territorial de cabotaje.
  */
  renderCabotageTerritorialChart(
    "cabTerritorialChart",
    cabotageGroupARemainderRow
  );
  
  /*
    Total de los aeropuertos individuales
    mostrados en la tabla principal.
  */
  const cabotageTotalRow =
  
  buildAirportTableTotalRow(
    cabotageAirportRows,
    "cabotaje"
  );


/*
  Aeropuertos individuales + Total.
*/
const cabotageTableRows = [
  ...cabotageAirportRows,

  ...(
    cabotageTotalRow
      ? [cabotageTotalRow]
      : []
  )
];


/*
  Página principal de cabotaje.
*/
const cabAirportRows =
  renderPassengerTable(
    "cabTable",
    cabotageTableRows,
    0,
    CAB_ROWS_FIRST_PAGE
  );


/*
  Páginas de continuación de cabotaje.
*/
if (isSnaScope()) {

  /*
    En la versión SNA se divide
    la continuación en dos páginas.
  */
  const start1 =
    CAB_ROWS_FIRST_PAGE;

  const end1 =
    start1 +
    CAB_ROWS_CONTINUATION_SNA;

  const start2 =
    end1;


  /*
    Primera página de continuación.
  */
  renderPassengerTable(
    "cabTableContinuation",
    cabotageTableRows,
    start1,
    end1
  );


  /*
    Segunda página de continuación.
    Recibe todos los aeropuertos restantes.
  */
  renderPassengerTable(
    "cabTableContinuation2",
    cabotageTableRows,
    start2
  );


  /*
    Mostrar u ocultar
    la primera continuación.
  */
  const continuationSheet1 =
    $("cabTableContinuation")
      ?.closest(".sheet-a4");

  if (continuationSheet1) {
    continuationSheet1.style.display =
      cabAirportRows.length > start1
        ? ""
        : "none";
  }


  /*
    Mostrar u ocultar
    la segunda continuación.
  */
  const continuationSheet2 =
    $("cabTableContinuation2")
      ?.closest(".sheet-a4");

  if (continuationSheet2) {
    continuationSheet2.style.display =
      cabAirportRows.length > start2
        ? ""
        : "none";
  }

} else {

  /*
    Las versiones Grupo A conservan
    exactamente el funcionamiento actual.
  */
  renderPassengerTable(
    "cabTableContinuation",
    cabotageTableRows,
    CAB_ROWS_FIRST_PAGE
  );


  const continuationSheet =
    $("cabTableContinuation")
      ?.closest(".sheet-a4");

  if (continuationSheet) {
    continuationSheet.style.display =
      cabAirportRows.length >
      CAB_ROWS_FIRST_PAGE
        ? ""
        : "none";
  }
}


/*
  Filas utilizadas en las conclusiones.

  Se incluyen:
  - SNA;
  - AEP+EZE;
  - aeropuertos individuales.

  Se excluyen:
  - Resto Grupo A;
  - fila Total.
*/
/*
  Normalización de todos los aeropuertos
  individuales, sin depender de la
  paginación de la tabla.
*/
const cabAllAirportRows =
  normalizeReportRows(
    cabotageAirportRows,
    reportConfig
  );


const cabRows = [
  /*
    SNA y AEP+EZE se conservan para
    construir el texto general.
  */
  ...cabAggregateRows.filter(
    row =>
      row.isSna ||
      row.isBue
  ),

  /*
    Todos los aeropuertos individuales.
    topLabels excluirá los marginales.
  */
  ...cabAllAirportRows
];


  /*
    Internacional:
    Grupo A + agregados,
    sin EPA ni volumen marginal.
  */
  const significantInternationalRows =
    data.tablas.internacional.filter(
      row => {
        const iata = String(
          row?.iata || ""
        )
          .trim()
          .toUpperCase();

        return (
          isVisibleAirportRow(row) &&
          iata !== "EPA" &&
          !isMarginalRow(
            row,
            reportConfig
          )
        );
      }
    );


/*
  Referencias generales:
  SNA y AEP+EZE.
*/
const internationalAggregateRows =
  significantInternationalRows.filter(
    row =>
      row.es_sna ||
      row.es_aep_eze
  );


/*
  Aeropuertos individuales:
  actualmente solamente Grupo A.
*/
const internationalAirportRows =
  significantInternationalRows.filter(
    row =>
      !row.es_sna &&
      !row.es_aep_eze
  );

const internationalTotalRow =
  buildAirportTableTotalRow(
    internationalAirportRows,
    "internacional"
  );

const internationalAirportRowsWithTotal = [
  ...internationalAirportRows,

  ...(
    internationalTotalRow
      ? [internationalTotalRow]
      : []
  )
];
  
/*
  Suma de los aeropuertos individuales
  del Grupo A, excluidos AEP y EZE.
*/
const groupARemainderRow =
  buildGroupARemainderRow(
    internationalAirportRows,
    "internacional"
  );


const internationalSummaryRows = [
  ...internationalAggregateRows,

  ...(
    groupARemainderRow
      ? [groupARemainderRow]
      : []
  )
];

/*
  Tabla superior de referencias.
*/
const intAggregateRows =
  renderPassengerTable(
    "intAggregatesTable",
    internationalSummaryRows
  );


/*
  Tabla principal de aeropuertos.
*/
const intAirportRows =
  renderPassengerTable(
    "intTable",
    internationalAirportRowsWithTotal,
    0,
    isSnaScope()
      ? INT_ROWS_FIRST_PAGE_SNA
      : null
  );

if (isSnaScope()) {
  renderPassengerTable(
    "intTableContinuation",
    internationalAirportRowsWithTotal,
    INT_ROWS_FIRST_PAGE_SNA
  );
}


/*
  Las conclusiones necesitan conservar
  tanto los agregados como los aeropuertos.
*/
const intRows = [
  ...intAggregateRows.filter(
    row =>
      row.isSna ||
      row.isBue
  ),

  ...intAirportRows.filter(
    row =>
      !row.isTableTotal
  )
];


renderConclusions(
  cabRows,
  intRows
);


  /*
    El gráfico continúa representando
    SNA, AEP+EZE y resto del sistema.
  */
  renderInternationalTerritorialChart(
    "intlTerritorialChart",
    groupARemainderRow
  );


  return {
    cabRows,
    intRows
  };
}

  async function exportPdfA4() {
    const pages = Array.from(
      document.querySelectorAll(".sheet-a4")
    );

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
      document.documentElement.classList.add(
        "pdf-exporting"
      );
      document.body.classList.add(
        "pdf-exporting"
      );

      await new Promise(resolve =>
        setTimeout(resolve, 350)
      );

      if (
        !window.html2canvas ||
        !window.jspdf?.jsPDF
      ) {
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
        const canvas = await window.html2canvas(
          pages[i],
          {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            scrollX: 0,
            scrollY: 0,
            windowWidth: pages[i].scrollWidth,
            windowHeight: pages[i].scrollHeight
          }
        );

        const imgData = canvas.toDataURL(
          "image/jpeg",
          0.98
        );

        if (i > 0) {
          pdf.addPage("a4", "portrait");
        }

        pdf.addImage(
          imgData,
          "JPEG",
          0,
          0,
          210,
          297
        );
      }

      pdf.save(
        REPORT_VARIANT.pdfFileName
      );
    } catch (err) {
      console.error(
        "Error exportando PDF A4:",
        err
      );
      window.print();
    } finally {
      document.documentElement.classList.remove(
        "pdf-exporting"
      );
      document.body.classList.remove(
        "pdf-exporting"
      );

      if (btn) {
        btn.disabled = false;
        btn.textContent = "Descargar PDF A4";
      }
    }
  }

  async function load() {
    try {
      setStatus(
        "Cargando datos de recuperación…",
        "warn"
      );

const [
  data,
  airportsGeojson,
  airportClosures
] = await Promise.all([
  fetchJson(DATA_PATH),
  fetchJson(AIRPORTS_PATH),
  fetchJson(CLOSURES_PATH)
]);

airportNameByIata =
  buildAirportNameIndex(
    airportsGeojson
  );

airportGroupByIata =
  buildAirportGroupIndex(
    airportsGeojson
  );
      
airportClosure2025ByIata =
  buildAirportClosure2025Index(
    airportClosures
  );
airportClosure2026H1ByIata =
  buildAirportClosure2026H1Index(
    airportClosures
  );
renderReportVariant();
renderReport(data);

setStatus("");
    } catch (err) {
      console.error(err);

      setStatus(
        `Error al cargar el informe: ${escapeHtml(err.message || err)}.`,
        "err"
      );
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const btn = $("btnPdf");

      if (btn) {
        btn.addEventListener(
          "click",
          exportPdfA4
        );
      }

      load();
    }
  );
})();
