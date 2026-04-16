(() => {
  "use strict";

  const q = id => document.getElementById(id);

  async function loadText(url) {
    const sep = url.includes("?") ? "&" : "?";
    const cacheBust = `v=impacto6-${Date.now()}`;

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
  pdf.addImage(
    raster.dataUrl,
    "JPEG",
    fit.x,
    fit.y,
    fit.w,
    fit.h
  );
}

async function addSummaryNativePage(pdf) {
  const pageEl = document.querySelector("#summaryMount .summary-page");
  if (!pageEl) return;

  const kicker = pageEl.querySelector(".summary-kicker")?.textContent?.trim() || "";
  const airportLine = q("summaryAirportLine")?.textContent?.trim() || "";
  const title = pageEl.querySelector(".summary-title")?.textContent?.trim() || "RESUMEN EJECUTIVO";
  const paragraphs = Array.from(pageEl.querySelectorAll("#summaryText p"))
    .map(p => p.textContent.trim())
    .filter(Boolean);

  const summaryImg = await imageElementToData(q("summaryImgAirport"));

  pdf.addPage("a4", "portrait");

  const pageW = 210;
  const pageH = 297;
  const marginL = 10;
  const marginR = 10;
  const textW = pageW - marginL - marginR;

  let y = 14;

  pdf.setTextColor(53, 90, 115);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  pdf.text(kicker, marginL, y);
  y += 8;

  pdf.setTextColor(23, 52, 74);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(airportLine, marginL, y);
  y += 10;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, marginL, y);
  y += 10;

  pdf.setTextColor(34, 49, 61);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const lineH = 4.5;

  const maxTextBottom = 208;

  for (const paragraph of paragraphs) {
    const lines = pdf.splitTextToSize(paragraph, textW);

    if (y + (lines.length * lineH) > maxTextBottom) {
      break;
    }

    pdf.text(lines, marginL, y);
    y += (lines.length * lineH) + 3;
  }

  if (summaryImg) {
    const boxX = 10;
    const boxY = 214;
    const boxW = 190;
    const boxH = 70;

    const fit = fitIntoBox(summaryImg.width, summaryImg.height, boxW, boxH);

    pdf.addImage(
      summaryImg.dataUrl,
      "PNG",
      boxX + fit.x,
      boxY + fit.y,
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

      let firstPageUsed = false;

      if (coverEl) {
        const coverRaster = await rasterizeElement(coverEl, 2);
        addRasterPage(pdf, coverRaster, "portrait", true);
        firstPageUsed = true;
      }

      await addSummaryNativePage(pdf);

      if (laminaEl) {
        const laminaRaster = await rasterizeElement(laminaEl, 2);
        addRasterPage(pdf, laminaRaster, "landscape", false);
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

      await mountCoverPartial();
      await mountSummaryPartial();
      await mountLaminaFromCurrentHtml();

      document.dispatchEvent(new CustomEvent("report:partials-ready"));
    } catch (err) {
      console.error("No se pudo armar el informe.", err);
    }
  }

  document.addEventListener("DOMContentLoaded", bootReport);
})();
