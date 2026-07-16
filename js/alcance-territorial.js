(() => {
  "use strict";

  const PARTIAL_URL = "partials/alcance-territorial-body.html";
  const AIRPORTS_URL = "fuentes/Datos_aeropuertos.geojson";

  let aeropuertos = [];
  let selectEl = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    await loadPartial();
    bindElements();
    await loadAirports();
    initAirportFromUrl();
    bindEvents();
  }

  async function loadPartial() {
    const mount = document.getElementById("alcanceTerritorialMount");
    if (!mount) return;

    const response = await fetch(PARTIAL_URL);
    if (!response.ok) {
      mount.innerHTML = "<p>No se pudo cargar la página de alcance territorial.</p>";
      return;
    }

    mount.innerHTML = await response.text();
  }

  function bindElements() {
    selectEl = document.getElementById("territorialAirportSelect");
  }

  async function loadAirports() {
    if (!selectEl) return;

    try {
      const response = await fetch(AIRPORTS_URL);
      const geojson = await response.json();

      aeropuertos = (geojson.features || [])
        .map(feature => feature.properties || {})
        .filter(props => props.IATA)
        .sort((a, b) => getAirportLabel(a).localeCompare(getAirportLabel(b), "es"));

      selectEl.innerHTML = "";

      aeropuertos.forEach(a => {
        const option = document.createElement("option");
        option.value = String(a.IATA).toUpperCase();
        option.textContent = getAirportLabel(a);
        selectEl.appendChild(option);
      });
    } catch (error) {
      console.error("No se pudieron cargar los aeropuertos:", error);
      selectEl.innerHTML = '<option value="">Error al cargar aeropuertos</option>';
    }
  }

  function initAirportFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get("airport") || "").trim().toUpperCase();

    let initial = fromUrl && aeropuertos.some(a => String(a.IATA).toUpperCase() === fromUrl)
      ? fromUrl
      : "AEP";

    if (!aeropuertos.some(a => String(a.IATA).toUpperCase() === initial)) {
      initial = aeropuertos[0]?.IATA || "";
    }

    if (selectEl && initial) {
      selectEl.value = initial;
      renderAirport(initial);
    }
  }

  function bindEvents() {
    if (!selectEl) return;

    selectEl.addEventListener("change", () => {
      const iata = String(selectEl.value || "").trim().toUpperCase();
      if (!iata) return;

      renderAirport(iata);

      const url = new URL(window.location.href);
      url.searchParams.set("airport", iata);
      window.history.replaceState({}, "", url);
    });
  }

  function renderAirport(iata) {
    const a = aeropuertos.find(item =>
      String(item.IATA || "").trim().toUpperCase() === iata
    );

    if (!a) return;

    const label = getAirportLabel(a);

    const lineEl = document.getElementById("territorialAirportLine");
    if (lineEl) lineEl.textContent = label;

    const subtitleEl = document.getElementById("territorialMapSubtitle");
    if (subtitleEl) {
      subtitleEl.textContent = `Tiempos de viaje por carretera y área de influencia aeroportuaria · ${label}`;
    }

    const frame = document.getElementById("territorialInfluenceMap");
    if (frame) {
      const src = `mapa_influencia.html?airport=${encodeURIComponent(iata)}&embed=1`;

      if (frame.getAttribute("src") !== src) {
        frame.setAttribute("src", src);
      }

      frame.setAttribute("title", `Mapa de área de influencia aeroportuaria de ${label}`);
    }
  }

  function getAirportLabel(a) {
    const iata = String(a.IATA || "").trim().toUpperCase();

    let nombre = clean(a["Aeropuerto"]) || clean(a["Nombre del Aeropuerto"]) || iata;

    if (iata === "AEP") {
      nombre = "Aeroparque Jorge Newbery";
    }

    return `${nombre} (${iata})`;
  }

  function clean(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }
})();
