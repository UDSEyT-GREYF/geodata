/* global L */
(() => {
  "use strict";

  /*
    Extensión AIP para SIGA.
    - No modifica ni elimina ninguna capa definida en js/siga.js.
    - Agrega sólo capas con geometría publicada o derivada.
    - Excluye geometrías de referencia sin posición física exacta.
  */

  if (typeof L === "undefined") {
    console.warn("SIGA AIP: Leaflet no está disponible.");
    return;
  }

  // Captura la instancia del mapa que crea js/siga.js.
  const originalMapFactory = L.map;
  if (!L.map.__sigaAipWrapped) {
    const wrappedMapFactory = function (...args) {
      const map = originalMapFactory.apply(this, args);
      const target = args[0];
      const id = typeof target === "string" ? target : target?.id;
      if (id === "sigaMap") window.__SIGA_AIP_MAP__ = map;
      return map;
    };
    wrappedMapFactory.__sigaAipWrapped = true;
    L.map = wrappedMapFactory;
  }

  const EXTRA_LAYERS = [
    {
      id: "aip_umbrales",
      group: "Área de movimiento",
      name: "Umbrales de pista (AIP)",
      url: "fuentes/aip_umbrales_pista.geojson",
      color: "#00CFE8",
      minZoom: 11,
      point: { radius: 4.2, color: "#004E64", weight: 1.2, fillColor: "#00CFE8", fillOpacity: 0.95 },
      titleKeys: ["rwy"],
      fields: [
        ["IATA", ["iata", "IATA"]], ["OACI", ["icao", "OACI"]], ["Pista", ["rwy"]],
        ["BRG GEO", ["brg_geo"]], ["BRG MAG", ["brg_mag"]],
        ["Longitud RWY", ["longitud_rwy_m"], "m"], ["Ancho RWY", ["ancho_rwy_m"], "m"],
        ["Superficie / resistencia", ["resistencia_superficie"]], ["Elevación THR/TDZ", ["elev_thr_tdz"]],
        ["DTHR", ["dthr_m"], "m"], ["TORA", ["tora_m"], "m"], ["TODA", ["toda_m"], "m"],
        ["ASDA", ["asda_m"], "m"], ["LDA", ["lda_m"], "m"],
        ["Precisión", ["precision_geometria"]], ["Fecha AIP", ["fecha_seccion"]],
        ["AMDT AIRAC", ["amdt_airac"]], ["Fuente", ["url_fuente"], "", "url"]
      ]
    },
    {
      id: "aip_ejes_pista",
      group: "Área de movimiento",
      name: "Ejes de pista (AIP)",
      url: "fuentes/aip_pistas_ejes.geojson",
      color: "#F4D03F",
      minZoom: 10,
      style: { color: "#F4D03F", weight: 2.4, opacity: 0.95, fillOpacity: 0 },
      titleKeys: ["designacion"],
      fields: [
        ["IATA", ["iata"]], ["OACI", ["icao"]], ["Pista", ["designacion"]],
        ["Longitud publicada", ["longitud_publicada_m"], "m"], ["Ancho", ["ancho_m"], "m"],
        ["Superficie / resistencia", ["resistencia_superficie"]], ["BRG GEO 1", ["brg_geo_1"]],
        ["BRG GEO 2", ["brg_geo_2"]], ["Método", ["metodo_geometria"]],
        ["Precisión", ["precision_geometria"]], ["Fecha AIP", ["fecha_seccion"]],
        ["Fuente", ["url_fuente"], "", "url"]
      ]
    },
    {
      id: "aip_superficies_pista",
      group: "Área de movimiento",
      name: "Superficies de pista (AIP)",
      url: "fuentes/aip_pistas_superficies.geojson",
      color: "#F5B041",
      minZoom: 10,
      style: { color: "#F5B041", weight: 1.7, opacity: 0.95, fillColor: "#F5B041", fillOpacity: 0.07 },
      titleKeys: ["designacion"],
      fields: [
        ["IATA", ["iata"]], ["OACI", ["icao"]], ["Pista", ["designacion"]],
        ["Longitud publicada", ["longitud_publicada_m"], "m"], ["Ancho", ["ancho_m"], "m"],
        ["Superficie / resistencia", ["resistencia_superficie"]], ["Método", ["metodo_geometria"]],
        ["Precisión", ["precision_geometria"]], ["Fecha AIP", ["fecha_seccion"]],
        ["Fuente", ["url_fuente"], "", "url"]
      ]
    },
    {
      id: "aip_zonas_pista",
      group: "Área de movimiento",
      name: "Zonas de pista: SWY/CWY/RESA/franjas (AIP)",
      url: "fuentes/aip_zonas_pista.geojson",
      color: "#FF8C42",
      minZoom: 10,
      style: { color: "#FF8C42", weight: 1.6, opacity: 0.95, fillColor: "#FF8C42", fillOpacity: 0.08 },
      titleKeys: ["tipo_zona", "rwy_asociada"],
      fields: [
        ["IATA", ["iata"]], ["OACI", ["icao"]], ["Tipo", ["tipo_zona"]],
        ["RWY asociada", ["rwy_asociada"]], ["Dimensiones AIP", ["dimensiones_publicadas"]],
        ["Longitud", ["longitud_m"], "m"], ["Ancho", ["ancho_m"], "m"], ["OFZ", ["ofz"]],
        ["Sistema de parada", ["sistema_parada"]], ["Observaciones", ["observaciones"]],
        ["Método", ["metodo_geometria"]], ["Precisión", ["precision_geometria"]],
        ["Fecha AIP", ["fecha_seccion"]], ["Fuente", ["url_fuente"], "", "url"]
      ]
    },
    {
      id: "aip_luces_aproximacion",
      group: "Área de movimiento",
      name: "Luces de aproximación (AIP)",
      url: "fuentes/aip_luces_aproximacion.geojson",
      color: "#00E676",
      minZoom: 10,
      style: { color: "#00E676", weight: 3, opacity: 0.95, fillOpacity: 0 },
      titleKeys: ["rwy", "sistema_aproximacion"],
      fields: [
        ["IATA", ["iata"]], ["OACI", ["icao"]], ["RWY", ["rwy"]],
        ["Sistema", ["sistema_aproximacion"]], ["Longitud", ["longitud_m"], "m"],
        ["Método", ["metodo_geometria"]], ["Precisión", ["precision_geometria"]],
        ["Fecha AIP", ["fecha_seccion"]], ["Fuente", ["url_fuente"], "", "url"]
      ]
    },
    {
      id: "sei_aip",
      group: "Servicios y apoyo",
      name: "Salvamento y extinción de incendios (SEI)",
      url: "fuentes/SEI2026_final_AIP_AD26.geojson",
      color: "#E53935",
      minZoom: 10,
      style: { color: "#B71C1C", weight: 1.8, opacity: 1, fillColor: "#E53935", fillOpacity: 0.13 },
      titleKeys: ["etiqueta", "aeropuerto"],
      fields: [
        ["IATA", ["iata"]], ["OACI", ["icao"]], ["Aeropuerto", ["aeropuerto"]],
        ["Categoría SEI", ["categoria_sei_texto", "categoria_sei"]], ["Autobombas", ["cantidad_autobombas"]],
        ["Agua", ["agua_l"], "l"], ["Espuma", ["espuma_l"], "l"], ["Polvo químico", ["polvo_quimico_kg"], "kg"],
        ["Prestador", ["prestador_sei"]], ["Equipo de salvamento", ["equipo_salvamento"]],
        ["Remoción de aeronaves", ["capacidad_remocion"]], ["Estado de revisión", ["estado_revision"]],
        ["Fecha AIP AD 2.6", ["fecha_ad26"]], ["AMDT", ["amdt_ad26"]],
        ["Fuente AIP", ["fuente_ad26"], "", "url"]
      ]
    },
    {
      id: "aip_radioayudas",
      group: "Servicios y apoyo",
      name: "Radioayudas (AIP)",
      url: "fuentes/aip_radioayudas.geojson",
      color: "#7E57C2",
      minZoom: 8,
      point: { radius: 4.5, color: "#4527A0", weight: 1.2, fillColor: "#7E57C2", fillOpacity: 0.95 },
      titleKeys: ["tipo_ayuda", "id_ayuda"],
      fields: [
        ["IATA", ["iata"]], ["OACI", ["icao"]], ["Tipo", ["tipo_ayuda"]], ["Identificador", ["id_ayuda"]],
        ["Frecuencia / canal", ["frecuencia_canal"]], ["Horario", ["horario"]], ["Elevación DME", ["elevacion_dme"]],
        ["Observaciones", ["observaciones"]], ["Precisión", ["precision_geometria"]],
        ["Fecha AIP", ["fecha_seccion"]], ["Fuente", ["url_fuente"], "", "url"]
      ]
    },
    {
      id: "aip_puntos_verificacion",
      group: "Servicios y apoyo",
      name: "Puntos de verificación VOR/INS (AIP)",
      url: "fuentes/aip_puntos_verificacion.geojson",
      color: "#00ACC1",
      minZoom: 10,
      point: { radius: 4.5, color: "#006064", weight: 1.2, fillColor: "#00ACC1", fillOpacity: 0.95 },
      titleKeys: ["tipo"],
      fields: [
        ["IATA", ["iata"]], ["OACI", ["icao"]], ["Tipo", ["tipo"]], ["Método", ["metodo"]],
        ["Detalle", ["detalle"]], ["VOR", ["vor_id"]], ["Radial", ["rdl"]], ["Distancia", ["distancia_nm"], "NM"],
        ["Precisión", ["precision_geometria"]], ["Fecha AIP", ["fecha_seccion"]],
        ["Fuente", ["url_fuente"], "", "url"]
      ]
    },
    {
      id: "aip_obstaculos",
      group: "Contexto territorial",
      name: "Obstáculos de aeródromo (AIP)",
      url: "fuentes/aip_obstaculos_aerodromo.geojson",
      color: "#FF5252",
      minZoom: 11,
      point: { radius: 3.1, color: "#8B0000", weight: 1, fillColor: "#FF5252", fillOpacity: 0.9 },
      titleKeys: ["tipo_obstaculo"],
      fields: [
        ["IATA", ["iata"]], ["OACI", ["icao"]], ["Contexto", ["contexto"]],
        ["RWY / área afectada", ["rwy_area_afectada"]], ["Obstáculo", ["tipo_obstaculo"]],
        ["Elevación", ["elevacion_m"], "m"], ["Detalle", ["detalle"]], ["Coordenada AIP", ["coord_raw"]],
        ["Precisión", ["precision_geometria"]], ["Fecha AIP", ["fecha_seccion"]],
        ["Fuente", ["url_fuente"], "", "url"]
      ]
    },
    {
      id: "aip_espacios_ats",
      group: "Contexto territorial",
      name: "Espacios ATS / CTR (AIP)",
      url: "fuentes/aip_espacios_ats.geojson",
      color: "#8E44AD",
      minZoom: 5,
      style: { color: "#8E44AD", weight: 1.5, opacity: 0.9, fillColor: "#8E44AD", fillOpacity: 0.035 },
      titleKeys: ["designacion", "nombre", "tipo_espacio", "tipo"],
      fields: [
        ["IATA", ["iata"]], ["OACI", ["icao"]], ["Designación", ["designacion", "nombre"]],
        ["Tipo", ["tipo_espacio", "tipo"]], ["Límites laterales", ["limites_laterales", "limite_lateral"]],
        ["Límites verticales", ["limites_verticales", "limite_vertical"]],
        ["Clasificación", ["clasificacion", "clase"]], ["Dependencia ATS", ["dependencia_ats", "unidad_ats"]],
        ["Método", ["metodo_geometria", "metodo"]], ["Precisión", ["precision_geometria"]],
        ["Fecha AIP", ["fecha_seccion"]], ["Fuente", ["url_fuente"], "", "url"]
      ]
    }
  ];

  const defs = new Map();
  let initialized = false;

  const clean = (v) => v === null || v === undefined ? "" : String(v).trim();
  const escapeHtml = (v) => String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function firstProp(props, keys) {
    for (const key of keys || []) {
      const value = props?.[key];
      if (value !== null && value !== undefined && clean(value) !== "") return value;
    }
    return "";
  }

  // Regla de inclusión: geometría real o derivada; nunca una mera referencia.
  function acceptedFeature(feature) {
    if (!feature?.geometry) return false;
    const p = feature.properties || {};
    if (p.ubicacion_equipo_exacta === false) return false;
    if (p.aproximada === true) return false;
    const precision = clean(p.precision_geometria).toLowerCase();
    if (precision.includes("referencia") || precision.includes("no_posicion_fisica")) return false;
    return true;
  }

  function layerTitle(cfg, feature) {
    const p = feature?.properties || {};
    const parts = (cfg.titleKeys || []).map(k => clean(p[k])).filter(Boolean);
    if (parts.length) return parts.join(" · ");
    return clean(p.aeropuerto || p.Aeropuerto || p.iata || p.IATA || cfg.name);
  }

  function formatValue(value) {
    if (value === null || value === undefined || value === "") return "–";
    if (typeof value === "number") return value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
    return String(value);
  }

  function buildInfoRows(cfg, feature) {
    const props = feature?.properties || {};
    return (cfg.fields || []).map(([label, keys, suffix, type]) => {
      const value = firstProp(props, keys);
      if (value === "") return "";
      const shown = `${formatValue(value)}${suffix ? ` ${suffix}` : ""}`;
      const rendered = type === "url"
        ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener">Abrir fuente AIP</a>`
        : escapeHtml(shown);
      return `<tr><td>${escapeHtml(label)}</td><td>${rendered}</td></tr>`;
    }).filter(Boolean).join("");
  }

  function showFeatureInfo(cfg, feature) {
    const el = document.getElementById("featureInfo");
    if (!el) return;
    el.innerHTML = `
      <div class="feature-title">${escapeHtml(cfg.name)} · ${escapeHtml(layerTitle(cfg, feature))}</div>
      <table class="feature-table">${buildInfoRows(cfg, feature)}</table>
      <div class="siga-hint" style="margin-top:6px">Fuente: AIP Argentina · ANAC.</div>
    `;
  }

  function makeLeafletLayer(cfg, geojson) {
    const pane = cfg.group === "Área de movimiento"
      ? "sigaMovimientoPane"
      : cfg.group === "Servicios y apoyo"
        ? "sigaServiciosPane"
        : "sigaContextPane";

    const filtered = {
      type: "FeatureCollection",
      features: (geojson?.features || []).filter(acceptedFeature)
    };

    return L.geoJSON(filtered, {
      pane,
      interactive: true,
      style: () => ({
        ...(cfg.style || { color: cfg.color, weight: 1.5, fillColor: cfg.color, fillOpacity: 0.18 }),
        pane
      }),
      pointToLayer: (_feature, latlng) => {
        const p = cfg.point || {
          radius: 4, color: cfg.color, weight: 1,
          fillColor: cfg.color, fillOpacity: 0.9
        };
        return L.circleMarker(latlng, { ...p, pane });
      },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(`${escapeHtml(cfg.name)} · ${escapeHtml(layerTitle(cfg, feature))}`, {
          sticky: true,
          direction: "top",
          opacity: 0.92,
          className: "siga-tooltip"
        });
        layer.on("click", (e) => {
          if (e?.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
          showFeatureInfo(cfg, feature);
        });
      }
    });
  }

  function applyOpacity(def, opacity) {
    def.opacity = Number(opacity);
    def.layer?.eachLayer?.((layer) => {
      if (!layer.setStyle) return;
      if (layer.__sigaAipBaseOpacity === undefined) {
        layer.__sigaAipBaseOpacity = layer.options.opacity ?? 1;
      }
      if (layer.__sigaAipBaseFillOpacity === undefined) {
        layer.__sigaAipBaseFillOpacity = layer.options.fillOpacity ?? 0;
      }
      layer.setStyle({
        opacity: layer.__sigaAipBaseOpacity * def.opacity,
        fillOpacity: layer.__sigaAipBaseFillOpacity * def.opacity
      });
    });
  }

  function refreshVisibility() {
    const map = window.__SIGA_AIP_MAP__;
    if (!map) return;

    defs.forEach(def => {
      const shouldShow = def.active && map.getZoom() >= (def.cfg.minZoom ?? 0);
      const shown = map.hasLayer(def.layer);
      if (shouldShow && !shown) def.layer.addTo(map);
      else if (!shouldShow && shown) map.removeLayer(def.layer);
    });

    syncLegend();
  }

  function setExtraActive(id, active) {
    const def = defs.get(id);
    if (!def) return;
    def.active = !!active;
    refreshVisibility();
  }

  function findGroupEl(groupName) {
    const root = document.getElementById("layerTree");
    if (!root) return null;
    return Array.from(root.querySelectorAll(".layer-group")).find(group =>
      clean(group.querySelector(".layer-group-title")?.textContent) === groupName
    ) || null;
  }

  function renderRows() {
    if (!initialized) return;

    document.querySelectorAll("[data-siga-aip-extra-row]").forEach(el => el.remove());

    EXTRA_LAYERS.forEach(cfg => {
      const def = defs.get(cfg.id);
      const groupEl = findGroupEl(cfg.group);
      if (!groupEl || !def) return;

      const row = document.createElement("label");
      row.className = "layer-row";
      row.dataset.sigaAipExtraRow = cfg.id;
      row.title = cfg.minZoom ? `Capa AIP. Visible desde zoom ${cfg.minZoom}.` : "Capa AIP";
      row.innerHTML = `
        <input type="checkbox" data-aip-extra-id="${escapeHtml(cfg.id)}" ${def.active ? "checked" : ""}>
        <span class="layer-swatch" style="background:${cfg.color};"></span>
        <span class="layer-name" title="${escapeHtml(cfg.name)}">${escapeHtml(cfg.name)}</span>
        <input class="layer-opacity" type="range" min="0.1" max="1" step="0.05"
               value="${def.opacity}" data-aip-opacity-id="${escapeHtml(cfg.id)}">
      `;
      groupEl.appendChild(row);
    });
  }

  function syncLegend() {
    const legend = document.getElementById("mapLegend");
    const map = window.__SIGA_AIP_MAP__;
    if (!legend || !map) return;

    legend.querySelectorAll("[data-aip-extra-legend]").forEach(el => el.remove());
    const visible = Array.from(defs.values()).filter(def => def.active && map.hasLayer(def.layer));

    if (visible.length) {
      legend.querySelectorAll(".siga-hint").forEach(el => el.remove());
      visible.forEach(def => {
        const item = document.createElement("div");
        item.className = "legend-item";
        item.dataset.aipExtraLegend = def.cfg.id;
        item.innerHTML = `
          <span class="legend-swatch" style="background:${def.cfg.color};"></span>
          <span>${escapeHtml(def.cfg.name)}</span>
        `;
        legend.appendChild(item);
      });
    } else if (!legend.children.length) {
      legend.innerHTML = `<div class="siga-hint">No hay capas activas.</div>`;
    }
  }

  function wireExtensionUi() {
    const root = document.getElementById("layerTree");
    if (!root) return;

    root.addEventListener("change", e => {
      const checkbox = e.target.closest("input[data-aip-extra-id]");
      if (checkbox) {
        setExtraActive(checkbox.dataset.aipExtraId, checkbox.checked);
        return;
      }
      if (e.target.matches("input[data-layer-id]")) setTimeout(syncLegend, 0);
    });

    root.addEventListener("input", e => {
      const slider = e.target.closest("input[data-aip-opacity-id]");
      if (!slider) return;
      const def = defs.get(slider.dataset.aipOpacityId);
      if (!def) return;
      applyOpacity(def, Number(slider.value));
    });

    const buttonActions = {
      btnDefaultLayers: false,
      btnNoLayers: false,
      btnAllLayers: true
    };

    Object.entries(buttonActions).forEach(([id, value]) => {
      document.getElementById(id)?.addEventListener("click", () => {
        defs.forEach(def => { def.active = value; });
        refreshVisibility();

        // Los botones nativos vuelven a dibujar el árbol de capas.
        // Restauramos luego nuestras filas dentro de las mismas categorías.
        setTimeout(() => {
          renderRows();
          syncLegend();
        }, 0);
      });
    });

    window.__SIGA_AIP_MAP__?.on("zoomend", refreshVisibility);
  }

  async function initialize() {
    if (initialized) return;

    const map = window.__SIGA_AIP_MAP__;
    const root = document.getElementById("layerTree");
    if (!map || !root?.querySelector(".layer-group")) return;

    const results = await Promise.all(EXTRA_LAYERS.map(async cfg => {
      try {
        const response = await fetch(cfg.url);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const geojson = await response.json();
        const layer = makeLeafletLayer(cfg, geojson);
        const def = { cfg, layer, active: false, opacity: 1 };
        applyOpacity(def, 1);
        defs.set(cfg.id, def);
        return { ok: true, cfg, count: layer.getLayers().length };
      } catch (error) {
        console.warn(`SIGA AIP: no se pudo cargar ${cfg.url}`, error);
        return { ok: false, cfg, error };
      }
    }));

    initialized = true;
    renderRows();
    wireExtensionUi();
    syncLegend();

    const loaded = results.filter(r => r.ok);
    const failed = results.filter(r => !r.ok);
    console.info(
      "SIGA AIP: capas incorporadas",
      loaded.map(r => `${r.cfg.name}: ${r.count}`).join(" | ")
    );
    if (failed.length) {
      console.warn("SIGA AIP: capas no disponibles", failed.map(r => r.cfg.url));
    }
  }

  function waitForMainSiga(attempt = 0) {
    if (window.__SIGA_AIP_MAP__ && document.querySelector("#layerTree .layer-group")) {
      initialize();
      return;
    }

    if (attempt < 240) {
      setTimeout(() => waitForMainSiga(attempt + 1), 100);
    } else {
      console.warn("SIGA AIP: no se pudo encontrar el mapa o el árbol de capas.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => waitForMainSiga());
})();
