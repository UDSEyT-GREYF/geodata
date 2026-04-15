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

    const pages = [
      document.querySelector("#coverMount .report-cover-page"),
      document.querySelector("#summaryMount .summary-page"),
      document.querySelector("#laminaMount #sheetA4")
    ].filter(Boolean);

    if (!pages.length) return;

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

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];

        const canvas = await html2canvas(pageEl, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);

        const pdfW = 210;
        const pdfH = 297;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
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
