// js/datos-clave.js
/* global L, Chart */

(() => {
  "use strict";

  /* ============================================================
     0. RUTAS DE FUENTES (AJUSTAR SI TU REPO USA OTROS NOMBRES)
     ============================================================ */
  const SOURCES = {
    aeropuertos: "fuentes/Datos_aeropuertos.geojson",

    // Predio / concesión
    predios: [
      "fuentes/Poligonos_predio.geojson",
      "fuentes/poligonos_predio.geojson",
      "fuentes/Predios.geojson"
    ],

    // Área de movimiento
    psn: ["fuentes/PSN.geojson", "fuentes/psn.geojson"],
    pistas: ["fuentes/Pistas.geojson", "fuentes/pistas.geojson"],

    // Ubicación
    provincias: ["fuentes/Provincias.geojson", "fuentes/provincias.geojson"],

    // Transporte
    terminales: ["fuentes/Terminales.geojson", "fuentes/terminales.geojson"],
    paradas: ["fuentes/Paradas_transporte.geojson", "fuentes/paradas_transporte.geojson"],

    // Influencia (polígonos “vuelos regulares”)
    areasInfluencia: ["fuentes/Areasinfluencia39.geojson", "fuentes/areasInfluencia39.geojson"],

    // CSVs
    contactos: [
      "fuentes/contactos_aeropuertos.csv",
      "fuentes/Contactos_aeropuertos.csv",
      "fuentes/contactos.csv"
    ],
    inversiones: [
      "fuentes/Programacion_por_aeropuerto_aprobada2025_web.csv",
      "fuentes/programacion_por_aeropuerto_aprobada2025_web.csv"
    ],
    transporteCSV: [
      "fuentes/transporte_publico.csv",
      "fuentes/Transporte_publico.csv",
      "fuentes/transporte.csv"
    ],

    // Pasajeros
    pasajeros: [
      "fuentes/pasajeros_aeropuerto_mensual.csv",
      "fuentes/Pasajeros_aeropuerto_mensual.csv",
      "fuentes/pax_mensual.csv"
    ],

    // Tiempos por aeropuerto (se construye dinámicamente)
    tiemposTemplate: (iataUpper) => `img/Tiempos/Tiempos_${iataUpper}.geojson`
  };

  /* ============================================================
     A. VARIABLES GLOBALES (DATA + UI + MAPAS)
     ============================================================ */

  // Datos principales (GeoJSON / CSV)
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

  // Pasajeros
  let paxRows = [];
  let paxIndex = {};
  let paxChart = null;

  // UI
  let selectEl = null;

  // Leaflet maps & layers
  let map, mapMarker, poligonoLayer;
  let mapPSN, psnLayer, pistasLayerPSN;
  let mapUbicacion, ubicacionMarker, provinciasLayer;
  let mapTransporte, transporteLayer;
  let mapInfluencia, tiemposLayer, influenciaLayer, influenciaMarker;

  // Leyenda (influencia)
  let influenciaLegend = null;

  // Multiplicador para empleo indirecto
  const EMP_IND_MULT = 5.8;

  // Icono aeropuerto
  const airportIcon = L.icon({
    iconUrl: "img/icons/AeropuertosSNA.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    tooltipAnchor: [0, -18]
  });

  /* ============================================================
     B. HELPERS
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

  function parseEsNumber(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const normalized = s.replace(/\./g, "").replace(/,/g, "");
    const n = Number(normalized);
    return isNaN(n) ? null : n;
  }

  function parseDMYDate(raw) {
    const s = clean(raw);
    if (!s) return null;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function formatShortMonthYYYY(dateObj) {
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleDateString("es-AR", { year: "numeric", month: "short" });
  }

  // Parsea montos en texto (con separadores argentinos) a número
  function parseMonto(raw) {
    if (raw === null || raw === undefined) return 0;
    let s = String(raw).trim();
    if (!s) return 0;
    s = s.replace(/\./g, "").replace(/,/g, ".");
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  }

  function formatMillions(valor) {
    if (valor === null || valor === undefined || isNaN(Number(valor)) || Number(valor) === 0) return "–";
    const millones = Number(valor) / 1_000_000;
    return millones.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function splitField(str) {
    if (!str) return [];
    return String(str)
      .split(/[;]+| {2,}|\t+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function getProp(obj, keys) {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
    }
    return "";
  }

  async function fetchFirstOkJson(paths) {
    for (const p of paths) {
      try {
        const r = await fetch(p);
        if (!r.ok) continue;
        return await r.json();
      } catch (_) { /* continue */ }
    }
    return null;
  }

  async function fetchFirstOkText(paths) {
    for (const p of paths) {
      try {
        const r = await fetch(p);
        if (!r.ok) continue;
        return await r.text();
      } catch (_) { /* continue */ }
    }
    return null;
  }

  // Centro del aeropuerto: prioriza bounds del polígono y cae a Lat/Lon
  function getAirportCenterLatLng(a) {
    const iata = a.IATA;

    if (poligonos.length && iata) {
      const feats = poligonos.filter(f => {
        const props = f.properties || {};
        const code = props.IATA || props.iata || props.iata_code;
        return String(code).toUpperCase() === String(iata).toUpperCase();
      });

      if (feats.length) {
        const tempLayer = L.geoJSON(feats);
        const bounds = tempLayer.getBounds();
        if (bounds.isValid()) {
          const center = bounds.getCenter();
          return [center.lat, center.lng];
        }
      }
    }

    const lat = a["Lat"] || a["LAT"] || a["lat"] || a["Latitud"] || a["Latitude"];
    const lon = a["Lon"] || a["LON"] || a["Long"] || a["lng"] || a["Longitud"] || a["Longitude"];

    if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      return [Number(lat), Number(lon)];
    }
    return null;
  }

  /* ============================================================
     C. MAPAS LEAFLET (INIT)
     ============================================================ */

  function initMap() {
    // 1) Mapa del predio
    map = L.map("mapPredio").setView([-34.6, -58.4], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    mapMarker = L.marker([-34.6, -58.4]).addTo(map);

    // 2) Mapa PSN (satélite)
    mapPSN = L.map("mapPSN").setView([-34.6, -58.4], 5);
    if (L.esri && L.esri.basemapLayer) {
      L.esri.basemapLayer("Imagery").addTo(mapPSN);
    } else {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapPSN);
    }

    // 3) Mapa ubicación
    const mapUbDiv = document.getElementById("mapUbicacion");
    if (mapUbDiv) mapUbDiv.style.height = "450px";

    mapUbicacion = L.map("mapUbicacion", { zoomControl: true }).setView([-38, -64], 4);
    L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      { maxZoom: 14, tms: true, attribution: "© IGN Argentina - Argenmap" }
    ).addTo(mapUbicacion);

    // 4) Mapa transporte
    mapTransporte = L.map("mapTransporte").setView([-34.6, -58.4], 5);
    mapTransporte.createPane("pane_terminales");
    mapTransporte.getPane("pane_terminales").style.zIndex = 300;
    mapTransporte.createPane("pane_paradas");
    mapTransporte.getPane("pane_paradas").style.zIndex = 400;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapTransporte);

    // 5) Mapa influencia
    mapInfluencia = L.map("mapInfluencia").setView([-38, -64], 4);
    L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      { maxZoom: 14, tms: true, attribution: "© IGN Argentina - Argenmap" }
    ).addTo(mapInfluencia);
  }

  /* ============================================================
     D. MAPA PREDIO
     ============================================================ */
  function updateMapForAirport(a) {
    if (!map) return;

    if (poligonoLayer) {
      map.removeLayer(poligonoLayer);
      poligonoLayer = null;
    }

    const iata = a.IATA;

    if (poligonos.length > 0 && iata) {
      const feats = poligonos.filter(f => {
        const props = f.properties || {};
        const code = props.IATA || props.iata || props.iata_code;
        return String(code).toUpperCase() === String(iata).toUpperCase();
      });

      if (feats.length > 0) {
        poligonoLayer = L.geoJSON(feats, {
          style: { color: "#0072bb", weight: 2, fillColor: "#4fa3ff", fillOpacity: 0.35 }
        }).addTo(map);

        const bounds = poligonoLayer.getBounds();
        if (bounds.isValid()) {
          setTimeout(() => {
            map.invalidateSize();
            map.fitBounds(bounds, { padding: [5, 5] });
          }, 0);
        }

        if (mapMarker) map.removeLayer(mapMarker);
        return;
      }
    }

    const center = getAirportCenterLatLng(a);
    if (center) {
      setTimeout(() => {
        map.invalidateSize();
        map.setView(center, 11);
      }, 0);

      if (!mapMarker) mapMarker = L.marker(center).addTo(map);
      else mapMarker.setLatLng(center).addTo(map);
    } else {
      setTimeout(() => {
        map.invalidateSize();
        map.setView([-34.6, -58.4], 5);
      }, 0);
      if (mapMarker) mapMarker.setLatLng([-34.6, -58.4]).addTo(map);
    }
  }

  /* ============================================================
     E. MAPA PSN + PISTAS
     ============================================================ */
  function updatePSNMapForAirport(a) {
    if (!mapPSN) return;

    if (psnLayer) { mapPSN.removeLayer(psnLayer); psnLayer = null; }
    if (pistasLayerPSN) { mapPSN.removeLayer(pistasLayerPSN); pistasLayerPSN = null; }

    const iata = a.IATA;
    if (!iata) return;
    const iataUpper = String(iata).toUpperCase();

    const featsPSN = (psnFeatures || []).filter(f => {
      const props = f.properties || {};
      const code = props.IATA || props.iata || props.iata_code;
      return String(code || "").toUpperCase() === iataUpper;
    });

    if (featsPSN.length) {
      psnLayer = L.geoJSON(featsPSN, {
        pointToLayer: (feature, latlng) => {
          const marker = L.circleMarker(latlng, {
            radius: 4,
            color: "#000",
            weight: 1,
            fillColor: "#ff0000",
            fillOpacity: 0.9
          });
          const posLabel = feature.properties?.posicion || feature.properties?.etiqueta || "";
          if (posLabel) {
            marker.bindTooltip(String(posLabel), {
              permanent: true,
              direction: "top",
              offset: [0, -4],
              className: "psn-tooltip"
            });
          }
          return marker;
        }
      }).addTo(mapPSN);
    }

    const featsPistas = (pistasFeatures || []).filter(f => {
      const props = f.properties || {};
      const code = props.IATA || props.iata || props.iata_code;
      return String(code || "").toUpperCase() === iataUpper;
    });

    if (featsPistas.length) {
      pistasLayerPSN = L.geoJSON(featsPistas, {
        style: { color: "#222", weight: 1, fillColor: "#ffff00", fillOpacity: 0.15 },
        onEachFeature: (feature, layer) => {
          const label = feature.properties?.etiqueta || feature.properties?.ETIQUETA || "";
          if (label) {
            layer.bindTooltip(String(label), {
              permanent: true,
              direction: "center",
              className: "psn-tooltip"
            });
          }
        }
      }).addTo(mapPSN);
    }

    let bounds = null;
    if (psnLayer) {
      const b = psnLayer.getBounds();
      if (b.isValid()) bounds = b;
    }
    if (pistasLayerPSN) {
      const b = pistasLayerPSN.getBounds();
      if (b.isValid()) bounds ? bounds.extend(b) : (bounds = b);
    }

    if (bounds && bounds.isValid()) {
      setTimeout(() => {
        mapPSN.invalidateSize();
        mapPSN.fitBounds(bounds, { padding: [5, 5] });
      }, 0);
      return;
    }

    const center = getAirportCenterLatLng(a);
    if (center) {
      setTimeout(() => {
        mapPSN.invalidateSize();
        mapPSN.setView(center, 15);
      }, 0);
    } else {
      setTimeout(() => {
        mapPSN.invalidateSize();
        mapPSN.setView([-34.6, -58.4], 5);
      }, 0);
    }
  }

  /* ============================================================
     F. MAPA UBICACIÓN (PROVINCIAS + MARCADOR)
     ============================================================ */
  function updateUbicacionMapForAirport(a) {
    if (!mapUbicacion) return;

    if (!provinciasLayer && provinciasFeatures.length) {
      provinciasLayer = L.geoJSON(provinciasFeatures, {
        style: { color: "#b0b0b0", weight: 1, fillColor: "#f5f5f5", fillOpacity: 0.6 }
      }).addTo(mapUbicacion);

      const provBounds = provinciasLayer.getBounds();
      if (provBounds.isValid()) {
        setTimeout(() => {
          mapUbicacion.invalidateSize();
          mapUbicacion.fitBounds(provBounds, { padding: [10, 10] });
        }, 0);
      }
    }

    if (ubicacionMarker) {
      mapUbicacion.removeLayer(ubicacionMarker);
      ubicacionMarker = null;
    }

    const center = getAirportCenterLatLng(a);
    if (center) {
      ubicacionMarker = L.marker(center, { icon: airportIcon }).addTo(mapUbicacion);
      const iataLabel = a["IATA"] ? String(a["IATA"]).toUpperCase() : "";
      if (iataLabel) {
        ubicacionMarker.bindTooltip(iataLabel, {
          permanent: true,
          direction: "top",
          offset: [0, -4],
          className: "psn-tooltip"
        });
      }
      // zoom moderado al aeropuerto sin “romper” provincias
      setTimeout(() => {
        mapUbicacion.invalidateSize();
        mapUbicacion.setView(center, 8);
      }, 0);
    } else {
      setTimeout(() => mapUbicacion.invalidateSize(), 0);
    }
  }

  /* ============================================================
     F2. MAPA TRANSPORTE (TERMINALES + PARADAS)
     ============================================================ */
  function updateTransporteMapForAirport(a) {
    if (!mapTransporte) return;

    if (transporteLayer) {
      mapTransporte.removeLayer(transporteLayer);
      transporteLayer = null;
    }

    const iataUpper = String(a.IATA || "").trim().toUpperCase();
    if (!iataUpper) return;

    const featsParadas = (paradasFeatures || []).filter(f => {
      const code = String(f.properties?.IATA || f.properties?.iata || "").trim().toUpperCase();
      return code === iataUpper;
    });

    const paradasLayer =
      featsParadas.length
        ? L.geoJSON(featsParadas, {
            pane: "pane_paradas",
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
              radius: 5, color: "#004b80", weight: 1, fillColor: "#2a5fa0", fillOpacity: 0.9
            }),
            onEachFeature: (feature, layer) => {
              const nombre = feature.properties?.name || feature.properties?.nombre || "";
              if (nombre) {
                layer.bindTooltip(String(nombre), {
                  permanent: true,
                  direction: "top",
                  offset: [0, -4],
                  className: "psn-tooltip"
                });
              }
            }
          })
        : null;

    const featsTerminales = (terminalesFeatures || []).filter(f => {
      const code = String(f.properties?.iata || f.properties?.IATA || "").trim().toUpperCase();
      return code === iataUpper;
    });

    const terminalesLayer =
      featsTerminales.length
        ? L.geoJSON(featsTerminales, {
            pane: "pane_terminales",
            style: { color: "#b22222", weight: 1, fillColor: "#ffdede", fillOpacity: 0.25 },
            onEachFeature: (feature, layer) => {
              const name = feature.properties?.etiqueta || feature.properties?.tipo || "Terminal";
              layer.bindTooltip(String(name), { permanent: false, direction: "center", className: "terminal-label" });
            }
          })
        : null;

    transporteLayer = L.layerGroup();
    if (terminalesLayer) transporteLayer.addLayer(terminalesLayer);
    if (paradasLayer) transporteLayer.addLayer(paradasLayer);
    transporteLayer.addTo(mapTransporte);

    let bounds = null;
    if (terminalesLayer) {
      const b = terminalesLayer.getBounds();
      if (b.isValid()) bounds = b;
    }
    if (paradasLayer) {
      const b = paradasLayer.getBounds();
      if (b.isValid()) bounds ? bounds.extend(b) : (bounds = b);
    }

    if (bounds && bounds.isValid()) {
      setTimeout(() => {
        mapTransporte.invalidateSize();
        mapTransporte.fitBounds(bounds, { padding: [10, 10] });
      }, 0);
    } else {
      const center = getAirportCenterLatLng(a) || [-34.6, -58.4];
      setTimeout(() => {
        mapTransporte.invalidateSize();
        mapTransporte.setView(center, 12);
      }, 0);
    }
  }

  /* ============================================================
     F3. MAPA INFLUENCIA (TIEMPOS + POLÍGONO + PUNTO + LEYENDA)
     ============================================================ */
  async function updateInfluenciaMapForAirport(a) {
    if (!mapInfluencia) return;

    if (tiemposLayer) { mapInfluencia.removeLayer(tiemposLayer); tiemposLayer = null; }
    if (influenciaLayer) { mapInfluencia.removeLayer(influenciaLayer); influenciaLayer = null; }
    if (influenciaMarker) { mapInfluencia.removeLayer(influenciaMarker); influenciaMarker = null; }
    if (influenciaLegend) { mapInfluencia.removeControl(influenciaLegend); influenciaLegend = null; }

    const iataUpper = String(a.IATA || "").trim().toUpperCase();
    if (!iataUpper) return;

    const center = getAirportCenterLatLng(a) || [-38, -64];

    // 1) Tiempos de viaje (anillos)
    const tiemposPath = SOURCES.tiemposTemplate(iataUpper);
    try {
      const resp = await fetch(tiemposPath);
      if (resp.ok) {
        const gj = await resp.json();
        if (gj?.features?.length) {
          tiemposLayer = L.geoJSON(gj, {
            style: (feature) => {
              const props = feature.properties || {};
              let to = props.ToBreak ?? props.tobreak ?? props.TOBREAK ?? props.to_break ?? props.TO_BREAK;
              to = (to === undefined || to === null || to === "") ? null : Number(to);

              let color;
              if (to === 60) color = "#08306b";
              else if (to === 120) color = "#2171b5";
              else if (to === 180) color = "#6baed6";
              else color = "#9ecae1";

              return { color, weight: 1, fillColor: color, fillOpacity: 0.35 };
            }
          }).addTo(mapInfluencia);
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar tiempos de viaje para", iataUpper, e);
    }

    // 2) Área de influencia (polígono amarillo sin relleno) — solo si existe para ese IATA
    if (areasInfluenciaFeatures?.length) {
      const featsInfl = areasInfluenciaFeatures.filter(f => {
        const code = String(f.properties?.IATA || f.properties?.iata || "").trim().toUpperCase();
        return code === iataUpper;
      });

      if (featsInfl.length) {
        influenciaLayer = L.geoJSON(featsInfl, {
          style: { color: "#FFD700", weight: 2, dashArray: "6 4", fillOpacity: 0.0 }
        }).addTo(mapInfluencia);
      }
    }

    // 3) Punto del aeropuerto
    influenciaMarker = L.marker(center, { icon: airportIcon }).addTo(mapInfluencia);
    influenciaMarker.bindTooltip(iataUpper, {
      permanent: true, direction: "top", offset: [0, -4], className: "psn-tooltip"
    });

    // 4) Ajustar vista
    let bounds = null;
    if (tiemposLayer) {
      const b = tiemposLayer.getBounds();
      if (b.isValid()) bounds = b;
    }
    if (influenciaLayer) {
      const b = influenciaLayer.getBounds();
      if (b.isValid()) bounds ? bounds.extend(b) : (bounds = b);
    }
    if (influenciaMarker) {
      const ll = influenciaMarker.getLatLng();
      const b = L.latLngBounds(ll, ll);
      bounds ? bounds.extend(b) : (bounds = b);
    }

    if (bounds && bounds.isValid()) {
      setTimeout(() => {
        mapInfluencia.invalidateSize();
        mapInfluencia.fitBounds(bounds, { padding: [10, 10] });
      }, 0);
    } else {
      setTimeout(() => {
        mapInfluencia.invalidateSize();
        mapInfluencia.setView(center, 7);
      }, 0);
    }

    // 5) Leyenda (si hay tiempos)
    influenciaLegend = L.control({ position: "bottomright" });
    influenciaLegend.onAdd = function () {
      const div = L.DomUtil.create("div", "info legend");
      div.style.background = "rgba(255, 255, 255, 0.95)";
      div.style.border = "1px solid #d0d7e2";
      div.style.borderRadius = "4px";
      div.style.padding = "4px 6px";
      div.style.fontSize = "0.72rem";
      div.style.lineHeight = "1.3";
      div.style.color = "#111";

      div.innerHTML = `
        <div style="font-weight:600; margin-bottom:2px;">Tiempos de viaje</div>
        <div><span style="display:inline-block;width:10px;height:10px;background:#08306b;margin-right:4px;border:1px solid #08306b;"></span>Hasta 1 h</div>
        <div><span style="display:inline-block;width:10px;height:10px;background:#2171b5;margin-right:4px;border:1px solid #2171b5;"></span>Hasta 2 h</div>
        <div><span style="display:inline-block;width:10px;height:10px;background:#6baed6;margin-right:4px;border:1px solid #6baed6;"></span>Hasta 3 h</div>
      `;
      return div;
    };
    influenciaLegend.addTo(mapInfluencia);
  }

  /* ============================================================
     G. PARSEO CSV (INVERSIONES + TRANSPORTE + CONTACTOS)
     ============================================================ */
  function parseInversionesCSV(text) {
    const result = {};
    if (!text) return result;

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return result;

    const headerLine = lines[0];
    const sep = headerLine.indexOf(";") !== -1 ? ";" : ",";

    const headers = headerLine.split(sep).map(h => h.trim());
    const idxIATA = headers.findIndex(h => ["IATA", "COD_IATA", "CODIGO_IATA"].includes(h.toUpperCase()));
    const idx2025 = headers.findIndex(h => h.toUpperCase() === "A2025");
    const idx2026 = headers.findIndex(h => h.toUpperCase() === "A2026");
    const idx2027 = headers.findIndex(h => h.toUpperCase() === "A2027");
    const idxObra = headers.findIndex(h => h.toUpperCase() === "OBRAWEB");

    if (idxIATA === -1) return result;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(sep);
      const rawIata = (cols[idxIATA] || "").trim();
      if (!rawIata) continue;

      const iata = rawIata.toUpperCase();
      if (!result[iata]) {
        result[iata] = { A2025: 0, A2026: 0, A2027: 0, obras2025: [], obras2026: [], obras2027: [] };
      }

      const obraStr = idxObra !== -1 ? (cols[idxObra] || "").trim() : "";

      if (idx2025 !== -1) {
        const m = parseMonto(cols[idx2025]);
        if (m) { result[iata].A2025 += m; if (obraStr) result[iata].obras2025.push(obraStr); }
      }
      if (idx2026 !== -1) {
        const m = parseMonto(cols[idx2026]);
        if (m) { result[iata].A2026 += m; if (obraStr) result[iata].obras2026.push(obraStr); }
      }
      if (idx2027 !== -1) {
        const m = parseMonto(cols[idx2027]);
        if (m) { result[iata].A2027 += m; if (obraStr) result[iata].obras2027.push(obraStr); }
      }
    }

    Object.keys(result).forEach(iata => {
      ["obras2025", "obras2026", "obras2027"].forEach(k => {
        result[iata][k] = [...new Set(result[iata][k])];
      });
    });

    return result;
  }

  function parseTransporteCSV(text) {
    const result = {};
    if (!text) return result;

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return result;

    const headerLine = lines[0];
    const sep =
      headerLine.indexOf("\t") !== -1 ? "\t" :
      (headerLine.indexOf(";") !== -1 ? ";" : ",");

    const headers = headerLine.split(sep).map(h => h.trim().toUpperCase());
    const idxIATA = headers.indexOf("IATA");

    // En distintos archivos, puede llamarse LINEA/LINEAS/COLECTIVOS
    const idxLINEA = headers.indexOf("LINEA") !== -1 ? headers.indexOf("LINEA")
      : (headers.indexOf("LINEAS") !== -1 ? headers.indexOf("LINEAS")
      : headers.indexOf("COLECTIVOS"));

    let idxPARADA = headers.indexOf("PARADA");
    if (idxPARADA === -1) idxPARADA = headers.indexOf("PARADAAEP");

    if (idxIATA === -1) return result;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(sep);
      const rawIata = (cols[idxIATA] || "").trim();
      if (!rawIata) continue;

      const iata = rawIata.toUpperCase();
      const linea = idxLINEA !== -1 ? (cols[idxLINEA] || "").trim() : "";
      const parada = idxPARADA !== -1 ? (cols[idxPARADA] || "").trim() : "";

      // permitimos múltiples líneas por IATA
      if (!result[iata]) result[iata] = { lineas: [], paradas: [] };
      if (linea) result[iata].lineas.push(linea);
      if (parada) result[iata].paradas.push(parada);
    }

    // dedup
    Object.keys(result).forEach(iata => {
      result[iata].lineas = [...new Set(result[iata].lineas.flatMap(splitField))];
      result[iata].paradas = [...new Set(result[iata].paradas.flatMap(splitField))];
    });

    return result;
  }

  function parseContactosCSV(text) {
    const result = {};
    if (!text) return result;

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return result;

    const headerLine = lines[0];
    const sep =
      headerLine.indexOf("\t") !== -1 ? "\t" :
      (headerLine.indexOf(";") !== -1 ? ";" : ",");

    const headers = headerLine.split(sep).map(h => h.trim());
    const idxIATA = headers.findIndex(h => h.trim().toUpperCase() === "IATA");
    if (idxIATA === -1) return result;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(sep);
      const iata = String(cols[idxIATA] || "").trim().toUpperCase();
      if (!iata) continue;

      if (!result[iata]) result[iata] = {};
      headers.forEach((h, j) => {
        result[iata][h] = (cols[j] ?? "").trim();
      });
    }
    return result;
  }

  /* ============================================================
     G2. PASAJEROS (CSV mensual)
     ============================================================ */
  async function loadPaxCSV() {
    const text = await fetchFirstOkText(SOURCES.pasajeros);
    if (!text) {
      console.warn("No se encontró CSV de pasajeros en rutas conocidas.");
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return;

    const headerLine = lines[0];
    const sep =
      headerLine.indexOf("\t") !== -1 ? "\t" :
      (headerLine.indexOf(";") !== -1 ? ";" : ",");

    const headers = headerLine.split(sep).map(h => h.trim().toLowerCase());

    const idxIata = headers.indexOf("iata");
    const idxRegion = headers.indexOf("region");
    const idxFecha = headers.indexOf("fecha");
    const idxValorPax = headers.indexOf("valor_pax");

    if (idxIata === -1 || idxRegion === -1 || idxFecha === -1 || idxValorPax === -1) {
      console.warn("CSV pasajeros: faltan columnas esperadas (iata/region/fecha/valor_pax).");
      return;
    }

    paxRows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(sep);
      const iata = String(cols[idxIata] || "").trim().toUpperCase();
      const region = String(cols[idxRegion] || "").trim().toLowerCase();
      const fecha = parseDMYDate(cols[idxFecha]);
      const valor_pax = parseEsNumber(cols[idxValorPax]);

      if (!iata || !fecha || valor_pax === null) continue;
      if (region !== "cabotaje" && region !== "internacional") continue;

      paxRows.push({ iata, region, fecha, valor_pax });
    }

    paxIndex = {};
    paxRows.forEach(r => {
      if (!paxIndex[r.iata]) paxIndex[r.iata] = { cabotaje: [], internacional: [] };
      paxIndex[r.iata][r.region].push({ t: r.fecha, y: r.valor_pax });
    });

    Object.keys(paxIndex).forEach(iata => {
      paxIndex[iata].cabotaje.sort((a, b) => a.t - b.t);
      paxIndex[iata].internacional.sort((a, b) => a.t - b.t);
    });

    initPaxUI();
  }

  function initPaxUI() {
    const paxRegionSelect = document.getElementById("paxRegionSelect");
    if (!paxRegionSelect) return;

    paxRegionSelect.addEventListener("change", () => {
      const iata = (selectEl && selectEl.value) ? String(selectEl.value).toUpperCase() : "";
      updatePaxPanel(iata, paxRegionSelect.value);
    });
  }

  function sameMonthYearShift(dCandidate, dRef, monthsBack) {
    if (!(dCandidate instanceof Date) || !(dRef instanceof Date)) return false;
    const ref = new Date(dRef.getFullYear(), dRef.getMonth() - monthsBack, 1);
    return dCandidate.getFullYear() === ref.getFullYear() && dCandidate.getMonth() === ref.getMonth();
  }

  function mergeSeriesForKpis(cab, intl, regionMode) {
    const map = new Map();

    const pushArr = (arr) => {
      arr.forEach(p => {
        const k = `${p.t.getFullYear()}-${String(p.t.getMonth() + 1).padStart(2, "0")}`;
        map.set(k, (map.get(k) || 0) + (p.y || 0));
      });
    };

    if (regionMode === "cabotaje") pushArr(cab);
    else if (regionMode === "internacional") pushArr(intl);
    else { pushArr(cab); pushArr(intl); }

    const merged = Array.from(map.entries()).map(([k, y]) => {
      const [yy, mm] = k.split("-").map(Number);
      return { t: new Date(yy, mm - 1, 1), y };
    });

    merged.sort((a, b) => a.t - b.t);
    return merged;
  }

  function buildPaxSeries(iata, regionMode) {
    const entry = paxIndex[iata];
    if (!entry) return { datasets: [], last: null, yoy: null };

    const cab = entry.cabotaje || [];
    const intl = entry.internacional || [];

    const datasets = [];
    if (regionMode === "cabotaje" || regionMode === "ambos") {
      datasets.push({ label: "Cabotaje", data: cab, tension: 0.2, pointRadius: 0 });
    }
    if (regionMode === "internacional" || regionMode === "ambos") {
      datasets.push({ label: "Internacional", data: intl, tension: 0.2, pointRadius: 0 });
    }

    const merged = mergeSeriesForKpis(cab, intl, regionMode);
    const last = merged.length ? merged[merged.length - 1] : null;

    let yoy = null;
    if (merged.length >= 13 && last) {
      const prevYear = merged.find(p => sameMonthYearShift(p.t, last.t, 12));
      if (prevYear && prevYear.y && last.y) yoy = (last.y / prevYear.y) - 1;
    }

    return { datasets, last, yoy };
  }

  function drawPaxChart(datasets) {
    const canvas = document.getElementById("paxChart");
    if (!canvas) return;

    if (paxChart) { paxChart.destroy(); paxChart = null; }
    if (!datasets || !datasets.length) return;

    paxChart = new Chart(canvas, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const y = ctx.raw?.y ?? ctx.parsed?.y;
                return `${ctx.dataset.label}: ${formatNumber(y)}`;
              }
            }
          }
        },
        scales: {
          x: { type: "time", time: { unit: "month" }, ticks: { maxRotation: 0, autoSkip: true } },
          y: { ticks: { callback: (value) => formatNumber(value) } }
        }
      }
    });
  }

  function updatePaxPanel(iata, regionMode) {
    const kpiLastEl = document.getElementById("paxKpiLast");
    const kpiYoYEl = document.getElementById("paxKpiYoY");

    if (!iata || !paxIndex[iata]) {
      if (kpiLastEl) kpiLastEl.textContent = "–";
      if (kpiYoYEl) kpiYoYEl.textContent = "–";
      if (paxChart) { paxChart.destroy(); paxChart = null; }
      return;
    }

    const { datasets, last, yoy } = buildPaxSeries(iata, regionMode);

    if (kpiLastEl) {
      kpiLastEl.textContent = last ? `${formatNumber(last.y)} (${formatShortMonthYYYY(last.t)})` : "–";
    }
    if (kpiYoYEl) {
      if (typeof yoy === "number" && isFinite(yoy)) {
        kpiYoYEl.textContent = `${(yoy * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
      } else {
        kpiYoYEl.textContent = "–";
      }
    }

    drawPaxChart(datasets);
  }

  /* ============================================================
     H. RENDER PRINCIPAL
     ============================================================ */
  function renderAirport(iataCode) {
    const a = aeropuertos.find(x => String(x.IATA) === String(iataCode));
    if (!a) return;

    const iata = String(a.IATA || "").toUpperCase();
    const nombre = clean(getProp(a, ["Aeropuerto", "Nombre del Aeropuerto", "nombre", "NOMBRE"])) || iata;
    const tituloAeroSeccion = `${nombre} (${iata})`;

    // Título principal
    const pageTitleEl = document.getElementById("pageTitle");
    if (pageTitleEl) {
      pageTitleEl.textContent = (iata === "AEP")
        ? "Aeroparque Jorge Newbery (AEP)"
        : tituloAeroSeccion;
    }

    // Encabezados paneles (incluye PASAJEROS)
    const hdrSuperficie = document.getElementById("hdrSuperficie");
    const hdrMovimiento = document.getElementById("hdrMovimiento");
    const hdrTerminal = document.getElementById("hdrTerminal");
    const hdrUbicacion = document.getElementById("hdrUbicacion");
    const hdrEmpleoEl = document.getElementById("hdrEmpleo");
    const hdrPasajeros = document.getElementById("hdrPasajeros");

    if (hdrSuperficie) hdrSuperficie.innerHTML = `Explotación <small>${tituloAeroSeccion}</small>`;
    if (hdrMovimiento) hdrMovimiento.innerHTML = `Área de movimiento <small>${tituloAeroSeccion}</small>`;
    if (hdrTerminal) hdrTerminal.innerHTML = `Terminal de pasajeros <small>${tituloAeroSeccion}</small>`;
    if (hdrUbicacion) hdrUbicacion.innerHTML = `Ubicación y accesibilidad <small>${tituloAeroSeccion}</small>`;
    if (hdrPasajeros) hdrPasajeros.innerHTML = `Pasajeros <small>${tituloAeroSeccion}</small>`;

    // hdrEmpleo conserva el botón "i"
    if (hdrEmpleoEl) {
      const infoBtn = hdrEmpleoEl.querySelector("#btnInfoImpacto");
      hdrEmpleoEl.innerHTML = `Impacto territorial del aeropuerto <small>${tituloAeroSeccion}</small>`;
      if (infoBtn) hdrEmpleoEl.appendChild(infoBtn);
    }

    /* ---------- CONTACTOS ---------- */
    const contacto = contactosPorIATA[iata] || {};

    // Intentamos varias convenciones de columnas
    const adminNombre = clean(getProp(contacto, ["Administrador", "ADMINISTRADOR", "AdminNombre", "NombreAdmin"])) || "Sin dato";
    const adminTel = clean(getProp(contacto, ["AdmTelef", "ADMTELEF", "AdminTel", "TelefonoAdmin", "TelAdmin"]));
    const adminMail = clean(getProp(contacto, ["AdmCorreo", "ADMCORREO", "AdminMail", "CorreoAdmin", "EmailAdmin"]));

    const jefeNombre = clean(getProp(contacto, ["JefeAeropuerto", "Jefe de Aeropuerto", "JEFEAEROPUERTO", "JefeNombre", "NombreJefe"])) || "Sin dato";
    const jefeTel = clean(getProp(contacto, ["JefeTelef", "JEFETELEF", "JefeTel", "TelefonoJefe", "TelJefe"]));
    const jefeMail = clean(getProp(contacto, ["JefeCorreo", "JEFECORREO", "JefeMail", "CorreoJefe", "EmailJefe"]));

    const adminContactoStr =
      [adminTel ? `☎ ${adminTel}` : "", adminMail ? `✉ ${adminMail}` : ""].filter(Boolean).join(" · ") || "–";
    const jefeContactoStr =
      [jefeTel ? `☎ ${jefeTel}` : "", jefeMail ? `✉ ${jefeMail}` : ""].filter(Boolean).join(" · ") || "–";

    setText("kpiAdminNombre", adminNombre);
    setText("kpiAdminContacto", adminContactoStr);
    setText("kpiJefeNombre", jefeNombre);
    setText("kpiJefeContacto", jefeContactoStr);

    setText("contactoAdminNombre", adminNombre || "–");
    setText("contactoAdminTel", adminTel || "–");
    setText("contactoAdminCorreo", adminMail || "–");
    setText("contactoJefeNombre", jefeNombre || "–");
    setText("contactoJefeTel", jefeTel || "–");
    setText("contactoJefeCorreo", jefeMail || "–");

    /* ---------- KPI SUPERIOR ---------- */
    setText("kpiCheckin", safeVal(a["Mostradores Check in"] ?? a["MostradoresCheckin"] ?? a["Checkin"]));
    setText("kpiPuertas", safeVal(a["PuertasEmbarqueTotal"] ?? a["PuertasTotal"]));
    setText("kpiCintas", safeVal(a["CintasTotal"] ?? a["Cintas"]));
    setText("kpiPSN", safeVal(a["PSNTotal"] ?? a["PSN"]));
    setText("kpiEstac", safeVal(a["Estacionamiento Vehicular"] ?? a["Estacionamiento"]));
    setText("kpiMangas", safeVal(a["Mangas telescópicas"] ?? a["Mangas"]));
    setText("kpiPSA", safeVal(a["PSAScanTotal"] ?? a["PSA"]));

    /* ---------- EXPLOTACIÓN ---------- */
    setText("supPredio", safeVal(a["SupPredioHa"] ?? a["SupPredio"]));
    setText("supConcesionadaHa", safeVal(a["SupConcesionadaHa"] ?? a["SupConcesionada"]));
    setText("areasConcesionadas", clean(a["AreasConcesionadas"]) || "–");
    setText("explotador", clean(a["Explotador"]) || "–");
    setText("grupo", clean(a["Grupo"]) || "–");
    setText("concesionHasta", clean(a["ConcesionHasta"]) || "–");
    setText("habilitacion", clean(a["Habilitación"] ?? a["Habilitacion"]) || "–");

    const codigosEl = document.getElementById("codigos");
    if (codigosEl) {
      const cods = [];
      const oaci = clean(a["OACI"]);
      const anac = clean(a["ANAC"]);
      const iata2 = clean(a["IATA"]);
      if (oaci) cods.push(`OACI: ${oaci}`);
      if (anac) cods.push(`ANAC: ${anac}`);
      if (iata2) cods.push(`IATA: ${iata2}`);
      codigosEl.textContent = cods.length ? cods.join(" · ") : "–";
    }

    /* ---------- INVERSIONES ---------- */
    const inv = inversionesPorIATA[iata] || null;
    if (inv) {
      setText("inv2025", inv.A2025 ? formatMillions(inv.A2025) : "–");
      setText("inv2026", inv.A2026 ? formatMillions(inv.A2026) : "–");
      setText("inv2027", inv.A2027 ? formatMillions(inv.A2027) : "–");

      const setObras = (id, arr) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = (arr && arr.length) ? arr.map((o, idx) => `${idx + 1}) ${o}`).join("<br>") : "–";
      };
      setObras("invObras2025", inv.obras2025);
      setObras("invObras2026", inv.obras2026);
      setObras("invObras2027", inv.obras2027);
    } else {
      setText("inv2025", "–"); setText("inv2026", "–"); setText("inv2027", "–");
      setText("invObras2025", "–"); setText("invObras2026", "–"); setText("invObras2027", "–");
    }

    /* ---------- TERMINAL (m² + imagen) ---------- */
    setText("terminalM2", safeVal(a["TerminalM2"] ?? a["Terminal m2"] ?? a["Terminal_M2"]));

    const imgTerminal = document.getElementById("imgTerminal");
    const terminalProp = clean(a["imagenAeropuerto"] ?? a["imagen_terminal"] ?? a["imgTerminal"]);
    const terminalSrc = terminalProp || (iata ? `img/Terminales/${iata}_terminal.png` : "");

    if (imgTerminal) {
      imgTerminal.style.display = terminalSrc ? "block" : "none";
      imgTerminal.src = terminalSrc;
      imgTerminal.alt = `Terminal del aeropuerto ${nombre}`;
      imgTerminal.onerror = () => { imgTerminal.style.display = "none"; };
    }

    /* ---------- ÁREA DE MOVIMIENTO (TEXTOS) ---------- */
    // Cantidad de pistas: desde GeoJSON si existe; fallback a campo de tabla
    const pistasAer = (pistasFeatures || []).filter(f => {
      const code = String(f.properties?.IATA || f.properties?.iata || "").trim().toUpperCase();
      return code === iata;
    });

    setText("badgeCantPistas", pistasAer.length ? String(pistasAer.length) : safeVal(a["CantidadPistas"] ?? a["CantPistas"]));

    // Detalle de pistas
    const pistasDetalleEl = document.getElementById("pistasDetalle");
    if (pistasDetalleEl) {
      if (pistasAer.length) {
        pistasDetalleEl.innerHTML = pistasAer.map(f => {
          const p = f.properties || {};
          const etq = p.etiqueta || p.ETIQUETA || p.nombre || "";
          const dim = p.dimensiones || p.DIMENSIONES || "";
          const sup = p.superficie || p.SUPERFICIE || "";
          const parts = [clean(etq), clean(dim), clean(sup)].filter(Boolean);
          return `<div class="mov-runway-item">${parts.join(" · ")}</div>`;
        }).join("");
      } else {
        // fallback: si tu tabla tiene algo ya preparado en campos
        const fallback = clean(a["PistasDetalle"] ?? a["DetallePistas"]);
        pistasDetalleEl.innerHTML = fallback ? `<div class="mov-runway-item">${fallback}</div>` : `<div class="mov-runway-item">–</div>`;
      }
    }

    // PSN totales y desglose
    setText("badgePsnTotal", safeVal(a["PSNTotal"] ?? a["PSN"]));

    // si tenés campos ya en la tabla:
    setText("psnCom", safeVal(a["PSNCom"] ?? a["PSNComerciales"] ?? a["PSN_Com"]));
    setText("psnGen", safeVal(a["PSNGen"] ?? a["PSNAviacionGeneral"] ?? a["PSN_Gen"]));

    /* ---------- RECORRIDO TERMINAL (TEXTOS) ---------- */
    setText("mostradoresCheckin", safeVal(a["Mostradores Check in"] ?? a["MostradoresCheckin"]));
    setText("kioscosSelf", safeVal(a["Kioscos self check-in"] ?? a["KioscosSelf"] ?? a["Kioscos"]));
    setText("psaBadgeProxy", safeVal(a["PSAScanTotal"] ?? a["PSA"]));
    setText("psaInter", safeVal(a["PSAInter"] ?? a["PSA Internacional"]));
    setText("psaCabot", safeVal(a["PSACabot"] ?? a["PSA Cabotaje"]));
    setText("aduanaPuestos", safeVal(a["AduanaPuestos"] ?? a["Aduana"]));
    setText("migracionesTotal", safeVal(a["MigracionesTotal"] ?? a["Migraciones"]));
    setText("migracionesDetalle", clean(a["MigracionesDetalle"]) || "–");
    setText("puertasTotal", safeVal(a["PuertasEmbarqueTotal"] ?? a["PuertasTotal"]));
    setText("puertasDetalle", clean(a["PuertasDetalle"]) || "–");
    setText("mangas", safeVal(a["Mangas telescópicas"] ?? a["Mangas"]));
    setText("cintasTotal", safeVal(a["CintasTotal"] ?? a["Cintas"]));
    setText("cintasDetalle", clean(a["CintasDetalle"]) || "–");
    setText("carritos", safeVal(a["Carritos"] ?? a["Carritos porta equipajes"]));
    setText("estacionamiento", safeVal(a["Estacionamiento Vehicular"] ?? a["Estacionamiento"]));

    /* ---------- UBICACIÓN (TEXTOS) ---------- */
    setText("ubicacionText", clean(a["Ubicación"] ?? a["Ubicacion"] ?? a["Localidad"] ?? a["Ciudad"] ?? a["Provincia"]) || "–");
    setText("distanciaCentro", clean(a["Distancia al centro de la ciudad"] ?? a["DistanciaCentro"] ?? a["DistCentro"]) || "–");
    setText("horarioOperacion", clean(a["Horario de operación"] ?? a["HorarioOperacion"] ?? a["Horario"]) || "–");

    /* ---------- TRANSPORTE PÚBLICO (TEXTOS) ---------- */
    const t = transportePorIATA[iata];
    const lineasEl = document.getElementById("transporteLineas");
    if (lineasEl) {
      if (t?.lineas?.length) {
        lineasEl.textContent = t.lineas.join(" · ");
      } else {
        const fallback = clean(a["LineasColectivo"] ?? a["TransportePublico"] ?? a["Colectivos"]);
        lineasEl.textContent = fallback || "–";
      }
    }

    /* ---------- EMPLEO + POBLACIÓN ---------- */
    const empDirRaw = a["EmpleoDirecto2024"] ?? a["EmpleoDirecto"] ?? a["Empleo_Directo"];
    const empDirNum = Number(
      typeof empDirRaw === "string"
        ? empDirRaw.replace(/\./g, "").replace(/,/g, ".")
        : empDirRaw
    );

    const empIndNum = !isNaN(empDirNum) ? Math.round(empDirNum * EMP_IND_MULT) : null;

    setText("empleoDirecto", (!isNaN(empDirNum) && empDirNum !== null) ? formatNumber(empDirNum) : "–");
    setText("empleoIndirecto", (empIndNum !== null && !isNaN(empIndNum)) ? formatNumber(empIndNum) : "–");

    const pobRaw = a["Población del Área de Influencia (Censo 2022)"] ?? a["PoblacionAreaInfluencia"] ?? a["Poblacion"];
    setText("poblacionInfluencia", safeVal(pobRaw));

    /* ---------- PASAJEROS ---------- */
    const paxRegionSelect = document.getElementById("paxRegionSelect");
    const regionMode = paxRegionSelect ? paxRegionSelect.value : "ambos";
    updatePaxPanel(iata, regionMode);

    /* ---------- MAPAS ---------- */
    updateMapForAirport(a);
    updatePSNMapForAirport(a);
    updateUbicacionMapForAirport(a);
    updateTransporteMapForAirport(a);
    updateInfluenciaMapForAirport(a);
  }

  /* ============================================================
     I. CARGA DE DATOS (COMPLETA)
     ============================================================ */
  async function loadData() {
    try {
      // 1) Datos principales
      const resp = await fetch(SOURCES.aeropuertos);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} al leer ${SOURCES.aeropuertos}`);
      const geojson = await resp.json();

      aeropuertos = (geojson.features || [])
        .map(f => f.properties || {})
        .filter(p => p.IATA);

      aeropuertos.sort((a, b) => String(a.IATA).localeCompare(String(b.IATA)));

      if (!selectEl) selectEl = document.getElementById("airportSelect");
      if (selectEl) {
        selectEl.innerHTML = "";
        aeropuertos.forEach(p => {
          const opt = document.createElement("option");
          const nombre = clean(getProp(p, ["Aeropuerto", "Nombre del Aeropuerto", "nombre"])) || p.IATA;
          opt.value = p.IATA;
          opt.textContent = `${nombre} (${p.IATA})`;
          selectEl.appendChild(opt);
        });
      }

      // 2) Predios
      const pred = await fetchFirstOkJson(SOURCES.predios);
      poligonos = pred?.features || [];

      // 3) PSN
      const psn = await fetchFirstOkJson(SOURCES.psn);
      psnFeatures = psn?.features || [];

      // 4) Pistas
      const pistas = await fetchFirstOkJson(SOURCES.pistas);
      pistasFeatures = pistas?.features || [];

      // 5) Provincias
      const prov = await fetchFirstOkJson(SOURCES.provincias);
      provinciasFeatures = prov?.features || [];

      // 6) Terminales / Paradas
      const term = await fetchFirstOkJson(SOURCES.terminales);
      terminalesFeatures = term?.features || [];

      const par = await fetchFirstOkJson(SOURCES.paradas);
      paradasFeatures = par?.features || [];

      // 7) Áreas de influencia
      const infl = await fetchFirstOkJson(SOURCES.areasInfluencia);
      areasInfluenciaFeatures = infl?.features || [];

      // 8) CSV Inversiones
      const invText = await fetchFirstOkText(SOURCES.inversiones);
      inversionesPorIATA = invText ? parseInversionesCSV(invText) : {};

      // 9) CSV Transporte público
      const transpText = await fetchFirstOkText(SOURCES.transporteCSV);
      transportePorIATA = transpText ? parseTransporteCSV(transpText) : {};

      // 10) CSV Contactos
      const contText = await fetchFirstOkText(SOURCES.contactos);
      contactosPorIATA = contText ? parseContactosCSV(contText) : {};

      // 11) CSV Pasajeros (antes del primer render)
      await loadPaxCSV();

      // Inicial (URL ?airport=)
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("airport");

      let initial = aeropuertos[0]?.IATA;
      if (fromUrl && aeropuertos.find(x => String(x.IATA) === String(fromUrl))) initial = fromUrl;

      if (initial && selectEl) {
        selectEl.value = initial;
        renderAirport(initial);
      }

      // Cambio selector principal
      if (selectEl) {
        selectEl.addEventListener("change", (e) => {
          const value = e.target.value;
          if (!value) return;

          renderAirport(value);

          const url = new URL(window.location.href);
          url.searchParams.set("airport", value);
          window.history.replaceState({}, "", url);
        });
      }
    } catch (err) {
      console.error("Error cargando datos principales:", err);
      if (!selectEl) selectEl = document.getElementById("airportSelect");
      if (selectEl) selectEl.innerHTML = "<option>Error al cargar datos</option>";
    }
  }

  /* ============================================================
     J. MODAL: ACLARACIÓN METODOLÓGICA
     ============================================================ */
  function initModalImpacto() {
    const btnInfo = document.getElementById("btnInfoImpacto");
    const modalImpacto = document.getElementById("modalImpacto");
    if (!btnInfo || !modalImpacto) return;

    const open = () => {
      modalImpacto.classList.add("is-open");
      modalImpacto.setAttribute("aria-hidden", "false");
      const card = modalImpacto.querySelector(".modal-card");
      if (card) card.focus();
    };

    const close = () => {
      modalImpacto.classList.remove("is-open");
      modalImpacto.setAttribute("aria-hidden", "true");
      btnInfo.focus();
    };

    btnInfo.addEventListener("click", open);

    modalImpacto.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", close);
    });

    modalImpacto.addEventListener("click", (e) => {
      if (e.target === modalImpacto) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalImpacto.classList.contains("is-open")) close();
    });
  }

  /* ============================================================
     K. INICIO
     ============================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    selectEl = document.getElementById("airportSelect");

    initMap();
    initModalImpacto();
    loadData();

    // Botones "Abrir el mapa" (transporte / influencia)
    document.querySelectorAll(".map-expand-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const iata = selectEl ? selectEl.value : "";
        if (!iata) return;

        const mapType = btn.dataset.map;
        const url = `mapa_${mapType}.html?airport=${encodeURIComponent(iata)}`;
        window.open(url, "_blank");
      });
    });

    // Flechas carrusel KPI
    const kpiStrip = document.querySelector(".kpi-strip");
    const arrowLeft = document.querySelector(".kpi-arrow-left");
    const arrowRight = document.querySelector(".kpi-arrow-right");

    if (kpiStrip && arrowLeft && arrowRight) {
      const scrollAmount = 220;
      arrowLeft.addEventListener("click", () => kpiStrip.scrollBy({ left: -scrollAmount, behavior: "smooth" }));
      arrowRight.addEventListener("click", () => kpiStrip.scrollBy({ left: scrollAmount, behavior: "smooth" }));
    }
  });

})();
