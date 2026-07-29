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

  /*
    Una variación porcentual se considera no representativa cuando
    tanto el año base como el último año anual tienen menos de
    1.000 pasajeros en ese segmento.

    El umbral queda centralizado para poder modificarlo fácilmente.
  */
  const MARGINAL_MAX_ANNUAL_PAX = 1000;
  const MARGINAL_LABEL = "Volumen marginal: variación no representativa";

  let reportData = null;
  let reportConfig = null;

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
    const parametros = data?.parametros || {};
    const allRows = [
      ...(data?.tablas?.cabotaje || []),
      ...(data?.tablas?.internacional || [])
    ];

    const availableYears = getAnnualYearsFromRows(allRows);

    const baseYear =
      Number(metadata.base_anual) ||
      Number(parametros.h1_base_year) ||
      2019;

    const lastAnnualYear =
      extractYearFromText(metadata.comparacion_anual, "first") ||
      availableYears[availableYears.length - 1] ||
      2025;

    const h1BaseYear =
      Number(parametros.h1_base_year) ||
      extractYearFromText(metadata.periodo_semestre, "last") ||
      baseYear;

    const h1CompareYear =
      Number(parametros.h1_compare_year) ||
      extractYearFromText(metadata.periodo_semestre, "first") ||
      2026;

    /*
      El informe de recuperación muestra desde el año base.
      Aunque el JSON conserve 2015-2018, no se agregan columnas
      anteriores a 2019 en estas tablas.
    */
    const years = availableYears.filter(
      year => year >= baseYear && year <= lastAnnualYear
    );

    return {
      baseYear,
      lastAnnualYear,
      h1BaseYear,
      h1CompareYear,
      h1Label: `${h1CompareYear} 1S`,
      years: years.length
        ? years
        : Array.from(
            { length: lastAnnualYear - baseYear + 1 },
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

  function h1BaseValue(row, config = reportConfig) {
    return Number(row?.[`pax_${config.h1BaseYear}_1s`]) || 0;
  }

  function h1CurrentValue(row, config = reportConfig) {
    return Number(row?.[`pax_${config.h1CompareYear}_1s`]) || 0;
  }

  function h1Variation(row, config = reportConfig) {
    const stored = Number(
      row?.[`var_${config.h1CompareYear}_1s`]
    );

    if (Number.isFinite(stored)) return stored;

    return pct(
      h1CurrentValue(row, config),
      h1BaseValue(row, config)
    );
  }

  function isSpecialAggregate(row) {
    return !!row?.es_sna || !!row?.es_aep_eze;
  }

  function isMarginalRow(row, config = reportConfig) {
    if (!row || isSpecialAggregate(row)) return false;

    /*
      Si futuros JSON ya incluyen la marca, se respeta.
      Mientras tanto, se calcula con los valores incluidos.
    */
    if (row.es_volumen_marginal === true) return true;

    const base = annualValue(row, config.baseYear);
    const current = annualValue(row, config.lastAnnualYear);

    return (
      base < MARGINAL_MAX_ANNUAL_PAX &&
      current < MARGINAL_MAX_ANNUAL_PAX
    );
  }

function rowLabel(row) {
  const rawName = String(
    row?.aeropuerto || row?.iata || ""
  ).trim();

  const iata = String(
    row?.iata || ""
  ).trim().toUpperCase();

  /*
    Casos agregados:
    conservan su denominación actual.
  */
  if (iata === "SNA" || iata === "BUE") {
    return rawName;
  }

  /*
    Excepción solicitada para Aeroparque.
  */
  if (iata === "AEP") {
    return "Aeroparque Jorge Newbery";
  }

  /*
    Quita el código IATA final:
    (COR), (MDZ), (BRC), etc.
  */
  let shortName = rawName.replace(
    /\s*\([A-Z0-9]{2,4}\)\s*$/i,
    ""
  );

  /*
    Conserva solo lo anterior al guion:
    "Aeropuerto de Córdoba – Ing. A. Taravella"
    pasa a:
    "Aeropuerto de Córdoba"
  */
  shortName = shortName
    .split(/\s+[–—-]\s+/)[0]
    .trim();

  return shortName || rawName;
}

  function valuationText(row, config = reportConfig) {
    if (isMarginalRow(row, config)) {
      return MARGINAL_LABEL;
    }

    if (String(row?.valoracion || "").trim()) {
      return String(row.valoracion).trim();
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
        isSna: !!row?.es_sna,
        isBue: !!row?.es_aep_eze,
        isMarginal: isMarginalRow(row, config),
        currentValue: annualValue(row, config.lastAnnualYear),
        currentVariation: annualVariation(
          row,
          config.lastAnnualYear,
          config
        ),
        h1Value: h1CurrentValue(row, config),
        h1Variation: h1Variation(row, config),
        valuation: valuationText(row, config)
      }))
      .filter(row => {
        const base = annualValue(row.source, config.baseYear);

        return (
          base > 0 ||
          row.currentValue > 0 ||
          row.h1Value > 0
        );
      })
      .sort((a, b) => {
        if (a.isSna !== b.isSna) return a.isSna ? -1 : 1;
        if (a.isBue !== b.isBue) return a.isBue ? -1 : 1;
        return b.currentValue - a.currentValue;
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

  function renderPassengerTable(
    tableId,
    sourceRows
  ) {
    const table = $(tableId);
    if (!table) return [];

    const rows = normalizeReportRows(
      sourceRows,
      reportConfig
    );

    table.querySelector("thead").innerHTML = `
      <tr>
        <th>Aeropuerto</th>
        ${reportConfig.years
          .map(year => `<th>${year}</th>`)
          .join("")}
        <th>${reportConfig.h1Label}</th>
        <th>Valoración 2025/2019</th>
      </tr>
    `;

    table.querySelector("tbody").innerHTML = rows
      .map(row => {
        const marginalClass =
          row.isMarginal
            ? " marginal-volume-row"
            : "";

        return `
          <tr class="${marginalClass.trim()}">
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

                return `
                  <td>
                    ${buildCell(
                      value,
                      variation,
                      year === reportConfig.baseYear
                    )}
                  </td>
                `;
              })
              .join("")}

            <td>
              ${buildCell(
                row.h1Value,
                row.h1Variation,
                false
              )}
            </td>

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
        !row.isMarginal
      )
      .filter(predicate)
      .slice(0, limit)
      .map(row => row.label);
  }

  function marginalLabels(rows, limit = 10) {
    return (rows || [])
      .filter(row =>
        row.isMarginal &&
        !row.isSna &&
        !row.isBue
      )
      .slice(0, limit)
      .map(row => row.label);
  }

  function renderConclusions(cabRows, intRows) {
    const cabWide = topLabels(
      cabRows,
      row => Number(row.currentVariation) >= 20
    );

    const cabMild = topLabels(
      cabRows,
      row =>
        Number(row.currentVariation) >= 0 &&
        Number(row.currentVariation) < 20
    );

    const cabNotRecovered = topLabels(
      cabRows,
      row => Number(row.currentVariation) < 0
    );

    const cabFallBack = topLabels(
      cabRows,
      row =>
        Number(row.currentVariation) >= 0 &&
        Number(row.h1Variation) < -5
    );

    const cabMarginal = marginalLabels(cabRows);

    const intRecovered = topLabels(
      intRows,
      row => Number(row.currentVariation) >= 0
    );

    const intNotRecovered = topLabels(
      intRows,
      row => Number(row.currentVariation) < 0
    );

    const intFallBack = topLabels(
      intRows,
      row =>
        Number(row.currentVariation) >= 0 &&
        Number(row.h1Variation) < -5
    );

    const intMarginal = marginalLabels(intRows);

const cabConclusions = $("cabConclusions");

if (cabConclusions) {
  cabConclusions.innerHTML = `
    <p>
      <strong>Recuperación amplia:</strong>
      ${
        cabWide.length
          ? escapeHtml(cabWide.join("; "))
          : "sin casos destacados"
      }.
    </p>

    <p>
      <strong>Recuperación leve o nivelación:</strong>
      ${
        cabMild.length
          ? escapeHtml(cabMild.join("; "))
          : "sin casos destacados"
      }.
    </p>

    <p>
      <strong>Recuperación incompleta en ${reportConfig.lastAnnualYear}:</strong>
      ${
        cabNotRecovered.length
          ? escapeHtml(cabNotRecovered.join("; "))
          : "sin casos destacados"
      }.
    </p>

    <p>
      <strong>Alerta ${reportConfig.h1Label}:</strong>
      ${
        cabFallBack.length
          ? `recuperaron en ${reportConfig.lastAnnualYear} pero vuelven a caer frente al primer semestre de ${reportConfig.h1BaseYear}: ${escapeHtml(cabFallBack.join("; "))}.`
          : "no se observan retrocesos marcados entre los casos recuperados."
      }
    </p>
  `;
}

const intConclusions = $("intConclusions");

if (intConclusions) {
  intConclusions.innerHTML = `
    <p>
      <strong>Recuperación internacional:</strong>
      ${
        intRecovered.length
          ? escapeHtml(intRecovered.join("; "))
          : "sin casos destacados"
      }.
    </p>

    <p>
      <strong>Internacional aún por debajo de ${reportConfig.baseYear}:</strong>
      ${
        intNotRecovered.length
          ? escapeHtml(intNotRecovered.join("; "))
          : "sin casos destacados"
      }.
    </p>

    <p>
      <strong>Alerta ${reportConfig.h1Label}:</strong>
      ${
        intFallBack.length
          ? `casos recuperados en ${reportConfig.lastAnnualYear} que muestran retroceso frente al primer semestre de ${reportConfig.h1BaseYear}: ${escapeHtml(intFallBack.join("; "))}.`
          : "sin retrocesos marcados en los casos recuperados."
      }
    </p>
  `;
}

    const cabSummary = $("cabSummaryText");
    if (cabSummary) {
      const sna = cabRows.find(row => row.isSna);
      const bue = cabRows.find(row => row.isBue);

      cabSummary.innerHTML =
        `La tabla sintetiza la recuperación del cabotaje tomando ${reportConfig.baseYear} como base. ` +
        (
          sna
            ? `En el SNA, el cabotaje ${reportConfig.lastAnnualYear} muestra <strong class="${classForPct(sna.currentVariation)}">${fmtPct(sna.currentVariation)}</strong> respecto de ${reportConfig.baseYear}. `
            : ""
        ) +
        (
          bue
            ? `Para AEP+EZE, la variación ${reportConfig.lastAnnualYear}/${reportConfig.baseYear} es <strong class="${classForPct(bue.currentVariation)}">${fmtPct(bue.currentVariation)}</strong>.`
            : ""
        );
    }

const intSummary = $("intSummaryText");

if (intSummary) {
  const sna = intRows.find(row => row.isSna);
  const bue = intRows.find(row => row.isBue);

  intSummary.innerHTML =
    (
      sna
        ? `En el SNA, el tráfico internacional ${reportConfig.lastAnnualYear} registra <strong class="${classForPct(sna.currentVariation)}">${fmtPct(sna.currentVariation)}</strong> respecto de ${reportConfig.baseYear}. `
        : ""
    ) +
    (
      bue
        ? `En AEP+EZE, la lectura conjunta muestra una variación de <strong class="${classForPct(bue.currentVariation)}">${fmtPct(bue.currentVariation)}</strong> en ${reportConfig.lastAnnualYear} respecto de ${reportConfig.baseYear}.`
        : ""
    );
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
    reportConfig = buildReportConfig(data);

    const cabRows = renderPassengerTable(
      "cabTable",
      data.tablas.cabotaje
    );

    const intRows = renderPassengerTable(
      "intTable",
      data.tablas.internacional
    );

    renderConclusions(cabRows, intRows);

    return { cabRows, intRows };
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

      const data = await fetchJson(DATA_PATH);
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
