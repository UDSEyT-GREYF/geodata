/* global L */
(() => {
  "use strict";

  const DATA_VERSION = "20260925-4";
  const URLS = {
    airports: `fuentes/Datos_aeropuertos.geojson?v=${DATA_VERSION}`,
    polygons: `fuentes/poligonos_aeropuertos.geojson?v=${DATA_VERSION}`,
    influence: `fuentes/Areasinfluencia39.geojson?v=${DATA_VERSION}`,
    populationOneHour: `fuentes/PoblacionDentro1hora.geojson?v=${DATA_VERSION}`,
    localities: `fuentes/INDEC/localidades_censales.geojson?v=${DATA_VERSION}`,
  
    coverage60: `img/Tiempos/Cobertura%20Tiempo%20de%20viaje%20SNA%2060%20min%20vuelos%20reg.geojson?v=${DATA_VERSION}`,
    coverage120: `img/Tiempos/Cobertura%20Tiempo%20de%20viaje%20SNA%20120%20min%20vuelos%20reg.geojson?v=${DATA_VERSION}`,
    coverage180: `img/Tiempos/Cobertura%20Tiempo%20de%20viaje%20SNA%20180%20min%20vuelos%20reg.geojson?v=${DATA_VERSION}`
  };

  const TIME_FILE_OVERRIDES = {
    LPG: "LGP"
  };

  // Vista inicial más cercana, similar a la escala visual del mapa original de ArcGIS.
  // El botón "Ver todos los aeropuertos" sigue ajustando la extensión a los 57 puntos.
  const INITIAL_CENTER = [-36.8, -64.2];
  const INITIAL_ZOOM = 7;

  const REGULAR_SERVICE_EXCEPTIONS_2025 = new Set([
  "EPA",
  "LGS"
]);

function hasRegularService2025(airport) {
  if (!airport) return false;

  const regular = clean(
    airport.raw?.["Vuelos comerciales regulares"]
  ).toLowerCase();

  if (regular === "no aplica") return false;

  if (REGULAR_SERVICE_EXCEPTIONS_2025.has(airport.iata)) {
    return false;
  }

  return true;
}

function getOverviewAirports() {
  return state.airports.filter(hasRegularService2025);
}

  const dom = {
    loading: document.getElementById("loadingOverlay"),
    error: document.getElementById("mapError"),
    errorMessage: document.getElementById("mapErrorMessage"),
    retry: document.getElementById("retryButton"),
    search: document.getElementById("airportSearch"),
    clearSearch: document.getElementById("clearSearch"),
    select: document.getElementById("airportSelect"),
    overview: document.getElementById("overviewButton"),
    emptySelection: document.getElementById("emptySelection"),
    details: document.getElementById("airportDetails"),
    airportIata: document.getElementById("airportIata"),
    airportLocation: document.getElementById("airportLocation"),
    airportName: document.getElementById("airportName"),
    populationInfluence: document.getElementById("populationInfluence"),
    populationOneHour: document.getElementById("populationOneHour"),
    airportProvince: document.getElementById("airportProvince"),
    airportCity: document.getElementById("airportCity"),
    airportDistance: document.getElementById("airportDistance"),
    airportOperator: document.getElementById("airportOperator"),
    share: document.getElementById("shareButton"),
    fitMap: document.getElementById("fitMapButton"),
    fullscreen: document.getElementById("fullscreenButton"),
    mapStage: document.getElementById("mapStage"),
    mapHint: document.getElementById("mapHint"),
    basemapButtons: [...document.querySelectorAll("[data-basemap]")],
    sidebar: document.getElementById("sidebar"),
    mobilePanel: document.getElementById("mobilePanelButton"),
    mobileBackdrop: document.getElementById("mobileBackdrop"),
    aboutButton: document.getElementById("aboutButton"),
    aboutDialog: document.getElementById("aboutDialog"),
    aboutClose: document.getElementById("aboutClose"),
    toast: document.getElementById("toast")
  };

  const state = {
    map: null,
    baseLayers: {},
    currentBaseLayer: "argenmap",
    airportLayer: null,
    
    overviewTimeLayer: null,
    overviewLoaded: false,
    overviewLoading: false,
    
    overviewCoverageLayer: null,
    overviewCoverageLoaded: false,
    overviewCoverageLoading: false,
    timeLayer: null,
    influenceLayer: null,
    localityLayer: null,
    airports: [],
    filteredAirports: [],
    polygons: [],
    influenceFeatures: [],
    localities: null,
    localitiesPromise: null,
    populationOneHour: new Map(),
    markerByIata: new Map(),
    timeCache: new Map(),
    timePromises: new Map(),
    selectedIata: "",
    selectedAirport: null,
    selectedBounds: null,
    initialized: false,
    initialOverviewApplied: false
  };

  const collator = new Intl.Collator("es", { sensitivity: "base" });

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      initMap();
      bindEvents();
      await loadCoreData();
      populateAirportSelect(state.airports);
      renderAirportMarkers();
      setInitialView();
      state.initialized = true;
      setLoading(false);
      openAirportFromUrl();
    } catch (error) {
      console.error(error);
      setLoading(false);
      showError(error.message || "No se pudieron cargar los datos del mapa.");
    }
  }

  function initMap() {
    if (!window.L) throw new Error("La biblioteca del mapa no está disponible.");

    const argenmap = L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      {
        minZoom: 3,
        maxZoom: 18,
        tms: true,
        attribution: "© Instituto Geográfico Nacional · Argenmap"
      }
    );

    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      minZoom: 3,
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    });

    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        minZoom: 3,
        maxZoom: 19,
        attribution: "Tiles &copy; Esri"
      }
    );

    state.baseLayers = { argenmap, osm, satellite };

    state.map = L.map("map", {
      center: [-38.2, -64.2],
      zoom: 4,
      minZoom: 3,
      maxZoom: 19,
      zoomControl: false,
      worldCopyJump: true,
      layers: [argenmap]
    });

    L.control.zoom({ position: "topleft" }).addTo(state.map);

    state.map.createPane("timePane");
    state.map.getPane("timePane").style.zIndex = 410;
    state.map.createPane("influencePane");
    state.map.createPane("coveragePane");
    state.map.getPane("coveragePane").style.zIndex = 420;
    state.map.getPane("influencePane").style.zIndex = 430;
    state.map.createPane("localityPane");
    state.map.getPane("localityPane").style.zIndex = 440;
    state.map.createPane("airportPane");
    state.map.getPane("airportPane").style.zIndex = 460;

    state.airportLayer = L.layerGroup().addTo(state.map);
  }

  async function loadCoreData() {
    setLoading(true);
    hideError();

    const [airportsGeoJSON, polygonsGeoJSON, influenceGeoJSON, populationGeoJSON] = await Promise.all([
      fetchJSON(URLS.airports),
      fetchJSON(URLS.polygons).catch(() => ({ features: [] })),
      fetchJSON(URLS.influence).catch(() => ({ features: [] })),
      fetchJSON(URLS.populationOneHour).catch(() => ({ features: [] }))
    ]);

    state.polygons = polygonsGeoJSON.features || [];
    state.influenceFeatures = influenceGeoJSON.features || [];
    state.populationOneHour = parsePopulationOneHour(populationGeoJSON);

    state.airports = (airportsGeoJSON.features || [])
      .map(feature => prepareAirport(feature.properties || {}))
      .filter(airport => airport.iata && airport.center)
      .sort((a, b) => collator.compare(a.label, b.label));

    state.filteredAirports = [...state.airports];
  }

  async function fetchJSON(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo cargar ${url}.`);
    return response.json();
  }

  function prepareAirport(props) {
    const iata = clean(props.IATA).toUpperCase();
    const name = clean(props["Nombre del Aeropuerto"]) || clean(props.Aeropuerto) || iata;
    const shortName = clean(props.Aeropuerto) || name;
    const province = clean(props.Provincia);
    const city = clean(props.Localidad);
    const center = getAirportCenter(iata, props);

    return {
      raw: props,
      iata,
      name,
      shortName,
      province,
      city,
      center,
      label: `${iata} · ${shortName}`,
      searchText: normalize([iata, name, shortName, province, city].join(" "))
    };
  }

  function getAirportCenter(iata, props) {
    const matching = state.polygons.filter(feature => {
      const p = feature.properties || {};
      return clean(p.IATA || p.iata).toUpperCase() === iata;
    });

    if (matching.length) {
      try {
        const bounds = L.geoJSON(matching).getBounds();
        if (bounds.isValid()) {
          const c = bounds.getCenter();
          return [c.lat, c.lng];
        }
      } catch (error) {
        console.warn(`No se pudo obtener centro por polígono para ${iata}`, error);
      }
    }

    const lat = Number(props.Lat ?? props.LAT ?? props.lat);
    const lon = Number(props.Lon ?? props.LON ?? props.Long ?? props.lon ?? props.lng);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];

    return null;
  }

  function parsePopulationOneHour(geojson) {
    const result = new Map();
    (geojson.features || []).forEach(feature => {
      const p = feature.properties || {};
      const iata = clean(p.IATA || p.iata).toUpperCase();
      if (!iata) return;
      let value = clean(p.Pob1hora || p.pob1hora);
      if (value && !value.includes("%")) value += "%";
      result.set(iata, value || "—");
    });
    return result;
  }

  function populateAirportSelect(airports) {
    const current = dom.select.value;
    dom.select.innerHTML = '<option value="">Seleccionar aeropuerto…</option>';

    airports.forEach(airport => {
      const option = document.createElement("option");
      option.value = airport.iata;
      option.textContent = `${airport.iata} · ${airport.shortName}`;
      dom.select.appendChild(option);
    });

    if (current && airports.some(a => a.iata === current)) dom.select.value = current;
  }

  function renderAirportMarkers() {
    state.airportLayer.clearLayers();
    state.markerByIata.clear();

    state.airports.forEach(airport => {
      const marker = L.marker(airport.center, {
        pane: "airportPane",
        icon: createAirportIcon(airport, airport.iata === state.selectedIata),
        keyboard: true,
        title: airport.label
      });

      marker.bindTooltip(`${airport.iata} · ${escapeHTML(airport.shortName)}`, {
        direction: "top",
        offset: [0, -8],
        className: "airport-tooltip"
      });

      marker.on("click", () => selectAirport(airport.iata, { source: "marker", updateUrl: true }));
      marker.addTo(state.airportLayer);
      state.markerByIata.set(airport.iata, marker);
    });
  }

  function createAirportIcon(airport, selected) {
    const iata = airport.iata;
    const image = `img/Terminales/${encodeURIComponent(iata)}_terminal.png`;

    return L.divIcon({
      className: "airport-marker",
      html: `
        <span class="airport-photo-marker${selected ? " is-selected" : ""}">
          <span class="airport-photo-frame">
            <img src="${image}" alt="" loading="lazy" draggable="false" onerror="this.style.display='none'">
          </span>
          <span class="airport-photo-code">${escapeHTML(iata)}</span>
        </span>`,
      iconSize: [46, 46],
      iconAnchor: [23, 23],
      tooltipAnchor: [0, -25]
    });
  }

  async function selectAirport(iata, { source = "selector", updateUrl = true } = {}) {
    iata = clean(iata).toUpperCase();
    if (!iata) {
      showOverview({ updateUrl });
      return;
    }

    const airport = state.airports.find(item => item.iata === iata);
    if (!airport) return;

    if (state.selectedIata === iata && state.timeLayer) {
      focusSelected();
      closeMobilePanel();
      return;
    }

    hideError();
    state.selectedIata = iata;
    state.selectedAirport = airport;
    dom.select.value = iata;
    dom.mapHint.classList.add("is-hidden");
    renderAirportDetails(airport);
    updateSelectedMarker();
    hideOverviewTravelTimes();
    hideOverviewCoverage();
    clearSelectedLayers();
    showMapBusy(true);

    try {
      await Promise.all([
        drawTravelTimes(airport),
        drawInfluenceArea(airport)
      ]);
      await drawLocalities(airport);

      state.selectedBounds = getSelectedBounds(airport);
      focusSelected();
      trackAirportView(airport, source);

      if (updateUrl) updateUrlAirport(iata);
    } catch (error) {
      console.error(error);
      showError(`No fue posible cargar los tiempos de viaje para ${iata}.`);
    } finally {
      showMapBusy(false);
      closeMobilePanel();
    }
  }

  function renderAirportDetails(airport) {
    const p = airport.raw;
    dom.emptySelection.hidden = true;
    dom.details.hidden = false;
    dom.airportIata.textContent = airport.iata;
    dom.airportLocation.textContent = airport.province || "Sistema Nacional de Aeropuertos";
    dom.airportName.textContent = getAirportDisplayName(airport);
    dom.populationInfluence.textContent = formatInteger(p["Población del Área de Influencia (Censo 2022)"]);
    dom.populationOneHour.textContent = state.populationOneHour.get(airport.iata) || "—";
    dom.airportProvince.textContent = airport.province || "—";
    dom.airportCity.textContent = airport.city || "—";

    const distance = parseNumberFlexible(p["Distancia al centro de la ciudad (km)"]);
    dom.airportDistance.textContent = Number.isFinite(distance) ? `${formatDecimal(distance)} km` : "—";
    dom.airportOperator.textContent = clean(p.Explotador) || "—";
  }
function getAirportDisplayName(airport) {
  if (!airport) return "—";

  const iata = clean(airport.iata).toUpperCase();

  // Excepciones que conservan su denominación habitual en GeoData.
  const specialNames = {
    AEP: "Aeroparque Jorge Newbery"
  };

  if (specialNames[iata]) {
    return specialNames[iata];
  }

  const placeName =
    clean(airport.shortName) ||
    clean(airport.raw?.Aeropuerto) ||
    clean(airport.city) ||
    iata;

  // Evitar duplicar el prefijo si la fuente ya lo tuviera.
  if (/^Aeropuerto\b/i.test(placeName)) {
    return placeName;
  }

  if (/^Aeroparque\b/i.test(placeName)) {
    return placeName;
  }

  return `Aeropuerto de ${placeName}`;
}
  
  async function drawTravelTimes(airport) {
    const geojson = await loadTravelTimeGeoJSON(airport);
    const features = [...(geojson.features || [])].sort((a, b) => getToBreak(b) - getToBreak(a));
    if (!features.length) throw new Error(`Sin isócronas para ${airport.iata}`);

    state.timeLayer = L.geoJSON({ type: "FeatureCollection", features }, {
      pane: "timePane",
      interactive: false,
      smoothFactor: 1.2,
      style: feature => travelTimeStyle(feature, false)
    }).addTo(state.map);
  }

  function getTravelTimeUrl(airport) {
    const fileCode = TIME_FILE_OVERRIDES[airport.iata] || airport.iata;
    return `img/Tiempos/Tiempos_${fileCode}.geojson?v=${DATA_VERSION}`;
  }

  async function loadTravelTimeGeoJSON(airport) {
    if (state.timeCache.has(airport.iata)) {
      return state.timeCache.get(airport.iata);
    }

    if (state.timePromises.has(airport.iata)) {
      return state.timePromises.get(airport.iata);
    }

    const promise = fetchJSON(getTravelTimeUrl(airport))
      .then(geojson => {
        state.timeCache.set(airport.iata, geojson);
        state.timePromises.delete(airport.iata);
        return geojson;
      })
      .catch(error => {
        state.timePromises.delete(airport.iata);
        throw error;
      });

    state.timePromises.set(airport.iata, promise);
    return promise;
  }

function travelTimeStyle(feature, overview = false) {
  const to = getToBreak(feature);

  // Tres bandas reales de los GeoJSON:
  // 0–60 min, 60–120 min y 120–180 min.
  // Paleta ajustada para aproximar la simbología del mapa ArcGIS original.
  let color = "#A7C0F3";

  if (to === 60) color = "#1547B3";
  else if (to === 120) color = "#416FF9";
  else if (to === 180) color = "#A7C0F3";

  // Vista general de aeropuertos con vuelos regulares:
  // se prioriza el relleno y se suavizan los bordes individuales.
  if (overview) {
    let fillOpacity = 0.28;

    if (to === 60) fillOpacity = 0.46;
    else if (to === 120) fillOpacity = 0.36;
    else if (to === 180) fillOpacity = 0.26;

    return {
      color,
      weight: 0.55,
      opacity: 0.55,
      fillColor: color,
      fillOpacity
    };
  }

  // Vista individual del aeropuerto seleccionado.
  return {
    color,
    weight: 1.2,
    opacity: 0.96,
    fillColor: color,
    fillOpacity: 0.40
  };
}

  function ensureOverviewTimeLayer() {
    if (!state.overviewTimeLayer) {
      state.overviewTimeLayer = L.layerGroup();
    }

    if (!state.map.hasLayer(state.overviewTimeLayer)) {
      state.overviewTimeLayer.addTo(state.map);
    }

    return state.overviewTimeLayer;
  }

  function hideOverviewTravelTimes() {
    if (state.overviewTimeLayer && state.map.hasLayer(state.overviewTimeLayer)) {
      state.map.removeLayer(state.overviewTimeLayer);
    }
  }

function ensureOverviewCoverageLayer() {
  if (!state.overviewCoverageLayer) {
    state.overviewCoverageLayer = L.layerGroup();
  }

  if (!state.map.hasLayer(state.overviewCoverageLayer)) {
    state.overviewCoverageLayer.addTo(state.map);
  }

  return state.overviewCoverageLayer;
}

function hideOverviewCoverage() {
  if (
    state.overviewCoverageLayer &&
    state.map.hasLayer(state.overviewCoverageLayer)
  ) {
    state.map.removeLayer(state.overviewCoverageLayer);
  }
}

function coverageStyle(minutes) {
  let color = "#A7C0F3";

  if (minutes === 60) color = "#1547B3";
  else if (minutes === 120) color = "#416FF9";
  else if (minutes === 180) color = "#A7C0F3";

  return {
    color,
    weight: 2.4,
    opacity: 1,
    fill: false,
    fillOpacity: 0,
    lineCap: "round",
    lineJoin: "round"
  };
}

async function showOverviewCoverage() {
  ensureOverviewCoverageLayer();

  if (
    state.overviewCoverageLoaded ||
    state.overviewCoverageLoading
  ) {
    return;
  }

  state.overviewCoverageLoading = true;

  try {
    const [coverage180, coverage120, coverage60] =
      await Promise.all([
        fetchJSON(URLS.coverage180),
        fetchJSON(URLS.coverage120),
        fetchJSON(URLS.coverage60)
      ]);

    /*
     * Orden deliberado:
     * primero 180, luego 120 y finalmente 60.
     * Así el borde de menor tiempo queda visualmente arriba.
     */

    L.geoJSON(coverage180, {
      pane: "coveragePane",
      interactive: false,
      smoothFactor: 1.5,
      style: coverageStyle(180)
    }).addTo(state.overviewCoverageLayer);

    L.geoJSON(coverage120, {
      pane: "coveragePane",
      interactive: false,
      smoothFactor: 1.5,
      style: coverageStyle(120)
    }).addTo(state.overviewCoverageLayer);

    L.geoJSON(coverage60, {
      pane: "coveragePane",
      interactive: false,
      smoothFactor: 1.5,
      style: coverageStyle(60)
    }).addTo(state.overviewCoverageLayer);

    state.overviewCoverageLoaded = true;

  } catch (error) {
    console.warn(
      "No se pudieron cargar las coberturas generales SNA",
      error
    );

  } finally {
    state.overviewCoverageLoading = false;
  }
}
  
  async function showOverviewTravelTimes() {
    ensureOverviewTimeLayer();
    if (state.overviewLoaded || state.overviewLoading) return;

    state.overviewLoading = true;
    setOverviewHint("Cargando tiempos de viaje", "Las isócronas de los 57 aeropuertos se incorporan progresivamente al mapa.");

const overviewAirports = getOverviewAirports();

let nextIndex = 0;
const workerCount = 6;

async function worker() {
  while (nextIndex < overviewAirports.length) {
    const airport = overviewAirports[nextIndex++];
        try {
          const geojson = await loadTravelTimeGeoJSON(airport);
          const features = [...(geojson.features || [])].sort((a, b) => getToBreak(b) - getToBreak(a));
          if (!features.length) continue;

          L.geoJSON({ type: "FeatureCollection", features }, {
            pane: "timePane",
            interactive: false,
            smoothFactor: 3,
            style: feature => travelTimeStyle(feature, true)
          }).addTo(state.overviewTimeLayer);
        } catch (error) {
          console.warn(`No se pudo cargar la isócrona general de ${airport.iata}`, error);
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
      state.overviewLoaded = true;
    } finally {
      state.overviewLoading = false;
      if (!state.selectedIata) {
        setOverviewHint("57 aeropuertos", "Hacé clic sobre una terminal para explorar sus tiempos de viaje en detalle.");
      }
    }
  }

  function setOverviewHint(title, text) {
    const titleEl = dom.mapHint.querySelector("strong");
    const textEl = dom.mapHint.querySelector("span");
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
  }

  function getToBreak(feature) {
    const p = feature?.properties || {};
    return Number(p.ToBreak ?? p.tobreak ?? p.TOBREAK ?? p.to_break ?? p.TO_BREAK ?? 0);
  }

  async function drawInfluenceArea(airport) {
    let features = state.influenceFeatures.filter(feature => {
      const p = feature.properties || {};
      const code = clean(p.Areas2022 || p.areas2022 || p.AREAS2022 || p.IATA || p.iata || p.iata_code).toUpperCase();
      return code === airport.iata;
    });

    if (airport.iata === "USH" || airport.iata === "RGA") {
      const fuegianBounds = L.latLngBounds([-55.7, -70.4], [-49.8, -55.2]).pad(0.15);
      features = features.map(feature => filterFeatureToBounds(feature, fuegianBounds)).filter(Boolean);
    }

    if (!features.length) return;

    state.influenceLayer = L.geoJSON(features, {
      pane: "influencePane",
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
    }).addTo(state.map);
  }


  function filterFeatureToBounds(feature, bounds) {
    if (!feature?.geometry) return null;
    const geom = feature.geometry;

    if (geom.type === "Polygon") {
      try {
        const b = L.geoJSON(feature).getBounds();
        return b.isValid() && bounds.intersects(b) ? feature : null;
      } catch {
        return null;
      }
    }

    if (geom.type === "MultiPolygon") {
      const kept = (geom.coordinates || []).filter(coords => {
        try {
          const temp = {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: coords }
          };
          const b = L.geoJSON(temp).getBounds();
          return b.isValid() && bounds.intersects(b);
        } catch {
          return false;
        }
      });

      if (!kept.length) return null;
      return {
        type: "Feature",
        properties: feature.properties || {},
        geometry: { type: "MultiPolygon", coordinates: kept }
      };
    }

    return feature;
  }

  async function drawLocalities(airport) {
    await ensureLocalities();
    if (!state.localities?.length) return;

    const bounds = getSelectedBounds(airport);
    if (!bounds?.isValid()) return;
    const padded = bounds.pad(0.38);

    const features = state.localities.filter(feature => featureIntersectsBounds(feature, padded));
    if (!features.length) return;

    state.localityLayer = L.geoJSON(features, {
      pane: "localityPane",
      interactive: true,
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: 2.7,
        color: "#1f2933",
        weight: 1,
        fillColor: "#ffffff",
        fillOpacity: 0.95
      }),
      style: {
        color: "#1f2933",
        weight: 0.8,
        fillColor: "#ffffff",
        fillOpacity: 0.65
      },
      onEachFeature: (feature, layer) => {
        const label = getLocalityLabel(feature.properties || {});
        if (label) {
          layer.bindTooltip(label, {
            permanent: false,
            sticky: true,
            direction: "top",
            offset: [0, -3],
            className: "localidad-tooltip"
          });
        }
      }
    }).addTo(state.map);
  }

  async function ensureLocalities() {
    if (state.localities) return state.localities;
    if (!state.localitiesPromise) {
      state.localitiesPromise = fetchJSON(URLS.localities)
        .then(geojson => {
          state.localities = geojson.features || [];
          return state.localities;
        })
        .catch(error => {
          console.warn("No se pudieron cargar las localidades censales", error);
          state.localities = [];
          return state.localities;
        });
    }
    return state.localitiesPromise;
  }

  function featureIntersectsBounds(feature, bounds) {
    try {
      const b = L.geoJSON(feature).getBounds();
      return Boolean(b?.isValid() && bounds.intersects(b));
    } catch {
      return false;
    }
  }

  function getLocalityLabel(p) {
    return clean(p.nam || p.NAM || p.nombre || p.NOMBRE || p.localidad || p.LOCALIDAD || p.nomloc || p.NOMLOC || p.name || p.NAME);
  }

  function getSelectedBounds(airport) {
    let bounds = null;

    [state.timeLayer, state.influenceLayer].forEach(layer => {
      if (!layer?.getBounds) return;
      const b = layer.getBounds();
      if (b?.isValid()) bounds = bounds ? bounds.extend(b) : b;
    });

    if (airport?.center) {
      const pointBounds = L.latLngBounds(airport.center, airport.center);
      bounds = bounds ? bounds.extend(pointBounds) : pointBounds;
    }

    return bounds;
  }

  function focusSelected() {
    if (!state.selectedAirport) return;
    const bounds = state.selectedBounds || getSelectedBounds(state.selectedAirport);

    if (bounds?.isValid()) {
      state.map.fitBounds(bounds, { padding: [18, 18], maxZoom: 9 });
    } else {
      state.map.setView(state.selectedAirport.center, 7);
    }
  }

  function setInitialView() {
    state.map.setView(INITIAL_CENTER, INITIAL_ZOOM);
  }

function fitOverview() {
  const centers = state.airports.map(a => a.center).filter(Boolean);

  if (!centers.length) {
    state.map.setView([-38.2, -64.2], 5);
    return;
  }

  state.map.fitBounds(
    L.latLngBounds(centers),
    {
      padding: [20, 20],
      maxZoom: 6
    }
  );
}

  function showOverview({ updateUrl = true, fitAll = true } = {}) {
    state.selectedIata = "";
    state.selectedAirport = null;
    state.selectedBounds = null;
    dom.select.value = "";
    dom.emptySelection.hidden = false;
    dom.details.hidden = true;
    dom.mapHint.classList.remove("is-hidden");
    clearSelectedLayers();
    updateSelectedMarker();
    ensureOverviewTimeLayer();
    
    showOverviewTravelTimes();
    showOverviewCoverage();
    fitAll ? fitOverview() : setInitialView();
    if (updateUrl) updateUrlAirport("");
    track("map_overview", {});
    closeMobilePanel();
  }

  function clearSelectedLayers() {
    ["timeLayer", "influenceLayer", "localityLayer"].forEach(key => {
      const layer = state[key];
      if (layer && state.map.hasLayer(layer)) state.map.removeLayer(layer);
      state[key] = null;
    });
  }

  function updateSelectedMarker() {
    state.markerByIata.forEach((marker, iata) => {
      const airport = state.airports.find(item => item.iata === iata);
      if (airport) marker.setIcon(createAirportIcon(airport, iata === state.selectedIata));
    });
  }

  function bindEvents() {
    dom.search.addEventListener("input", () => {
      const query = normalize(dom.search.value);
      dom.clearSearch.hidden = !dom.search.value;
      state.filteredAirports = query
        ? state.airports.filter(airport => airport.searchText.includes(query))
        : [...state.airports];
      populateAirportSelect(state.filteredAirports);
    });

    dom.clearSearch.addEventListener("click", () => {
      dom.search.value = "";
      dom.clearSearch.hidden = true;
      state.filteredAirports = [...state.airports];
      populateAirportSelect(state.filteredAirports);
      dom.search.focus();
    });

    dom.select.addEventListener("change", () => {
      selectAirport(dom.select.value, { source: "selector", updateUrl: true });
    });

    dom.overview.addEventListener("click", () => showOverview({ updateUrl: true }));
    dom.fitMap.addEventListener("click", () => {
      state.selectedAirport ? focusSelected() : fitOverview();
      track("map_fit", { airport_iata: state.selectedIata || null });
    });

    dom.fullscreen.addEventListener("click", toggleFullscreen);
    dom.share.addEventListener("click", shareSelectedAirport);

    dom.basemapButtons.forEach(button => {
      button.addEventListener("click", () => switchBasemap(button.dataset.basemap));
    });

    dom.mobilePanel.addEventListener("click", toggleMobilePanel);
    dom.mobileBackdrop.addEventListener("click", closeMobilePanel);

    dom.aboutButton.addEventListener("click", () => dom.aboutDialog.showModal());
    dom.aboutClose.addEventListener("click", () => dom.aboutDialog.close());

    dom.retry.addEventListener("click", () => window.location.reload());
    document.addEventListener("fullscreenchange", () => setTimeout(() => state.map?.invalidateSize(), 100));
    window.addEventListener("popstate", openAirportFromUrl);
  }

  function switchBasemap(name) {
    if (!state.baseLayers[name] || name === state.currentBaseLayer) return;
    const current = state.baseLayers[state.currentBaseLayer];
    if (current && state.map.hasLayer(current)) state.map.removeLayer(current);
    state.baseLayers[name].addTo(state.map);
    state.currentBaseLayer = name;

    dom.basemapButtons.forEach(button => {
      const active = button.dataset.basemap === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    track("basemap_change", { basemap: name, airport_iata: state.selectedIata || null });
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await dom.mapStage.requestFullscreen();
        track("fullscreen", { state: "enter", airport_iata: state.selectedIata || null });
      } else {
        await document.exitFullscreen();
        track("fullscreen", { state: "exit", airport_iata: state.selectedIata || null });
      }
    } catch (error) {
      console.warn("No se pudo cambiar el modo pantalla completa", error);
    }
  }

  async function shareSelectedAirport() {
    if (!state.selectedAirport) return;
    const url = new URL(window.location.href);
    url.searchParams.set("airport", state.selectedAirport.iata);
    url.hash = "";

    try {
      await navigator.clipboard.writeText(url.toString());
      showToast("Enlace copiado");
    } catch {
      window.prompt("Copiá este enlace:", url.toString());
    }

    track("share_airport", { airport_iata: state.selectedAirport.iata });
  }

  function openAirportFromUrl() {
    if (!state.initialized) return;
    const params = new URLSearchParams(window.location.search);
    const iata = clean(params.get("airport")).toUpperCase();

    if (iata && state.airports.some(a => a.iata === iata)) {
      state.initialOverviewApplied = true;
      selectAirport(iata, { source: "url", updateUrl: false });
    } else if (!iata) {
      const isFirstOverview = !state.initialOverviewApplied;
      showOverview({ updateUrl: false, fitAll: !isFirstOverview });
      state.initialOverviewApplied = true;
    }
  }

  function updateUrlAirport(iata) {
    const url = new URL(window.location.href);
    if (iata) url.searchParams.set("airport", iata);
    else url.searchParams.delete("airport");
    window.history.pushState({}, "", url);
  }

  function trackAirportView(airport, source) {
    if (window.sigaAnalytics?.trackAirport) {
      window.sigaAnalytics.trackAirport(airport.iata, {
        airport_name: airport.shortName,
        province: airport.province || null,
        source
      });
      return;
    }

    track("airport_view", {
      airport_iata: airport.iata,
      airport_name: airport.shortName,
      province: airport.province || null,
      source
    });
  }

  function track(eventName, metadata) {
    if (window.sigaAnalytics?.track) {
      window.sigaAnalytics.track(eventName, metadata || {});
    }
  }

  function toggleMobilePanel() {
    const open = dom.sidebar.classList.toggle("is-open");
    dom.mobilePanel.setAttribute("aria-expanded", open ? "true" : "false");
    dom.mobileBackdrop.hidden = !open;
  }

  function closeMobilePanel() {
    dom.sidebar.classList.remove("is-open");
    dom.mobilePanel.setAttribute("aria-expanded", "false");
    dom.mobileBackdrop.hidden = true;
  }

  function setLoading(show) {
    dom.loading.hidden = !show;
  }

  function showMapBusy(show) {
    if (!state.initialized) return;
    dom.loading.hidden = !show;
    if (show) {
      dom.loading.querySelector("strong").textContent = "Cargando aeropuerto";
      dom.loading.querySelector("span").textContent = "Preparando tiempos de viaje y contexto territorial…";
    }
  }

  function showError(message) {
    dom.errorMessage.textContent = message;
    dom.error.hidden = false;
  }

  function hideError() {
    dom.error.hidden = true;
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      dom.toast.hidden = true;
    }, 1800);
  }

  function parseNumberFlexible(value) {
    if (value === null || value === undefined || value === "") return NaN;
    if (typeof value === "number") return value;
    const raw = String(value).trim();
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : NaN;
  }

  function formatInteger(value) {
    const number = parseNumberFlexible(value);
    return Number.isFinite(number)
      ? number.toLocaleString("es-AR", { maximumFractionDigits: 0 })
      : "—";
  }

  function formatDecimal(value) {
    return Number(value).toLocaleString("es-AR", { maximumFractionDigits: 1 });
  }

  function clean(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function normalize(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function escapeHTML(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
