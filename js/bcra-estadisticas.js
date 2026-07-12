// js/bcra-estadisticas.js

(() => {
  "use strict";

  const API_BASE = "https://api.bcra.gob.ar";
  const CATALOG_URL = `${API_BASE}/estadisticas/v4.0/Monetarias`;

  const COLORS = [
    "#2f77c8",
    "#42cda7",
    "#e9943a",
    "#c94e55",
    "#35c3d4",
    "#9bd633",
    "#7c3aed",
    "#111827"
  ];

  let catalog = [];
  let filteredCatalog = [];
  let selectedVariables = new Map();

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindElements();
    setDefaultDates();
    bindEvents();
    loadCatalog();
  }

  function bindElements() {
    [
      "bcraTotalVariables",
      "bcraLoadedVariables",
      "bcraSelectedCount",
      "bcraSearch",
      "bcraCategory",
      "bcraCurrency",
      "bcraPeriodicity",
      "bcraDesde",
      "bcraHasta",
      "bcraFrequency",
      "bcraMode",
      "bcraQuickUvaCer",
      "bcraClearSelection",
      "bcraDrawChart",
      "bcraVariableList",
      "bcraVisibleCount",
      "bcraChart",
      "bcraChartTitle",
      "bcraChartSubtitle",
      "bcraSeriesTable"
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function setDefaultDates() {
    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setFullYear(today.getFullYear() - 2);

    if (els.bcraHasta) els.bcraHasta.value = isoToday;
    if (els.bcraDesde && !els.bcraDesde.value) {
      els.bcraDesde.value = twoYearsAgo.toISOString().slice(0, 10);
    }
  }

  function bindEvents() {
    ["bcraSearch", "bcraCategory", "bcraCurrency", "bcraPeriodicity"].forEach((id) => {
      els[id]?.addEventListener("input", applyFilters);
      els[id]?.addEventListener("change", applyFilters);
    });

    els.bcraDrawChart?.addEventListener("click", drawSelectedSeries);
    els.bcraClearSelection?.addEventListener("click", clearSelection);
    els.bcraQuickUvaCer?.addEventListener("click", selectUvaCer);
  }

  async function loadCatalog() {
    try {
      setVariableListMessage("Consultando catálogo BCRA...");

      const first = await fetchJson(`${CATALOG_URL}?Limit=1&Offset=0`);
      const total = first.metadata?.resultset?.count ?? null;

      els.bcraTotalVariables.textContent = total ? total.toLocaleString("es-AR") : "–";

      catalog = await fetchFullCatalog(total);
      catalog.sort((a, b) => String(a.descripcion || "").localeCompare(String(b.descripcion || ""), "es"));

      els.bcraLoadedVariables.textContent = catalog.length.toLocaleString("es-AR");

      fillFilterOptions();
      applyFilters();
    } catch (error) {
      console.error(error);
      setVariableListMessage("No se pudo cargar el catálogo del BCRA. Revisá la consola del navegador.");
    }
  }

  async function fetchFullCatalog(total) {
    const pageSize = 1000;
    const rows = [];
    const count = total || pageSize;

    for (let offset = 0; offset < count; offset += pageSize) {
      const json = await fetchJson(`${CATALOG_URL}?Limit=${pageSize}&Offset=${offset}`);
      const page = json.results || [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return rows;
  }

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    let detail = "";

    try {
      const errorJson = await response.json();
      detail = errorJson.errorMessages
        ? ` · ${errorJson.errorMessages.join(" / ")}`
        : "";
    } catch (error) {
      detail = "";
    }

    throw new Error(`Error API BCRA ${response.status}${detail}: ${url}`);
  }

  return await response.json();
}

  function fillFilterOptions() {
    fillSelect(els.bcraCategory, uniqueValues(catalog.map((v) => v.categoria)));
    fillSelect(els.bcraCurrency, uniqueValues(catalog.map((v) => v.moneda)));
    fillSelect(els.bcraPeriodicity, uniqueValues(catalog.map((v) => v.periodicidad)));
  }

  function fillSelect(select, values) {
    if (!select) return;

    const first = select.querySelector("option");
    select.innerHTML = "";
    if (first) select.appendChild(first);

    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function uniqueValues(values) {
    return [...new Set(values.filter((value) => value !== null && value !== undefined && String(value).trim() !== ""))]
      .sort((a, b) => String(a).localeCompare(String(b), "es"));
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function applyFilters() {
    const query = normalizeText(els.bcraSearch?.value || "");
    const category = els.bcraCategory?.value || "";
    const currency = els.bcraCurrency?.value || "";
    const periodicity = els.bcraPeriodicity?.value || "";

    filteredCatalog = catalog.filter((variable) => {
      const text = normalizeText([
        variable.idVariable,
        variable.descripcion,
        variable.categoria,
        variable.tipoSerie,
        variable.periodicidad,
        variable.unidadExpresion,
        variable.moneda
      ].join(" "));

      return (!query || text.includes(query))
        && (!category || variable.categoria === category)
        && (!currency || variable.moneda === currency)
        && (!periodicity || variable.periodicidad === periodicity);
    });

    renderVariableList();
  }

  function renderVariableList() {
    els.bcraVisibleCount.textContent = `${filteredCatalog.length.toLocaleString("es-AR")} visibles`;

    if (!filteredCatalog.length) {
      setVariableListMessage("No se encontraron variables con esos filtros.");
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredCatalog.slice(0, 500).forEach((variable) => {
      const id = String(variable.idVariable);

      const item = document.createElement("label");
      item.className = "bcra-variable-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = id;
      input.checked = selectedVariables.has(id);

      input.addEventListener("change", () => {
        if (input.checked) {
          selectedVariables.set(id, variable);
        } else {
          selectedVariables.delete(id);
        }
        updateSelectedCount();
      });

      const text = document.createElement("div");

      const title = document.createElement("strong");
      title.textContent = `${variable.descripcion || "Variable sin descripción"} · ID ${id}`;

      const meta = document.createElement("small");
      meta.textContent = [
        variable.categoria,
        variable.periodicidad ? `Periodicidad: ${variable.periodicidad}` : null,
        variable.moneda ? `Moneda: ${variable.moneda}` : null,
        variable.unidadExpresion ? `Unidad: ${variable.unidadExpresion}` : null,
        variable.ultFechaInformada ? `Último dato: ${variable.ultFechaInformada}` : null
      ].filter(Boolean).join(" · ");

      text.appendChild(title);
      text.appendChild(meta);

      item.appendChild(input);
      item.appendChild(text);
      fragment.appendChild(item);
    });

    els.bcraVariableList.innerHTML = "";
    els.bcraVariableList.appendChild(fragment);

    if (filteredCatalog.length > 500) {
      const note = document.createElement("p");
      note.className = "bcra-muted";
      note.textContent = "Se muestran las primeras 500 variables. Refiná la búsqueda para ver menos resultados.";
      els.bcraVariableList.appendChild(note);
    }

    updateSelectedCount();
  }

  function setVariableListMessage(message) {
    els.bcraVariableList.innerHTML = `<p class="bcra-muted">${escapeHtml(message)}</p>`;
  }

  function updateSelectedCount() {
    els.bcraSelectedCount.textContent = selectedVariables.size.toLocaleString("es-AR");
  }

  function clearSelection() {
    selectedVariables.clear();
    updateSelectedCount();
    renderVariableList();
    clearChart("Seleccione una o varias variables para graficar.");
    els.bcraSeriesTable.innerHTML = "";
  }

function selectUvaCer() {
  selectedVariables.clear();

  const candidatas = catalog.filter((variable) => {
    const desc = normalizeText(variable.descripcion || "");

    return (
      desc === "unidad de valor adquisitivo" ||
      desc === "unidad de valor adquisitivo uva" ||
      desc.includes("unidad de valor adquisitivo") ||
      desc === "coeficiente de estabilizacion de referencia" ||
      desc === "coeficiente de estabilizacion de referencia cer" ||
      desc.includes("coeficiente de estabilizacion de referencia")
    );
  });

  candidatas.forEach((variable) => {
    selectedVariables.set(String(variable.idVariable), variable);
  });

  els.bcraSearch.value = "";
  els.bcraCategory.value = "";
  els.bcraCurrency.value = "";
  els.bcraPeriodicity.value = "";

  applyFilters();
  updateSelectedCount();

  if (!candidatas.length) {
    clearChart("No se encontraron variables exactas para UVA y CER. Probá buscar manualmente “Unidad de Valor Adquisitivo” o “Coeficiente de Estabilización de Referencia”.");
  }
}

  async function drawSelectedSeries() {
    const variables = [...selectedVariables.values()];

    if (!variables.length) {
      clearChart("Seleccioná al menos una variable.");
      return;
    }

    const desde = els.bcraDesde.value;
    const hasta = els.bcraHasta.value;
    const frequency = els.bcraFrequency.value;
    const mode = els.bcraMode.value;

    clearChart("Cargando series seleccionadas...");

    try {
      const series = [];

      for (const variable of variables.slice(0, 6)) {
        const detail = await fetchSerie(variable.idVariable, desde, hasta);
        const prepared = prepareSerie(detail, frequency, mode);

        if (prepared.length) {
          series.push({
            idVariable: variable.idVariable,
            label: variable.descripcion || `Variable ${variable.idVariable}`,
            unidad: variable.unidadExpresion || "",
            moneda: variable.moneda || "",
            data: prepared
          });
        }
      }

      if (!series.length) {
        clearChart("No se encontraron datos para el período seleccionado.");
        return;
      }

      drawLineChart(series, mode);
      renderSeriesTable(series, mode);

      els.bcraChartTitle.textContent = "Evolución de variables seleccionadas";
      els.bcraChartSubtitle.textContent = mode === "index"
        ? "Series normalizadas con base 100 en el primer dato disponible del período."
        : "Valores originales informados por la API BCRA.";
    } catch (error) {
      console.error(error);
      clearChart("No se pudieron cargar las series. Revisá la consola del navegador.");
    }
  }

async function fetchSerie(idVariable, desde, hasta) {
  const pageSize = 1000;
  let offset = 0;
  let all = [];

  const desdeDateTime = desde ? `${desde}T00:00:00` : "";
  const hastaDateTime = hasta ? `${hasta}T23:59:59` : "";

  while (true) {
    const params = new URLSearchParams();

    if (desdeDateTime) params.set("Desde", desdeDateTime);
    if (hastaDateTime) params.set("Hasta", hastaDateTime);

    params.set("Limit", String(pageSize));
    params.set("Offset", String(offset));

    const url = `${API_BASE}/estadisticas/v4.0/Monetarias/${idVariable}?${params.toString()}`;
    const json = await fetchJson(url);

    const detail = json.results?.[0]?.detalle || [];
    all = all.concat(detail);

    if (detail.length < pageSize) break;

    offset += pageSize;
  }

  return all;
}

  function prepareSerie(detail, frequency, mode) {
    const rows = detail
      .map((row) => ({
        fecha: String(row.fecha || "").slice(0, 10),
        valor: Number(row.valor)
      }))
      .filter((row) => row.fecha && Number.isFinite(row.valor))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const sampled = frequency === "monthly"
      ? firstAvailableByMonth(rows)
      : rows;

    if (mode !== "index") return sampled;

    const base = sampled.find((row) => row.valor !== 0)?.valor;

    if (!Number.isFinite(base) || base === 0) return sampled;

    return sampled.map((row) => ({
      ...row,
      valorOriginal: row.valor,
      valor: (row.valor / base) * 100
    }));
  }

  function firstAvailableByMonth(rows) {
    const map = new Map();

    rows.forEach((row) => {
      const key = row.fecha.slice(0, 7);
      if (!map.has(key)) {
        map.set(key, row);
      }
    });

    return [...map.values()];
  }

  function clearChart(message) {
    els.bcraChart.innerHTML = `<p class="bcra-muted">${escapeHtml(message)}</p>`;
  }

  function drawLineChart(series, mode) {
    const width = 900;
    const height = 420;
    const margin = { top: 28, right: 28, bottom: 58, left: 72 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const allDates = uniqueValues(series.flatMap((s) => s.data.map((d) => d.fecha))).sort();
    const allValues = series.flatMap((s) => s.data.map((d) => d.valor)).filter(Number.isFinite);

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const pad = (maxValue - minValue) * 0.08 || 1;

    const yMin = minValue - pad;
    const yMax = maxValue + pad;

    const xScale = (fecha) => {
      const index = allDates.indexOf(fecha);
      if (allDates.length <= 1) return margin.left;
      return margin.left + (index / (allDates.length - 1)) * innerW;
    };

    const yScale = (value) => {
      return margin.top + innerH - ((value - yMin) / (yMax - yMin)) * innerH;
    };

    const svg = createSvg("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img"
    });

    // Grilla horizontal
    for (let i = 0; i <= 4; i += 1) {
      const value = yMin + ((yMax - yMin) / 4) * i;
      const y = yScale(value);

      svg.appendChild(createSvg("line", {
        x1: margin.left,
        y1: y,
        x2: width - margin.right,
        y2: y,
        stroke: "#e5ebf2",
        "stroke-width": 1
      }));

      svg.appendChild(createSvg("text", {
        x: margin.left - 10,
        y: y + 4,
        "text-anchor": "end",
        fill: "#66717e",
        "font-size": 11
      }, formatNumber(value)));
    }

    // Etiquetas eje X
    const tickEvery = Math.max(1, Math.ceil(allDates.length / 8));

    allDates.forEach((fecha, index) => {
      if (index % tickEvery !== 0 && index !== allDates.length - 1) return;

      const x = xScale(fecha);

      svg.appendChild(createSvg("text", {
        x,
        y: height - 24,
        "text-anchor": "middle",
        fill: "#66717e",
        "font-size": 11
      }, formatDateLabel(fecha)));
    });

    // Líneas
    series.forEach((serie, index) => {
      const color = COLORS[index % COLORS.length];

      const points = serie.data
        .filter((d) => Number.isFinite(d.valor) && allDates.includes(d.fecha))
        .map((d) => `${xScale(d.fecha)},${yScale(d.valor)}`)
        .join(" ");

      svg.appendChild(createSvg("polyline", {
        points,
        fill: "none",
        stroke: color,
        "stroke-width": 2.6,
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      }));

      const last = serie.data[serie.data.length - 1];
      if (last) {
        svg.appendChild(createSvg("circle", {
          cx: xScale(last.fecha),
          cy: yScale(last.valor),
          r: 4,
          fill: color
        }));
      }
    });

    // Leyenda
    let legendX = margin.left;
    let legendY = 20;

    series.forEach((serie, index) => {
      const color = COLORS[index % COLORS.length];
      const label = shortLabel(serie.label);

      svg.appendChild(createSvg("rect", {
        x: legendX,
        y: legendY - 10,
        width: 12,
        height: 12,
        rx: 2,
        fill: color
      }));

      svg.appendChild(createSvg("text", {
        x: legendX + 18,
        y: legendY,
        fill: "#002855",
        "font-size": 12,
        "font-weight": 700
      }, label));

      legendX += Math.min(260, 32 + label.length * 7);
    });

    els.bcraChart.innerHTML = "";
    els.bcraChart.appendChild(svg);
  }

  function renderSeriesTable(series, mode) {
    const rows = series.map((serie) => {
      const first = serie.data[0];
      const last = serie.data[serie.data.length - 1];
      const variation = first && last && first.valor !== 0
        ? ((last.valor - first.valor) / first.valor) * 100
        : null;

      return `
        <tr>
          <td>${escapeHtml(serie.label)}</td>
          <td>${escapeHtml(serie.idVariable)}</td>
          <td>${first ? escapeHtml(first.fecha) : "–"}</td>
          <td>${last ? escapeHtml(last.fecha) : "–"}</td>
          <td>${last ? formatNumber(last.valor) : "–"}</td>
          <td>${Number.isFinite(variation) ? variation.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "%" : "–"}</td>
        </tr>
      `;
    }).join("");

    els.bcraSeriesTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Variable</th>
            <th>ID</th>
            <th>Desde</th>
            <th>Hasta</th>
            <th>${mode === "index" ? "Último índice" : "Último valor"}</th>
            <th>Variación período</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function createSvg(tag, attrs = {}, text = "") {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    if (text !== "") el.textContent = text;
    return el;
  }

  function shortLabel(label) {
    const text = String(label || "");
    return text.length > 34 ? `${text.slice(0, 31)}...` : text;
  }

  function formatDateLabel(fecha) {
    const [year, month] = fecha.split("-");
    return `${month}/${year}`;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "–";

    return value.toLocaleString("es-AR", {
      maximumFractionDigits: value >= 100 ? 1 : 3
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
})();
