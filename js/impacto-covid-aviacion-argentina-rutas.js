(() => {
  "use strict";

  const DATA_PATH = "data/recuperacion_postpandemia_rutas.json";
  const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const MAIN_ROUTE_THRESHOLD = 150000;
  const ROWS_FIRST_PAGE = 7;

  let reportData = null;

  const $ = id => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "–";
    return v.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }

  function fmtPct(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "–";
    const sign = v > 0 ? "+" : "";
    return sign + v.toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + "%";
  }

  function classForPct(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "";
    return v >= 0 ? "good" : "bad";
  }

  function setStatus(message, type = "ok") {
    const el = $("status");
    if (!el) return;
    if (!message) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "";
    el.className = `status ${type}`;
    el.textContent = message;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${url}: HTTP ${response.status}`);
    }
    return response.json();
  }

  function principalRows(segmento) {
    return (reportData?.rutas || [])
      .filter(row =>
        row.segmento === segmento &&
        (
          Number(row.pax_2019) >= MAIN_ROUTE_THRESHOLD ||
          Number(row.pax_2025) >= MAIN_ROUTE_THRESHOLD
        )
      )
      .sort((a, b) => Number(b.pax_2025) - Number(a.pax_2025));
  }

  function buildCell(value, variation, isBase = false) {
    return `
      <span class="cell-main">${fmt(value)}</span>
      <span class="cell-var ${isBase ? "cell-base" : classForPct(variation)}">
        ${isBase ? "base 2019" : fmtPct(variation)}
      </span>
    `;
  }

  function renderRouteTable(tableId, rows, start = 0, end = null) {
    const table = $(tableId);
    if (!table) return;

    const visible = rows.slice(start, Number.isInteger(end) ? end : rows.length);

    table.querySelector("thead").innerHTML = `
      <tr>
        <th>Ruta</th>
        ${YEARS.map(year => `
          <th class="${year === 2019 ? "year-base-col" : year === 2025 ? "year-current-col" : ""}">
            ${year}
          </th>
        `).join("")}
        <th class="semester-current-col">
          1S 2026<br>
          <span class="semester-head-sub">vs 1S 2019</span>
        </th>
        <th>Valoración 2025/2019</th>
      </tr>
    `;

    table.querySelector("tbody").innerHTML = visible.map(row => `
      <tr class="${Number(row.var_2025) < -3 ? "negative-valuation-row" : ""}">
        <td class="airport-name route-name">${escapeHtml(displayRoute(row.ruta))}</td>
        ${YEARS.map(year => {
          const value = Number(row[`pax_${year}`]) || 0;
          const base = Number(row.pax_2019) || 0;
          const variation = base ? ((value / base) - 1) * 100 : NaN;
          return `
            <td class="${year === 2019 ? "year-base-col" : year === 2025 ? "year-current-col" : ""}">
              ${buildCell(value, variation, year === 2019)}
            </td>
          `;
        }).join("")}
        <td class="semester-current-col">
          <span class="cell-main">${fmt(row.pax_2026_1s)}</span>
          <span class="cell-var ${classForPct(row.var_2026_1s)}">${fmtPct(row.var_2026_1s)}</span>
        </td>
        <td class="valuation">${escapeHtml(row.valoracion)}</td>
      </tr>
    `).join("");
  }

  function displayRoute(label) {
    return String(label ?? "")
      .replace(/Región Buenos Aires/gi, "Buenos Aires");
  }

  function shortRoute(label) {
    return displayRoute(label)
      .replace(/\s*-\s*/g, " – ");
  }

  function renderIndexChart(containerId, rows) {
    const el = $(containerId);
    if (!el) return;

    const top = rows.slice(0, 10);
    if (!top.length) {
      el.innerHTML = "";
      return;
    }

    const width = 860;
    const height = 330;
    const margin = { top: 20, right: 52, bottom: 34, left: 225 };
    const plotWidth = width - margin.left - margin.right;
    const rowHeight = (height - margin.top - margin.bottom) / top.length;

    const indices = top.map(row => {
      const base = Number(row.pax_2019) || 0;
      const current = Number(row.pax_2025) || 0;
      return base ? current / base * 100 : 0;
    });

    const maxValue = Math.max(120, Math.ceil(Math.max(...indices) / 50) * 50);
    const x = value => margin.left + (value / maxValue) * plotWidth;
    const baseX = x(100);

    const ticks = [];
    for (let t = 0; t <= maxValue; t += 50) ticks.push(t);

    el.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img"
        aria-label="Índice 2025 respecto de 2019 para las diez principales rutas por pasajeros de 2025.">
        ${ticks.map(t => `
          <line x1="${x(t)}" y1="${margin.top - 6}" x2="${x(t)}" y2="${height - margin.bottom}"
            class="route-chart-grid"></line>
          <text x="${x(t)}" y="${height - 10}" text-anchor="middle"
            class="chart-axis-text">${t}</text>
        `).join("")}

        <line x1="${baseX}" y1="${margin.top - 6}" x2="${baseX}" y2="${height - margin.bottom}"
          class="chart-base-line"></line>
        <text x="${baseX + 5}" y="${margin.top - 7}" class="chart-base-label">2019 = 100</text>

        ${top.map((row, i) => {
          const idx = indices[i];
          const y = margin.top + i * rowHeight + 3;
          const h = Math.max(10, rowHeight - 10);
          return `
            <text x="${margin.left - 10}" y="${y + h * 0.70}" text-anchor="end"
              class="route-chart-label">${escapeHtml(shortRoute(row.ruta))}</text>
          
            <rect x="${margin.left}" y="${y}" width="${Math.max(1, x(idx) - margin.left)}" height="${h}"
              class="route-index-bar ${idx >= 100 ? "route-index-good" : "route-index-bad"}"></rect>
          
            <text x="${Math.min(width - 6, x(idx) + 6)}" y="${y + h * 0.70}"
              class="route-chart-value">${idx.toLocaleString("es-AR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
              })}</text>
          `;
        }).join("")}
      </svg>
    `;
  }

  function topNames(rows, predicate, limit = 5) {
    return rows
      .filter(predicate)
      .sort((a, b) => Number(b.var_2025) - Number(a.var_2025))
      .slice(0, limit)
      .map(row => displayRoute(row.ruta));
  }

  function bottomNames(rows, limit = 5) {
    return rows
      .filter(row => Number.isFinite(Number(row.var_2025)) && Number(row.var_2025) < -3)
      .sort((a, b) => Number(a.var_2025) - Number(b.var_2025))
      .slice(0, limit)
      .map(row => displayRoute(row.ruta));
  }

  function renderSummary(segmento, rows) {
    const summary = reportData?.resumen?.[segmento];
    const prefix = segmento === "internacional" ? "int" : "cab";
    if (!summary) return;

    const text = $(`${prefix}SummaryText`);
    if (text) {
      text.innerHTML = `
        Las <strong>${fmt(summary.cantidad_rutas)} rutas principales</strong> concentran
        <strong>${fmtPct(summary.cobertura_2025_pct).replace("+","")}</strong> del tráfico ${segmento} de 2025.
        En conjunto registran <strong class="${classForPct(summary.variacion_2025_2019)}">${fmtPct(summary.variacion_2025_2019)}</strong>
        respecto de 2019 y, en el 1S 2026, <strong class="${classForPct(summary.variacion_2026_1s_2019_1s)}">${fmtPct(summary.variacion_2026_1s_2019_1s)}</strong>
        frente al 1S 2019.
      `;
    }

    const kpis = $(`${prefix}Kpis`);
    if (kpis) {
      kpis.innerHTML = `
        <div class="route-kpi">
          <span class="route-kpi-value">${fmt(summary.cantidad_rutas)}</span>
          <span class="route-kpi-label">rutas principales</span>
        </div>
        <div class="route-kpi">
          <span class="route-kpi-value">${fmtPct(summary.cobertura_2025_pct).replace("+","")}</span>
          <span class="route-kpi-label">del tráfico 2025</span>
        </div>
        <div class="route-kpi">
          <span class="route-kpi-value ${classForPct(summary.variacion_2025_2019)}">${fmtPct(summary.variacion_2025_2019)}</span>
          <span class="route-kpi-label">2025 / 2019</span>
        </div>
        <div class="route-kpi">
          <span class="route-kpi-value ${classForPct(summary.variacion_2026_1s_2019_1s)}">${fmtPct(summary.variacion_2026_1s_2019_1s)}</span>
          <span class="route-kpi-label">1S 2026 / 1S 2019</span>
        </div>
      `;
    }

    const conclusions = $(`${prefix}Conclusions`);
    if (conclusions) {
      const growth = topNames(rows, row => Number(row.var_2025) >= 20);
      const decline = bottomNames(rows);
      const categories = summary.categorias || {};
      conclusions.innerHTML = `
        <p>
          <strong>Recuperación amplia:</strong>
          ${escapeHtml(growth.length ? growth.join("; ") : "sin casos destacados")}.
        </p>
        <p>
          <strong>Mayores rezagos:</strong>
          ${escapeHtml(decline.length ? decline.join("; ") : "sin casos destacados")}.
        </p>
        <p class="route-category-line">
          Distribución: ${escapeHtml(
            Object.entries(categories)
              .map(([name, count]) => `${name}: ${count}`)
              .join(" · ")
          )}.
        </p>
      `;
    }
  }

  function renderReport(data) {
    reportData = data;

    const intRows = principalRows("internacional");
    const cabRows = principalRows("cabotaje");

    renderSummary("internacional", intRows);
    renderSummary("cabotaje", cabRows);

    renderIndexChart("intRouteChart", intRows);
    renderIndexChart("cabRouteChart", cabRows);

    renderRouteTable("intRoutesTable", intRows, 0, ROWS_FIRST_PAGE);
    renderRouteTable("intRoutesTableContinuation", intRows, ROWS_FIRST_PAGE);

    renderRouteTable("cabRoutesTable", cabRows, 0, ROWS_FIRST_PAGE);
    renderRouteTable("cabRoutesTableContinuation", cabRows, ROWS_FIRST_PAGE);

    const intCont = $("intRoutesTableContinuation")?.closest(".sheet-a4");
    if (intCont) intCont.style.display = intRows.length > ROWS_FIRST_PAGE ? "" : "none";

    const cabCont = $("cabRoutesTableContinuation")?.closest(".sheet-a4");
    if (cabCont) cabCont.style.display = cabRows.length > ROWS_FIRST_PAGE ? "" : "none";
  }

async function exportPdfA4() {
  const pages = Array.from(
    document.querySelectorAll(".sheet-a4")
  ).filter(page =>
    getComputedStyle(page).display !== "none"
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

    if (
      !window.html2canvas ||
      !window.jspdf?.jsPDF
    ) {
      window.print();
      return;
    }

    window.scrollTo(0, 0);

    /*
      IMPORTANTE:
      no se agrega la clase pdf-exporting.
      Se captura cada A4 exactamente como
      está renderizado en la página web.
    */

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

    const pdf = new window.jspdf.jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      const rect = page.getBoundingClientRect();

      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);

      const canvas = await window.html2canvas(
        page,
        {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",

          width: width,
          height: height,

          windowWidth: width,
          windowHeight: height,

          scrollX: 0,
          scrollY: 0,

          logging: false
        }
      );

      const imgData = canvas.toDataURL(
        "image/jpeg",
        0.98
      );

      if (i > 0) {
        pdf.addPage("a4", "portrait");
      }

      /*
        La hoja web ya está diseñada como A4.
        Solo se rasteriza y se coloca sobre
        una hoja A4 completa.
      */
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
      "recuperacion_postpandemia_rutas_principales_2025_2019_y_2026S1_2019S1.pdf"
    );

  } catch (err) {
    console.error(
      "Error exportando PDF A4:",
      err
    );

    window.print();

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Descargar PDF A4";
    }
  }
}

  document.addEventListener("DOMContentLoaded", async () => {
    const btn = $("btnPdf");
    if (btn) btn.addEventListener("click", exportPdfA4);

    try {
      setStatus("Cargando datos por ruta…", "warn");
      const data = await fetchJson(DATA_PATH);
      renderReport(data);
      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus(`Error al cargar el informe: ${err.message || err}`, "err");
    }
  });
})();
