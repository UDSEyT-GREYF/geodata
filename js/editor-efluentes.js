/* global L */
(() => {
  "use strict";

  const CFG = window.SIGA_EDITOR_CONFIG || {};
  const DEFAULT_CENTER = [-38.4, -63.6];
  const DEFAULT_ZOOM = 4;

  const configured =
    CFG.supabaseUrl &&
    CFG.supabaseAnonKey &&
    !String(CFG.supabaseUrl).startsWith("PEGAR_") &&
    !String(CFG.supabaseAnonKey).startsWith("PEGAR_");

  const $ = (id) => document.getElementById(id);
  const loginScreen = $("loginScreen");
  const app = $("app");
  const configWarning = $("configWarning");
  const loginForm = $("loginForm");
  const loginMessage = $("loginMessage");
  const recordForm = $("recordForm");
  const formEmpty = $("formEmpty");

  let sb = null;
  let map = null;
  let currentUser = null;
  let permission = null;
  let airports = [];
  let airportsByIata = new Map();
  let airportLayer = null;
  let prediosLayer = null;
  let efluentesLayer = null;
  let draftLayer = null;
  let efluentes = [];
  let selectedAirport = null;
  let selectedRecord = null;
  let placementMode = null; // "new" | "move" | null
  let basemaps = {};
  let activeBasemap = null;

  function setMessage(el, text = "", type = "") {
    el.textContent = text;
    el.className = "form-message" + (type ? ` ${type}` : "");
  }

  function clean(v) {
    return String(v ?? "").trim();
  }

  function normalize(v) {
    return clean(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function first(p, keys) {
    for (const k of keys) {
      const v = p?.[k];
      if (v !== null && v !== undefined && clean(v) !== "") return v;
    }
    return "";
  }

  function airportFromFeature(feature) {
    const p = feature?.properties || {};
    const iata = clean(first(p, ["IATA", "iata", "iata_code", "cod_iata"])).toUpperCase();
    const oaci = clean(first(p, ["OACI", "oaci", "ICAO", "icao", "ident"])).toUpperCase();
    const name = clean(first(p, [
      "Aeropuerto", "aeropuerto", "Nombre del Aeropuerto", "nombre", "name",
      "Ciudad", "Localidad"
    ])) || iata;
    const city = clean(first(p, ["Ciudad", "ciudad", "Localidad", "localidad", "Municipio"]));
    const province = clean(first(p, ["Provincia", "provincia"]));
    let lat = null, lon = null;

    if (feature?.geometry?.type === "Point" && Array.isArray(feature.geometry.coordinates)) {
      lon = Number(feature.geometry.coordinates[0]);
      lat = Number(feature.geometry.coordinates[1]);
    } else {
      lat = Number(first(p, ["latitud", "Latitud", "latitude", "lat"]));
      lon = Number(first(p, ["longitud", "Longitud", "longitude", "lon", "lng"]));
    }

    return { iata, oaci, name, city, province, lat, lon, feature, properties: p };
  }

  function canEditAirport(iata) {
    if (!permission?.activo) return false;
    if (permission.rol === "admin") return true;
    if (permission.acceso_todos) return true;
    return Array.isArray(permission.iata_habilitados) &&
      permission.iata_habilitados.map(x => clean(x).toUpperCase()).includes(clean(iata).toUpperCase());
  }

  function scopeText() {
    if (!permission) return "Sin habilitación";
    if (permission.rol === "admin") return "Administrador · todos los aeropuertos";
    if (permission.acceso_todos) return "Editor · todos los aeropuertos";
    const codes = permission.iata_habilitados || [];
    return `Editor · ${codes.length ? codes.join(", ") : "sin aeropuertos asignados"}`;
  }

  function initMap() {
    if (map) return;
    if (typeof L === "undefined") {
      throw new Error("Leaflet no se cargó. Recargá la página; si persiste, revisá el acceso al CDN.");
    }

    map = L.map("map", { zoomControl: true, preferCanvas: true })
      .setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    basemaps = {
      satellite: L.tileLayer(
        "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, attribution: "Imágenes © Esri" }
      ),
      argenmap: L.tileLayer(
        "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png",
        { tms: true, minZoom: 3, maxZoom: 19, attribution: "© IGN + OpenStreetMap" }
      ),
      osm: L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 20, attribution: "© OpenStreetMap contributors" }
      )
    };

    setBasemap("satellite");

    airportLayer = L.layerGroup().addTo(map);
    prediosLayer = L.geoJSON(null, {
      style: { color: "#8DE000", weight: 2, fillOpacity: 0.04 },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const iata = clean(first(p, ["IATA", "iata"])).toUpperCase();
        layer.bindTooltip(iata ? `Predio ${iata}` : "Predio aeroportuario");
      }
    }).addTo(map);

    efluentesLayer = L.layerGroup().addTo(map);

    map.on("click", (evt) => {
      if (!placementMode) return;
      if (!selectedAirport) {
        setMapStatus("Seleccioná un aeropuerto antes de ubicar un elemento.");
        return;
      }
      if (!canEditAirport(selectedAirport.iata)) {
        setMapStatus("Tu usuario no está habilitado para editar este aeropuerto.");
        placementMode = null;
        return;
      }
      setDraftPoint(evt.latlng.lat, evt.latlng.lng);

      if (placementMode === "new") {
        beginNewRecord(evt.latlng.lat, evt.latlng.lng, false);
      } else if (placementMode === "move") {
        $("formLat").value = evt.latlng.lat.toFixed(7);
        $("formLon").value = evt.latlng.lng.toFixed(7);
        setMessage($("formMessage"), "Nueva ubicación seleccionada. Guardá para confirmar.", "success");
      }
      placementMode = null;
      $("placementHint").classList.add("hidden");
      map.getContainer().style.cursor = "";
    });
  }

  function setBasemap(id) {
    if (!map || !basemaps[id]) return;
    if (activeBasemap) map.removeLayer(activeBasemap);
    activeBasemap = basemaps[id];
    activeBasemap.addTo(map);
  }

  function setMapStatus(text) {
    $("mapStatus").textContent = text;
  }

  function setDraftPoint(lat, lon) {
    if (draftLayer) map.removeLayer(draftLayer);
    draftLayer = L.circleMarker([lat, lon], {
      radius: 9, color: "#FFD700", weight: 3, fillColor: "#306fb0", fillOpacity: 1
    }).addTo(map);
  }

  function clearDraftPoint() {
    if (draftLayer && map) map.removeLayer(draftLayer);
    draftLayer = null;
  }

  async function loadAirports() {
    setMapStatus("Cargando aeropuertos…");
    const response = await fetch(CFG.airportsSource || "fuentes/Datos_aeropuertos.geojson");
    if (!response.ok) throw new Error(`No se pudo cargar Datos_aeropuertos.geojson (${response.status})`);
    const geojson = await response.json();

    airports = (geojson.features || [])
      .map(airportFromFeature)
      .filter(a => a.iata)
      .sort((a,b) => a.name.localeCompare(b.name, "es"));

    airportsByIata = new Map(airports.map(a => [a.iata, a]));

    airportLayer.clearLayers();
    airports.forEach(a => {
      if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) return;
      const marker = L.circleMarker([a.lat, a.lon], {
        radius: 4,
        color: "#002855",
        weight: 1,
        fillColor: "#75AADB",
        fillOpacity: .9
      });
      marker.bindTooltip(`${a.name} (${a.iata})`);
      marker.on("click", () => selectAirport(a.iata, true));
      marker.addTo(airportLayer);
    });

    wireAirportSearch();
  }

  async function loadPredios() {
    try {
      const response = await fetch(CFG.airportPolygonsSource || "fuentes/poligonos_aeropuertos.geojson");
      if (!response.ok) return;
      const data = await response.json();
      prediosLayer.clearLayers();
      prediosLayer.addData(data);
    } catch (err) {
      console.warn("Predios no disponibles:", err);
    }
  }

  function airportSearchText(a) {
    return normalize([a.iata, a.oaci, a.name, a.city, a.province].join(" "));
  }

  function wireAirportSearch() {
    const input = $("airportSearch");
    const results = $("airportSearchResults");
    let visible = [];

    function render() {
      const term = normalize(input.value);
      const source = airports.filter(a => permission?.rol === "admin" || permission?.acceso_todos || canEditAirport(a.iata));

      visible = (term ? source.filter(a => airportSearchText(a).includes(term)) : source).slice(0, 30);
      results.innerHTML = "";

      visible.forEach(a => {
        const item = document.createElement("div");
        item.className = "search-result";
        item.innerHTML = `<strong>${escapeHtml(a.name)} (${escapeHtml(a.iata)})</strong>
          <span>${escapeHtml([a.city, a.province, a.oaci].filter(Boolean).join(" · "))}</span>`;
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectAirport(a.iata, true);
          results.classList.add("hidden");
        });
        results.appendChild(item);
      });

      if (!visible.length) {
        results.innerHTML = `<div class="empty-state">No se encontraron aeropuertos.</div>`;
      }
      results.classList.remove("hidden");
    }

    input.addEventListener("focus", render);
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && visible[0]) {
        e.preventDefault();
        selectAirport(visible[0].iata, true);
        results.classList.add("hidden");
      } else if (e.key === "Escape") {
        results.classList.add("hidden");
      }
    });
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !results.contains(e.target)) results.classList.add("hidden");
    });
  }

  function selectAirport(iata, zoom = false) {
    const a = airportsByIata.get(clean(iata).toUpperCase());
    if (!a) return;
    selectedAirport = a;
    $("airportSearch").value = `${a.name} (${a.iata})`;
    $("selectedAirportInfo").innerHTML =
      `<strong>${escapeHtml(a.name)}</strong><br>${escapeHtml(a.iata)}${a.oaci ? ` · ${escapeHtml(a.oaci)}` : ""}` +
      `${a.city ? ` · ${escapeHtml(a.city)}` : ""}${a.province ? ` · ${escapeHtml(a.province)}` : ""}`;
    $("zoomAirportButton").disabled = false;
    $("newRecordButton").disabled = !canEditAirport(a.iata);
    renderRecordList();

    if (zoom) zoomToAirport(a.iata);
  }

  function zoomToAirport(iata) {
    const a = airportsByIata.get(iata);
    if (!a) return;

    let fitted = false;
    prediosLayer.eachLayer(layer => {
      if (fitted) return;
      const p = layer.feature?.properties || {};
      const code = clean(first(p, ["IATA", "iata"])).toUpperCase();
      if (code === iata && layer.getBounds) {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [35,35], maxZoom: 18 });
          fitted = true;
        }
      }
    });
    if (!fitted && Number.isFinite(a.lat) && Number.isFinite(a.lon)) map.setView([a.lat, a.lon], 16);
  }

  async function loadPermission() {
    const { data, error } = await sb
      .from("editores_aeropuertos")
      .select("rol, iata_habilitados, activo, acceso_todos")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.activo) throw new Error("Este usuario no tiene habilitación activa como editor SIGA.");

    permission = data;
    $("userScope").textContent = scopeText();
  }

  async function loadEfluentes() {
    setMapStatus("Cargando infraestructura de efluentes…");
    const { data, error } = await sb
      .from("v_infraestructura_efluentes_editor")
      .select("*")
      .order("iata", { ascending: true })
      .order("tipo", { ascending: true });

    if (error) throw error;
    efluentes = data || [];
    renderEfluentes();
    renderRecordList();
    setMapStatus(`${efluentes.length} elementos de efluentes cargados.`);
  }

  function reviewColor(state) {
    return state === "aprobado" ? "#238636" :
      state === "observado" ? "#b42318" : "#b7791f";
  }

  function renderEfluentes() {
    efluentesLayer.clearLayers();

    efluentes.forEach(r => {
      const lat = Number(r.latitud), lon = Number(r.longitud);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const marker = L.circleMarker([lat, lon], {
        radius: 7,
        color: selectedRecord?.id === r.id ? "#FFD700" : "#ffffff",
        weight: selectedRecord?.id === r.id ? 3 : 1,
        fillColor: reviewColor(r.estado_revision),
        fillOpacity: .95
      });

      marker.bindPopup(`
        <div class="ef-popup-title">${escapeHtml(r.tipo || "Efluente")}</div>
        <div>${escapeHtml(r.aeropuerto || r.iata || "")}</div>
        <div>IATA: <strong>${escapeHtml(r.iata || "—")}</strong></div>
        <div>Estado: ${escapeHtml(labelOperational(r.estado_operativo))}</div>
        <div>Revisión: ${escapeHtml(r.estado_revision || "pendiente")}</div>
        <div class="ef-popup-link" data-edit-id="${escapeHtml(r.id)}">Abrir ficha</div>
      `);

      marker.on("popupopen", (evt) => {
        const node = evt.popup.getElement()?.querySelector(`[data-edit-id="${CSS.escape(r.id)}"]`);
        if (node) node.addEventListener("click", () => selectRecord(r.id, true));
      });

      marker.on("click", () => selectRecord(r.id, false));
      marker.addTo(efluentesLayer);
    });
  }

  function renderRecordList() {
    const list = $("recordList");
    const filtered = selectedAirport
      ? efluentes.filter(r => clean(r.iata).toUpperCase() === selectedAirport.iata)
      : efluentes;

    $("recordCount").textContent = filtered.length;
    list.innerHTML = "";

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state">${selectedAirport ? "No hay elementos cargados para este aeropuerto." : "No hay registros."}</div>`;
      return;
    }

    filtered.forEach(r => {
      const item = document.createElement("div");
      item.className = "record-item" + (selectedRecord?.id === r.id ? " selected" : "");
      item.innerHTML = `
        <div class="record-item-title">${escapeHtml(r.tipo || "Sin tipo")}</div>
        <div class="record-item-meta">
          <span>${escapeHtml(r.iata || "—")}</span>
          <span>·</span>
          <span><i class="dot dot-${escapeHtml(r.estado_revision || "pendiente")}"></i>${escapeHtml(r.estado_revision || "pendiente")}</span>
        </div>`;
      item.addEventListener("click", () => selectRecord(r.id, true));
      list.appendChild(item);
    });
  }

  function selectRecord(id, zoom = false) {
    const r = efluentes.find(x => x.id === id);
    if (!r) return;
    selectedRecord = r;

    if (r.iata && airportsByIata.has(r.iata)) selectAirport(r.iata, false);

    clearDraftPoint();
    placementMode = null;
    $("placementHint").classList.add("hidden");
    map.getContainer().style.cursor = "";

    formEmpty.classList.add("hidden");
    recordForm.classList.remove("hidden");
    $("formTitle").textContent = "Editar infraestructura";
    $("recordId").value = r.id || "";
    $("formIata").value = r.iata || "";
    $("formOaci").value = r.oaci || "";
    $("formAirport").value = r.aeropuerto || "";
    $("formType").value = r.tipo || "";
    $("formOperational").value = r.estado_operativo || "a_verificar";
    $("formPrecision").value = r.precision_ubicacion || "aproximada";
    $("formMethod").value = r.metodo_ubicacion || "";
    $("formSource").value = r.fuente || "";
    $("formSourceUrl").value = r.fuente_url || "";
    $("formSourceDate").value = r.fecha_fuente || "";
    $("formObservations").value = r.observaciones || "";
    $("formPhotos").value = Array.isArray(r.fotos) ? r.fotos.join("\n") : "";
    $("formLat").value = r.latitud ?? "";
    $("formLon").value = r.longitud ?? "";

    showReviewBadge(r.estado_revision || "pendiente");
    const editable = canEditAirport(r.iata);
    setFormEditable(editable);
    setMessage($("formMessage"), "");
    renderEfluentes();
    renderRecordList();

    if (zoom && Number.isFinite(Number(r.latitud)) && Number.isFinite(Number(r.longitud))) {
      map.setView([Number(r.latitud), Number(r.longitud)], Math.max(map.getZoom(), 18));
    }
  }

  function beginNewPlacement() {
    if (!selectedAirport || !canEditAirport(selectedAirport.iata)) return;
    selectedRecord = null;
    placementMode = "new";
    clearForm();
    formEmpty.classList.add("hidden");
    recordForm.classList.remove("hidden");
    $("formTitle").textContent = "Nueva infraestructura";
    $("formIata").value = selectedAirport.iata;
    $("formOaci").value = selectedAirport.oaci || "";
    $("formAirport").value = selectedAirport.name || "";
    $("formOperational").value = "a_verificar";
    $("formPrecision").value = "aproximada";
    $("formMethod").value = "especialista";
    showReviewBadge("pendiente");
    setFormEditable(true);
    $("placementHint").textContent = "Hacé clic en el mapa para ubicar el nuevo elemento.";
    $("placementHint").classList.remove("hidden");
    map.getContainer().style.cursor = "crosshair";
    setMessage($("formMessage"), "Primero ubicá el elemento haciendo clic en el mapa.");
    renderRecordList();
  }

  function beginNewRecord(lat, lon, keepExisting = true) {
    if (!selectedAirport) return;
    selectedRecord = null;
    if (!keepExisting) {
      clearForm();
      $("formIata").value = selectedAirport.iata;
      $("formOaci").value = selectedAirport.oaci || "";
      $("formAirport").value = selectedAirport.name || "";
      $("formOperational").value = "a_verificar";
      $("formPrecision").value = "aproximada";
      $("formMethod").value = "especialista";
    }
    formEmpty.classList.add("hidden");
    recordForm.classList.remove("hidden");
    $("formTitle").textContent = "Nueva infraestructura";
    $("formLat").value = Number(lat).toFixed(7);
    $("formLon").value = Number(lon).toFixed(7);
    showReviewBadge("pendiente");
    setFormEditable(true);
    setMessage($("formMessage"), "Ubicación definida. Completá la ficha y guardá.", "success");
  }

  function clearForm() {
    recordForm.reset();
    $("recordId").value = "";
    $("formLat").value = "";
    $("formLon").value = "";
    setMessage($("formMessage"), "");
  }

  function cancelForm() {
    selectedRecord = null;
    placementMode = null;
    clearDraftPoint();
    clearForm();
    recordForm.classList.add("hidden");
    formEmpty.classList.remove("hidden");
    $("reviewBadge").classList.add("hidden");
    $("placementHint").classList.add("hidden");
    if (map) map.getContainer().style.cursor = "";
    renderEfluentes();
    renderRecordList();
  }

  function setFormEditable(editable) {
    const ids = [
      "formType","formOperational","formPrecision","formMethod","formSource",
      "formSourceUrl","formSourceDate","formObservations","formPhotos",
      "movePointButton","saveRecordButton"
    ];
    ids.forEach(id => $(id).disabled = !editable);
    $("readOnlyMessage").classList.toggle("hidden", editable);
  }

  function showReviewBadge(state) {
    const badge = $("reviewBadge");
    badge.textContent = state;
    badge.className = `review-badge review-${state}`;
    badge.classList.remove("hidden");
  }

  function payloadFromForm() {
    const photos = $("formPhotos").value
      .split(/\r?\n/)
      .map(clean)
      .filter(Boolean);

    return {
      iata: clean($("formIata").value).toUpperCase(),
      oaci: clean($("formOaci").value).toUpperCase() || null,
      aeropuerto: clean($("formAirport").value) || null,
      tipo: $("formType").value,
      estado_operativo: $("formOperational").value,
      precision_ubicacion: $("formPrecision").value,
      metodo_ubicacion: $("formMethod").value || null,
      fuente: clean($("formSource").value) || null,
      fuente_url: clean($("formSourceUrl").value) || null,
      fecha_fuente: $("formSourceDate").value || null,
      observaciones: clean($("formObservations").value) || null,
      fotos: photos,
      latitud: Number($("formLat").value),
      longitud: Number($("formLon").value),
      origen_registro: selectedRecord?.origen_registro || "editor_web"
    };
  }

  async function saveRecord(evt) {
    evt.preventDefault();
    setMessage($("formMessage"), "");

    const payload = payloadFromForm();
    if (!payload.iata || !payload.tipo || !Number.isFinite(payload.latitud) || !Number.isFinite(payload.longitud)) {
      setMessage($("formMessage"), "Completá tipo y ubicación antes de guardar.", "error");
      return;
    }
    if (!canEditAirport(payload.iata)) {
      setMessage($("formMessage"), "Tu usuario no está habilitado para editar este aeropuerto.", "error");
      return;
    }

    $("saveRecordButton").disabled = true;
    setMessage($("formMessage"), "Guardando…");

    try {
      let result;
      if (selectedRecord?.id) {
        result = await sb
          .from("infraestructura_efluentes_aeropuertos")
          .update(payload)
          .eq("id", selectedRecord.id)
          .select("id")
          .single();
      } else {
        result = await sb
          .from("infraestructura_efluentes_aeropuertos")
          .insert(payload)
          .select("id")
          .single();
      }
      if (result.error) throw result.error;

      const savedId = result.data.id;
      clearDraftPoint();
      await loadEfluentes();
      selectRecord(savedId, true);
      setMessage($("formMessage"), "Registro guardado correctamente.", "success");
    } catch (err) {
      console.error(err);
      setMessage($("formMessage"), `No se pudo guardar: ${err.message || err}`, "error");
    } finally {
      $("saveRecordButton").disabled = false;
    }
  }

  function labelOperational(v) {
    return ({
      operativo: "Operativo",
      fuera_de_servicio: "Fuera de servicio",
      historico: "Histórico",
      a_verificar: "A verificar"
    })[v] || v || "—";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function openApp(user) {
    currentUser = user;
    $("userEmail").textContent = user.email || "Usuario";
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");

    initMap();

    try {
      await loadPermission();
      await Promise.all([loadAirports(), loadPredios()]);
      await loadEfluentes();
      setMapStatus("Editor listo.");
    } catch (err) {
      console.error(err);
      alert(`No se pudo abrir el editor: ${err.message || err}`);
      try { await sb.auth.signOut(); } catch (_) {}
      showLogin();
      throw err;
    }
  }

  function showLogin() {
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    currentUser = null;
    permission = null;
  }

  async function signIn(evt) {
    evt.preventDefault();
    if (!configured) {
      configWarning.classList.remove("hidden");
      setMessage(loginMessage, "Primero configurá Supabase.", "error");
      return;
    }

    const email = clean($("loginEmail").value);
    const password = $("loginPassword").value;
    $("loginButton").disabled = true;
    setMessage(loginMessage, "Ingresando…");

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await openApp(data.user);
      setMessage(loginMessage, "");
    } catch (err) {
      console.error(err);
      setMessage(loginMessage, err.message || "No se pudo iniciar sesión.", "error");
    } finally {
      $("loginButton").disabled = false;
    }
  }

  function wireUI() {
    loginForm.addEventListener("submit", signIn);
    $("logoutButton").addEventListener("click", async () => {
      await sb.auth.signOut();
      showLogin();
    });
    $("newRecordButton").addEventListener("click", beginNewPlacement);
    $("cancelFormButton").addEventListener("click", cancelForm);
    recordForm.addEventListener("submit", saveRecord);
    $("movePointButton").addEventListener("click", () => {
      if (!selectedAirport || !canEditAirport($("formIata").value)) return;
      placementMode = "move";
      $("placementHint").textContent = "Hacé clic en el mapa para indicar la nueva ubicación.";
      $("placementHint").classList.remove("hidden");
      map.getContainer().style.cursor = "crosshair";
      setMessage($("formMessage"), "Seleccioná la nueva ubicación en el mapa.");
    });
    $("zoomAirportButton").addEventListener("click", () => {
      if (selectedAirport) zoomToAirport(selectedAirport.iata);
    });
    $("argentinaButton").addEventListener("click", () => map.setView(DEFAULT_CENTER, DEFAULT_ZOOM));
    $("basemapSelect").addEventListener("change", e => setBasemap(e.target.value));
    $("toggleAirports").addEventListener("change", e => e.target.checked ? airportLayer.addTo(map) : map.removeLayer(airportLayer));
    $("togglePredios").addEventListener("change", e => e.target.checked ? prediosLayer.addTo(map) : map.removeLayer(prediosLayer));
    $("toggleEfluentes").addEventListener("change", e => e.target.checked ? efluentesLayer.addTo(map) : map.removeLayer(efluentesLayer));
  }

  async function bootstrap() {
    wireUI();

    if (!configured) {
      configWarning.classList.remove("hidden");
      return;
    }

    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) await openApp(session.user);

    sb.auth.onAuthStateChange((event, session2) => {
      if (event === "SIGNED_OUT" || !session2) showLogin();
    });
  }

  bootstrap().catch(err => {
    console.error(err);
    setMessage(loginMessage, err.message || String(err), "error");
  });
})();
