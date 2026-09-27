(() => {
    "use strict";

    const SNA_URL = "/geodata/fuentes/Datos_aeropuertos.geojson";
    const LAD_MAP_URL =
      "https://www.google.com/maps/d/u/0/viewer?mid=13BCxH0lhQw9sGNiQKtAdVoavn7y21EC9";

    // Fuente original LAD en Google My Maps.
    // Si Google permite CORS desde GitHub Pages, ésta será la fuente viva.
    const LAD_KML_URL =
      "https://www.google.com/maps/d/kml?mid=13BCxH0lhQw9sGNiQKtAdVoavn7y21EC9&forcekml=1";

    // Respaldo opcional. Si Google bloquea CORS, guardar el KML descargado como:
    // fuentes/AD_y_LAD_Argentina_v5.kml
    const LAD_FALLBACK_URL = "/geodata/fuentes/AD_y_LAD_Argentina_v5.kml";

    const argenmap = L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/mapabase_gris/gwc/service/wmts" +
      "?SERVICE=WMTS" +
      "&REQUEST=GetTile" +
      "&VERSION=1.0.0" +
      "&LAYER=mapabase_gris" +
      "&STYLE=" +
      "&TILEMATRIXSET=EPSG:3857" +
      "&TILEMATRIX=EPSG:3857:{z}" +
      "&TILEROW={y}" +
      "&TILECOL={x}" +
      "&FORMAT=image/png",
      {
        minZoom: 3,
        maxZoom: 18,
        attribution: "Instituto Geográfico Nacional | Argenmap"
      }
    );

    const osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }
    );

    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
      }
    );

    const baseLayers = { light: argenmap, osm, satellite };
    let currentBaseLayer = "light";

    const map = L.map("map", {
      zoomControl: false,
      minZoom: 3,
      maxZoom: 19,
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      worldCopyJump: true,
      layers: [argenmap]
    }).setView([-39.0, -64.2], 4.75);

    L.control.zoom({ position: "topleft" }).addTo(map);

    const ladLayer = L.layerGroup().addTo(map);
    const snaLayer = L.layerGroup().addTo(map);

    const airportIcon = L.icon({
      iconUrl: "/geodata/img/icons/AeropuertosSNA.png",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -13]
    });

    const searchIndex = [];

    function esc(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function normalize(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    }

    function cleanText(value) {
      return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Registro es la clave estable del LAD y se preserva explícitamente
    // para el futuro cruce con la base SIAC.
    function parseLadName(name) {
      const raw = cleanText(name);
      // Ej.: LAD 176 - EL ADUAR / LADH 2190 - QUILA QUINA / LADA ...
      const m = raw.match(/^(LAD(?:\/LADH|H|A)?)\s+(\d+)\s*-\s*(.+)$/i);

      if (!m) {
        return {
          Tipo: raw.split(/\s+/)[0] || "LAD",
          Registro: null,
          Denominacion: raw
        };
      }

      return {
        Tipo: m[1].toUpperCase(),
        Registro: Number(m[2]),
        Denominacion: cleanText(m[3])
      };
    }

    function htmlToLines(html) {
      const div = document.createElement("div");
      div.innerHTML = String(html ?? "")
        .replace(/<br\s*\/?>/gi, "\n");
      return (div.textContent || "")
        .split(/\n+/)
        .map(cleanText)
        .filter(Boolean);
    }

    function parseDescription(html) {
      const lines = htmlToLines(html);
      const out = {
        FIR: "",
        Provincia: "",
        Coordenadas: "",
        RWY: "",
        Elevacion: "",
        Dimensiones: "",
        Superficie: "",
        Ubicacion: ""
      };

      for (const line of lines) {
        let m;
        if ((m = line.match(/^FIR:\s*(.+)$/i))) out.FIR = m[1];
        else if ((m = line.match(/^PROVINCIA:\s*(.+)$/i))) out.Provincia = m[1];
        else if ((m = line.match(/^COORDENADAS:\s*(.+)$/i))) out.Coordenadas = m[1];
        else if ((m = line.match(/^RWY:\s*(.+)$/i))) out.RWY = m[1];
        else if ((m = line.match(/^Elevaci[oó]n:\s*(.+)$/i))) out.Elevacion = m[1];
        else if ((m = line.match(/^Dimensiones:\s*(.+)$/i))) out.Dimensiones = m[1];
        else if ((m = line.match(/^Superficie:\s*(.+)$/i))) out.Superficie = m[1];
        else if ((m = line.match(/^Ubicaci[oó]n:\s*(.+)$/i))) out.Ubicacion = m[1];
      }

      // En el KML actual "COORDENADAS:" puede venir en una línea y el valor en la siguiente.
      const coordLabel = lines.findIndex(x => /^COORDENADAS:$/i.test(x));
      if (!out.Coordenadas && coordLabel >= 0 && lines[coordLabel + 1]) {
        out.Coordenadas = lines[coordLabel + 1];
      }

      // Lo mismo para UBICACION descriptiva.
      const ubicLabels = lines
        .map((x, i) => /^Ubicaci[oó]n:$/i.test(x) ? i : -1)
        .filter(i => i >= 0);
      if (!out.Ubicacion && ubicLabels.length) {
        const i = ubicLabels[ubicLabels.length - 1];
        if (lines[i + 1]) out.Ubicacion = lines[i + 1];
      }

      return out;
    }

    function row(label, value) {
      if (!value && value !== 0) return "";
      return `<div class="popup-row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;
    }

    function ladPopup(p) {
      return `
        <div class="popup-type">${esc(p.Tipo || "LAD")}</div>
        <div class="popup-title">
          ${p.Registro ? `Registro ${esc(p.Registro)} · ` : ""}${esc(p.Denominacion)}
        </div>
        ${row("Provincia", p.Provincia)}
        ${row("FIR", p.FIR)}
        ${row("Pista", p.RWY)}
        ${row("Dimensiones", p.Dimensiones)}
        ${row("Superficie", p.Superficie)}
        ${row("Elevación", p.Elevacion)}
        ${p.Ubicacion ? `<div class="popup-location">${esc(p.Ubicacion)}</div>` : ""}
        <div class="source-note">Fuente cartográfica: <a href="${LAD_MAP_URL}" target="_blank" rel="noopener">AD y LAD Argentina v5</a>.</div>
      `;
    }

    function snaPopup(p) {
      const title = p["Nombre del Aeropuerto"] || p.Aeropuerto || p.IATA || "Aeropuerto SNA";
      return `
        <div class="popup-type">Aeropuerto del SNA</div>
        <div class="popup-title">${esc(title)}</div>
        ${row("IATA", p.IATA)}
        ${row("OACI", p.OACI)}
        ${row("Localidad", p.Localidad)}
        ${row("Provincia", p.Provincia)}
        ${row("Explotador", p.Explotador)}
        ${row("Pista", p.PistaOrientacion)}
        ${row("Dimensiones", p.Dimensiones)}
        <div class="source-note">Fuente SNA: Datos_aeropuertos.geojson.</div>
      `;
    }

    function addSearchItem(type, label, sublabel, text, marker) {
      searchIndex.push({
        type,
        label,
        sublabel,
        search: normalize(text),
        marker
      });
    }

    function parseCoordinates(text) {
      if (!text) return null;
      const first = cleanText(text).split(/\s+/)[0];
      const parts = first.split(",");
      if (parts.length < 2) return null;
      const lng = Number(parts[0]);
      const lat = Number(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lat, lng];
    }

    function directChildText(node, tagName) {
      for (const child of node.children) {
        if (child.localName === tagName) return child.textContent || "";
      }
      return "";
    }

    function getDirectFolders(node) {
      return Array.from(node.children).filter(el => el.localName === "Folder");
    }

    function findFolderByName(root, wanted) {
      const all = Array.from(root.getElementsByTagNameNS("*", "Folder"));
      return all.find(folder =>
        cleanText(directChildText(folder, "name")).toUpperCase() === wanted.toUpperCase()
      );
    }

    async function fetchText(url) {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.text();
    }

    async function loadLad() {
      let xmlText;
      let usedFallback = false;

      try {
        xmlText = await fetchText(LAD_KML_URL);
      } catch (e) {
        console.warn("No fue posible cargar el KML LAD directamente desde Google.", e);
        usedFallback = true;
        try {
          xmlText = await fetchText(LAD_FALLBACK_URL);
        } catch (fallbackError) {
          throw new Error(
            "Google bloqueó la carga directa del KML y tampoco se encontró el archivo de respaldo " +
            LAD_FALLBACK_URL
          );
        }
      }

      const xml = new DOMParser().parseFromString(xmlText, "application/xml");
      if (xml.querySelector("parsererror")) {
        throw new Error("El archivo recibido no pudo interpretarse como KML.");
      }

      const folder = findFolderByName(xml, "LAD");
      if (!folder) throw new Error('No se encontró la carpeta "LAD" dentro del KML.');

      // Sólo Placemarks hijos directos de la carpeta LAD:
      // evita incorporar AD, TMA, CTR, etc.
      const placemarks = Array.from(folder.children)
        .filter(el => el.localName === "Placemark");

      let count = 0;

      for (const pm of placemarks) {
        const name = cleanText(directChildText(pm, "name"));
        const description = directChildText(pm, "description");
        const point = pm.getElementsByTagNameNS("*", "Point")[0];
        const coordsEl = point?.getElementsByTagNameNS("*", "coordinates")[0];
        const latlng = parseCoordinates(coordsEl?.textContent);

        if (!latlng) continue;

        const identity = parseLadName(name);
        const detail = parseDescription(description);
        const props = { ...identity, ...detail };

        const marker = L.marker(latlng, {
          icon: L.divIcon({
            className: "",
            html: '<div class="lad-marker"></div>',
            iconSize: [20, 12],
            iconAnchor: [10, 6]
          }),
          title: `${props.Tipo} ${props.Registro || ""} ${props.Denominacion}`.trim()
        });

        marker.bindPopup(ladPopup(props));
        marker.addTo(ladLayer);

        addSearchItem(
          "LAD",
          `${props.Tipo}${props.Registro ? " " + props.Registro : ""} · ${props.Denominacion}`,
          [props.Provincia, props.RWY ? "Pista " + props.RWY : ""].filter(Boolean).join(" · "),
          [
            props.Tipo, props.Registro, props.Denominacion, props.Provincia,
            props.FIR, props.RWY, props.Superficie, props.Ubicacion
          ].join(" "),
          marker
        );

        count++;
      }

      document.getElementById("ladCount").textContent = count.toLocaleString("es-AR");

      if (usedFallback) {
        showWarning(
          "La capa LAD se cargó desde el KML de respaldo del repositorio porque Google bloqueó la consulta directa. " +
          "El mapa funciona, pero ese respaldo no se actualizará solo."
        );
      }

      return count;
    }

    async function loadSna() {
      const r = await fetch(SNA_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(`No se pudo cargar ${SNA_URL}.`);
      const data = await r.json();

      let count = 0;

      for (const feature of data.features || []) {
        const geometry = feature.geometry;
        const p = feature.properties || {};

        if (!geometry || geometry.type !== "Point" ||
            !Array.isArray(geometry.coordinates) ||
            geometry.coordinates.length < 2) continue;

        const [lng, lat] = geometry.coordinates.map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const marker = L.marker([lat, lng], {
          icon: airportIcon,
          title: p["Nombre del Aeropuerto"] || p.Aeropuerto || p.IATA || ""
        });

        marker.bindPopup(snaPopup(p));
        marker.addTo(snaLayer);

        addSearchItem(
          "SNA",
          `${p.IATA || ""}${p.IATA ? " · " : ""}${p["Nombre del Aeropuerto"] || p.Aeropuerto || ""}`,
          [p.OACI, p.Localidad, p.Provincia].filter(Boolean).join(" · "),
          [
            p.IATA, p.OACI, p.Aeropuerto, p["Nombre del Aeropuerto"],
            p.Localidad, p.Provincia, p.Explotador
          ].join(" "),
          marker
        );

        count++;
      }

      document.getElementById("snaCount").textContent = count.toLocaleString("es-AR");
      return count;
    }

    function showWarning(message) {
      const el = document.getElementById("loadWarning");
      el.textContent = message;
      el.style.display = "block";
    }

    function renderResults(found) {
      const list = document.getElementById("resultList");
      if (!found.length) {
        list.innerHTML = '<p class="initial-note">No se encontraron coincidencias.</p>';
        return;
      }
      list.innerHTML = found.map((item, i) => `
        <button class="result-item" type="button" data-index="${i}">
          <span class="result-code">${esc(item.type === "LAD" ? item.label.split(" · ")[0] : "SNA")}</span>
          <span class="result-copy"><strong>${esc(item.label)}</strong><span>${esc(item.sublabel)}</span></span>
        </button>`).join("");
      list.querySelectorAll(".result-item").forEach((el, i) => {
        el.addEventListener("click", () => focusItem(found[i]));
      });
    }

    function focusItem(item) {
      if (item.type === "LAD" && !map.hasLayer(ladLayer)) {
        map.addLayer(ladLayer);
        document.getElementById("ladToggle").checked = true;
      }
      if (item.type === "SNA" && !map.hasLayer(snaLayer)) {
        map.addLayer(snaLayer);
        document.getElementById("snaToggle").checked = true;
      }
      map.setView(item.marker.getLatLng(), 13);
      item.marker.openPopup();
    }

    function setBaseLayer(layerKey) {
      const layer = baseLayers[layerKey];
      if (!layer) return;

      Object.entries(baseLayers).forEach(([key, baseLayer]) => {
        if (key !== layerKey && map.hasLayer(baseLayer)) map.removeLayer(baseLayer);
      });

      if (!map.hasLayer(layer)) layer.addTo(map);
      currentBaseLayer = layerKey;

      document.querySelectorAll("[data-basemap]").forEach(button => {
        const active = button.dataset.basemap === currentBaseLayer;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    function setupSearch() {
      const input = document.getElementById("searchInput");
      input.addEventListener("input", () => {
        const q = normalize(input.value);
        if (q.length < 2) {
          document.getElementById("resultList").innerHTML =
            '<p class="initial-note">Ingrese al menos dos caracteres para buscar por denominación, Registro, provincia, IATA u OACI.</p>';
          return;
        }
        const found = searchIndex.filter(item => item.search.includes(q)).slice(0, 40);
        renderResults(found);
      });

      document.getElementById("clearSearch").addEventListener("click", () => {
        input.value = "";
        input.focus();
        document.getElementById("resultList").innerHTML =
          '<p class="initial-note">Ingrese al menos dos caracteres para buscar por denominación, Registro, provincia, IATA u OACI.</p>';
      });

      document.getElementById("ladToggle").addEventListener("change", e => {
        e.target.checked ? map.addLayer(ladLayer) : map.removeLayer(ladLayer);
      });
      document.getElementById("snaToggle").addEventListener("change", e => {
        e.target.checked ? map.addLayer(snaLayer) : map.removeLayer(snaLayer);
      });
      document.getElementById("fitMapButton").addEventListener("click", () => {
        const layers = [
          ...(map.hasLayer(ladLayer) ? ladLayer.getLayers() : []),
          ...(map.hasLayer(snaLayer) ? snaLayer.getLayers() : [])
        ];
        if (layers.length) map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [25, 25] });
      });

      document.querySelectorAll("[data-basemap]").forEach(button => {
        button.addEventListener("click", () => setBaseLayer(button.dataset.basemap));
      });

      const legend = document.getElementById("mapLegend");
      const legendToggle = document.getElementById("legendToggle");
      legendToggle.addEventListener("click", () => {
        const collapsed = legend.classList.toggle("is-collapsed");
        legendToggle.setAttribute("aria-expanded", String(!collapsed));
      });

      document.getElementById("fullscreenButton").addEventListener("click", async () => {
        const stage = document.getElementById("mapStage");
        try {
          if (!document.fullscreenElement) await stage.requestFullscreen();
          else await document.exitFullscreen();
        } catch (error) {
          console.warn("No fue posible cambiar el modo de pantalla completa.", error);
        }
      });

      document.addEventListener("fullscreenchange", () => {
        setTimeout(() => map.invalidateSize(), 100);
      });

      const aboutDialog = document.getElementById("aboutDialog");
      document.getElementById("aboutButton").addEventListener("click", () => aboutDialog.showModal());
      document.getElementById("aboutClose").addEventListener("click", () => aboutDialog.close());
    }

    async function init() {
      setupSearch();

      const results = await Promise.allSettled([
        loadLad(),
        loadSna()
      ]);

      if (results[0].status === "rejected") {
        console.error(results[0].reason);
        document.getElementById("ladCount").textContent = "error";
        showWarning(results[0].reason.message);
      }

      if (results[1].status === "rejected") {
        console.error(results[1].reason);
        document.getElementById("snaCount").textContent = "error";
        showWarning(results[1].reason.message);
      }

// Vista inicial nacional fija.
// Mantiene la escala mostrada en la vista general del mapa.
map.setView([-39.0, -64.2], 4.75);

document.getElementById("loadingOverlay").classList.add("is-hidden");
    }

    init();
  })();
