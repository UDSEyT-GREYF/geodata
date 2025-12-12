// js/datos-clave.js
// Lógica de "datos-clave.html" separada a archivo externo

/* global L */

(() => {
  "use strict";

  /* ============================================================
     A. VARIABLES GLOBALES
     ============================================================ */
  let aeropuertos = [];
  let poligonos = [];
  let psnFeatures = [];
  let pistasFeatures = [];
  let contactosPorIATA = {};
  let inversionesPorIATA = {};
  let transportePorIATA = {};
  let paradasFeatures = [];
  let terminalesFeatures = [];
  let provinciasFeatures = [];
  let areasInfluenciaFeatures = [];

  let selectEl = null;

  // Mapas Leaflet
  let map, mapMarker, poligonoLayer;
  let mapPSN, psnLayer, pistasLayerPSN;
  let mapUbicacion, ubicacionMarker, provinciasLayer;
  let mapTransporte, transporteLayer;
  let mapInfluencia, tiemposLayer, influenciaLayer, influenciaMarker;
  let influenciaLegend = null;

  const EMP_IND_MULT = 5.8;

  const airportIcon = L.icon({
    iconUrl: "img/icons/AeropuertosSNA.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    tooltipAnchor: [0, -18]
  });

  /* ============================================================
     B. HELPERS DE FORMATEO
     ============================================================ */
  function formatNumber(n) {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "–";
    return Number(n).toLocaleString("es-AR");
  }

  function clean(text) {
    if (text === null || text === undefined) return "";
    return String(text).trim();
  }

  function safeVal(v) {
    return (v !== null && v !== undefined && v !== "" && !isNaN(v))
      ? formatNumber(v)
      : (clean(v) || "–");
  }

  function splitField(str) {
    if (!str) return [];
    return str
      .split(/[;]+| {2,}|\t+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function getAirportCenterLatLng(a) {
    const iata = a.IATA;

    if (poligonos.length && iata) {
      const feats = poligonos.filter(f =>
        String(f.properties?.IATA || "").toUpperCase() === iata
      );
      if (feats.length) {
        const tmp = L.geoJSON(feats).getBounds();
        if (tmp.isValid()) return [tmp.getCenter().lat, tmp.getCenter().lng];
      }
    }

    const lat = a.Lat || a.LAT;
    const lon = a.Lon || a.LON || a.Long;
    return (lat && lon) ? [Number(lat), Number(lon)] : null;
  }

  /* ============================================================
     C. INICIALIZACIÓN DE MAPAS
     ============================================================ */
  function initMap() {
    // Predio
    map = L.map("mapPredio").setView([-34.6, -58.4], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);
    mapMarker = L.marker([-34.6, -58.4]).addTo(map);

    // PSN
    mapPSN = L.map("mapPSN").setView([-34.6, -58.4], 5);
    L.esri.basemapLayer("Imagery").addTo(mapPSN);

    // Ubicación
    mapUbicacion = L.map("mapUbicacion").setView([-38, -64], 4);
    L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      { tms: true, maxZoom: 14 }
    ).addTo(mapUbicacion);

    // Transporte
    mapTransporte = L.map("mapTransporte").setView([-34.6, -58.4], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(mapTransporte);

    // Influencia
    mapInfluencia = L.map("mapInfluencia").setView([-38, -64], 4);
    L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      { tms: true, maxZoom: 14 }
    ).addTo(mapInfluencia);
  }

  /* ============================================================
     D. RENDER PRINCIPAL DEL AEROPUERTO
     ============================================================ */
  function renderAirport(iataCode) {
    const a = aeropuertos.find(x => x.IATA === iataCode);
    if (!a) return;

    const iata = a.IATA.toUpperCase();
    const nombre = clean(a.Aeropuerto) || clean(a["Nombre del Aeropuerto"]) || iata;
    const nombreOficial = clean(a["Nombre del Aeropuerto"]);

    const tituloFinal =
      iata === "AEP"
        ? "Aeroparque Jorge Newbery (AEP)"
        : `${nombre} (${iata}) – ${nombreOficial || ""}`.trim();

    document.getElementById("pageTitle").textContent = tituloFinal;

    // Encabezados
    const secciones = {
      hdrSuperficie: "Explotación",
      hdrMovimiento: "Área de movimiento",
      hdrTerminal: "Terminal de pasajeros",
      hdrUbicacion: "Ubicación y accesibilidad",
      hdrServicios: "Servicios y ayudas",
      hdrEmpleo: "Impacto territorial del aeropuerto"
    };

    Object.entries(secciones).forEach(([id, label]) => {
      const el = document.getElementById(id);
      if (!el) return;

      const btn = el.querySelector("#btnInfoImpacto");
      el.innerHTML = `${label} <small>${nombre} (${iata})</small>`;
      if (btn) el.appendChild(btn);
    });

    /* ---------- KPI SUPERIOR ---------- */
    document.getElementById("kpiCheckin").textContent = safeVal(a["Mostradores Check in"]);
    document.getElementById("kpiPuertas").textContent = safeVal(a["PuertasEmbarqueTotal"]);
    document.getElementById("kpiCintas").textContent = safeVal(a["CintasTotal"]);
    document.getElementById("kpiPSN").textContent = safeVal(a["PSNTotal"]);
    document.getElementById("kpiEstac").textContent = safeVal(a["Estacionamiento Vehicular"]);
    document.getElementById("kpiMangas").textContent = safeVal(a["Mangas telescópicas"]);
    document.getElementById("kpiPSA").textContent = safeVal(a["PSAScanTotal"]);

    /* ---------- CONTACTOS ---------- */
    const contacto = contactosPorIATA[iata] || {};

    document.getElementById("kpiAdminNombre").textContent =
      clean(contacto.Administrador) || "–";
    document.getElementById("kpiAdminContacto").textContent =
      [contacto.AdmTelef, contacto.AdmCorreo].filter(Boolean).join(" · ") || "–";

    document.getElementById("kpiJefeNombre").textContent =
      clean(contacto.JefeAeropuerto || contacto["Jefe de Aeropuerto"]) || "–";
    document.getElementById("kpiJefeContacto").textContent =
      [contacto.JefeTelef, contacto.JefeCorreo].filter(Boolean).join(" · ") || "–";

    /* ---------- EMPLEO ---------- */
    const empDir = Number(String(a.EmpleoDirecto2024 || "").replace(/\./g, ""));
    const empInd = !isNaN(empDir) ? Math.round(empDir * EMP_IND_MULT) : null;

    document.getElementById("empleoDirecto").textContent =
      !isNaN(empDir) ? formatNumber(empDir) : "–";
    document.getElementById("empleoIndirecto").textContent =
      empInd !== null ? formatNumber(empInd) : "–";

    /* ---------- MAPAS ---------- */
    updateMapForAirport(a);
    updatePSNMapForAirport(a);
    updateUbicacionMapForAirport(a);
    updateTransporteMapForAirport(a);
    updateInfluenciaMapForAirport(a);
  }

  /* ============================================================
     E. CARGA DE DATOS
     ============================================================ */
  async function loadData() {
    const resp = await fetch("fuentes/Datos_aeropuertos.geojson");
    const geojson = await resp.json();
    aeropuertos = geojson.features.map(f => f.properties).filter(p => p.IATA);

    selectEl.innerHTML = "";
    aeropuertos.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.IATA;
      opt.textContent = `${a.Aeropuerto || a.IATA} (${a.IATA})`;
      selectEl.appendChild(opt);
    });

    renderAirport(aeropuertos[0].IATA);

    selectEl.addEventListener("change", e => renderAirport(e.target.value));
  }

  /* ============================================================
     F. INICIO
     ============================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    selectEl = document.getElementById("airportSelect");
    initMap();
    loadData();

    /* ---------- MODAL IMPACTO ---------- */
    const btnInfo = document.getElementById("btnInfoImpacto");
    const modalImpacto = document.getElementById("modalImpacto");

    if (btnInfo && modalImpacto) {
      btnInfo.addEventListener("click", () => {
        modalImpacto.classList.add("is-open");
        modalImpacto.setAttribute("aria-hidden", "false");
      });

      modalImpacto.querySelectorAll("[data-close-modal]").forEach(btn => {
        btn.addEventListener("click", () => {
          modalImpacto.classList.remove("is-open");
          modalImpacto.setAttribute("aria-hidden", "true");
        });
      });

      modalImpacto.addEventListener("click", e => {
        if (e.target === modalImpacto) {
          modalImpacto.classList.remove("is-open");
          modalImpacto.setAttribute("aria-hidden", "true");
        }
      });
    }
  });

})();
