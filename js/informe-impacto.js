(() => {
  "use strict";

  const q = id => document.getElementById(id);
  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function initAirportSearch() {
    const select = q("airportSelect");
    const box = q("airportSearch");
    const input = q("airportSearchInput");
    const clearBtn = q("airportSearchClear");
    const results = q("airportSearchResults");

    if (!select || !box || !input || !clearBtn || !results) return;
    if (box.dataset.bound === "1") return;

    box.dataset.bound = "1";

    let items = [];
    let activeIndex = -1;
    let committedLabel = "";

    function getOptionLabel(option) {
      return String(option?.textContent || "").trim();
    }

    function rebuildItems() {
      items = Array.from(select.options)
        .filter(opt => opt.value)
        .map(opt => {
          const value = String(opt.value || "").trim().toUpperCase();
          const label = getOptionLabel(opt);
          const codeMatch = label.match(/\(([A-Z0-9]{3})\)\s*$/);
          const code = value || (codeMatch ? codeMatch[1] : "");

          return {
            value,
            code,
            label,
            search: normalizeSearchText(`${label} ${value}`)
          };
        });
    }

    function selectedLabel() {
      const opt = select.options[select.selectedIndex];
      return getOptionLabel(opt);
    }

    function setInputValue(value) {
      input.value = value || "";
      box.classList.toggle("has-text", input.value.trim() !== "");
    }

    function syncFromSelect() {
      const label = selectedLabel();
      if (label) {
        committedLabel = label;
        setInputValue(label);
      }
    }

    function closeResults(restoreIfEmpty = true) {
      box.classList.remove("is-open");
      input.setAttribute("aria-expanded", "false");
      activeIndex = -1;

      if (restoreIfEmpty && !input.value.trim()) {
        setInputValue(committedLabel || selectedLabel());
      }
    }

    function openResults() {
      box.classList.add("is-open");
      input.setAttribute("aria-expanded", "true");
    }

    function chooseAirport(value) {
      const nextValue = String(value || "").trim().toUpperCase();
      if (!nextValue) return;

      select.value = nextValue;

      const label = selectedLabel();
      committedLabel = label;
      setInputValue(label);

      closeResults(false);

      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function renderResults(query = "") {
      rebuildItems();

      const qNorm = normalizeSearchText(query);
      const filtered = qNorm
        ? items.filter(item => item.search.includes(qNorm))
        : items;

      const visible = filtered.slice(0, 12);

      results.innerHTML = "";
      activeIndex = visible.length ? 0 : -1;

      if (!visible.length) {
        const empty = document.createElement("div");
        empty.className = "airport-search-empty";
        empty.textContent = "No se encontraron aeropuertos.";
        results.appendChild(empty);
        openResults();
        return;
      }

      visible.forEach((item, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `airport-search-option${index === activeIndex ? " is-active" : ""}`;
        btn.setAttribute("role", "option");
        btn.dataset.value = item.value;

        btn.innerHTML = `
          <span class="airport-search-name">${item.label}</span>
          <span class="airport-search-code">${item.code}</span>
        `;

        btn.addEventListener("mousedown", event => {
          event.preventDefault();
          chooseAirport(item.value);
        });

        results.appendChild(btn);
      });

      openResults();
    }

    function updateActiveOption(delta) {
      const options = Array.from(results.querySelectorAll(".airport-search-option"));
      if (!options.length) return;

      activeIndex = activeIndex + delta;

      if (activeIndex < 0) activeIndex = options.length - 1;
      if (activeIndex >= options.length) activeIndex = 0;

      options.forEach((opt, index) => {
        opt.classList.toggle("is-active", index === activeIndex);
      });

      options[activeIndex].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("focus", () => {
      committedLabel = selectedLabel() || committedLabel;
      setInputValue("");
      renderResults("");
    });

    input.addEventListener("click", () => {
      committedLabel = selectedLabel() || committedLabel;
      setInputValue("");
      renderResults("");
    });

    input.addEventListener("input", () => {
      setInputValue(input.value);
      renderResults(input.value);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!box.classList.contains("is-open")) renderResults(input.value);
        updateActiveOption(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!box.classList.contains("is-open")) renderResults(input.value);
        updateActiveOption(-1);
        return;
      }

      if (event.key === "Enter") {
        const active = results.querySelector(".airport-search-option.is-active");
        if (active?.dataset.value) {
          event.preventDefault();
          chooseAirport(active.dataset.value);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeResults(true);
      }
    });

    input.addEventListener("blur", () => {
      window.setTimeout(() => closeResults(true), 120);
    });

    clearBtn.addEventListener("click", () => {
      committedLabel = selectedLabel() || committedLabel;
      setInputValue("");
      renderResults("");
      input.focus();
    });

    select.addEventListener("change", () => {
  syncFromSelect();
  scheduleInformeImpactoPageNumbers();
});

    const observer = new MutationObserver(() => {
      rebuildItems();
      syncFromSelect();
    });

    observer.observe(select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["selected"]
    });

    rebuildItems();
    syncFromSelect();
  }
  
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

function isVisibleReportPage(page) {
  if (!page) return false;

  const style = window.getComputedStyle(page);

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    !page.classList.contains("is-hidden") &&
    page.offsetWidth > 0 &&
    page.offsetHeight > 0
  );
}

function getInformeImpactoPagesForNumbering() {
  const pages = [];

  const coverEl = document.querySelector("#coverMount .report-cover-page");
  const summaryEl = document.querySelector("#summaryMount .summary-page");
  const laminaEl = document.querySelector("#laminaMount #sheetA4");

  if (isVisibleReportPage(coverEl)) {
    pages.push({ el: coverEl, orientation: "portrait" });
  }

  if (isVisibleReportPage(summaryEl)) {
    pages.push({ el: summaryEl, orientation: "portrait" });
  }

  if (isVisibleReportPage(laminaEl)) {
    pages.push({ el: laminaEl, orientation: "landscape" });
  }

  const offerDemandPages = Array.from(
    document.querySelectorAll("#offerDemandMount .offer-demand-page")
  ).filter(isVisibleReportPage);

  offerDemandPages.forEach(page => {
    pages.push({ el: page, orientation: "portrait" });
  });

  return pages;
}

function renderInformeImpactoPageNumbers() {
  const root = q("reportStack");
  if (!root) return;

  root.querySelectorAll(".impact-page-number").forEach(el => el.remove());
  root.querySelectorAll(".impact-numbered-page").forEach(el => {
    el.classList.remove("impact-numbered-page");
  });

  const pages = getInformeImpactoPagesForNumbering();

  pages.forEach((item, index) => {
    const pageNumber = index + 1;
    const page = item.el;

    // La portada cuenta pero no muestra número.
    if (pageNumber === 1) return;

    // La página apaisada cuenta pero no muestra número.
    if (item.orientation === "landscape") return;

    page.classList.add("impact-numbered-page");

    const numberEl = document.createElement("div");
    numberEl.className = "impact-page-number";
    numberEl.textContent = String(pageNumber);

    page.appendChild(numberEl);
  });
}

function scheduleInformeImpactoPageNumbers() {
  requestAnimationFrame(() => {
    renderInformeImpactoPageNumbers();

    setTimeout(renderInformeImpactoPageNumbers, 400);
    setTimeout(renderInformeImpactoPageNumbers, 1000);
    setTimeout(renderInformeImpactoPageNumbers, 1800);
  });
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

  el.classList.add("is-exporting");

  try {
    await new Promise(resolve => requestAnimationFrame(resolve));

    const rect = el.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);

    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale,
      useCORS: true,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0
    });

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.95),
      width: canvas.width,
      height: canvas.height
    };

  } finally {
    el.classList.remove("is-exporting");
  }
}

function addRasterPage(pdf, raster, orientation = "portrait", isFirst = false) {
  if (!raster) return;

  const pageW = orientation === "landscape" ? 297 : 210;
  const pageH = orientation === "landscape" ? 210 : 297;

  if (!isFirst) {
    pdf.addPage("a4", orientation);
  }

  // Las hojas del informe ya están maquetadas como A4.
  // Se insertan ocupando la página completa para evitar reencuadres.
  pdf.addImage(raster.dataUrl, "JPEG", 0, 0, pageW, pageH);
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
        renderInformeImpactoPageNumbers();
        await new Promise(resolve => requestAnimationFrame(resolve));
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true
        });

renderInformeImpactoPageNumbers();

await new Promise(resolve => {
  requestAnimationFrame(() => {
    requestAnimationFrame(resolve);
  });
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

renderInformeImpactoPageNumbers();

await new Promise(resolve => {
  requestAnimationFrame(() => {
    requestAnimationFrame(resolve);
  });
});

const offerDemandPages = Array.from(
  document.querySelectorAll("#offerDemandMount .offer-demand-page")
).filter(page => {
  return page.offsetParent !== null && !page.classList.contains("is-hidden");
});

for (const page of offerDemandPages) {
  const raster = await rasterizeElement(page, 2);

  addRasterPage(
    pdf,
    raster,
    "portrait",
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
    initAirportSearch();

await mountCoverPartial();
await mountSummaryPartial();
await mountLaminaFromCurrentHtml();
await mountOfferDemandPartial();

document.dispatchEvent(new CustomEvent("report:partials-ready"));

scheduleInformeImpactoPageNumbers();
  } catch (err) {
    console.error("No se pudo armar el informe.", err);
  }
}

  document.addEventListener("DOMContentLoaded", bootReport);
})();
