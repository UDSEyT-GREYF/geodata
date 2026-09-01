/* global L */
(() => {
  "use strict";

  /*
    Capas SIGA de sólo lectura para el Editor DMA.
    Este archivo NO modifica editor-efluentes.js.
    Captura la instancia Leaflet y monta las capas del SIGA principal
    por debajo de la capa editable de efluentes.
  */

  if (typeof L === "undefined") {
    console.warn("Editor contexto SIGA: Leaflet no está disponible.");
    return;
  }

  const DEFAULT_CORE_ACTIVE = true;
  const DEFAULT_AIP_ACTIVE = false;

  const CONTEXT_LAYERS = [
    // Edificios e infraestructura
    {
      id: "terminales2026",
      group: "Edificios e infraestructura",
      name: "Terminales",
      url: "fuentes/Terminales2026.geojson",
      color: "#b22222",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorInfraPane",
      style: { color:"#b22222", weight:1.2, fillColor:"#ffdede", fillOpacity:.32 }
    },
    {
      id: "torres",
      group: "Edificios e infraestructura",
      name: "Torres de control",
      url: "fuentes/Torres_control_2026.geojson",
      color: "#FF2D8D",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorInfraPane",
      point: { radius:6, color:"#5B0037", weight:2, fillColor:"#FF2D8D", fillOpacity:1 }
    },
    {
      id: "hangares",
      group: "Edificios e infraestructura",
      name: "Hangares",
      url: "fuentes/Hangares2026.geojson",
      color: "#FF8A00",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorInfraPane",
      style: { color:"#FF8A00", weight:1.7, fillColor:"#FF8A00", fillOpacity:.02 }
    },
    {
      id: "otros",
      group: "Edificios e infraestructura",
      name: "Otros edificios",
      url: "fuentes/Otros_edificios2026.geojson",
      color: "#6c757d",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorInfraPane",
      style: { color:"#555555", weight:1.1, fillColor:"#b3b3b3", fillOpacity:.25 }
    },
    {
      id: "estacionamientos",
      group: "Edificios e infraestructura",
      name: "Estacionamientos vehiculares",
      url: "fuentes/Estacionamientos_vehiculares2026.geojson",
      color: "#00B8D9",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorInfraPane",
      style: { color:"#00B8D9", weight:1.6, fillColor:"#00B8D9", fillOpacity:.02 }
    },

    // Área de movimiento
    {
      id: "pistas",
      group: "Área de movimiento",
      name: "Pistas",
      url: "fuentes/pistas.geojson",
      color: "#ffff00",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorMovimientoPane",
      style: { color:"#ffff00", weight:2.2, opacity:1, fillColor:"#ffff00", fillOpacity:.015 }
    },
    {
      id: "cabeceras",
      group: "Área de movimiento",
      name: "Cabeceras de pista",
      url: "fuentes/Cabeceras2026.geojson",
      color: "#2a5fa0",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorMovimientoPane",
      style: { color:"#002855", weight:1.6, fillColor:"#2a5fa0", fillOpacity:.28 }
    },
    {
      id: "plataformas",
      group: "Área de movimiento",
      name: "Plataformas",
      url: "fuentes/Plataformas2026.geojson",
      color: "#00AEEF",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorMovimientoPane",
      style: { color:"#00AEEF", weight:1.7, opacity:1, fillColor:"#00AEEF", fillOpacity:.015 }
    },
    {
      id: "psn",
      group: "Área de movimiento",
      name: "Posiciones aeronaves",
      url: "fuentes/psn_posiciones.geojson",
      color: "#6b2f82",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorMovimientoPane",
      point: { radius:2.6, color:"#000000", weight:1, fillColor:"#6b2f82", fillOpacity:.72 }
    },
    {
      id: "aeroplantas",
      group: "Área de movimiento",
      name: "Aeroplantas",
      url: "fuentes/Aeroplantas.geojson",
      color: "#d71920",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorMovimientoPane",
      style: { color:"#d71920", weight:1.4, fillColor:"#d71920", fillOpacity:.02 }
    },

    // AIP con posición publicada/derivada
    {
      id: "aip_umbrales",
      group: "Área de movimiento",
      name: "Umbrales de pista",
      url: "fuentes/aip_umbrales_pista.geojson",
      color: "#00CFE8",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 11,
      aip: true,
      exactOnly: true,
      pane: "editorMovimientoPane",
      point: { radius:4, color:"#004E64", weight:1.1, fillColor:"#00CFE8", fillOpacity:.92 }
    },
    {
      id: "aip_ejes_pista",
      group: "Área de movimiento",
      name: "Ejes de pista",
      url: "fuentes/aip_pistas_ejes.geojson",
      color: "#F4D03F",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 10,
      aip: true,
      exactOnly: true,
      pane: "editorMovimientoPane",
      style: { color:"#F4D03F", weight:2.2, opacity:.95, fillOpacity:0 }
    },
    {
      id: "aip_superficies_pista",
      group: "Área de movimiento",
      name: "Superficies de pista",
      url: "fuentes/aip_pistas_superficies.geojson",
      color: "#F5B041",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 10,
      aip: true,
      exactOnly: true,
      pane: "editorMovimientoPane",
      style: { color:"#F5B041", weight:1.5, opacity:.9, fillColor:"#F5B041", fillOpacity:.045 }
    },
    {
      id: "aip_zonas_pista",
      group: "Área de movimiento",
      name: "Zonas SWY/CWY/RESA/franjas",
      url: "fuentes/aip_zonas_pista.geojson",
      color: "#FF8C42",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 10,
      aip: true,
      exactOnly: true,
      pane: "editorMovimientoPane",
      style: { color:"#FF8C42", weight:1.4, opacity:.9, fillColor:"#FF8C42", fillOpacity:.05 }
    },
    {
      id: "aip_luces_aproximacion",
      group: "Área de movimiento",
      name: "Luces de aproximación",
      url: "fuentes/aip_luces_aproximacion.geojson",
      color: "#00E676",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 10,
      aip: true,
      exactOnly: true,
      pane: "editorMovimientoPane",
      style: { color:"#00E676", weight:2.5, opacity:.9, fillOpacity:0 }
    },

    // Servicios y apoyo
    {
      id: "paradasapp",
      group: "Servicios y apoyo",
      name: "Paradas transporte público",
      url: "fuentes/paradasapp.geojson",
      color: "#16c41e",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorServiciosPane",
      point: { radius:4.2, color:"#1a7a3e", weight:1, fillColor:"#16c41e", fillOpacity:.86 }
    },
    {
      id: "smn",
      group: "Servicios y apoyo",
      name: "Estaciones meteorológicas SMN",
      url: "fuentes/smn_estaciones_meteorologicas2026.geojson",
      color: "#0072bb",
      active: DEFAULT_CORE_ACTIVE,
      minZoom: 12,
      pane: "editorServiciosPane",
      point: { radius:4.8, color:"#002855", weight:1, fillColor:"#0072bb", fillOpacity:.9 }
    },
    {
      id: "sei_aip",
      group: "Servicios y apoyo",
      name: "Salvamento y extinción de incendios (SEI)",
      url: "fuentes/SEI2026_final_AIP_AD26.geojson",
      color: "#E53935",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 10,
      aip: true,
      pane: "editorServiciosPane",
      style: { color:"#B71C1C", weight:1.7, opacity:.95, fillColor:"#E53935", fillOpacity:.10 }
    },
    {
      id: "aip_radioayudas",
      group: "Servicios y apoyo",
      name: "Radioayudas",
      url: "fuentes/aip_radioayudas.geojson",
      color: "#7E57C2",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 8,
      aip: true,
      exactOnly: true,
      pane: "editorServiciosPane",
      point: { radius:4.3, color:"#4527A0", weight:1.1, fillColor:"#7E57C2", fillOpacity:.92 }
    },
    {
      id: "aip_puntos_verificacion",
      group: "Servicios y apoyo",
      name: "Puntos de verificación VOR/INS",
      url: "fuentes/aip_puntos_verificacion.geojson",
      color: "#00ACC1",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 10,
      aip: true,
      exactOnly: true,
      pane: "editorServiciosPane",
      point: { radius:4.2, color:"#006064", weight:1.1, fillColor:"#00ACC1", fillOpacity:.92 }
    },

    // Contexto territorial
    {
      id: "provincias",
      group: "Contexto territorial",
      name: "Provincias",
      url: "fuentes/provincias.geojson",
      color: "#b0b0b0",
      active: DEFAULT_CORE_ACTIVE,
      pane: "editorContextPane",
      style: { color:"#b0b0b0", weight:1, opacity:.85, fill:false, fillOpacity:0 }
    },
    {
      id: "aip_obstaculos",
      group: "Contexto territorial",
      name: "Obstáculos de aeródromo",
      url: "fuentes/aip_obstaculos_aerodromo.geojson",
      color: "#FF5252",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 11,
      aip: true,
      exactOnly: true,
      pane: "editorContextPane",
      point: { radius:3, color:"#8B0000", weight:1, fillColor:"#FF5252", fillOpacity:.88 }
    },
    {
      id: "aip_espacios_ats",
      group: "Contexto territorial",
      name: "Espacios ATS / CTR",
      url: "fuentes/aip_espacios_ats.geojson",
      color: "#8E44AD",
      active: DEFAULT_AIP_ACTIVE,
      minZoom: 5,
      aip: true,
      exactOnly: true,
      pane: "editorContextPane",
      style: { color:"#8E44AD", weight:1.4, opacity:.82, fillColor:"#8E44AD", fillOpacity:.025 }
    }
  ];

  const GROUP_ORDER = [
    "Edificios e infraestructura",
    "Área de movimiento",
    "Servicios y apoyo",
    "Contexto territorial"
  ];

  const defs = new Map();
  let initialized = false;

  // Captura la instancia que crea editor-efluentes.js.
  const originalMap = L.map;
  if (!L.map.__editorContextWrapped) {
    const wrapped = function (...args) {
      const instance = originalMap.apply(this, args);
      const target = args[0];
      const id = typeof target === "string" ? target : target?.id;

      if (id === "map") {
        window.__SIGA_EDITOR_MAP__ = instance;
        setTimeout(() => initializeContext(), 0);
      }
      return instance;
    };

    Object.keys(originalMap).forEach(key => {
      try { wrapped[key] = originalMap[key]; } catch (_) {}
    });
    wrapped.__editorContextWrapped = true;
    L.map = wrapped;
  }

  const clean = v => String(v ?? "").trim();

  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function first(props, keys) {
    for (const k of keys) {
      const value = props?.[k];
      if (value !== undefined && value !== null && clean(value) !== "") return value;
    }
    return "";
  }

  function featureIata(feature) {
    return clean(first(feature?.properties || {}, [
      "IATA","iata","iata_code","cod_iata","COD_IATA"
    ])).toUpperCase();
  }

  function featureName(feature, cfg) {
    const p = feature?.properties || {};
    return clean(first(p, [
      "Aeropuerto","aeropuerto","Nombre","nombre","NOMBRE",
      "tipo","Tipo","etiqueta","ETIQUETA",
      "Cabecera","cabecera","Posicion","posicion",
      "designacion","rwy","tipo_ayuda","id_ayuda"
    ])) || cfg.name;
  }

  function exactAipFeature(feature) {
    if (!feature?.geometry) return false;
    const p = feature.properties || {};

    if (p.ubicacion_equipo_exacta === false) return false;
    if (p.aproximada === true) return false;

    const precision = clean(p.precision_geometria).toLowerCase();
    if (precision.includes("referencia") || precision.includes("no_posicion_fisica")) return false;

    return true;
  }

  function ensurePanes(map) {
    [
      ["editorContextPane", 320],
      ["editorMovimientoPane", 345],
      ["editorInfraPane", 350],
      ["editorServiciosPane", 355]
    ].forEach(([name, z]) => {
      if (!map.getPane(name)) map.createPane(name);
      map.getPane(name).style.zIndex = String(z);
    });
  }

  function makeLayer(cfg, geojson) {
    const source = cfg.exactOnly
      ? {
          type: "FeatureCollection",
          features: (geojson?.features || []).filter(exactAipFeature)
        }
      : geojson;

    return L.geoJSON(source, {
      pane: cfg.pane,
      interactive: true,
      bubblingMouseEvents: true,

      style: () => ({
        ...(cfg.style || {
          color: cfg.color,
          weight: 1.4,
          fillColor: cfg.color,
          fillOpacity: .15
        }),
        pane: cfg.pane
      }),

      pointToLayer: (_feature, latlng) => {
        const p = cfg.point || {
          radius: 4,
          color: cfg.color,
          weight: 1,
          fillColor: cfg.color,
          fillOpacity: .85
        };

        return L.circleMarker(latlng, {
          ...p,
          pane: cfg.pane,
          bubblingMouseEvents: true
        });
      },

      onEachFeature: (feature, layer) => {
        const iata = featureIata(feature);
        const name = featureName(feature, cfg);
        const text = iata
          ? `${cfg.name} · ${iata} · ${name}`
          : `${cfg.name} · ${name}`;

        layer.bindTooltip(escapeHtml(text), {
          sticky: true,
          direction: "top",
          opacity: .9,
          className: "context-map-tooltip"
        });
      }
    });
  }

  function layerPassesZoom(def) {
    const min = def.cfg.minZoom;
    return min === undefined || min === null || window.__SIGA_EDITOR_MAP__?.getZoom() >= min;
  }

  function setVisible(def) {
    const map = window.__SIGA_EDITOR_MAP__;
    if (!map || !def.layer) return;

    const shouldShow = def.active && layerPassesZoom(def);
    const shown = map.hasLayer(def.layer);

    if (shouldShow && !shown) def.layer.addTo(map);
    if (!shouldShow && shown) map.removeLayer(def.layer);
  }

  function refreshVisibility() {
    defs.forEach(setVisible);
    renderStatus();
  }

  function applyOpacity(def, value) {
    const opacity = Number(value);
    def.opacity = opacity;

    def.layer?.eachLayer?.(layer => {
      if (!layer.setStyle) return;

      if (layer.__ctxOpacity === undefined) {
        layer.__ctxOpacity = layer.options.opacity ?? 1;
        layer.__ctxFillOpacity = layer.options.fillOpacity ?? 0;
      }

      layer.setStyle({
        opacity: layer.__ctxOpacity * opacity,
        fillOpacity: layer.__ctxFillOpacity * opacity
      });
    });
  }

  function renderStatus() {
    const el = document.getElementById("contextLoadStatus");
    if (!el) return;

    const loaded = Array.from(defs.values()).filter(d => d.layer).length;
    const visible = Array.from(defs.values()).filter(
      d => d.layer && d.active && window.__SIGA_EDITOR_MAP__?.hasLayer(d.layer)
    ).length;

    el.textContent = `${visible}/${loaded}`;
    el.title = `${visible} capas visibles de ${loaded} cargadas`;
  }

  function renderTree() {
    const root = document.getElementById("contextLayerTree");
    if (!root) return;

    const groups = new Map();
    CONTEXT_LAYERS.forEach(cfg => {
      if (!groups.has(cfg.group)) groups.set(cfg.group, []);
      groups.get(cfg.group).push(cfg);
    });

    root.innerHTML = "";

    GROUP_ORDER.forEach((groupName, groupIndex) => {
      const items = groups.get(groupName) || [];
      if (!items.length) return;

      const details = document.createElement("details");
      details.className = "context-group";

      // Dejar abiertas las dos categorías más útiles para ubicar infraestructura.
      if (groupName === "Edificios e infraestructura" || groupName === "Área de movimiento") {
        details.open = true;
      }

      const summary = document.createElement("summary");
      summary.innerHTML = `
        <span>${escapeHtml(groupName)}</span>
        <span class="context-group-count">${items.length}</span>
      `;
      details.appendChild(summary);

      const body = document.createElement("div");
      body.className = "context-group-body";

      items.forEach(cfg => {
        const def = defs.get(cfg.id);
        const row = document.createElement("label");
        row.className =
          `context-layer-row${cfg.aip ? " is-aip" : ""}${def?.error ? " is-unavailable" : ""}`;

        row.title = def?.error
          ? `No se pudo cargar ${cfg.url}`
          : cfg.minZoom
            ? `${cfg.name}. Visible desde zoom ${cfg.minZoom}.`
            : cfg.name;

        row.innerHTML = `
          <input
            type="checkbox"
            data-context-layer="${escapeHtml(cfg.id)}"
            ${def?.active ? "checked" : ""}
            ${def?.error ? "disabled" : ""}
          >
          <span class="context-swatch" style="background:${cfg.color};"></span>
          <span class="context-layer-name">${escapeHtml(cfg.name)}</span>
          <input
            class="context-opacity"
            type="range"
            min="0.15"
            max="1"
            step="0.05"
            value="${def?.opacity ?? 1}"
            data-context-opacity="${escapeHtml(cfg.id)}"
            ${def?.error ? "disabled" : ""}
            title="Transparencia"
          >
        `;

        body.appendChild(row);
      });

      details.appendChild(body);
      root.appendChild(details);
    });

    root.querySelectorAll("[data-context-layer]").forEach(input => {
      input.addEventListener("change", e => {
        const def = defs.get(e.target.dataset.contextLayer);
        if (!def) return;
        def.active = e.target.checked;
        setVisible(def);
        renderStatus();
      });
    });

    root.querySelectorAll("[data-context-opacity]").forEach(input => {
      input.addEventListener("input", e => {
        const def = defs.get(e.target.dataset.contextOpacity);
        if (!def) return;
        applyOpacity(def, e.target.value);
      });
    });
  }

  function dispatchCheck(id, checked) {
    const input = document.getElementById(id);
    if (!input || input.checked === checked) return;
    input.checked = checked;
    input.dispatchEvent(new Event("change", { bubbles:true }));
  }

  function applyPreset(mode) {
    if (mode === "default") {
      dispatchCheck("toggleAirports", true);
      dispatchCheck("togglePredios", true);

      defs.forEach(def => {
        def.active = def.cfg.aip ? DEFAULT_AIP_ACTIVE : DEFAULT_CORE_ACTIVE;
      });
    }

    if (mode === "all") {
      dispatchCheck("toggleAirports", true);
      dispatchCheck("togglePredios", true);
      defs.forEach(def => { if (!def.error) def.active = true; });
    }

    if (mode === "none") {
      dispatchCheck("toggleAirports", false);
      dispatchCheck("togglePredios", false);
      defs.forEach(def => { def.active = false; });
    }

    refreshVisibility();
    renderTree();
  }

  function wireButtons() {
    document.getElementById("contextDefaultButton")
      ?.addEventListener("click", () => applyPreset("default"));

    document.getElementById("contextAllButton")
      ?.addEventListener("click", () => applyPreset("all"));

    document.getElementById("contextNoneButton")
      ?.addEventListener("click", () => applyPreset("none"));
  }

  async function loadContextLayers() {
    const map = window.__SIGA_EDITOR_MAP__;
    if (!map) return;

    ensurePanes(map);

    const status = document.getElementById("contextLoadStatus");
    if (status) status.textContent = "…";

    const results = await Promise.all(
      CONTEXT_LAYERS.map(async cfg => {
        try {
          const response = await fetch(cfg.url);
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

          const geojson = await response.json();
          const layer = makeLayer(cfg, geojson);
          const def = {
            cfg,
            layer,
            active: !!cfg.active,
            opacity: 1,
            error: false
          };

          defs.set(cfg.id, def);
          applyOpacity(def, 1);
          setVisible(def);

          return { ok:true, cfg, count:layer.getLayers().length };
        } catch (error) {
          console.warn(`Editor contexto SIGA: no se pudo cargar ${cfg.url}`, error);
          defs.set(cfg.id, {
            cfg,
            layer:null,
            active:false,
            opacity:1,
            error:true
          });
          return { ok:false, cfg, error };
        }
      })
    );

    renderTree();
    refreshVisibility();

    const ok = results.filter(r => r.ok);
    const failed = results.filter(r => !r.ok);

    console.info(
      "Editor DMA · contexto SIGA:",
      ok.map(r => `${r.cfg.name}: ${r.count}`).join(" | ")
    );

    if (failed.length) {
      console.warn(
        "Editor DMA · capas de contexto no disponibles:",
        failed.map(r => r.cfg.url)
      );
    }
  }

  async function initializeContext() {
    if (initialized) return;

    const map = window.__SIGA_EDITOR_MAP__;
    const tree = document.getElementById("contextLayerTree");

    if (!map || !tree) {
      setTimeout(initializeContext, 100);
      return;
    }

    initialized = true;
    wireButtons();

    map.on("zoomend", refreshVisibility);

    await loadContextLayers();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (window.__SIGA_EDITOR_MAP__) initializeContext();
  });
})();
