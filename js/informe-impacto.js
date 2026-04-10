(() => {
  "use strict";

  const q = id => document.getElementById(id);

  async function loadText(url) {
    const resp = await fetch(url);
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
      const target = q("reportStack");
      const airport = q("airportSelect")?.value || "aeropuerto";

      if (!target || typeof html2canvas === "undefined") return;

      const prev = button.textContent;
      button.disabled = true;
      button.textContent = "Exportando...";

      try {
        const canvas = await html2canvas(target, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false
        });

        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `informe-impacto-${airport}.png`;
        link.click();
      } catch (err) {
        console.error("No se pudo exportar el informe.", err);
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
      await mountLaminaFromCurrentHtml();

      document.dispatchEvent(new CustomEvent("report:partials-ready"));
    } catch (err) {
      console.error("No se pudo armar el informe.", err);
    }
  }

  document.addEventListener("DOMContentLoaded", bootReport);
})();
