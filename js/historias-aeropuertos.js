(() => {
  "use strict";

  const DATA_VERSION = "20260917-1";
  const URLS = {
    interviews: `data/historias/entrevistas.json?v=${DATA_VERSION}`,
    airports: "data/sudamerica/aeropuertos_sudamerica.geojson",
    countries: "data/sudamerica/limites_paises_sudamerica.geojson"
  };

  const AUTO_SATELLITE_ZOOM = 11;
  const RESULT_STEP = 1000;

  const GROUP_MEMBERS = {
    BUE: ["AEP", "EZE"],
    "PMY-REL": ["PMY", "REL"],
    "RHD SDE": ["RHD", "SDE"]
  };

  const RECORD_LOCATION_OVERRIDES = {
    "rhd-sde-2021-el-carancho": {
      key: "SDE",
      codes: ["SDE"],
      label: "Santiago del Estero"
    },
    "rhd-sde-2021-termas": {
      key: "RHD",
      codes: ["RHD"],
      label: "Termas de Río Hondo"
    }
  };

  const dom = {
    loading: document.getElementById("loadingOverlay"),
    error: document.getElementById("mapError"),
    errorMessage: document.getElementById("mapErrorMessage"),
    retry: document.getElementById("retryButton"),
    search: document.getElementById("searchInput"),
    clearSearch: document.getElementById("clearSearch"),
    year: document.getElementById("yearSelect"),
    airport: document.getElementById("airportSelect"),
    province: document.getElementById("provinceSelect"),
    sector: document.getElementById("sectorSelect"),
    theme: document.getElementById("themeSelect"),
    function: document.getElementById("functionSelect"),
    keyword: document.getElementById("keywordSelect"),
    resetFilters: document.getElementById("resetFilters"),
    resultList: document.getElementById("resultList"),
    showMore: document.getElementById("showMoreButton"),
    visibleCount: document.getElementById("visibleCount"),
    locationCount: document.getElementById("locationCount"),
    provinceCount: document.getElementById("provinceCount"),
    fitMap: document.getElementById("fitMapButton"),
    fullscreen: document.getElementById("fullscreenButton"),
    mapStage: document.getElementById("mapStage"),
    basemapButtons: [...document.querySelectorAll("[data-basemap]")],
    sidebar: document.getElementById("sidebar"),
    mobileFilter: document.getElementById("mobileFilterButton"),
    mobileBackdrop: document.getElementById("mobileBackdrop"),
    detailPanel: document.getElementById("detailPanel"),
    detailContent: document.getElementById("detailContent"),
    detailClose: document.getElementById("detailClose"),
    aboutButton: document.getElementById("aboutButton"),
    aboutDialog: document.getElementById("aboutDialog"),
    aboutClose: document.getElementById("aboutClose")
  };

  const state = {
    map: null,
    markerLayer: null,
    countryLayer: null,
    baseLayers: {},
    currentBaseLayer: "light",
    userBaseLayer: "light",
    records: [],
    filtered: [],
    airportCatalog: new Map(),
    markers: new Map(),
    resultsLimit: RESULT_STEP,
    selectedLocationKey: null,
    initialized: false
  };

  const collator = new Intl.Collator("es", { sensitivity: "base" });

  function initMap() {
    if (!window.L) throw new Error("La biblioteca del mapa no está disponible.");

    const lightLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=cb1_325a_1_1e9283ed596ac884153a8003",
      {
        subdomains: "abcd",
        maxZoom: 20,
        attribution: "&copy; OpenStreetMap &copy; CARTO"
      }
    );

    const osmLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }
    );

    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri"
      }
    );

    state.baseLayers = {
      light: lightLayer,
      osm: osmLayer,
      satellite: satelliteLayer
    };

    state.map = L.map("map", {
      center: [-38.2, -64.2],
      zoom: 4,
      minZoom: 3,
      maxZoom: 19,
      zoomControl: false,
      worldCopyJump: true,
      layers: [lightLayer]
    });

    L.control.zoom({ position: "topleft" }).addTo(state.map);
    state.markerLayer = L.layerGroup().addTo(state.map);

    state.map.createPane("countryPane");
    state.map.getPane("countryPane").style.zIndex = 320;
    state.map.getPane("countryPane").style.pointerEvents = "none";

    state.countryLayer = L.geoJSON(null, {
      pane: "countryPane",
      interactive: false,
      style: {
        color: "#0b1f33",
        weight: 1.2,
        opacity: 0.65,
        fillOpacity: 0
      }
    }).addTo(state.map);

    state.map.on("zoomend", updateBaseLayerForZoom);
    state.map.on("click", closeDetail);
    updateBasemapButtons();
  }

  async function loadData() {
    setLoading(true);
    hideError();

    try {
      const [records, airportsGeoJSON, countriesGeoJSON] = await Promise.all([
        fetchJSON(URLS.interviews),
        fetchJSON(URLS.airports),
        fetchJSON(URLS.countries).catch(() => null)
      ]);

      buildAirportCatalog(airportsGeoJSON);
      if (countriesGeoJSON) state.countryLayer.addData(countriesGeoJSON);

      state.records = records.map(prepareRecord).filter(Boolean);
      populateFilters();
      applyFilters({ fit: true });
      state.initialized = true;
      setLoading(false);
      openFromHash();
    } catch (error) {
      console.error(error);
      setLoading(false);
      showError(error.message || "No se pudieron cargar los datos.");
    }
  }

  async function fetchJSON(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo cargar ${url}.`);
    return response.json();
  }

  function buildAirportCatalog(geojson) {
    state.airportCatalog.clear();
    (geojson?.features || []).forEach((feature) => {
      const p = feature.properties || {};
      const code = String(p.codigo_iata || p.iata || feature.id || "").trim().toUpperCase();
      const coords = feature.geometry?.coordinates;
      if (!code || !Array.isArray(coords) || coords.length < 2) return;
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      state.airportCatalog.set(code, {
        code,
        lat,
        lon,
        name: p.nombre_oficial || p.name || code,
        city: p.ciudad || p.municipality || ""
      });
    });
  }

  function prepareRecord(raw) {
    const record = { ...raw };
    record.imagenes = Array.isArray(raw.imagenes) ? raw.imagenes : [];
    record.palabras_clave = Array.isArray(raw.palabras_clave) ? raw.palabras_clave : [];
    record.funciones_aeropuerto = Array.isArray(raw.funciones_aeropuerto) ? raw.funciones_aeropuerto : [];
    record.texto_parrafos = Array.isArray(raw.texto_parrafos) ? raw.texto_parrafos : [];
    record._location = resolveRecordLocation(record);
    record._search = normalize([
      record.titulo,
      record.referencia,
      record.localidad_aeroportuaria,
      record.provincia,
      record.sector_principal,
      record.tema_principal,
      record.cita_destacada,
      ...record.palabras_clave,
      ...record.funciones_aeropuerto,
      ...record.texto_parrafos
    ].filter(Boolean).join(" "));
    return record;
  }

  function resolveRecordLocation(record) {
    const override = RECORD_LOCATION_OVERRIDES[record.id];
    const baseKey = String(record.codigo_archivo || "").trim();
    const codes = override?.codes || GROUP_MEMBERS[baseKey] || record.iata || [baseKey];
    const airports = codes.map((code) => state.airportCatalog.get(String(code).toUpperCase())).filter(Boolean);

    if (!airports.length) {
      console.warn("Sin coordenadas para", record.id, codes);
      return null;
    }

    const lat = airports.reduce((sum, item) => sum + item.lat, 0) / airports.length;
    const lon = airports.reduce((sum, item) => sum + item.lon, 0) / airports.length;

    return {
      key: override?.key || baseKey,
      label: override?.label || record.localidad_aeroportuaria || baseKey,
      codes,
      lat,
      lon
    };
  }

  function populateFilters() {
    fillSelect(dom.year, unique(state.records.map((r) => r.anio_entrevista)).sort((a, b) => a - b));
    fillSelect(dom.province, unique(state.records.map((r) => r.provincia)).sort(collator.compare));
    fillSelect(dom.sector, unique(state.records.map((r) => r.sector_principal)).sort(collator.compare));
    fillSelect(dom.theme, unique(state.records.map((r) => r.tema_principal)).sort(collator.compare));
    fillSelect(dom.function, unique(state.records.flatMap((r) => r.funciones_aeropuerto)).sort(collator.compare));
    fillSelect(dom.keyword, unique(state.records.flatMap((r) => r.palabras_clave)).sort(collator.compare));

    const airportOptions = [...new Map(state.records.map((record) => [
      record.codigo_archivo,
      {
        value: record.codigo_archivo,
        label: `${record.codigo_archivo} · ${record.localidad_aeroportuaria || record.codigo_archivo}`
      }
    ])).values()].sort((a, b) => collator.compare(a.label, b.label));

    airportOptions.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      dom.airport.appendChild(option);
    });
  }

  function fillSelect(select, values) {
    values.filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
      .forEach((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        select.appendChild(option);
      });
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function applyFilters({ fit = false } = {}) {
    state.resultsLimit = RESULT_STEP;
    const query = normalize(dom.search.value);

    state.filtered = state.records.filter((record) => {
      if (dom.year.value && String(record.anio_entrevista) !== dom.year.value) return false;
      if (dom.airport.value && String(record.codigo_archivo) !== dom.airport.value) return false;
      if (dom.province.value && record.provincia !== dom.province.value) return false;
      if (dom.sector.value && record.sector_principal !== dom.sector.value) return false;
      if (dom.theme.value && record.tema_principal !== dom.theme.value) return false;
      if (dom.function.value && !record.funciones_aeropuerto.includes(dom.function.value)) return false;
      if (dom.keyword.value && !record.palabras_clave.includes(dom.keyword.value)) return false;
      if (query && !record._search.includes(query)) return false;
      return true;
    });

    dom.clearSearch.hidden = !dom.search.value;
    renderSummary();
    renderResults();
    renderMarkers();
    if (fit) fitVisibleMarkers();
  }

  function renderSummary() {
    const locations = new Set(state.filtered.map((r) => r._location?.key).filter(Boolean));
    const provinces = new Set(state.filtered.map((r) => r.provincia).filter(Boolean));
    dom.visibleCount.textContent = state.filtered.length;
    dom.locationCount.textContent = locations.size;
    dom.provinceCount.textContent = provinces.size;
  }

  function renderResults() {
    dom.resultList.innerHTML = "";
    if (!state.filtered.length) {
      dom.resultList.innerHTML = '<div class="empty-results">No hay entrevistas para los filtros seleccionados.</div>';
      dom.showMore.hidden = true;
      return;
    }

    const visible = state.filtered.slice(0, state.resultsLimit);
    visible.forEach((record) => dom.resultList.insertAdjacentHTML("beforeend", resultCardHTML(record)));
    dom.showMore.hidden = state.filtered.length <= state.resultsLimit;
  }

  function resultCardHTML(record) {
    const image = firstImage(record);
    return `
      <button class="result-card" type="button" data-record-id="${escapeAttr(record.id)}">
        <span class="result-thumb">
          ${image ? `<img src="${escapeAttr(imageUrl(image.archivo))}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=&quot;result-thumb-fallback&quot;>Sin imagen</span>'">` : '<span class="result-thumb-fallback">Sin imagen</span>'}
        </span>
        <span>
          <strong class="result-title">${escapeHTML(record.titulo || "Sin título")}</strong>
          <span class="result-meta">${escapeHTML(record.codigo_archivo)} · ${escapeHTML(record.localidad_aeroportuaria || "")} · ${escapeHTML(record.anio_entrevista)}</span>
          <span class="result-sector">${escapeHTML(record.sector_principal || "")}</span>
        </span>
      </button>`;
  }

  function renderMarkers() {
    state.markerLayer.clearLayers();
    state.markers.clear();

    const groups = new Map();
    state.filtered.forEach((record) => {
      const loc = record._location;
      if (!loc) return;
      if (!groups.has(loc.key)) groups.set(loc.key, { location: loc, records: [] });
      groups.get(loc.key).records.push(record);
    });

    groups.forEach((group, key) => {
      const count = group.records.length;
      const representative = group.records.find((record) => firstImage(record)) || group.records[0];
      const image = representative ? firstImage(representative) : null;

      const markerHTML = image
        ? `<span class="story-photo-marker">
             <img src="${escapeAttr(imageUrl(image.archivo))}" alt="" loading="lazy">
             <span class="story-photo-count">${count}</span>
           </span>`
        : `<span class="story-marker ${count === 1 ? "is-single" : ""}">${count}</span>`;

      const size = image ? 64 : (count >= 5 ? 46 : count >= 3 ? 42 : 38);
      const icon = L.divIcon({
        className: "story-marker-wrap",
        html: markerHTML,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker([group.location.lat, group.location.lon], { icon });
      marker.bindTooltip(
        `<strong>${escapeHTML(group.location.label)}</strong><br>${count} ${count === 1 ? "historia" : "historias"}`,
        { className: "story-tooltip", direction: "top", offset: [0, -18] }
      );
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        openLocation(key, group.records, group.location);
      });
      marker.addTo(state.markerLayer);
      state.markers.set(key, marker);
    });
  }

  function openLocation(key, records, location) {
    state.selectedLocationKey = key;
    dom.detailContent.innerHTML = `
      <p class="detail-kicker">${escapeHTML(location.codes.join(" · "))}</p>
      <h2 class="detail-location-title">${escapeHTML(location.label)}</h2>
      <p class="detail-location-meta">${records.length} ${records.length === 1 ? "entrevista visible" : "entrevistas visibles"}</p>
      <div class="location-stories">
        ${records.map((record) => `
          <button class="location-story-card" type="button" data-record-id="${escapeAttr(record.id)}">
            <strong>${escapeHTML(record.titulo)}</strong>
            <span>${escapeHTML(record.anio_entrevista)} · ${escapeHTML(record.sector_principal || "")}</span>
            <span>${escapeHTML(record.referencia || "")}</span>
          </button>`).join("")}
      </div>`;
    openDetailPanel();

if (location) {
  focusLocation(location);
}
  }

function extractQuotedPassages(record) {
  const passages = [];

  record.texto_parrafos.forEach((paragraph) => {
    const regex = /“([^”]+)”/g;
    let match;

    while ((match = regex.exec(paragraph)) !== null) {
      const text = match[1].trim();

      if (text) passages.push(text);
    }
  });

  return passages;
}

function comparableQuote(value) {
  return String(value || "")
    .replace(/…$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function featuredQuote(record) {
  const current = trimQuote(record.cita_destacada || "");

  if (!current) return "";

  const passages = extractQuotedPassages(record);

  if (!passages.length) return current;

  const currentComparable = comparableQuote(current);
  const searchFragment = currentComparable.slice(0, 140);

  const recovered = passages.find((passage) => {
    const comparable = comparableQuote(passage);

    return comparable.startsWith(searchFragment)
      || comparable.includes(searchFragment);
  });

  if (recovered) return recovered;

  if (current.endsWith("…")) {
    return [...passages].sort((a, b) => b.length - a.length)[0];
  }

  return current;
}
  
  function openRecord(id, { updateHash = true } = {}) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;

const location = record._location;
const related = location
  ? state.filtered.filter((item) => item._location?.key === location.key)
  : [];

const historicText = `Entrevista realizada en ${record.anio_entrevista}.`;

    dom.detailContent.innerHTML = `
      ${related.length > 1 ? `<button class="back-to-location" type="button" data-back-location="${escapeAttr(location.key)}">← Volver a ${escapeHTML(location.label)}</button>` : ""}
<div class="detail-meta-row">

  <p class="detail-kicker">
    ${escapeHTML(record.codigo_archivo)} · ${escapeHTML(record.provincia || "")}
  </p>

  <p class="historic-note-inline">
    ${escapeHTML(historicText)}
    Se conservó el testimonio según su contexto original.
  </p>

</div>

<h2 class="detail-title">
  ${escapeHTML(record.titulo || "Sin título")}
</h2>

<p class="detail-reference">
  ${escapeHTML(record.referencia || "")}
</p>
      ${galleryHTML(record)}
      ${featuredQuote(record) ? `
  <blockquote class="detail-quote">
    “${escapeHTML(featuredQuote(record))}”
  </blockquote>
` : ""}
      <div class="detail-body">
        ${record.texto_parrafos.map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join("")}
      </div>
      ${record.palabras_clave.length ? `
        <h3 class="detail-subtitle">Palabras clave</h3>
        <div class="tag-list">
          ${record.palabras_clave.map((tag) => `<button class="tag-button" type="button" data-keyword="${escapeAttr(tag)}">${escapeHTML(tag)}</button>`).join("")}
        </div>` : ""}
      ${record.funciones_aeropuerto.length ? `
        <h3 class="detail-subtitle">Función del aeropuerto</h3>
        <div class="tag-list">
          ${record.funciones_aeropuerto.map((tag) => `<span class="tag-static function-tag">${escapeHTML(tag)}</span>`).join("")}
        </div>` : ""}`;

      openDetailPanel();
      initCarousel();
      
      if (location) focusLocation(location);
    if (updateHash) history.replaceState(null, "", `#${encodeURIComponent(record.id)}`);
  }

function galleryHTML(record) {
  if (!record.imagenes.length) {
    return '<div class="gallery-empty">Imagen no disponible.</div>';
  }

  const multiple = record.imagenes.length > 1;

  return `
    <div class="story-carousel ${multiple ? "is-multiple" : ""}"
         data-story-carousel>

      <div class="story-carousel-viewport">

        ${record.imagenes.map((image, index) => `
          <figure class="story-carousel-slide ${index === 0 ? "is-active" : ""}"
                  data-carousel-slide>

            <img
              src="${escapeAttr(imageUrl(image.archivo))}"
              alt="${escapeAttr(`${record.titulo}, imagen ${index + 1}`)}"
              loading="lazy">

            ${multiple ? `
              <figcaption>
                Imagen ${index + 1} de ${record.imagenes.length}
              </figcaption>
            ` : ""}

          </figure>
        `).join("")}

      </div>

      ${multiple ? `
        <button class="carousel-button carousel-prev"
                type="button"
                data-carousel-prev
                aria-label="Imagen anterior">
          ‹
        </button>

        <button class="carousel-button carousel-next"
                type="button"
                data-carousel-next
                aria-label="Imagen siguiente">
          ›
        </button>

        <div class="carousel-dots">
          ${record.imagenes.map((_, index) => `
            <button
              type="button"
              class="carousel-dot ${index === 0 ? "is-active" : ""}"
              data-carousel-dot="${index}"
              aria-label="Mostrar imagen ${index + 1}">
            </button>
          `).join("")}
        </div>
      ` : ""}

    </div>
  `;
}

let carouselTimer = null;

function stopCarousel() {
  if (!carouselTimer) return;

  clearInterval(carouselTimer);
  carouselTimer = null;
}

function initCarousel() {
  stopCarousel();

  const carousel = dom.detailContent.querySelector("[data-story-carousel]");

  if (!carousel) return;

  const slides = [...carousel.querySelectorAll("[data-carousel-slide]")];

  if (slides.length < 2) return;

  const dots = [...carousel.querySelectorAll("[data-carousel-dot]")];
  const previous = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");

  let current = 0;

  function showSlide(index) {
    current = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === current);
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === current);
    });
  }

  function startCarousel() {
    stopCarousel();

    carouselTimer = window.setInterval(() => {
      showSlide(current + 1);
    }, 4500);
  }

  previous?.addEventListener("click", () => {
    showSlide(current - 1);
    startCarousel();
  });

  next?.addEventListener("click", () => {
    showSlide(current + 1);
    startCarousel();
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
      startCarousel();
    });
  });

  carousel.addEventListener("mouseenter", stopCarousel);
  carousel.addEventListener("mouseleave", startCarousel);

  startCarousel();
}
  
  function firstImage(record) {
    return record.imagenes?.[0] || null;
  }

  function imageUrl(fileName) {
    return `img/historias/${encodeURIComponent(String(fileName || ""))}`;
  }

  function trimQuote(value) {
    return String(value || "").replace(/^[“\"'«]+|[”\"'»]+$/g, "").trim();
  }

function focusLocation(location) {
  if (!state.map || !location) return;

  const target = L.latLng(location.lat, location.lon);
  const zoom = Math.max(state.map.getZoom(), 7);

  state.map.flyTo(target, zoom, {
    duration: 0.6
  });

  window.setTimeout(() => {
    if (!dom.detailPanel.classList.contains("is-open")) return;
    if (window.innerWidth <= 760) return;

    const mapRect = dom.mapStage.getBoundingClientRect();
    const panelRect = dom.detailPanel.getBoundingClientRect();

    const overlap = Math.max(
      0,
      Math.min(mapRect.right, panelRect.right) -
      Math.max(mapRect.left, panelRect.left)
    );

    const visibleWidth = mapRect.width - overlap;

    if (visibleWidth < 180) return;

    const point = state.map.latLngToContainerPoint(target);

    const desiredX = visibleWidth / 2;
    const deltaX = point.x - desiredX;

    state.map.panBy([deltaX, 0], {
      animate: true,
      duration: 0.35
    });
  }, 700);
}

  function fitVisibleMarkers() {
    const latlngs = [...state.markers.values()].map((marker) => marker.getLatLng());
    if (!latlngs.length) return;
    if (latlngs.length === 1) {
      state.map.setView(latlngs[0], 7);
      return;
    }
    state.map.fitBounds(L.latLngBounds(latlngs), { padding: [45, 45], maxZoom: 7 });
  }

  function openDetailPanel() {
    dom.detailPanel.classList.add("is-open");
    dom.detailPanel.setAttribute("aria-hidden", "false");
    document.body.classList.add("detail-open");
  }

function closeDetail() {
  dom.detailPanel.classList.remove("is-open");
  dom.detailPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("detail-open");

  stopCarousel();

  state.selectedLocationKey = null;

  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

  function setBaseLayer(layerKey, { remember = false } = {}) {
    const layer = state.baseLayers[layerKey];
    if (!state.map || !layer) return;

    Object.entries(state.baseLayers).forEach(([key, baseLayer]) => {
      if (key !== layerKey && state.map.hasLayer(baseLayer)) state.map.removeLayer(baseLayer);
    });

    if (!state.map.hasLayer(layer)) layer.addTo(state.map);
    state.currentBaseLayer = layerKey;
    if (remember) state.userBaseLayer = layerKey;
    updateBasemapButtons();
  }

  function updateBaseLayerForZoom() {
    if (!state.map) return;
    const target = state.map.getZoom() >= AUTO_SATELLITE_ZOOM ? "satellite" : state.userBaseLayer;
    setBaseLayer(target);
  }

  function updateBasemapButtons() {
    dom.basemapButtons.forEach((button) => {
      const active = button.dataset.basemap === state.currentBaseLayer;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function openFromHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (id && state.records.some((record) => record.id === id)) openRecord(id, { updateHash: false });
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function setLoading(show) {
    dom.loading.hidden = !show;
    dom.loading.style.display = show ? "flex" : "none";
  }

  function showError(message) {
    dom.errorMessage.textContent = message;
    dom.error.hidden = false;
  }

  function hideError() {
    dom.error.hidden = true;
  }

  function openMobileSidebar() {
    dom.sidebar.classList.add("is-open");
    dom.mobileBackdrop.hidden = false;
    dom.mobileFilter.setAttribute("aria-expanded", "true");
  }

  function closeMobileSidebar() {
    dom.sidebar.classList.remove("is-open");
    dom.mobileBackdrop.hidden = true;
    dom.mobileFilter.setAttribute("aria-expanded", "false");
  }

  function resetFilters() {
    dom.search.value = "";
    [dom.year, dom.airport, dom.province, dom.sector, dom.theme, dom.function, dom.keyword].forEach((select) => { select.value = ""; });
    applyFilters({ fit: true });
  }

  function bindEvents() {
    dom.search.addEventListener("input", () => applyFilters());
    dom.clearSearch.addEventListener("click", () => {
      dom.search.value = "";
      dom.search.focus();
      applyFilters();
    });

    [dom.year, dom.airport, dom.province, dom.sector, dom.theme, dom.function, dom.keyword]
      .forEach((select) => select.addEventListener("change", () => applyFilters()));

    dom.resetFilters.addEventListener("click", resetFilters);
    dom.retry.addEventListener("click", loadData);
    dom.showMore.addEventListener("click", () => {
      state.resultsLimit += RESULT_STEP;
      renderResults();
    });

    dom.resultList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-record-id]");
      if (button) openRecord(button.dataset.recordId);
    });

    dom.detailContent.addEventListener("click", (event) => {
      const recordButton = event.target.closest("[data-record-id]");
      if (recordButton) {
        openRecord(recordButton.dataset.recordId);
        return;
      }

      const keywordButton = event.target.closest("[data-keyword]");
      if (keywordButton) {
        dom.keyword.value = keywordButton.dataset.keyword;
        closeDetail();
        applyFilters({ fit: true });
        return;
      }

      const backButton = event.target.closest("[data-back-location]");
      if (backButton) {
        const key = backButton.dataset.backLocation;
        const records = state.filtered.filter((record) => record._location?.key === key);
        if (records.length) openLocation(key, records, records[0]._location);
      }
    });

    dom.detailClose.addEventListener("click", closeDetail);
    dom.fitMap.addEventListener("click", fitVisibleMarkers);

    dom.fullscreen.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) await dom.mapStage.requestFullscreen();
        else await document.exitFullscreen();
      } catch (error) {
        console.warn(error);
      }
    });

    document.addEventListener("fullscreenchange", () => {
      setTimeout(() => state.map?.invalidateSize(), 100);
    });

    dom.basemapButtons.forEach((button) => {
      button.addEventListener("click", () => setBaseLayer(button.dataset.basemap, { remember: true }));
    });

    dom.mobileFilter.addEventListener("click", () => {
      if (dom.sidebar.classList.contains("is-open")) closeMobileSidebar();
      else openMobileSidebar();
    });
    dom.mobileBackdrop.addEventListener("click", closeMobileSidebar);

    dom.aboutButton.addEventListener("click", () => dom.aboutDialog.showModal());
    dom.aboutClose.addEventListener("click", () => dom.aboutDialog.close());

    window.addEventListener("hashchange", openFromHash);
    window.addEventListener("resize", () => setTimeout(() => state.map?.invalidateSize(), 100));
  }

  function bootstrap() {
    try {
      initMap();
      bindEvents();
      loadData();
    } catch (error) {
      console.error(error);
      setLoading(false);
      showError(error.message || "No se pudo iniciar el mapa.");
    }
  }

  bootstrap();
})();
