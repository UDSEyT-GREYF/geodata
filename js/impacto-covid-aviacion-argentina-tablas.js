(() => {
  "use strict";

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
  /*
    Una variación porcentual se considera no representativa cuando
    tanto el año base como el último año anual tienen menos de
    1.000 pasajeros en ese segmento.

    El umbral queda centralizado para poder modificarlo fácilmente.
  */
  const MARGINAL_MAX_ANNUAL_PAX = 1000;
  const MARGINAL_LABEL = "Volumen marginal";
  const CAB_ROWS_FIRST_PAGE = 18;
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
  
  const $ = id => document.getElementById(id);

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
      "Resto de aeropuertos del Grupo A",

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
      "Total aeropuertos del Grupo A",

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
  
  function valuationText(row, config = reportConfig) {
    if (isMarginalRow(row, config)) {
      return MARGINAL_LABEL;
    }

const storedValuation = String(
  row?.valoracion || ""
).trim();

const hasSemesterReference =
  /2026|1\s*S|primer\s+semestre/i
    .test(storedValuation);

/*
  Se conserva la valoración almacenada
  solamente cuando no contiene referencias
  al período semestral eliminado.
*/
if (
  storedValuation &&
  !hasSemesterReference
) {
  return storedValuation;
}

    const annualVar = annualVariation(
      row,
      config.lastAnnualYear,
      config
    );

    if (!Number.isFinite(annualVar)) {
      return `Sin base ${config.baseYear}`;
    }

    if (annualVar >= 20) return "Recuperación amplia";
    if (annualVar >= 10) return "Recuperación clara";
    if (annualVar >= 3) return "Recuperación leve";
    if (annualVar >= -3) return `Igualó el nivel de ${config.baseYear}`;
    if (annualVar >= -20) return "Recuperación incompleta";
    return `Muy por debajo de ${config.baseYear}`;
  }

  function normalizeReportRows(rows, config = reportConfig) {
    return (rows || [])
      .map(row => ({
        source: row,
        iata: String(row?.iata || "").trim().toUpperCase(),
        label: rowLabel(row),
        shortLabel: conclusionLabel(row),
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
        y="${yScale(last.snaIndex) - 8}"
        class="chart-last-label-sna"
      >SNA: ${formatOneDecimal(last.snaIndex)}</text>

      <text
        x="${width - margin.right + 12}"
        y="${yScale(last.bueIndex) + 2}"
        class="chart-last-label-bue"
      >AEP+EZE: ${formatOneDecimal(last.bueIndex)}</text>

      <text
        x="${width - margin.right + 12}"
        y="${yScale(last.restoIndex) + 12}"
        class="chart-last-label-resto"
      >Resto Grupo A: ${formatOneDecimal(last.restoIndex)}</text>
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
    
    return `
      <tr class="${rowClasses.join(" ")}">
            <td class="airport-name">
              ${escapeHtml(row.label)}
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


            <td class="valuation">
              ${escapeHtml(row.valuation)}
            </td>
          </tr>
        `;
      })
      .join("");

    return rows;
  }

  function topLabels(
    rows,
    predicate,
    limit = 6
  ) {
    return (rows || [])
      .filter(row =>
        !row.isSna &&
        !row.isBue &&
        !row.isMarginal &&
        !row.isTableTotal
      )
      .filter(predicate)
      .slice(0, limit)
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
        <strong>Recuperación internacional:</strong>
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
      `La tabla sintetiza la recuperación del cabotaje en ${reportConfig.lastAnnualYear} tomando ${reportConfig.baseYear} como base.`;
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
      `La tabla sintetiza la recuperación del tráfico internacional en ${reportConfig.lastAnnualYear} tomando ${reportConfig.baseYear} como base.`;
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
  Página de continuación de cabotaje.
*/
renderPassengerTable(
  "cabTableContinuation",
  cabotageTableRows,
  CAB_ROWS_FIRST_PAGE
);


/*
  Ocultar la página de continuación
  cuando todas las filas entran
  en la página principal.
*/
const continuationTable =
  $("cabTableContinuation");

const continuationSheet =
  continuationTable?.closest(
    ".sheet-a4"
  );

if (continuationSheet) {
  continuationSheet.style.display =
    cabAirportRows.length >
    CAB_ROWS_FIRST_PAGE
      ? ""
      : "none";
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
const cabRows = [
  ...cabAggregateRows.filter(
    row =>
      row.isSna ||
      row.isBue
  ),

  ...cabAirportRows.filter(
    row =>
      !row.isTableTotal
  )
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
    internationalAirportRowsWithTotal
  );


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
        "impacto_covid_aviacion_argentina_pasajeros_a4.pdf"
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
  airportsGeojson
] = await Promise.all([
  fetchJson(DATA_PATH),
  fetchJson(AIRPORTS_PATH)
]);

airportNameByIata =
  buildAirportNameIndex(
    airportsGeojson
  );

airportGroupByIata =
  buildAirportGroupIndex(
    airportsGeojson
  );

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
