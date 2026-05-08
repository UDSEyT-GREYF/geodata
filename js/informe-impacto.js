(() => {
  "use strict";

  const q = id => document.getElementById(id);
  const PERFIL_OPERATIVO_URL = "fuentes/perfil_operativo_impacto_2025.json";

  const PerfilOperativoImpacto = {
    data: null,
    index: new Map(),
    ready: false
  };

  window.PerfilOperativoImpacto = PerfilOperativoImpacto;
  
  async function loadText(url) {
    const sep = url.includes("?") ? "&" : "?";
    const cacheBust = `v=impacto9-${Date.now()}`;

    const resp = await fetch(`${url}${sep}${cacheBust}`, {
      cache: "no-store"
    });

    if (!resp.ok) {
      throw new Error(`No se pudo cargar ${url}`);
    }
    return resp.text();
  }

  async function mountCoverPartial() {
    const html = await loadText("partials/portada-informe.html");
    const mount = q("coverMount");
    if (mount) mount.innerHTML = html;
  }

  async function mountSummaryPartial() {
    const html = await loadText("partials/resumen-ejecutivo.html");
    const mount = q("summaryMount");
    if (mount) mount.innerHTML = html;
  }

  async function mountLaminaFromCurrentHtml() {
    const html = await loadText("datos-clave-lamina.html");
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const sheet = doc.querySelector("#sheetA4");

    if (!sheet) {
      throw new Error("No se encontró #sheetA4 dentro de datos-clave-lamina.html");
    }

    const mount = q("laminaMount");
    if (mount) mount.innerHTML = sheet.outerHTML;
  }
  
async function mountOfferDemandPartial() {
  const html = await loadText("partials/oferta-demanda.html");
  const mount = q("offerDemandMount");
  if (mount) mount.innerHTML = html;
}

    async function loadJson(url) {
    const text = await loadText(url);
    return JSON.parse(text);
  }

  async function loadPerfilOperativoImpacto() {
    try {
      const data = await loadJson(PERFIL_OPERATIVO_URL);
      const index = buildPerfilOperativoIndex(data);

      PerfilOperativoImpacto.data = data;
      PerfilOperativoImpacto.index = index;
      PerfilOperativoImpacto.ready = true;

      console.log(
        `[perfil operativo] cargados ${index.size} aeropuertos desde ${PERFIL_OPERATIVO_URL}`
      );

      return PerfilOperativoImpacto;
    } catch (error) {
      console.warn("[perfil operativo] no se pudo cargar el perfil operativo:", error);

      PerfilOperativoImpacto.data = null;
      PerfilOperativoImpacto.index = new Map();
      PerfilOperativoImpacto.ready = false;

      return PerfilOperativoImpacto;
    }
  }

  function buildPerfilOperativoIndex(data) {
    const index = new Map();

    if (!data || !data.categorias) return index;

    Object.entries(data.categorias).forEach(([categoriaKey, categoria]) => {
      const aeropuertos = Array.isArray(categoria.aeropuertos)
        ? categoria.aeropuertos
        : [];

      aeropuertos.forEach(aeropuerto => {
        const iata = normalizeIata(aeropuerto.iata);
        if (!iata) return;

        index.set(iata, {
          ...aeropuerto,
          iata,
          categoria_key: categoriaKey,
          categoria_orden: categoria.orden ?? null,
          categoria_label: categoria.label || "",
          categoria_criterio: categoria.criterio || "",
          categoria_enfoque_narrativo: categoria.enfoque_narrativo || "",
          categoria_aclaracion_historica: categoria.aclaracion_historica || ""
        });
      });
    });

    return index;
  }

  function normalizeIata(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getPerfilOperativo(iata) {
    const key = normalizeIata(iata);
    if (!key) return null;

    return PerfilOperativoImpacto.index.get(key) || null;
  }

  window.getPerfilOperativoImpacto = getPerfilOperativo;

    function renderPerfilOperativoCard(iata) {
    const perfil = getPerfilOperativo(iata);

    const card = q("summaryPerfilOperativoCard");
    const badge = q("summaryPerfilOperativoBadge");
    const title = q("summaryPerfilOperativoTitle");
    const text = q("summaryPerfilOperativoText");
    const metrics = q("summaryPerfilOperativoMetrics");

    if (!card || !badge || !title || !text || !metrics) return;

    if (!perfil) {
      card.hidden = true;
      card.dataset.perfil = "";
      badge.textContent = "";
      title.textContent = "";
      text.textContent = "";
      metrics.innerHTML = "";
      return;
    }

    card.hidden = false;
    card.dataset.perfil = perfil.categoria_key || "";

    badge.textContent = "Perfil operativo 2025";
    title.textContent = perfil.categoria_label || "Caracterización operativa";
    text.textContent = getTextoPerfilOperativo(perfil);

    metrics.innerHTML = `
      <div class="summary-profile-metric">
        <span>Pasajeros 2025</span>
        <strong>${formatIntegerPerfil(perfil.pasajeros_2025)}</strong>
      </div>

      <div class="summary-profile-metric">
        <span>Movimientos 2025</span>
        <strong>${formatIntegerPerfil(perfil.movimientos_2025)}</strong>
      </div>

      <div class="summary-profile-metric">
        <span>Pasajeros por movimiento</span>
        <strong>${formatDecimalPerfil(perfil.pasajeros_por_movimiento)}</strong>
      </div>
    `;
  }

  function getTextoPerfilOperativo(perfil) {
    if (!perfil) return "";

    switch (perfil.categoria_key) {
      case "nodo_aerocomercial_consolidado":
        return "El aeropuerto presenta una función aerocomercial consolidada dentro del SNA, con alto volumen relativo de pasajeros, conectividad regular significativa y capacidad de generar impactos sobre empleo, turismo, servicios e integración territorial.";

      case "aeropuerto_regular_intermedio":
        return "El aeropuerto cumple una función aerocomercial regular de escala regional. Su impacto debe leerse combinando conectividad, función territorial y dependencia relativa de un conjunto acotado de rutas, frecuencias u operadores.";

      case "baja_regularidad_demanda_acotada":
        return "El aeropuerto presenta una demanda acotada o estacional. En estos casos, las variaciones porcentuales deben interpretarse con cautela, ya que pocos vuelos pueden modificar sensiblemente los resultados anuales o mensuales.";

      case "infraestructura_sin_oferta_regular_relevante":
        return "El aeropuerto no debe evaluarse principalmente por su volumen de pasajeros comerciales. Su relevancia se vincula con la disponibilidad de infraestructura, el soporte territorial, la conectividad eventual, la logística, los servicios públicos y el potencial de desarrollo regional.";

      case "aviacion_general_ejecutiva_privada":
        return "El aeropuerto tiene un perfil principalmente asociado a aviación general, ejecutiva, privada, sanitaria, de instrucción o de servicios aeronáuticos. Por eso, su importancia se expresa mejor en los movimientos y en la disponibilidad operativa que en el volumen de pasajeros comerciales.";

      default:
        return perfil.categoria_enfoque_narrativo || perfil.categoria_criterio || "";
    }
  }

  function formatIntegerPerfil(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "s/d";

    return num.toLocaleString("es-AR", {
      maximumFractionDigits: 0
    });
  }

  function formatDecimalPerfil(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "s/d";

    return num.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function getCurrentAirportIata() {
    const selected = q("airportSelect")?.value;
    if (selected) return normalizeIata(selected);

    const params = new URLSearchParams(window.location.search);
    return normalizeIata(params.get("airport"));
  }

  function initPerfilOperativoBindings() {
    const airportSelect = q("airportSelect");

    if (airportSelect) {
      airportSelect.addEventListener("change", event => {
        renderPerfilOperativoCard(event.target.value);
      });
    }

    window.renderPerfilOperativoCard = renderPerfilOperativoCard;
  }
  function fitIntoBox(srcW, srcH, boxW, boxH) {
    const srcRatio = srcW / srcH;
    const boxRatio = boxW / boxH;

    let w;
    let h;

    if (srcRatio > boxRatio) {
      w = boxW;
      h = boxW / srcRatio;
    } else {
      h = boxH;
      w = boxH * srcRatio;
    }

    return {
      w,
      h,
      x: (boxW - w) / 2,
      y: (boxH - h) / 2
    };
  }

  async function waitForImage(imgEl) {
    if (!imgEl || !imgEl.src) return;

    if (imgEl.complete && imgEl.naturalWidth > 0) return;

    await new Promise((resolve) => {
      const done = () => resolve();
      imgEl.addEventListener("load", done, { once: true });
      imgEl.addEventListener("error", done, { once: true });
    });
  }

  async function imageElementToData(imgEl) {
    if (!imgEl || !imgEl.src || imgEl.classList.contains("is-hidden")) return null;

    await waitForImage(imgEl);

    const w = imgEl.naturalWidth || imgEl.width;
    const h = imgEl.naturalHeight || imgEl.height;
    if (!w || !h) return null;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgEl, 0, 0, w, h);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: w,
      height: h
    };
  }

  async function rasterizeElement(el, scale = 2) {
    if (!el) return null;

    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale,
      useCORS: true,
      logging: false
    });

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.95),
      width: canvas.width,
      height: canvas.height
    };
  }

  function addRasterPage(pdf, raster, orientation = "portrait", isFirst = false) {
    if (!raster) return;

    const pageW = orientation === "landscape" ? 297 : 210;
    const pageH = orientation === "landscape" ? 210 : 297;

    if (!isFirst) {
      pdf.addPage("a4", orientation);
    }

    const fit = fitIntoBox(raster.width, raster.height, pageW, pageH);
    pdf.addImage(raster.dataUrl, "JPEG", fit.x, fit.y, fit.w, fit.h);
  }

  function extractRichTextSegments(node, inheritedBold = false) {
    const segments = [];

    if (!node) return segments;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) segments.push({ text, bold: inheritedBold });
      return segments;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return segments;

    const tag = (node.tagName || "").toLowerCase();
    const isBold = inheritedBold || tag === "strong" || tag === "b";

    node.childNodes.forEach(child => {
      segments.push(...extractRichTextSegments(child, isBold));
    });

    return segments;
  }

  function normalizeSegmentsForLayout(segments) {
    const out = [];

    segments.forEach(seg => {
      const parts = String(seg.text || "").split(/(\s+)/);
      parts.forEach(part => {
        if (!part) return;
        out.push({
          text: part,
          bold: !!seg.bold,
          isSpace: /^\s+$/.test(part)
        });
      });
    });

    return out;
  }

  function buildRichParagraphLines(pdf, paragraphEl, maxWidth, options = {}) {
    const fontSize = options.fontSize || 10;
    pdf.setFontSize(fontSize);

    const rawSegments = extractRichTextSegments(paragraphEl, false);
    const tokens = normalizeSegmentsForLayout(rawSegments);

    const lines = [];
    let currentLine = [];
    let currentWidth = 0;

    const pushLine = () => {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    };

    tokens.forEach(token => {
      let txt = token.text;

      if (token.isSpace) {
        if (!currentLine.length) return;
        txt = " ";
      }

      pdf.setFont("helvetica", token.bold ? "bold" : "normal");
      const tokenWidth = pdf.getTextWidth(txt);

      if (!token.isSpace && currentLine.length && currentWidth + tokenWidth > maxWidth) {
        pushLine();
      }

      if (!token.isSpace || currentLine.length) {
        currentLine.push({
          text: txt,
          bold: token.bold,
          width: tokenWidth
        });
        currentWidth += tokenWidth;
      }
    });

    if (currentLine.length) pushLine();

    return lines;
  }

function drawRichParagraph(pdf, lines, x, y, maxWidth, options = {}) {
  const fontSize = options.fontSize || 10;
  const lineHeight = options.lineHeight || 4.5;
  const color = options.color || [34, 49, 61];

  pdf.setFontSize(fontSize);
  pdf.setTextColor(...color);

  let cursorY = y;

  lines.forEach((line, lineIndex) => {
    const isLastLine = lineIndex === lines.length - 1;

    const lineWidth = line.reduce((acc, token) => acc + token.width, 0);
    const spaceTokens = line.filter(token => token.text === " ");
    const justify = !isLastLine && spaceTokens.length > 0;

    const extraSpaceTotal = justify ? Math.max(0, maxWidth - lineWidth) : 0;
    const extraPerSpace = justify ? (extraSpaceTotal / spaceTokens.length) : 0;

    let cursorX = x;

    line.forEach(token => {
      pdf.setFont("helvetica", token.bold ? "bold" : "normal");
      pdf.text(token.text, cursorX, cursorY);

      if (token.text === " " && justify) {
        cursorX += token.width + extraPerSpace;
      } else {
        cursorX += token.width;
      }
    });

    cursorY += lineHeight;
  });

  return cursorY;
}

async function addSummaryNativePage(pdf, useCurrentPage = false) {
  const pageEl = document.querySelector("#summaryMount .summary-page");
  if (!pageEl) return;

  const kicker = pageEl.querySelector(".summary-kicker")?.textContent?.trim() || "";
  const airportLine = q("summaryAirportLine")?.textContent?.trim() || "";
  const title = pageEl.querySelector(".summary-title")?.textContent?.trim() || "RESUMEN EJECUTIVO";
  const paragraphEls = Array.from(pageEl.querySelectorAll("#summaryText p"));
  const summaryImg = await imageElementToData(q("summaryImgAirport"));

  if (!useCurrentPage) {
    pdf.addPage("a4", "portrait");
  }

  const pageW = 210;
  const pageH = 297;
  const marginL = 10;
  const marginR = 10;
  const bottomMargin = 10;
  const textW = pageW - marginL - marginR;

  let y = 13;

  pdf.setTextColor(53, 90, 115);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.2);
  pdf.text(kicker, marginL, y);
  y += 7.5;

  pdf.setTextColor(23, 52, 74);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13.4);
  pdf.text(airportLine, marginL, y);
  y += 9;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text(title, marginL, y);
  y += 9;

  const fontSize = 9.6;
  const lineHeight = 4.15;
  const paraGap = 1.9;

  // Reservamos al menos un bloque razonable para la imagen
  const minImageBlock = 78;
  const maxTextBottom = pageH - bottomMargin - minImageBlock - 4;

  pdf.setTextColor(34, 49, 61);

  for (const p of paragraphEls) {
    const lines = buildRichParagraphLines(pdf, p, textW, { fontSize });
    const estimatedBottom = y + (lines.length * lineHeight);

    if (estimatedBottom > maxTextBottom) break;

    y = drawRichParagraph(pdf, lines, marginL, y, textW, {
      fontSize,
      lineHeight,
      color: [34, 49, 61]
    });

    y += paraGap;
  }

  if (summaryImg) {
    // La imagen arranca apenas debajo del texto y ocupa todo el resto útil
    const gapAfterText = 4;
    const boxX = 8;
    const boxW = 194;
    const boxY = y + gapAfterText;
    const boxH = Math.max(60, pageH - bottomMargin - boxY);

    const fit = fitIntoBox(summaryImg.width, summaryImg.height, boxW, boxH);

    // Importante: la alineamos arriba, no centrada verticalmente,
    // para evitar la gran franja vacía entre texto e imagen
    const imgX = boxX + ((boxW - fit.w) / 2);
    const imgY = boxY;

    pdf.addImage(
      summaryImg.dataUrl,
      "PNG",
      imgX,
      imgY,
      fit.w,
      fit.h
    );
  }
}

  function initReportExport() {
    q("btnPrintReport")?.addEventListener("click", () => {
      window.print();
    });

    q("btnExportReportPng")?.addEventListener("click", async () => {
      const button = q("btnExportReportPng");
      const airport = q("airportSelect")?.value || "aeropuerto";

      if (typeof html2canvas === "undefined" || typeof window.jspdf === "undefined") {
        console.error("Faltan html2canvas o jsPDF.");
        return;
      }

      const { jsPDF } = window.jspdf;

const coverEl = document.querySelector("#coverMount .report-cover-page");
const laminaEl = document.querySelector("#laminaMount #sheetA4");


      const prev = button.textContent;
      button.disabled = true;
      button.textContent = "Exportando PDF...";

      try {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true
        });

        let usedFirstPage = false;

        if (coverEl) {
          const coverRaster = await rasterizeElement(coverEl, 2);
          addRasterPage(pdf, coverRaster, "portrait", true);
          usedFirstPage = true;
        }

        await addSummaryNativePage(pdf, !usedFirstPage);

if (laminaEl) {
  const laminaRaster = await rasterizeElement(laminaEl, 2);
  addRasterPage(pdf, laminaRaster, "landscape", false);
}

const offerDemandPages = Array.from(
  document.querySelectorAll("#offerDemandMount .offer-demand-page")
).filter(page => {
  return page.offsetParent !== null && !page.classList.contains("is-hidden");
});

for (const page of offerDemandPages) {
  const raster = await rasterizeElement(page, 2);

  const isLandscape =
    page.offsetWidth > page.offsetHeight ||
    raster.width > raster.height;

  addRasterPage(
    pdf,
    raster,
    isLandscape ? "landscape" : "portrait",
    false
  );
}

pdf.save(`informe-impacto-${airport}.pdf`);
      } catch (err) {
        console.error("No se pudo exportar el informe en PDF.", err);
      } finally {
        button.disabled = false;
        button.textContent = prev;
      }
    });
  }

  async function bootReport() {
    try {
      initReportExport();

      const perfilPromise = loadPerfilOperativoImpacto();

      await mountCoverPartial();
      await mountSummaryPartial();
      await mountLaminaFromCurrentHtml();
      await mountOfferDemandPartial();

      await perfilPromise;

      initPerfilOperativoBindings();
      renderPerfilOperativoCard(getCurrentAirportIata());

      document.dispatchEvent(new CustomEvent("report:partials-ready", {
        detail: {
          perfilOperativoReady: PerfilOperativoImpacto.ready
        }
      }));
    } catch (err) {
      console.error("No se pudo armar el informe.", err);
    }
  }

  document.addEventListener("DOMContentLoaded", bootReport);
})();
