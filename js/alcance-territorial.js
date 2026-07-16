/* global L */

(() => {
  "use strict";

  const PARTIAL_URL = "partials/alcance-territorial-body.html";

  const AIRPORTS_URL = "fuentes/Datos_aeropuertos.geojson";
  const AIRPORT_POLYGONS_URL = "fuentes/poligonos_aeropuertos.geojson";
  const AREAS_URL = "fuentes/Areasinfluencia39.geojson";

  let aeropuertos = [];
  let aeropuertosPoligonos = [];
  let areasInfluenciaFeatures = [];

  let map = null;
  let tiemposLayer = null;
  let influenciaLayer = null;
  let airportMarker = null;
  let legendControl = null;

  let airportSelect = null;

  const airportIcon = L.icon({
    iconUrl: "img/icons/AeropuertosSNA.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    tooltipAnchor: [0, -18]
  });

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    await loadPartial();

    airportSelect = document.getElementById("alcanceAirportSelect");

    await loadData();

    fillAirportSelect();

    initMap();

    const initialIata = getInitialAirport();
    if (initialIata && airportSelect) {
      airportSelect.value = initialIata;
    }

    renderAirport(initialIata);

    if (airportSelect) {
      airportSelect.addEventListener("change", () => {
        const iata = String(airportSelect.value || "").trim().toUpperCase();
        if (!iata) return;

        renderAirport(iata);

        const url = new URL(window.location.href);
        url.searchParams.set("airport", iata);
        window.history.replaceState({}, "", url);
      });
    }
  }

  async function loadPartial() {
    const mount = document.getElementById("alcanceTerritorialMount");
    if (!mount) return;

    const response = await fetch(PARTIAL_URL);

    if (!response.ok) {
      mount.innerHTML = "<p>No se pudo cargar el contenido de alcance territorial.</p>";
      throw new Error(`No se pudo cargar ${PARTIAL_URL}`);
    }

    mount.innerHTML = await response.text();
  }

  async function loadData() {
    const [airports, polygons, areas] = await Promise.all([
      fetchJson(AIRPORTS_URL),
      fetchJsonSafe(AIRPORT_POLYGONS_URL),
      fetchJsonSafe(AREAS_URL)
    ]);

    aeropuertos = (airports.features || [])
      .map(feature => feature.properties || {})
      .filter(props => props.IATA)
      .sort((a, b) => getAirportLabel(a).localeCompare(getAirportLabel(b), "es"));

    aeropuertosPoligonos = polygons?.features || [];
    areasInfluenciaFeatures = areas?.features || [];
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${url}: ${response.status}`);
    }
    return await response.json();
  }

  async function fetchJsonSafe(url) {
    try {
      return await fetchJson(url);
    } catch (error) {
      console.warn(error);
      return { features: [] };
    }
  }

  function fillAirportSelect() {
    if (!airportSelect) return;

    airportSelect.innerHTML = "";

    aeropuertos.forEach(a => {
      const option = document.createElement("option");
      option.value = String(a.IATA || "").trim().toUpperCase();
      option.textContent = getAirportLabel(a);
      airportSelect.appendChild(option);
    });
  }

  function getInitialAirport() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get("airport") || "").trim().toUpperCase();

    if (fromUrl && aeropuertos.some(a => getAirportIata(a) === fromUrl)) {
      return fromUrl;
    }

    if (aeropuertos.some(a => getAirportIata(a) === "AEP")) {
      return "AEP";
    }

    return getAirportIata(aeropuertos[0]);
  }

  function initMap() {
    const mapEl = document.getElementById("alcanceTerritorialMap");
    if (!mapEl) return;

    map = L.map(mapEl, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false
    }).setView([-38, -64], 4);

    map.createPane("pane_tiempos");
    map.getPane("pane_tiempos").style.zIndex = 410;

    map.createPane("pane_influencia");
    map.getPane("pane_influencia").style.zIndex = 430;

    map.createPane("pane_aeropuerto");
    map.getPane("pane_aeropuerto").style.zIndex = 450;

    L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      {
        maxZoom: 14,
        tms: true,
        attribution: "© IGN Argentina - Argenmap"
      }
    ).addTo(map);
  }

  async function renderAirport(iata) {
    if (!map || !iata) return;

    const airport = aeropuertos.find(a => getAirportIata(a) === iata);
    if (!airport) return;

    clearMapLayers();

    const airportLabel = getAirportLabel(airport);
    setBind("airportLine", airportLabel);

    await drawTravelTimeLayer(iata);
    drawInfluenceAreaLayer(iata);
    drawAirportMarker(airport);
    drawLegend(Boolean(influenciaLayer));
    fitMapToLayers(airport);

    setTimeout(() => {
      map.invalidateSize();
      fitMapToLayers(airport);
    }, 250);
  }

  function clearMapLayers() {
    if (tiemposLayer) {
      map.removeLayer(tiemposLayer);
      tiemposLayer = null;
    }

    if (influenciaLayer) {
      map.removeLayer(influenciaLayer);
      influenciaLayer = null;
    }

    if (airportMarker) {
      map.removeLayer(airportMarker);
      airportMarker = null;
    }

    if (legendControl) {
      map.removeControl(legendControl);
      legendControl = null;
    }
  }

  async function drawTravelTimeLayer(iata) {
    const tiemposUrl = `img/Tiempos/Tiempos_${iata}.geojson`;

    try {
      const gj = await fetchJson(tiemposUrl);

      if (!gj?.features?.length) return;

      tiemposLayer = L.geoJSON(gj, {
        pane: "pane_tiempos",
        interactive: false,
        style: feature => {
          const props = feature.properties || {};
          const to = Number(
            props.ToBreak ??
            props.tobreak ??
            props.TOBREAK ??
            props.to_break ??
            props.TO_BREAK
          );

          let color = "#9ecae1";

          if (to === 60) color = "#08306b";
          else if (to === 120) color = "#2171b5";
          else if (to === 180) color = "#6baed6";

          return {
            color,
            weight: 1,
            fillColor: color,
            fillOpacity: 0.35
          };
        }
      }).addTo(map);
    } catch (error) {
      console.warn(`No se pudo cargar tiempos de viaje para ${iata}:`, error);
    }
  }

  function drawInfluenceAreaLayer(iata) {
    const features = (areasInfluenciaFeatures || []).filter(feature => {
      const code = getInfluenceAreaCode(feature.properties || {});
      return code === iata;
    });

    if (!features.length) {
      console.warn(`No se encontró área de influencia para ${iata}.`);
      return;
    }

    influenciaLayer = L.geoJSON(features, {
      pane: "pane_influencia",
      interactive: false,
      style: {
        color: "#ffb000",
        opacity: 1,
        weight: 3,
        dashArray: "8 5",
        lineCap: "round",
        lineJoin: "round",
        fill: false,
        fillOpacity: 0
      }
    }).addTo(map);

    influenciaLayer.bringToFront();
  }

  function drawAirportMarker(airport) {
    const center = getAirportCenterLatLng(airport);
    if (!center) return;

    const iata = getAirportIata(airport);

    airportMarker = L.marker(center, {
      icon: airportIcon,
      pane: "pane_aeropuerto",
      zIndexOffset: 1000
    }).addTo(map);

    airportMarker.bindTooltip(iata, {
      permanent: true,
      direction: "top",
      offset: [0, -4],
      className: "psn-tooltip"
    });
  }

  function drawLegend(hasInfluenceArea) {
    legendControl = L.control({ position: "bottomleft" });

    legendControl.onAdd = function () {
      const div = L.DomUtil.create("div", "info legend");

      div.innerHTML = `
        <div style="font-weight:800; margin-bottom:3px;">Tiempos de viaje</div>
        <div><span style="display:inline-block;width:10px;height:10px;background:#08306b;margin-right:4px;border:1px solid #08306b;"></span>Hasta 1 h</div>
        <div><span style="display:inline-block;width:10px;height:10px;background:#2171b5;margin-right:4px;border:1px solid #2171b5;"></span>Entre 1 y 2 h</div>
        <div><span style="display:inline-block;width:10px;height:10px;background:#6baed6;margin-right:4px;border:1px solid #6baed6;"></span>Entre 2 y 3 h</div>
        ${hasInfluenceArea ? `
          <div style="margin-top:4px;">
            <span style="display:inline-block;width:18px;height:0;border-top:2px dashed #ffb000;margin-right:4px;vertical-align:middle;"></span>
            Área de influencia aeroportuaria
          </div>
        ` : ""}
      `;

      return div;
    };

    legendControl.addTo(map);
  }

  function fitMapToLayers(airport) {
    let bounds = null;

    if (tiemposLayer) {
      const b = tiemposLayer.getBounds();
      if (b.isValid()) bounds = b;
    }

    if (influenciaLayer) {
      const b = influenciaLayer.getBounds();
      if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
    }

    if (airportMarker) {
      const p = airportMarker.getLatLng();
      const b = L.latLngBounds(p, p);
      bounds = bounds ? bounds.extend(b) : b;
    }

    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [14, 14] });
      return;
    }

    const center = getAirportCenterLatLng(airport) || [-38, -64];
    map.setView(center, 7);
  }

  function getAirportCenterLatLng(airport) {
    const iata = getAirportIata(airport);

    const polygonFeatures = (aeropuertosPoligonos || []).filter(feature => {
      const props = feature.properties || {};
      const code = String(
        props.IATA ||
        props.iata ||
        props.iata_code ||
        props.IATA_CODE ||
        ""
      ).trim().toUpperCase();

      return code === iata;
    });

    if (polygonFeatures.length) {
      const layer = L.geoJSON(polygonFeatures);
      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        const center = bounds.getCenter();
        return [center.lat, center.lng];
      }
    }

    const lat = airport["Lat"] || airport["LAT"];
    const lon = airport["Lon"] || airport["LON"] || airport["Long"];

    if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      return [Number(lat), Number(lon)];
    }

    return null;
  }

  function getInfluenceAreaCode(props) {
    return String(
      props.Areas2022 ||
      props.areas2022 ||
      props.AREAS2022 ||
      props.IATA ||
      props.iata ||
      props.iata_code ||
      props.IATA_CODE ||
      ""
    ).trim().toUpperCase();
  }

  function getAirportIata(airport) {
    return String(airport?.IATA || "").trim().toUpperCase();
  }

  function getAirportLabel(airport) {
    const iata = getAirportIata(airport);

    let name =
      clean(airport?.["Aeropuerto"]) ||
      clean(airport?.["Nombre del Aeropuerto"]) ||
      iata;

    if (iata === "AEP") {
      name = "Aeroparque Jorge Newbery";
    }

    return `${name} (${iata})`;
  }

  function clean(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function setBind(name, value) {
    document.querySelectorAll(`[data-bind="${name}"]`).forEach(el => {
      el.textContent = value ?? "–";
    });
  }
})();
