// js/datos-clave.js
// Lógica de "datos-clave.html" separada a archivo externo
/* global L */

(() => {
  "use strict";

  /* ============================================================
     A. VARIABLES GLOBALES (DATA + UI + MAPAS)
     ============================================================ */

  // Datos
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
  let pasajerosMensualRows = [];
  let currentIATA = "";

  // UI
  let selectEl = null;
  let paxChart = null;
  let paxMinimapChart = null;
  let paxWeekChart = null;
  let paxSeasonChart = null;

  // Pasajeros filter state (module-level to avoid closure issues)
  let paxAllData = null;          // Full dataset for current airport { date, tot, cab, intl }[]
  let paxPeriodMin = null;        // { year, month } – earliest data point
  let paxPeriodMax = null;        // { year, month } – latest data point
  const PAX_MESES_ABBR = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];


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

  // Icono aeropuerto (igual a tu proyecto)
  const airportIcon = L.icon({
    iconUrl: "img/icons/AeropuertosSNA.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    tooltipAnchor: [0, -18]
  });

  /* ============================================================
     B. HELPERS DE FORMATEO / UTILIDADES
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
    if (!valor || isNaN(Number(valor))) return "–";
    const millones = Number(valor) / 1_000_000;
    return millones.toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
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

    const lat = a["Lat"] || a["LAT"];
    const lon = a["Lon"] || a["LON"] || a["Long"];

    if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      return [Number(lat), Number(lon)];
    }

    return null;
  }

  /* ============================================================
     C. INICIALIZACIÓN DE MAPAS LEAFLET
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
    L.esri.basemapLayer("Imagery").addTo(mapPSN);

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

    // panes para orden de dibujo (terminales detrás, paradas delante)
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
     D. MAPA DEL PREDIO (POLÍGONO O PUNTO)
     ============================================================ */

  function updateMapForAirport(a) {
    if (!map) return;

    // limpiar polígono anterior
    if (poligonoLayer) {
      map.removeLayer(poligonoLayer);
      poligonoLayer = null;
    }

    const iata = a.IATA;

    // 1) Si hay polígono para el IATA, lo dibujamos y hacemos fit bounds
    if (poligonos.length > 0 && iata) {
      const feats = poligonos.filter(f => {
        const props = f.properties || {};
        const code = props.IATA || props.iata || props.iata_code;
        return String(code).toUpperCase() === String(iata).toUpperCase();
      });

      if (feats.length > 0) {
        poligonoLayer = L.geoJSON(feats, {
          style: {
            color: "#0072bb",
            weight: 2,
            fillColor: "#4fa3ff",
            fillOpacity: 0.35
          }
        }).addTo(map);

        const bounds = poligonoLayer.getBounds();
        if (bounds.isValid()) {
          setTimeout(() => {
            map.invalidateSize();
            map.fitBounds(bounds, { padding: [5, 5] });
          }, 0);
        }

        // si se usa polígono, removemos el marker (evita duplicado visual)
        if (mapMarker) map.removeLayer(mapMarker);
        return;
      }
    }

    // 2) fallback al punto (Lat/Lon)
    const lat = a["Lat"] || a["LAT"];
    const lon = a["Lon"] || a["LON"] || a["Long"];

    if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      const latNum = Number(lat);
      const lonNum = Number(lon);

      setTimeout(() => {
        map.invalidateSize();
        map.setView([latNum, lonNum], 11);
      }, 0);

      if (!mapMarker) {
        mapMarker = L.marker([latNum, lonNum]).addTo(map);
      } else {
        mapMarker.setLatLng([latNum, lonNum]).addTo(map);
      }
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

    if (psnLayer) {
      mapPSN.removeLayer(psnLayer);
      psnLayer = null;
    }
    if (pistasLayerPSN) {
      mapPSN.removeLayer(pistasLayerPSN);
      pistasLayerPSN = null;
    }

    const iata = a.IATA;
    if (!iata) return;

    // PSN puntos
    const featsPSN = (psnFeatures || []).filter(f => {
      const props = f.properties || {};
      const code = props.IATA || props.iata || props.iata_code;
      return String(code).toUpperCase() === String(iata).toUpperCase();
    });

    if (featsPSN.length) {
      psnLayer = L.geoJSON(featsPSN, {
        pointToLayer: (feature, latlng) => {
          const marker = L.circleMarker(latlng, {
            radius: 4,
            color: "#000000",
            weight: 1,
            fillColor: "#ff0000",
            fillOpacity: 0.9
          });

          const posLabel = feature.properties?.posicion || "";
          if (posLabel) {
            marker.bindTooltip(posLabel, {
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

    // Pistas
    const featsPistas = (pistasFeatures || []).filter(f => {
      const props = f.properties || {};
      const code = props.IATA || props.iata || props.iata_code;
      return String(code).toUpperCase() === String(iata).toUpperCase();
    });

    if (featsPistas.length) {
      pistasLayerPSN = L.geoJSON(featsPistas, {
        style: {
          color: "#222",
          weight: 1,
          fillColor: "#ffff00",
          fillOpacity: 0.15
        },
        onEachFeature: (feature, layer) => {
          const label =
            (feature.properties && (feature.properties.etiqueta || feature.properties.ETIQUETA)) || "";
          if (label) {
            layer.bindTooltip(label, {
              permanent: true,
              direction: "center",
              className: "psn-tooltip"
            });
          }
        }
      }).addTo(mapPSN);
    }

    // bounds combinados
    let bounds = null;

    if (psnLayer) {
      const b1 = psnLayer.getBounds();
      if (b1.isValid()) bounds = b1;
    }
    if (pistasLayerPSN) {
      const b2 = pistasLayerPSN.getBounds();
      if (b2.isValid()) bounds ? bounds.extend(b2) : (bounds = b2);
    }

    if (bounds && bounds.isValid()) {
      setTimeout(() => {
        mapPSN.invalidateSize();
        mapPSN.fitBounds(bounds, { padding: [5, 5] });
      }, 0);
      return;
    }

    // fallback a Lat/Lon
    const lat = a["Lat"] || a["LAT"];
    const lon = a["Lon"] || a["LON"] || a["Long"];

    if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      const latNum = Number(lat);
      const lonNum = Number(lon);
      setTimeout(() => {
        mapPSN.invalidateSize();
        mapPSN.setView([latNum, lonNum], 15);
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

    // Provincias solo 1 vez
    if (!provinciasLayer && provinciasFeatures.length) {
      provinciasLayer = L.geoJSON(provinciasFeatures, {
        style: {
          color: "#b0b0b0",
          weight: 1,
          fillColor: "#f5f5f5",
          fillOpacity: 0.6
        }
      }).addTo(mapUbicacion);

      const provBounds = provinciasLayer.getBounds();
      if (provBounds.isValid()) {
        setTimeout(() => {
          mapUbicacion.invalidateSize();
          mapUbicacion.fitBounds(provBounds, { padding: [10, 10] });
        }, 0);
      }
    }

    // marcador
    if (ubicacionMarker) {
      mapUbicacion.removeLayer(ubicacionMarker);
      ubicacionMarker = null;
    }

    const center = getAirportCenterLatLng(a);
    if (center) {
      const [latNum, lonNum] = center;

      ubicacionMarker = L.marker([latNum, lonNum], { icon: airportIcon }).addTo(mapUbicacion);

      const iataLabel = a["IATA"] ? String(a["IATA"]).toUpperCase() : "";
      if (iataLabel) {
        ubicacionMarker.bindTooltip(iataLabel, {
          permanent: true,
          direction: "top",
          offset: [0, -4],
          className: "psn-tooltip"
        });
      }
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

    // Paradas (puntos)
    const featsParadas = (paradasFeatures || []).filter(f => {
      const code = String(f.properties?.IATA || "").trim().toUpperCase();
      return code === iataUpper;
    });

    const paradasLayer =
      featsParadas.length > 0
        ? L.geoJSON(featsParadas, {
            pane: "pane_paradas",
            pointToLayer: (feature, latlng) =>
              L.circleMarker(latlng, {
                radius: 5,
                color: "#004b80",
                weight: 1,
                fillColor: "#2a5fa0",
                fillOpacity: 0.9
              }),
            onEachFeature: (feature, layer) => {
              const nombre = feature.properties?.name || "";
              if (nombre) {
                layer.bindTooltip(nombre, {
                  permanent: true,
                  direction: "top",
                  offset: [0, -4],
                  className: "psn-tooltip"
                });
              }
            }
          })
        : null;

    // Terminales (polígonos)
    const featsTerminales = (terminalesFeatures || []).filter(f => {
      const code = String(f.properties?.iata || f.properties?.IATA || "")
        .trim()
        .toUpperCase();
      return code === iataUpper;
    });

    const terminalesLayer =
      featsTerminales.length > 0
        ? L.geoJSON(featsTerminales, {
            pane: "pane_terminales",
            style: {
              color: "#b22222",
              weight: 1,
              fillColor: "#ffdede",
              fillOpacity: 0.25
            },
            onEachFeature: (feature, layer) => {
              const name = feature.properties?.etiqueta || feature.properties?.tipo || "Terminal";
              layer.bindTooltip(name, {
                permanent: false,
                direction: "center",
                className: "terminal-label"
              });
            }
          })
        : null;

    // Group combinado
    transporteLayer = L.layerGroup();
    if (terminalesLayer) transporteLayer.addLayer(terminalesLayer);
    if (paradasLayer) transporteLayer.addLayer(paradasLayer);
    transporteLayer.addTo(mapTransporte);

    // bounds combinados
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
      mapTransporte.setView(center, 12);
    }
  }

  /* ============================================================
     F3. MAPA INFLUENCIA (TIEMPOS + POLÍGONO + PUNTO + LEYENDA)
     ============================================================ */

  async function updateInfluenciaMapForAirport(a) {
    if (!mapInfluencia) return;

    // limpiar capas previas
    if (tiemposLayer) {
      mapInfluencia.removeLayer(tiemposLayer);
      tiemposLayer = null;
    }
    if (influenciaLayer) {
      mapInfluencia.removeLayer(influenciaLayer);
      influenciaLayer = null;
    }
    if (influenciaMarker) {
      mapInfluencia.removeLayer(influenciaMarker);
      influenciaMarker = null;
    }

    // limpiar leyenda previa
    if (influenciaLegend) {
      mapInfluencia.removeControl(influenciaLegend);
      influenciaLegend = null;
    }

    const iataUpper = String(a.IATA || "").trim().toUpperCase();
    if (!iataUpper) return;

    const center = getAirportCenterLatLng(a) || [-38, -64];

    // 1) Tiempos de viaje (anillos)
    const tiemposPath = `img/Tiempos/Tiempos_${iataUpper}.geojson`;

    try {
      const resp = await fetch(tiemposPath);
      if (resp.ok) {
        const gj = await resp.json();
        if (gj && gj.features && gj.features.length) {
          tiemposLayer = L.geoJSON(gj, {
            style: (feature) => {
              const props = feature.properties || {};
              let to = props.ToBreak;

              if (to === undefined || to === null || to === "") {
                const alt =
                  props.ToBreak ??
                  props.tobreak ??
                  props.TOBREAK ??
                  props.to_break ??
                  props.TO_BREAK;
                to = alt !== undefined && alt !== null ? Number(alt) : null;
              } else {
                to = Number(to);
              }

              let color;
              if (to === 60) color = "#08306b";
              else if (to === 120) color = "#2171b5";
              else if (to === 180) color = "#6baed6";
              else color = "#9ecae1";

              return {
                color,
                weight: 1,
                fillColor: color,
                fillOpacity: 0.35
              };
            }
          }).addTo(mapInfluencia);
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar tiempos de viaje para", iataUpper, e);
    }

    // 2) Área de influencia (polígono amarillo sin relleno)
    if (areasInfluenciaFeatures && areasInfluenciaFeatures.length) {
      const featsInfl = areasInfluenciaFeatures.filter(f => {
        const code = String(f.properties?.IATA || f.properties?.iata || "")
          .trim()
          .toUpperCase();
        return code === iataUpper;
      });

      if (featsInfl.length) {
        influenciaLayer = L.geoJSON(featsInfl, {
          style: {
            color: "#FFD700",
            weight: 2,
            dashArray: "6 4",
            fillOpacity: 0.0
          }
        }).addTo(mapInfluencia);
      }
    }

    // 3) Punto del aeropuerto
    if (center) {
      influenciaMarker = L.marker(center, { icon: airportIcon }).addTo(mapInfluencia);

      const iataLabel = a["IATA"] ? String(a["IATA"]).toUpperCase() : "";
      if (iataLabel) {
        influenciaMarker.bindTooltip(iataLabel, {
          permanent: true,
          direction: "top",
          offset: [0, -4],
          className: "psn-tooltip"
        });
      }
    }

    // 4) Ajustar vista combinando todo
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
      const mLatLng = influenciaMarker.getLatLng();
      const b = L.latLngBounds(mLatLng, mLatLng);
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

    // 5) Leyenda
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
     G. PARSEO CSV (INVERSIONES + TRANSPORTE)
     ============================================================ */

  function parseInversionesCSV(text) {
    const result = {};
    if (!text) return result;

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return result;

    const headerLine = lines[0];
    const sep = headerLine.indexOf(";") !== -1 ? ";" : ",";
    const headers = headerLine.split(sep).map(h => h.trim());

    const idxIATA = headers.findIndex(h =>
      h.toUpperCase() === "IATA" ||
      h.toUpperCase() === "COD_IATA" ||
      h.toUpperCase() === "CODIGO_IATA"
    );
    const idx2025 = headers.findIndex(h => h.toUpperCase() === "A2025");
    const idx2026 = headers.findIndex(h => h.toUpperCase() === "A2026");
    const idx2027 = headers.findIndex(h => h.toUpperCase() === "A2027");
    const idxObra = headers.findIndex(h => h.toUpperCase() === "OBRAWEB");

    if (idxIATA === -1) {
      console.warn("No se encontró columna IATA en Programacion_por_aeropuerto_aprobada2025_web.csv");
      return result;
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(sep);
      const rawIata = (cols[idxIATA] || "").trim();
      if (!rawIata) continue;

      const iata = rawIata.toUpperCase();
      if (!result[iata]) {
        result[iata] = {
          A2025: 0,
          A2026: 0,
          A2027: 0,
          obras2025: [],
          obras2026: [],
          obras2027: []
        };
      }

      const obraStr = idxObra !== -1 ? (cols[idxObra] || "").trim() : "";

      if (idx2025 !== -1) {
        const m2025 = parseMonto(cols[idx2025]);
        if (m2025) {
          result[iata].A2025 += m2025;
          if (obraStr) result[iata].obras2025.push(obraStr);
        }
      }
      if (idx2026 !== -1) {
        const m2026 = parseMonto(cols[idx2026]);
        if (m2026) {
          result[iata].A2026 += m2026;
          if (obraStr) result[iata].obras2026.push(obraStr);
        }
      }
      if (idx2027 !== -1) {
        const m2027 = parseMonto(cols[idx2027]);
        if (m2027) {
          result[iata].A2027 += m2027;
          if (obraStr) result[iata].obras2027.push(obraStr);
        }
      }
    }

    // dedup obras
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
    const sep = headerLine.indexOf(";") !== -1 ? ";" : ",";
    const headers = headerLine.split(sep).map(h => h.trim().toUpperCase());

    const idxIATA = headers.indexOf("IATA");
    const idxLINEA = headers.indexOf("LINEA");
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

      result[iata] = { linea, parada };
    }

    return result;
  }
  /* ============================================================
     G2. PARSEO CSV (PASAJEROS MENSUALES)
     ============================================================ */

  function parseFechaFlexible(raw) {
    if (!raw) return null;

    // 1/1/2001 o 01/01/2001
    const m1 = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) {
      const dd = Number(m1[1]);
      const mm = Number(m1[2]);
      const yyyy = Number(m1[3]);
      return new Date(yyyy, mm - 1, dd);
    }

    // 2001-01-01
    const m2 = String(raw).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) {
      const yyyy = Number(m2[1]);
      const mm = Number(m2[2]);
      const dd = Number(m2[3]);
      return new Date(yyyy, mm - 1, dd);
    }

    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  function parsePasajerosMensualCSV(text) {
    const rows = [];
    if (!text) return rows;

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return rows;

    const headerLine = lines[0];

    // Detectar separador: tab > ; > ,
    let sep = ",";
    if (headerLine.includes("\t")) sep = "\t";
    else if (headerLine.includes(";")) sep = ";";

    const headers = headerLine.split(sep).map(h => h.trim());

    const idxIATA = headers.findIndex(h => h.toLowerCase() === "iata");
    const idxFecha = headers.findIndex(h => h.toLowerCase() === "fecha");
    const idxValorPax = headers.findIndex(h => h.toLowerCase() === "valor_pax");
    const idxAnio = headers.findIndex(h => h.toLowerCase() === "anio");
    const idxMes = headers.findIndex(h => h.toLowerCase() === "mes");
    const idxMesNombre = headers.findIndex(h => h.toLowerCase() === "mes_nombre");
    const idxDataset = headers.findIndex(h => h.toLowerCase() === "dataset");

    if (idxIATA === -1 || idxFecha === -1 || idxValorPax === -1) {
      console.warn("CSV pasajeros: faltan columnas requeridas (iata/fecha/valor_pax).");
      return rows;
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;

      const cols = line.split(sep);

      const iata = String(cols[idxIATA] || "").trim().toUpperCase();
      if (!iata) continue;

      const fechaRaw = (cols[idxFecha] || "").trim();
      const date = parseFechaFlexible(fechaRaw);
      if (!date) continue;

      const vRaw = (cols[idxValorPax] || "").trim();
      const valor = Number(vRaw);
      if (isNaN(valor)) continue;

      rows.push({
        iata,
        dataset: idxDataset !== -1 ? String(cols[idxDataset] || "").trim() : "",
        date,
        valor,
        anio: idxAnio !== -1 ? Number(cols[idxAnio]) : null,
        mes: idxMes !== -1 ? Number(cols[idxMes]) : null,
        mesNombre: idxMesNombre !== -1 ? String(cols[idxMesNombre] || "").trim() : ""
      });
    }

    // Orden ascendente por fecha
    rows.sort((a, b) => a.date - b.date);
    return rows;
  }

function formatPct(p) {
  if (p === null || p === undefined || isNaN(p)) return "–";

  const sign = (p >= 0) ? "+" : "-";
  const abs = Math.abs(p);

  return `${sign}${abs.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function formatPctShare(p) {
  if (p === null || p === undefined || isNaN(p)) return "–";
  return `${Math.round(Number(p)).toLocaleString("es-AR")}%`;
}


function setPaxDeltaVisual(el) {
  if (!el) return;
  const text = String(el.textContent || "").trim();
  const card = el.closest(".pasajeros-kpi");
  el.classList.remove("pax-delta", "is-pos", "is-neg", "is-neutral");
  delete el.dataset.trendSymbol;
  if (card) card.classList.remove("trend-pos", "trend-neg", "trend-neutral");

  if (!text || text === "–") return;

  let cls = "is-neutral";
  let symbol = "•";
  if (text.startsWith("+")) {
    cls = "is-pos";
    symbol = "▲";
  } else if (text.startsWith("-")) {
    cls = "is-neg";
    symbol = "▼";
  }

  el.classList.add("pax-delta", cls);
  el.dataset.trendSymbol = symbol;
  if (card) card.classList.add(cls.replace("is", "trend"));
}

function setText(el, value, fallback = "–") {
  if (!el) return;
  el.textContent = (value !== null && value !== undefined && String(value).trim() !== "") ? String(value) : fallback;
}

function setChipList(containerEl, values) {
  if (!containerEl) return;
  const items = (values || []).filter(Boolean);
  if (!items.length) {
    containerEl.innerHTML = '<span class="servicios-chip servicios-chip-empty">Sin datos</span>';
    return;
  }
  containerEl.innerHTML = items.map(v => `<span class="servicios-chip">${v}</span>`).join("");
}


    // Datasets válidos del CSV
  const PAX_DATASET_CAB = "pasajeros_comerciales_cabotaje_aeropuerto";
  const PAX_DATASET_INT = "pasajeros_comerciales_internacional_aeropuerto";

// IDs de KPIs (deben existir en tu HTML nuevo)
const PAX_KPI_IDS = {
  total: {
    lastVal: "paxTotUltimoValor",
    lastPer: "paxTotUltimoPeriodo",
    yoy: "paxTotVarYoY",
    yoyDet: "paxTotVarYoYDetalle",
    ytd: "paxTotVarYTD",
    ytdDet: "paxTotVarYTDDetalle"
  },
  cab: {
    lastVal: "paxCabUltimoValor",
    lastPer: "paxCabUltimoPeriodo",
    yoy: "paxCabVarYoY",
    yoyDet: "paxCabVarYoYDetalle",
    ytd: "paxCabVarYTD",
    ytdDet: "paxCabVarYTDDetalle"
  },
  intl: {
    lastVal: "paxIntUltimoValor",
    lastPer: "paxIntUltimoPeriodo",
    yoy: "paxIntVarYoY",
    yoyDet: "paxIntVarYoYDetalle",
    ytd: "paxIntVarYTD",
    ytdDet: "paxIntVarYTDDetalle"
  }
};

  
  // Construye la serie según modo: cabotaje | internacional | total
  function buildPaxSeries(iataUpper, mode) {
    const rowsAll = (pasajerosMensualRows || []).filter(r => r.iata === iataUpper);
    if (!rowsAll.length) return [];

    if (mode === "cabotaje" || mode === "internacional") {
      const target = (mode === "cabotaje") ? PAX_DATASET_CAB : PAX_DATASET_INT;
      return rowsAll
        .filter(r => r.dataset === target)
        .sort((a, b) => a.date - b.date);
    }

    // mode === "total": sumar cabotaje + internacional por mes (YYYY-MM)
    const acc = new Map();

    for (const r of rowsAll) {
      if (r.dataset !== PAX_DATASET_CAB && r.dataset !== PAX_DATASET_INT) continue;

const year = r.date.getFullYear();
const m = r.date.getMonth() + 1;
const key = `${year}-${String(m).padStart(2, "0")}`;


      if (!acc.has(key)) {
        acc.set(key, {
          iata: iataUpper,
          dataset: "total",
        date: new Date(year, m - 1, 1),
        valor: 0,
        anio: year,
          mes: m,
          mesNombre: r.mesNombre || ""
        });
      }
      acc.get(key).valor += r.valor;
    }

    return Array.from(acc.values()).sort((a, b) => a.date - b.date);
  }

 function calcPaxKPIs(rows){
  if (!rows || !rows.length) {
    return {
      ultimoValor: "–",
      ultimoPeriodo: "Sin datos",
      yoy: "–",
      yoyDet: "–",
      ytd: "–",
      ytdDet: "–"
    };
  }

  const last = rows[rows.length - 1];

  const ultimoValor = formatNumber(Math.round(last.valor));
  const ultimoPeriodo = last.date
    ? last.date.toLocaleString("es-AR", { month: "long", year: "numeric" })
    : "–";

  // YoY
  const lastY = last.date.getFullYear();
  const lastM = last.date.getMonth();
  const prevYearRow = rows.find(r => r.date.getFullYear() === (lastY - 1) && r.date.getMonth() === lastM);

  let yoy = "–", yoyDet = "–";
  if (prevYearRow && Number(prevYearRow.valor) > 0) {
    const yoyPct = ((last.valor - prevYearRow.valor) / prevYearRow.valor) * 100;
    yoy = formatPct(yoyPct);
    yoyDet = `${formatNumber(prevYearRow.valor)} → ${formatNumber(last.valor)}`;
  } else if (prevYearRow) {
    yoyDet = "La base interanual es 0 para ese mes.";
  } else {
    yoyDet = "No hay base interanual para ese mes.";
  }

  // YTD (ene → último mes) contra mismo período del año anterior
  const ytdCur = rows
    .filter(r => r.date.getFullYear() === lastY && r.date.getMonth() <= lastM)
    .reduce((s, r) => s + (Number(r.valor) || 0), 0);

  const ytdPrev = rows
    .filter(r => r.date.getFullYear() === (lastY - 1) && r.date.getMonth() <= lastM)
    .reduce((s, r) => s + (Number(r.valor) || 0), 0);

  let ytd = "–", ytdDet = "–";
  if (ytdPrev > 0) {
    const ytdPct = ((ytdCur - ytdPrev) / ytdPrev) * 100;
    ytd = formatPct(ytdPct);
    ytdDet = `${formatNumber(Math.round(ytdPrev))} → ${formatNumber(Math.round(ytdCur))}`;
  } else {
    ytdDet = "No hay base del año anterior para el período acumulado.";
  }

  return { ultimoValor, ultimoPeriodo, yoy, yoyDet, ytd, ytdDet };
}
  
  // ===================================================================
  // PASAJEROS – FUNCIONES DE FILTRADO (nivel módulo, sin problemas de closure)
  // ===================================================================

  /**
   * Filtra el gráfico principal de pasajeros al rango indicado.
   * Usa paxAllData (datos completos del aeropuerto) y actualiza paxChart.
   */
  function filterPasajerosChart(startYear, startMonth, endYear, endMonth) {
    if (!paxChart || !paxAllData || !paxAllData.length) return;

    const fromKey = startYear * 12 + (startMonth - 1);
    const toKey   = endYear   * 12 + (endMonth   - 1);

    let rowsChart = paxAllData.filter(r => {
      const k = r.date.getFullYear() * 12 + r.date.getMonth();
      return k >= fromKey && k <= toKey;
    });
    if (!rowsChart.length) rowsChart = paxAllData;

    const labels = rowsChart.map(r => {
      const y = r.date.getFullYear();
      const m = String(r.date.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    });

    paxChart.data.labels = labels;
    paxChart.data.datasets[0].data = rowsChart.map(r => r.tot);
    paxChart.data.datasets[1].data = rowsChart.map(r => r.cab);
    paxChart.data.datasets[2].data = rowsChart.map(r => r.intl);
    paxChart.update("none");
  }

  /** Actualiza el overlay del minimap según el rango seleccionado. */
  function updatePaxMinimapOverlayGlobal(fromYear, fromMonth, toYear, toMonth) {
    const all = paxAllData;
    if (!all || !all.length) return;

    const shadeL  = document.getElementById("paxMmShadeL");
    const handleL = document.getElementById("paxMmHandleL");
    const mmWin   = document.getElementById("paxMmWindow");
    const handleR = document.getElementById("paxMmHandleR");
    const shadeR  = document.getElementById("paxMmShadeR");
    if (!shadeL) return;

    const total   = all.length;
    const fromKey = fromYear * 12 + (fromMonth - 1);
    const toKey   = toYear   * 12 + (toMonth   - 1);

    let fromIdx = 0;
    for (let i = 0; i < total; i++) {
      if (all[i].date.getFullYear() * 12 + all[i].date.getMonth() >= fromKey) { fromIdx = i; break; }
    }
    let toIdx = total - 1;
    for (let i = total - 1; i >= 0; i--) {
      if (all[i].date.getFullYear() * 12 + all[i].date.getMonth() <= toKey) { toIdx = i; break; }
    }

    const leftPct  = total > 1 ? (fromIdx / (total - 1)) * 100 : 0;
    const rightPct = total > 1 ? (toIdx   / (total - 1)) * 100 : 100;

    shadeL.style.left  = "0";
    shadeL.style.width = leftPct + "%";
    handleL.style.left = leftPct + "%";
    mmWin.style.left   = leftPct + "%";
    mmWin.style.width  = Math.max(0, rightPct - leftPct) + "%";
    handleR.style.left = rightPct + "%";
    shadeR.style.left  = rightPct + "%";
    shadeR.style.width = (100 - rightPct) + "%";
  }

  /** Lee los valores actuales de los inputs de rango. */
  function readPaxRangeInputsGlobal() {
    const minY = paxPeriodMin ? paxPeriodMin.year  : 2001;
    const minM = paxPeriodMin ? paxPeriodMin.month : 1;
    const maxY = paxPeriodMax ? paxPeriodMax.year  : 2026;
    const maxM = paxPeriodMax ? paxPeriodMax.month : 12;
    return {
      fromYear:  Number(document.getElementById("paxYearFrom")?.value  || minY),
      fromMonth: Number(document.getElementById("paxMonthFrom")?.value || minM),
      toYear:    Number(document.getElementById("paxYearTo")?.value    || maxY),
      toMonth:   Number(document.getElementById("paxMonthTo")?.value   || maxM)
    };
  }

  /**
   * Aplica un rango: clampea al rango disponible, actualiza inputs, etiqueta,
   * overlay del minimap y filtra el gráfico.
   */
  function applyPaxRangeGlobal(fromYear, fromMonth, toYear, toMonth) {
    const minY = paxPeriodMin ? paxPeriodMin.year  : 2001;
    const minM = paxPeriodMin ? paxPeriodMin.month : 1;
    const maxY = paxPeriodMax ? paxPeriodMax.year  : 2026;
    const maxM = paxPeriodMax ? paxPeriodMax.month : 12;

    const dataFromKey = minY * 12 + (minM - 1);
    const dataToKey   = maxY * 12 + (maxM - 1);
    const cFromKey = Math.max(dataFromKey, Math.min(dataToKey, fromYear * 12 + (fromMonth - 1)));
    const cToKey   = Math.max(dataFromKey, Math.min(dataToKey, toYear   * 12 + (toMonth   - 1)));
    const cFY = Math.floor(cFromKey / 12);
    const cFM = (cFromKey % 12) + 1;
    const cTY = Math.floor(cToKey  / 12);
    const cTM = (cToKey  % 12) + 1;

    const mfEl    = document.getElementById("paxMonthFrom");
    const yfEl    = document.getElementById("paxYearFrom");
    const mtEl    = document.getElementById("paxMonthTo");
    const ytEl    = document.getElementById("paxYearTo");
    const labelEl = document.getElementById("paxYearLabel");

    if (mfEl)    mfEl.value    = String(cFM);
    if (yfEl)    yfEl.value    = String(cFY);
    if (mtEl)    mtEl.value    = String(cTM);
    if (ytEl)    ytEl.value    = String(cTY);
    if (labelEl) labelEl.textContent =
      PAX_MESES_ABBR[cFM - 1] + " " + cFY + " — " + PAX_MESES_ABBR[cTM - 1] + " " + cTY;

    updatePaxMinimapOverlayGlobal(cFY, cFM, cTY, cTM);
    filterPasajerosChart(cFY, cFM, cTY, cTM);
  }

  /** Aplica un período rápido (botón 1m/3m/6m/ytd/1y/all). */
  function applyPaxQuickRangeGlobal(range) {
    if (!paxAllData || !paxAllData.length) return;

    const lastDate  = paxAllData[paxAllData.length - 1].date;
    const lastYear  = lastDate.getFullYear();
    const lastMonth = lastDate.getMonth() + 1;
    let fromYear, fromMonth;

    switch (range) {
      case "1m":
        fromYear = lastYear; fromMonth = lastMonth;
        break;
      case "3m": {
        const d = new Date(lastYear, lastDate.getMonth() - 2, 1);
        fromYear = d.getFullYear(); fromMonth = d.getMonth() + 1;
        break;
      }
      case "6m": {
        const d = new Date(lastYear, lastDate.getMonth() - 5, 1);
        fromYear = d.getFullYear(); fromMonth = d.getMonth() + 1;
        break;
      }
      case "ytd":
        fromYear = lastYear; fromMonth = 1;
        break;
      case "1y": {
        const d = new Date(lastYear, lastDate.getMonth() - 11, 1);
        fromYear = d.getFullYear(); fromMonth = d.getMonth() + 1;
        break;
      }
      default: // "all"
        fromYear  = paxPeriodMin ? paxPeriodMin.year  : 2001;
        fromMonth = paxPeriodMin ? paxPeriodMin.month : 1;
    }

    applyPaxRangeGlobal(fromYear, fromMonth, lastYear, lastMonth);
    document.querySelectorAll(".pax-btn").forEach(btn =>
      btn.classList.toggle("pax-btn-active", btn.dataset.range === range)
    );
  }

  /** Configura los event listeners de controles (ejecutar una sola vez). */
  function initPaxControls() {
    const marker = document.getElementById("paxYearFrom");
    if (!marker || marker.dataset.globalBound) return;
    marker.dataset.globalBound = "1";

    // Botones rápidos de período
    document.querySelectorAll(".pax-btn").forEach(btn => {
      btn.addEventListener("click", () => applyPaxQuickRangeGlobal(btn.dataset.range));
    });

    // Inputs de fecha (mes y año inicio/fin)
    const onDateChange = () => {
      const r = readPaxRangeInputsGlobal();
      const fromKey = r.fromYear * 12 + (r.fromMonth - 1);
      const toKey   = r.toYear   * 12 + (r.toMonth   - 1);
      let fY = r.fromYear, fM = r.fromMonth, tY = r.toYear, tM = r.toMonth;
      if (fromKey > toKey) { tY = fY; tM = fM; }
      applyPaxRangeGlobal(fY, fM, tY, tM);
      document.querySelectorAll(".pax-btn").forEach(b => b.classList.remove("pax-btn-active"));
    };
    ["paxMonthFrom", "paxYearFrom", "paxMonthTo", "paxYearTo"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", onDateChange);
    });

    // Minimap interactivo
    initMinimapDrag();
  }

  /** Configura el arrastre interactivo del minimap (mouse y touch). */
  function initMinimapDrag() {
    const wrap = document.getElementById("paxMinimapWrap");
    if (!wrap || wrap._minimapDragBound) return;
    wrap._minimapDragBound = true;

    const handleL = document.getElementById("paxMmHandleL");
    const handleR = document.getElementById("paxMmHandleR");
    const mmWin   = document.getElementById("paxMmWindow");
    if (!handleL || !handleR || !mmWin) return;

    let dragMode = null;
    let panStartClientX = 0;
    let panStartFromIdx = 0;
    let panStartToIdx   = 0;

    function xToIdx(clientX) {
      const rect = wrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const total = (paxAllData || []).length;
      return Math.round(pct * Math.max(0, total - 1));
    }

    function idxToDate(idx) {
      const all = paxAllData;
      if (!all || !all.length) return { year: 2001, month: 1 };
      const r = all[Math.max(0, Math.min(all.length - 1, idx))];
      return { year: r.date.getFullYear(), month: r.date.getMonth() + 1 };
    }

    function getCurrentIdxs() {
      const all = paxAllData;
      if (!all || !all.length) return { fi: 0, ti: 0 };
      const r = readPaxRangeInputsGlobal();
      const fKey = r.fromYear * 12 + (r.fromMonth - 1);
      const tKey = r.toYear   * 12 + (r.toMonth   - 1);
      let fi = 0, ti = all.length - 1;
      for (let i = 0; i < all.length; i++) {
        if (all[i].date.getFullYear() * 12 + all[i].date.getMonth() >= fKey) { fi = i; break; }
      }
      for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].date.getFullYear() * 12 + all[i].date.getMonth() <= tKey) { ti = i; break; }
      }
      return { fi, ti };
    }

    function onMove(e) {
      if (!dragMode) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const idx = xToIdx(clientX);
      const { fi, ti } = getCurrentIdxs();
      const all = paxAllData || [];

      if (dragMode === "left") {
        const cIdx = Math.min(idx, ti);
        applyPaxRangeGlobal(idxToDate(cIdx).year, idxToDate(cIdx).month, idxToDate(ti).year, idxToDate(ti).month);
      } else if (dragMode === "right") {
        const cIdx = Math.max(idx, fi);
        applyPaxRangeGlobal(idxToDate(fi).year, idxToDate(fi).month, idxToDate(cIdx).year, idxToDate(cIdx).month);
      } else if (dragMode === "pan") {
        const span   = panStartToIdx - panStartFromIdx;
        const deltaI = xToIdx(clientX) - xToIdx(panStartClientX);
        const newFi  = Math.max(0, Math.min(all.length - 1 - span, panStartFromIdx + deltaI));
        const newTi  = Math.min(all.length - 1, newFi + span);
        applyPaxRangeGlobal(idxToDate(newFi).year, idxToDate(newFi).month,
                            idxToDate(newTi).year, idxToDate(newTi).month);
      }
      document.querySelectorAll(".pax-btn").forEach(b => b.classList.remove("pax-btn-active"));
    }

    function onUp() {
      dragMode = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
    }

    handleL.addEventListener("mousedown", e => {
      e.preventDefault(); dragMode = "left";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp, { once: true });
    });
    handleL.addEventListener("touchstart", e => {
      e.preventDefault(); dragMode = "left";
      panStartClientX = e.touches[0].clientX;
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp, { once: true });
    }, { passive: false });

    handleR.addEventListener("mousedown", e => {
      e.preventDefault(); dragMode = "right";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp, { once: true });
    });
    handleR.addEventListener("touchstart", e => {
      e.preventDefault(); dragMode = "right";
      panStartClientX = e.touches[0].clientX;
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp, { once: true });
    }, { passive: false });

    mmWin.addEventListener("mousedown", e => {
      e.preventDefault(); dragMode = "pan";
      panStartClientX = e.clientX;
      const ci = getCurrentIdxs();
      panStartFromIdx = ci.fi; panStartToIdx = ci.ti;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp, { once: true });
    });
    mmWin.addEventListener("touchstart", e => {
      e.preventDefault(); dragMode = "pan";
      panStartClientX = e.touches[0].clientX;
      const ci = getCurrentIdxs();
      panStartFromIdx = ci.fi; panStartToIdx = ci.ti;
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp, { once: true });
    }, { passive: false });
  }

  /** Renderiza (o actualiza) el minimap con la serie total completa del aeropuerto. */
  function renderPaxMinimapGlobal() {
    const all = paxAllData;
    if (!all || !all.length) return;
    const mmCanvas = document.getElementById("paxMinimapCanvas");
    if (!mmCanvas) return;

    const labels = all.map(r => {
      const y = r.date.getFullYear();
      const m = String(r.date.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    });
    const data = all.map(r => r.tot || 0);

    if (paxMinimapChart) {
      paxMinimapChart.data.labels = labels;
      paxMinimapChart.data.datasets[0].data = data;
      paxMinimapChart.update("none");
    } else {
      paxMinimapChart = new Chart(mmCanvas.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: [{
            data,
            borderColor: "#0f44bf",
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true,
            backgroundColor: "rgba(15,68,191,0.08)",
            tension: 0.15
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
          events: []
        }
      });
    }
  }


 // ------Función que define el panel de pasajeros.
  
function renderPasajerosPanel(iataUpper) {
  const canvas = document.getElementById("paxChartCanvas");
  const note = document.getElementById("paxChartNote");

  const yearFromEl = document.getElementById("paxYearFrom");
  const yearToEl = document.getElementById("paxYearTo");
  const yearLabelEl = document.getElementById("paxYearLabel");

  if (!canvas || !note) return;

  // --- Helpers KPIs ---
  const seriesCab = buildPaxSeries(iataUpper, "cabotaje");
  const seriesInt = buildPaxSeries(iataUpper, "internacional");
  const seriesTot = buildPaxSeries(iataUpper, "total");

  const hasAny = (seriesCab.length || seriesInt.length || seriesTot.length);
  if (!hasAny) {
    // limpiar KPIs (si existen)
    ["total","cab","intl"].forEach(k => {
      const ids = PAX_KPI_IDS[k];
      if (!ids) return;
      const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      setTxt(ids.lastVal, "–");
      setTxt(ids.lastPer, "–");
      setTxt(ids.yoy, "–");
      setTxt(ids.yoyDet, "–");
      setTxt(ids.ytd, "–");
      setTxt(ids.ytdDet, "–");
    });

if (paxChart) {
  paxChart.destroy();
  paxChart = null;
}
    note.textContent = `No hay datos de pasajeros para ${iataUpper}.`;
    return;
  }

  function setKpiBlock(key, rows) {
    const ids = PAX_KPI_IDS[key];
    if (!ids) return;

    const elLastVal = document.getElementById(ids.lastVal);
    const elLastPer = document.getElementById(ids.lastPer);
    const elYoY = document.getElementById(ids.yoy);
    const elYoYDet = document.getElementById(ids.yoyDet);
    const elYTD = document.getElementById(ids.ytd);
    const elYTDDet = document.getElementById(ids.ytdDet);

    if (!rows || !rows.length) {
      if (elLastVal) elLastVal.textContent = "–";
      if (elLastPer) elLastPer.textContent = "–";
      if (elYoY) elYoY.textContent = "–";
      if (elYoYDet) elYoYDet.textContent = "–";
      if (elYTD) elYTD.textContent = "–";
      if (elYTDDet) elYTDDet.textContent = "–";
      setPaxDeltaVisual(elYoY);
      setPaxDeltaVisual(elYTD);
      return;
    }

    const last = rows[rows.length - 1];
    const lastLabel = `${last.mesNombre || ""} ${last.anio || last.date.getFullYear()}`.trim()
      || last.date.toLocaleDateString("es-AR");

    if (elLastVal) elLastVal.textContent = formatNumber(last.valor);
    if (elLastPer) elLastPer.textContent = lastLabel;

    // YoY (mismo mes año anterior)
    const lastY = last.date.getFullYear();
    const lastM = last.date.getMonth();
    const prevYearRow = rows.find(r => r.date.getFullYear() === (lastY - 1) && r.date.getMonth() === lastM);

    if (prevYearRow && Number(prevYearRow.valor) > 0) {
      const yoy = ((last.valor - prevYearRow.valor) / prevYearRow.valor) * 100;
      if (elYoY) elYoY.textContent = formatPct(yoy);
      if (elYoYDet) elYoYDet.textContent = `${formatNumber(prevYearRow.valor)} → ${formatNumber(last.valor)}`;
    } else if (prevYearRow) {
      if (elYoY) elYoY.textContent = "–";
      if (elYoYDet) elYoYDet.textContent = "La base interanual es 0 para ese mes.";
    } else {
      if (elYoY) elYoY.textContent = "–";
      if (elYoYDet) elYoYDet.textContent = "No hay base interanual para ese mes.";
    }

    // YTD (ene → último mes disponible del año del último dato)
    const yearCur = last.date.getFullYear();
    const lastMonthIdx = last.date.getMonth();

    const sumPeriod = (year) => rows
      .filter(r => r.date.getFullYear() === year && r.date.getMonth() <= lastMonthIdx)
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0);

    const ytdCur = sumPeriod(yearCur);
    const ytdPrev = sumPeriod(yearCur - 1);

    if (elYTD && elYTDDet) {
      if (ytdPrev > 0) {
        const ytdPct = ((ytdCur - ytdPrev) / ytdPrev) * 100;
        elYTD.textContent = formatPct(ytdPct);
        elYTDDet.textContent = `${formatNumber(Math.round(ytdPrev))} → ${formatNumber(Math.round(ytdCur))}`;
      } else {
        elYTD.textContent = "–";
        elYTDDet.textContent = "No hay base del año anterior para el acumulado.";
      }
    }

    setPaxDeltaVisual(elYoY);
    setPaxDeltaVisual(elYTD);
  }

  // KPIs: Total / Cabotaje / Internacional
  setKpiBlock("total", seriesTot);
  setKpiBlock("cab", seriesCab);
  setKpiBlock("intl", seriesInt);

  // --- Construcción de fechas para el gráfico (unión de meses) ---
  const mapByKey = new Map();
  const addSeriesToMap = (rows, field) => {
    rows.forEach(r => {
      const y = r.date.getFullYear();
      const m = r.date.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (!mapByKey.has(key)) {
        mapByKey.set(key, { date: new Date(y, m - 1, 1), tot: null, cab: null, intl: null });
      }
      mapByKey.get(key)[field] = Number(r.valor) || 0;
    });
  };

  addSeriesToMap(seriesTot, "tot");
  addSeriesToMap(seriesCab, "cab");
  addSeriesToMap(seriesInt, "intl");

  const all = Array.from(mapByKey.values()).sort((a, b) => a.date - b.date);
canvas._paxAll = all;       // cache de la serie completa
canvas._paxIATA = iataUpper;
canvas._paxPatternsDoneFor = ""; // fuerza recalcular patrones cuando corresponda


  // ---- Almacenar datos del aeropuerto en variables de módulo ----
  paxAllData    = all;
  paxPeriodMin  = { year: all[0].date.getFullYear(), month: all[0].date.getMonth() + 1 };
  paxPeriodMax  = { year: all[all.length - 1].date.getFullYear(), month: all[all.length - 1].date.getMonth() + 1 };

  // Reset de rango al cambiar de aeropuerto
  const prevIata = yearFromEl?.dataset.iata || "";
  if (prevIata !== iataUpper) {
    applyPaxRangeGlobal(paxPeriodMin.year, paxPeriodMin.month, paxPeriodMax.year, paxPeriodMax.month);
    document.querySelectorAll(".pax-btn").forEach(b =>
      b.classList.toggle("pax-btn-active", b.dataset.range === "all")
    );
    if (yearFromEl) yearFromEl.dataset.iata = iataUpper;
  } else {
    // Solo actualiza label y overlay sin cambiar los valores
    const r = readPaxRangeInputsGlobal();
    const labelEl = document.getElementById("paxYearLabel");
    if (labelEl) labelEl.textContent =
      PAX_MESES_ABBR[r.fromMonth - 1] + " " + r.fromYear + " — " +
      PAX_MESES_ABBR[r.toMonth  - 1] + " " + r.toYear;
    updatePaxMinimapOverlayGlobal(r.fromYear, r.fromMonth, r.toYear, r.toMonth);
  }

  // Configurar event listeners globales (solo una vez)
  initPaxControls();

  // Renderizar minimap
  renderPaxMinimapGlobal();


// =========================================================================
// FIX Chart.js — NO TOCAR SIN REVISAR
// - maintainAspectRatio:false es clave para que el chart respete el alto del contenedor
// - Si el gráfico vuelve a "gigante", revisar CSS (pasajeros-chart-wrap / paxChartCanvas)
// =========================================================================
  // filtrar por rango de mes+año para el chart
  const _paxR = readPaxRangeInputsGlobal();
  const _paxFromKey = _paxR.fromYear * 12 + (_paxR.fromMonth - 1);
  const _paxToKey   = _paxR.toYear   * 12 + (_paxR.toMonth   - 1);
  let rowsChart = all.filter(row => {
    const k = row.date.getFullYear() * 12 + row.date.getMonth();
    return k >= _paxFromKey && k <= _paxToKey;
  });
  if (!rowsChart.length) rowsChart = all;

  // --- Chart (Chart.js) ---
  const labels = rowsChart.map(r => {
    const y = r.date.getFullYear();
    const m = String(r.date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  const dataTot = rowsChart.map(r => r.tot);
  const dataCab = rowsChart.map(r => r.cab);
  const dataInt = rowsChart.map(r => r.intl);

  const ctx = canvas.getContext("2d");

  if (!paxChart) {
    paxChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Total",
            data: dataTot,
            borderColor: "#0f44bf",
            borderWidth: 2,
            pointRadius: 0,
            spanGaps: true,
            tension: 0.15
          },
          {
            label: "Cabotaje",
            data: dataCab,
            borderColor: "#73acdf",
            borderWidth: 2,
            pointRadius: 0,
            spanGaps: true,
            tension: 0.15
          },
          {
            label: "Internacional",
            data: dataInt,
            borderColor: "#16c41e",
            borderWidth: 2,
            pointRadius: 0,
            spanGaps: true,
            tension: 0.15
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: true, position: "top" },
          tooltip: {
            callbacks: {
              title: (items) => {
                const [yy, mm] = (items[0]?.label || "").split("-");
                const d = new Date(Number(yy), Number(mm) - 1, 1);
                const mes = d.toLocaleString("es-AR", { month: "short" }).replace(".", "");
                return `${mes} ${yy}`;
              },
              label: (item) => `${item.dataset.label}: ${formatNumber(item.parsed.y || 0)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { maxTicksLimit: 12 }
          },
y: {
  beginAtZero: true,
  grace: "5%",              // agrega margen superior
  ticks: {
    callback: (v) => formatNumber(v),
    maxTicksLimit: 6
  }
}
        }
      }
    });
  } else {
    paxChart.data.labels = labels;
    paxChart.data.datasets[0].data = dataTot;
    paxChart.data.datasets[1].data = dataCab;
    paxChart.data.datasets[2].data = dataInt;
    paxChart.update();
  }
  
// PERF: Patrones se renderiza por aeropuerto (no por slider) para evitar cuelgues
// renderPaxPatterns(iataUpper, all);

  note.textContent = `Elaborado por ORSNA con datos de SIAC ANAC`;
}

// -------NUEVA FUNCION------------
function renderPaxPatterns(iataUpper) {
  const paxMainCanvas = document.getElementById("paxChartCanvas");
  if (!paxMainCanvas) return;

  if (!paxMainCanvas._paxAll || paxMainCanvas._paxIATA !== iataUpper) return;
  if (paxMainCanvas._paxPatternsDoneFor === iataUpper) return;
  paxMainCanvas._paxPatternsDoneFor = iataUpper;

  const allRows = paxMainCanvas._paxAll;

  // ===== Composición cabotaje/internacional: últimos 12 meses =====
  const compCanvas = document.getElementById("paxWeekChart");
  const compNote = document.getElementById("paxWeekNote");
  const compCabEl = document.getElementById("paxCompCabShare");
  const compIntEl = document.getElementById("paxCompIntShare");

  if (compCanvas) {
    const rows12 = allRows.slice(-12);
    const cab12 = rows12.reduce((acc, r) => acc + (Number(r.cab) || 0), 0);
    const int12 = rows12.reduce((acc, r) => acc + (Number(r.intl) || 0), 0);
    const tot12 = cab12 + int12;
    const cabPct = tot12 > 0 ? (cab12 / tot12) * 100 : 0;
    const intPct = tot12 > 0 ? (int12 / tot12) * 100 : 0;

    if (compCabEl) compCabEl.textContent = tot12 > 0 ? formatPctShare(cabPct) : "–";
    if (compIntEl) compIntEl.textContent = tot12 > 0 ? formatPctShare(intPct) : "–";
    if (compNote) {
      compNote.textContent = tot12 > 0
        ? `${formatNumber(Math.round(tot12))} pasajeros acumulados en los últimos 12 meses.`
        : "No hay base suficiente para estimar la composición reciente.";
    }

    if (paxWeekChart) {
      paxWeekChart.destroy();
      paxWeekChart = null;
    }

    const compCtx = compCanvas.getContext("2d");
    paxWeekChart = new Chart(compCtx, {
      type: "doughnut",
      data: {
        labels: ["Cabotaje", "Internacional"],
        datasets: [{
          data: [cab12, int12],
          backgroundColor: ["#73acdf", "#16c41e"],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 10, usePointStyle: true, pointStyle: "circle" }
          },
          tooltip: {
            callbacks: {
              label: (item) => {
                const value = Number(item.parsed || 0);
                const pct = tot12 > 0 ? (value / tot12) * 100 : 0;
                return `${item.label}: ${formatNumber(Math.round(value))} (${formatPctShare(pct)})`;
              }
            }
          }
        }
      }
    });
  }

  // ===== Estacionalidad mensual: promedio por mes y por segmento, excluyendo 2020-2022 =====
  const seasonCanvas = document.getElementById("paxSeasonChart");
  if (!seasonCanvas) return;

  const rows = allRows.filter(r => {
    const y = r.date.getFullYear();
    return y < 2020 || y > 2022;
  });

  const labels = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const cabSum = Array(12).fill(0);
  const cabCnt = Array(12).fill(0);
  const intSum = Array(12).fill(0);
  const intCnt = Array(12).fill(0);

  for (const r of rows) {
    const m = r.date.getMonth();

    if (r.cab !== null && r.cab !== undefined && !isNaN(Number(r.cab))) {
      cabSum[m] += Number(r.cab);
      cabCnt[m] += 1;
    }

    if (r.intl !== null && r.intl !== undefined && !isNaN(Number(r.intl))) {
      intSum[m] += Number(r.intl);
      intCnt[m] += 1;
    }
  }

  const dataCab = labels.map((_, i) => (cabCnt[i] ? cabSum[i] / cabCnt[i] : null));
  const dataInt = labels.map((_, i) => (intCnt[i] ? intSum[i] / intCnt[i] : null));

  if (paxSeasonChart) {
    paxSeasonChart.destroy();
    paxSeasonChart = null;
  }

  const ctx = seasonCanvas.getContext("2d");
  paxSeasonChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Cabotaje",
          data: dataCab,
          backgroundColor: "#73acdf",
          borderRadius: 4,
          barPercentage: 0.9,
          categoryPercentage: 0.7
        },
        {
          label: "Internacional",
          data: dataInt,
          backgroundColor: "#16c41e",
          borderRadius: 4,
          barPercentage: 0.9,
          categoryPercentage: 0.7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: { boxWidth: 10, usePointStyle: true, pointStyle: "circle" }
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatNumber(Math.round(item.parsed.y || 0))}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          grace: "8%",
          ticks: {
            callback: (v) => formatNumber(Math.round(v)),
            maxTicksLimit: 4
          }
        }
      }
    }
  });
}


const TOTAL_SNA_AEROPUERTOS = 57;

function computePaxRankingData(mode) {
  const modeKey = (mode === "cabotaje" || mode === "internacional") ? mode : "total";
  const iatas = [...new Set((pasajerosMensualRows || []).map(r => String(r.iata || "").trim().toUpperCase()).filter(Boolean))];
  const ranking = [];

  for (const iata of iatas) {
    const series = buildPaxSeries(iata, modeKey);
    if (!series || series.length < 24) continue;

    const last12 = series.slice(-12);
    const prev12 = series.slice(-24, -12);
    if (last12.length < 12 || prev12.length < 12) continue;

    const sumLast12 = last12.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    const sumPrev12 = prev12.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    if (!sumPrev12 || sumPrev12 <= 0) continue;

    const pct = ((sumLast12 - sumPrev12) / sumPrev12) * 100;
    const delta = sumLast12 - sumPrev12;
    const airportMeta = (aeropuertos || []).find(a => String(a.IATA || "").toUpperCase() === iata) || {};
    const nombre = clean(airportMeta["Aeropuerto"]) || clean(airportMeta["Nombre del Aeropuerto"]) || iata;

    ranking.push({
      iata,
      nombre,
      pct,
      delta,
      sumLast12,
      sumPrev12,
      lastDate: last12[last12.length - 1]?.date || null,
      mode: modeKey
    });
  }

  ranking.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    if (b.delta !== a.delta) return b.delta - a.delta;
    return a.iata.localeCompare(b.iata);
  });

  ranking.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return ranking;
}

function renderSinglePaxRanking(iataUpper, mode, listId, contentId, modeLabel) {
  const listEl = document.getElementById(listId);
  const currentEl = document.getElementById(contentId);
  if (!listEl || !currentEl) return;

  const ranking = computePaxRankingData(mode);
  if (!ranking.length) {
    listEl.innerHTML = '<li class="pax-top10-loading">No hay base comparable suficiente.</li>';
    currentEl.innerHTML = '<p class="pax-ranking-loading">No hay ranking comparable suficiente.</p>';
    return;
  }

  const top10 = ranking.slice(0, 10);
  const maxAbsPct = Math.max(...top10.map(r => Math.abs(r.pct)), 1);

  function arrowClass(pct) {
    if (pct > 0.0001) return "pax-ranking-arrow-up";
    if (pct < -0.0001) return "pax-ranking-arrow-down";
    return "pax-ranking-arrow-flat";
  }

  function arrowChar(pct) {
    if (pct > 0.0001) return "↑";
    if (pct < -0.0001) return "↓";
    return "→";
  }

  listEl.innerHTML = top10.map(r => {
    const width = Math.max(4, Math.round((Math.abs(r.pct) / maxAbsPct) * 100));
    const barCls = r.pct >= 0 ? "pax-ranking-bar-pos" : "pax-ranking-bar-neg";
    const currentCls = r.iata === iataUpper ? " pax-ranking-current" : "";
    return `
      <li class="pax-top10-item${currentCls}">
        <span class="pax-top10-pos">${r.rank}</span>
        <span class="pax-top10-iata">${r.iata}</span>
        <span class="pax-top10-nombre" title="${r.nombre}">${r.nombre}</span>
        <span class="pax-ranking-arrow ${arrowClass(r.pct)}">${arrowChar(r.pct)}</span>
        <span class="pax-top10-pct">${formatPct(r.pct)}</span>
        <span class="pax-ranking-bar-wrap"><span class="pax-ranking-bar ${barCls}" style="width:${width}%"></span></span>
        <span class="pax-top10-vol">${formatNumber(Math.round(r.sumLast12))}</span>
      </li>`;
  }).join("");

  const current = ranking.find(r => r.iata === iataUpper);
  if (!current) {
    currentEl.innerHTML = `<p class="pax-ranking-loading">El aeropuerto actual no tiene base comparable suficiente en ${modeLabel.toLowerCase()}.</p>`;
    return;
  }

  const monthLabel = current.lastDate
    ? current.lastDate.toLocaleString("es-AR", { month: "short", year: "numeric" }).replace(".", "")
    : "último dato";

  currentEl.innerHTML = `
    <div class="pax-tu-ranking-row">
      <span class="pax-tu-ranking-label">Ubicación en el ranking</span>
      <span class="pax-tu-ranking-pos"><strong>#${current.rank}</strong> / ${TOTAL_SNA_AEROPUERTOS}</span>
    </div>
    <div class="pax-tu-ranking-row">
      <span class="pax-tu-ranking-label">Variación acumulada últimos 12 meses</span>
      <span class="pax-tu-ranking-pct">${formatPct(current.pct)}</span>
      <span class="pax-tu-ranking-sub">${formatNumber(Math.round(current.sumPrev12))} → ${formatNumber(Math.round(current.sumLast12))}</span>
    </div>
    <div class="pax-tu-ranking-contexto">
      Ranking calculado para la serie de <strong>${modeLabel.toLowerCase()}</strong>, comparando los <strong>12 últimos meses disponibles</strong> contra los <strong>12 meses previos</strong>.
      Último dato considerado: <strong>${monthLabel}</strong>.
    </div>
    <div class="pax-tu-ranking-meta">
      Universo del SNA: <strong>${TOTAL_SNA_AEROPUERTOS}</strong> aeropuertos · con base comparable en ${modeLabel.toLowerCase()}: <strong>${ranking.length}</strong>.
    </div>`;
}

function renderPaxRanking(iataUpper) {
  renderSinglePaxRanking(iataUpper, "cabotaje", "paxTop10CabList", "paxTuRankingCabContent", "Cabotaje");
  renderSinglePaxRanking(iataUpper, "internacional", "paxTop10IntList", "paxTuRankingIntContent", "Internacional");
}





  /* ============================================================
     H. RENDER PRINCIPAL (AEROPUERTO SELECCIONADO)
     ============================================================ */

  function renderAirport(iataCode) {
    currentIATA = String(iataCode || "").toUpperCase();   // <-- AGREGAR ACÁ (1ra línea útil)
    const a = aeropuertos.find(x => x.IATA === iataCode);
    if (!a) return;
    
    currentIATA = String(iataCode || "").toUpperCase();

    const iata = String(a.IATA || "").toUpperCase();
    currentIATA = iata;
    const nombre = clean(a["Aeropuerto"]) || clean(a["Nombre del Aeropuerto"]) || iata;
    const nombreOficial = clean(a["Nombre del Aeropuerto"]) || clean(a["Aeropuerto"]);
    const tituloAeroSeccion = `${nombre} (${iata})`;

    // Título principal
    let tituloFinal = "";
    if (iata === "AEP") {
      tituloFinal = "Aeroparque Jorge Newbery (AEP)";
    } else if (nombreOficial && nombre && nombre !== nombreOficial) {
      tituloFinal = `${nombre} (${iata}) – ${nombreOficial}`;
    } else {
      tituloFinal = `${nombre} (${iata})`;
    }
    const pageTitleEl = document.getElementById("pageTitle");
    if (pageTitleEl) pageTitleEl.textContent = tituloFinal;

    // Encabezados (respetando nombres/IDs)
    const hdrSuperficie = document.getElementById("hdrSuperficie");
    const hdrMovimiento = document.getElementById("hdrMovimiento");
    const hdrTerminal = document.getElementById("hdrTerminal");
    const hdrUbicacion = document.getElementById("hdrUbicacion");
    const hdrServicios = document.getElementById("hdrServicios");
    const hdrPasajeros = document.getElementById("hdrPasajeros");
    const hdrEmpleoEl = document.getElementById("hdrEmpleo");

    if (hdrSuperficie) hdrSuperficie.innerHTML = `Explotación <small>${tituloAeroSeccion}</small>`;
    if (hdrMovimiento) hdrMovimiento.innerHTML = `Área de movimiento <small>${tituloAeroSeccion}</small>`;
    if (hdrTerminal) hdrTerminal.innerHTML = `Terminal de pasajeros <small>${tituloAeroSeccion}</small>`;
    if (hdrUbicacion) hdrUbicacion.innerHTML = `Ubicación y accesibilidad <small>${tituloAeroSeccion}</small>`;
    if (hdrServicios) hdrServicios.innerHTML = `Servicios y ayudas <small>${tituloAeroSeccion}</small>`;
    if (hdrPasajeros) hdrPasajeros.innerHTML = `Pasajeros comerciales <small>${tituloAeroSeccion}</small>`;

    // hdrEmpleo conserva el botón "i" (btnInfoImpacto) si ya existe dentro del header
    if (hdrEmpleoEl) {
      const infoBtn = hdrEmpleoEl.querySelector("#btnInfoImpacto");
      hdrEmpleoEl.innerHTML = `Impacto territorial del aeropuerto <small>${tituloAeroSeccion}</small>`;
      if (infoBtn) hdrEmpleoEl.appendChild(infoBtn);
    }

    /* ---------- CONTACTOS ---------- */
    const contacto = contactosPorIATA[iata] || {};

    // KPI superior: Administración / Jefatura
    const adminNombre = clean(contacto["Administrador"]) || "Sin dato";
    const adminTel = clean(contacto["AdmTelef"]);
    const adminMail = clean(contacto["AdmCorreo"]);

    const jefeNombre = clean(contacto["JefeAeropuerto"] || contacto["Jefe de Aeropuerto"]) || "Sin dato";
    const jefeTel = clean(contacto["JefeTelef"]);
    const jefeMail = clean(contacto["JefeCorreo"]);

    const adminContactoStr =
      [adminTel ? `☎ ${adminTel}` : "", adminMail ? `✉ ${adminMail}` : ""].filter(Boolean).join(" · ") || "–";

    const jefeContactoStr =
      [jefeTel ? `☎ ${jefeTel}` : "", jefeMail ? `✉ ${jefeMail}` : ""].filter(Boolean).join(" · ") || "–";

    const kpiAdminNombreEl = document.getElementById("kpiAdminNombre");
    const kpiAdminContactoEl = document.getElementById("kpiAdminContacto");
    const kpiJefeNombreEl = document.getElementById("kpiJefeNombre");
    const kpiJefeContactoEl = document.getElementById("kpiJefeContacto");

    if (kpiAdminNombreEl) kpiAdminNombreEl.textContent = adminNombre;
    if (kpiAdminContactoEl) kpiAdminContactoEl.textContent = adminContactoStr;
    if (kpiJefeNombreEl) kpiJefeNombreEl.textContent = jefeNombre;
    if (kpiJefeContactoEl) kpiJefeContactoEl.textContent = jefeContactoStr;

    // Contactos en panel ubicación
    const contactoAdminNombreEl = document.getElementById("contactoAdminNombre");
    const contactoAdminTelEl = document.getElementById("contactoAdminTel");
    const contactoAdminCorreoEl = document.getElementById("contactoAdminCorreo");

    const contactoJefeNombreEl = document.getElementById("contactoJefeNombre");
    const contactoJefeTelEl = document.getElementById("contactoJefeTel");
    const contactoJefeCorreoEl = document.getElementById("contactoJefeCorreo");

    if (contactoAdminNombreEl) contactoAdminNombreEl.textContent = clean(contacto["Administrador"]) || "–";
    if (contactoAdminTelEl) contactoAdminTelEl.textContent = clean(contacto["AdmTelef"]) || "–";
    if (contactoAdminCorreoEl) contactoAdminCorreoEl.textContent = clean(contacto["AdmCorreo"]) || "–";

    if (contactoJefeNombreEl) contactoJefeNombreEl.textContent = clean(contacto["JefeAeropuerto"] || contacto["Jefe de Aeropuerto"]) || "–";
    if (contactoJefeTelEl) contactoJefeTelEl.textContent = clean(contacto["JefeTelef"]) || "–";
    if (contactoJefeCorreoEl) contactoJefeCorreoEl.textContent = clean(contacto["JefeCorreo"]) || "–";

    /* ---------- KPI SUPERIOR ---------- */
    const kpiCheckin = document.getElementById("kpiCheckin");
    const kpiPuertas = document.getElementById("kpiPuertas");
    const kpiCintas = document.getElementById("kpiCintas");
    const kpiPSN = document.getElementById("kpiPSN");
    const kpiEstac = document.getElementById("kpiEstac");
    const kpiMangas = document.getElementById("kpiMangas");
    const kpiPSA = document.getElementById("kpiPSA");

    if (kpiCheckin) kpiCheckin.textContent = safeVal(a["Mostradores Check in"]);
    if (kpiPuertas) kpiPuertas.textContent = safeVal(a["PuertasEmbarqueTotal"]);
    if (kpiCintas) kpiCintas.textContent = safeVal(a["CintasTotal"]);
    if (kpiPSN) kpiPSN.textContent = safeVal(a["PSNTotal"]);
    if (kpiEstac) kpiEstac.textContent = safeVal(a["Estacionamiento Vehicular"]);
    if (kpiMangas) kpiMangas.textContent = safeVal(a["Mangas telescópicas"]);
    if (kpiPSA) kpiPSA.textContent = safeVal(a["PSAScanTotal"]);

    /* ---------- EXPLOTACIÓN ---------- */
    const supPredioEl = document.getElementById("supPredio");
    const supConcesionadaEl = document.getElementById("supConcesionadaHa");
    const areasConcesionadasEl = document.getElementById("areasConcesionadas");
    const explotadorEl = document.getElementById("explotador");
    const grupoEl = document.getElementById("grupo");
    const concesionHastaEl = document.getElementById("concesionHasta");
    const codigosEl = document.getElementById("codigos");
    const habilitacionEl = document.getElementById("habilitacion");

    if (supPredioEl) supPredioEl.textContent = safeVal(a["SupPredioHa"]);
    if (supConcesionadaEl) supConcesionadaEl.textContent = safeVal(a["SupConcesionadaHa"]);
    if (areasConcesionadasEl) areasConcesionadasEl.textContent = clean(a["AreasConcesionadas"]) || "–";
    if (explotadorEl) explotadorEl.textContent = clean(a["Explotador"]) || "–";
    if (grupoEl) grupoEl.textContent = clean(a["Grupo"]) || "–";
    if (concesionHastaEl) concesionHastaEl.textContent = clean(a["ConcesionHasta"]) || "–";

    if (codigosEl) {
      const cods = [];
      if (clean(a["OACI"])) cods.push(`OACI: ${clean(a["OACI"])}`);
      if (clean(a["ANAC"])) cods.push(`ANAC: ${clean(a["ANAC"])}`);
      if (clean(a["IATA"])) cods.push(`IATA: ${clean(a["IATA"])}`);
      codigosEl.textContent = cods.length ? cods.join(" · ") : "–";
    }

    if (habilitacionEl) habilitacionEl.textContent = clean(a["Habilitación"]) || "–";

    /* ---------- INVERSIONES 2025–2027 ---------- */
    const inv = inversionesPorIATA[iata] || null;

    const inv2025El = document.getElementById("inv2025");
    const inv2026El = document.getElementById("inv2026");
    const inv2027El = document.getElementById("inv2027");
    const invObras2025El = document.getElementById("invObras2025");
    const invObras2026El = document.getElementById("invObras2026");
    const invObras2027El = document.getElementById("invObras2027");

    if (inv) {
      if (inv2025El) inv2025El.textContent = inv.A2025 ? formatMillions(inv.A2025) : "–";
      if (inv2026El) inv2026El.textContent = inv.A2026 ? formatMillions(inv.A2026) : "–";
      if (inv2027El) inv2027El.textContent = inv.A2027 ? formatMillions(inv.A2027) : "–";

      if (invObras2025El) invObras2025El.innerHTML = (inv.obras2025 && inv.obras2025.length)
        ? inv.obras2025.map((o, idx) => `${idx + 1}) ${o}`).join("<br>")
        : "–";

      if (invObras2026El) invObras2026El.innerHTML = (inv.obras2026 && inv.obras2026.length)
        ? inv.obras2026.map((o, idx) => `${idx + 1}) ${o}`).join("<br>")
        : "–";

      if (invObras2027El) invObras2027El.innerHTML = (inv.obras2027 && inv.obras2027.length)
        ? inv.obras2027.map((o, idx) => `${idx + 1}) ${o}`).join("<br>")
        : "–";
    } else {
      if (inv2025El) inv2025El.textContent = "–";
      if (inv2026El) inv2026El.textContent = "–";
      if (inv2027El) inv2027El.textContent = "–";
      if (invObras2025El) invObras2025El.textContent = "–";
      if (invObras2026El) invObras2026El.textContent = "–";
      if (invObras2027El) invObras2027El.textContent = "–";
    }

    /* ---------- TERMINAL (m² + imagen) ---------- */
    const terminalM2El = document.getElementById("terminalM2");
    if (terminalM2El) terminalM2El.textContent = safeVal(a["TerminalM2"]);

    const imgTerminal = document.getElementById("imgTerminal");
    const terminalProp = clean(a["imagenAeropuerto"]);
    const terminalSrc = terminalProp || (iata ? `img/Terminales/${iata}_terminal.png` : "");

    if (imgTerminal) {
      imgTerminal.style.display = terminalSrc ? "block" : "none";
      imgTerminal.src = terminalSrc;
      imgTerminal.alt = `Terminal del aeropuerto ${nombre}`;
      imgTerminal.onerror = () => {
        imgTerminal.style.display = "none";
      };
    }

    /* ---------- PISTAS (texto) ---------- */
    const orientRaw = clean(a["PistaOrientacion"]);
    const dimsRaw = clean(a["Dimensiones"]);
    const matRaw = clean(a["MaterialPista"]);

    const oriArr = splitField(orientRaw);
    const dimsArr = splitField(dimsRaw);
    const matArr = splitField(matRaw);

    const runways = oriArr.length
      ? oriArr.map((ori, idx) => ({ ori, dim: dimsArr[idx] || "", mat: matArr[idx] || "" }))
      : [];

    const cant = runways.length || (orientRaw ? 1 : 0);

    const badgeCantEl = document.getElementById("badgeCantPistas");
    const pistasSubEl = document.getElementById("pistasSubtitulo");
    const pistasDetalleEl = document.getElementById("pistasDetalle");

    if (cant > 0) {
      if (badgeCantEl) badgeCantEl.textContent = formatNumber(cant);
      if (pistasSubEl) pistasSubEl.textContent = cant === 1 ? "1 pista registrada" : `${formatNumber(cant)} pistas registradas`;
    } else {
      if (badgeCantEl) badgeCantEl.textContent = "–";
      if (pistasSubEl) pistasSubEl.textContent = "Sin información de pistas";
    }

    if (pistasDetalleEl) {
      pistasDetalleEl.innerHTML = "";

      if (runways.length) {
        runways.forEach(r => {
          const row = document.createElement("div");
          row.className = "mov-runway-row";
          row.innerHTML = `
            <span class="mov-runway-orient">Pista ${r.ori}</span>
            <span class="mov-runway-info">
              ${r.dim ? `<span class="runway-chip">${r.dim}</span>` : ""}
              ${r.mat ? `<span class="mov-runway-mat">${r.mat}</span>` : ""}
            </span>
          `;
          pistasDetalleEl.appendChild(row);
        });
      } else if (orientRaw || dimsRaw || matRaw) {
        const row = document.createElement("div");
        row.className = "mov-runway-row";
        row.innerHTML = `
          <span class="mov-runway-orient">${orientRaw ? `Pista ${orientRaw}` : ""}</span>
          <span class="mov-runway-info">
            ${dimsRaw ? `<span class="runway-chip">${dimsRaw}</span>` : ""}
            ${matRaw ? `<span class="mov-runway-mat">${matRaw}</span>` : ""}
          </span>
        `;
        pistasDetalleEl.appendChild(row);
      } else {
        pistasDetalleEl.textContent = "–";
      }
    }

    /* ---------- PSN (texto) ---------- */
    const rawPsnRemC = a["PSNRemotasC"];
    const rawPsnRemC1 = a["PSNRemotasC_1"];
    const rawPsnGen = a["PSN_C"];

    const psnComNum = (Number(rawPsnRemC) || 0) + (Number(rawPsnRemC1) || 0);
    const hasPsnCom = rawPsnRemC !== undefined || rawPsnRemC1 !== undefined;

    const psnGenNum = Number(rawPsnGen);
    const hasPsnGen = rawPsnGen !== undefined && rawPsnGen !== "";

    const psnComEl = document.getElementById("psnCom");
    const psnGenEl = document.getElementById("psnGen");
    const badgePsnTotalEl = document.getElementById("badgePsnTotal");

    if (psnComEl) psnComEl.textContent = (hasPsnCom && !isNaN(psnComNum)) ? formatNumber(psnComNum) : "–";
    if (psnGenEl) psnGenEl.textContent = (hasPsnGen && !isNaN(psnGenNum)) ? formatNumber(psnGenNum) : "–";

    let totalPsn = 0;
    if (hasPsnCom && !isNaN(psnComNum)) totalPsn += psnComNum;
    if (hasPsnGen && !isNaN(psnGenNum)) totalPsn += psnGenNum;

    if (badgePsnTotalEl) badgePsnTotalEl.textContent = totalPsn ? formatNumber(totalPsn) : "–";

    /* ---------- TERMINAL (recorrido) ---------- */
    const terminalM2DupEl = document.getElementById("terminalM2Dup");
    if (terminalM2DupEl) terminalM2DupEl.textContent = safeVal(a["TerminalM2"]);

    const mostradoresEl = document.getElementById("mostradoresCheckin");
    const kioscosEl = document.getElementById("kioscosSelf");
    const psaProxyEl = document.getElementById("psaBadgeProxy");

    if (mostradoresEl) mostradoresEl.textContent = safeVal(a["Mostradores Check in"]);
    if (kioscosEl) kioscosEl.textContent = safeVal(a["Kioscos         (self check In)"]);
    if (psaProxyEl) psaProxyEl.textContent = safeVal(a["PSAScanTotal"]);

    // PSA inter/cabotaje
    const interEl = document.getElementById("psaInter");
    const cabotEl = document.getElementById("psaCabot");
    if (interEl) interEl.textContent = safeVal(a["PSAScanInter"]);
    if (cabotEl) cabotEl.textContent = safeVal(a["PSAScanCabot"]);

    // Aduana
    const aduanaEl = document.getElementById("aduanaPuestos");
    if (aduanaEl) aduanaEl.textContent = safeVal(a["Puestos de Aduanas"]);

    // Migraciones
    const migrTotEl = document.getElementById("migracionesTotal");
    if (migrTotEl) migrTotEl.textContent = safeVal(a["PuestosMigracionesTot"]);

    const migrDetEl = document.getElementById("migracionesDetalle");
    if (migrDetEl) {
      const parts = [];
      if (a["PuestosMigracionesPartidas"]) parts.push(`Partidas: ${safeVal(a["PuestosMigracionesPartidas"])}`);
      if (a["PuestosMigracionesArribos"]) parts.push(`Arribos: ${safeVal(a["PuestosMigracionesArribos"])}`);
      migrDetEl.textContent = parts.length ? parts.join(" · ") : "–";
    }

    // Puertas
    const puertasTotalEl = document.getElementById("puertasTotal");
    if (puertasTotalEl) puertasTotalEl.textContent = safeVal(a["PuertasEmbarqueTotal"]);

    const puertasDetalleEl = document.getElementById("puertasDetalle");
    if (puertasDetalleEl) {
      const puertasDetalle = [];
      if (a["PuertasEmbarqueInter"]) puertasDetalle.push(`Internacional: ${a["PuertasEmbarqueInter"]}`);
      if (a["PuertasEmbarqueCabot"]) puertasDetalle.push(`Cabotaje: ${a["PuertasEmbarqueCabot"]}`);
      if (a["PuertasEmbarqueFlex"]) puertasDetalle.push(`Flex: ${a["PuertasEmbarqueFlex"]}`);
      puertasDetalleEl.textContent = puertasDetalle.length ? puertasDetalle.join(" · ") : "–";
    }

    // Mangas
    const mangasEl = document.getElementById("mangas");
    if (mangasEl) mangasEl.textContent = safeVal(a["Mangas telescópicas"]);

    // Cintas
    const cintasTotalEl = document.getElementById("cintasTotal");
    if (cintasTotalEl) cintasTotalEl.textContent = safeVal(a["CintasTotal"]);

    const cintasDetalleEl = document.getElementById("cintasDetalle");
    if (cintasDetalleEl) {
      const det = [];
      if (a["CintasInter"]) det.push(`Internacional: ${a["CintasInter"]}`);
      if (a["CintasCabot"]) det.push(`Cabotaje: ${a["CintasCabot"]}`);
      if (a["CintasFlex"]) det.push(`Flex: ${a["CintasFlex"]}`);
      cintasDetalleEl.textContent = det.length ? det.join(" · ") : "–";
    }

    // Estacionamiento y carritos
    const estacionamientoEl = document.getElementById("estacionamiento");
    const carritosEl = document.getElementById("carritos");
    if (estacionamientoEl) estacionamientoEl.textContent = safeVal(a["Estacionamiento Vehicular"]);
    if (carritosEl) carritosEl.textContent = safeVal(a["Carritos porta equipajes"]);

    /* ---------- UBICACIÓN ---------- */
    const ubicacionTextEl = document.getElementById("ubicacionText");
    const distanciaCentroEl = document.getElementById("distanciaCentro");
    const horarioEl = document.getElementById("horarioOperacion");

    const loc = `${clean(a["Localidad"])} · ${clean(a["Provincia"])}`.replace(/^ · | · $/g, "");
    if (ubicacionTextEl) ubicacionTextEl.textContent = loc || "–";

    const dist = a["Distancia al centro de la ciudad (km)"];
    if (distanciaCentroEl) distanciaCentroEl.textContent = dist ? `${formatNumber(dist)} km` : "–";

    if (horarioEl) horarioEl.textContent = clean(a["Horario de operación"]) || "–";

    /* ---------- TRANSPORTE (KPI texto + visibilidad caja) ---------- */
    const transpBox = document.querySelector(".transporte-kpi");
    const transpLines = document.getElementById("transporteLineas");
    const transpInfo = transportePorIATA[iata] || null;

    const hasCSVInfo = transpInfo && (clean(transpInfo.linea) !== "" || clean(transpInfo.parada) !== "");
    const hasParadasGeoJSON = (paradasFeatures || []).some(f => {
      const code = String(f.properties?.IATA || "").trim().toUpperCase();
      return code === iata;
    });

    if (transpBox) {
      if (hasCSVInfo || hasParadasGeoJSON) {
        transpBox.style.display = "flex";

        if (transpLines) {
          if (hasCSVInfo) {
            const partes = [];
            if (clean(transpInfo.linea)) partes.push(`Líneas: ${transpInfo.linea}`);
            if (clean(transpInfo.parada)) partes.push(`Parada: ${transpInfo.parada}`);
            transpLines.innerHTML = partes.join("<br>");
          } else {
            transpLines.textContent = "Paradas de colectivo registradas en el mapa.";
          }
        }
      } else {
        transpBox.style.display = "none";
        if (transpLines) transpLines.textContent = "–";
      }
    }

    /* ---------- EMPLEO + POBLACIÓN ---------- */
    const empDirRaw = a["EmpleoDirecto2024"];
    const empDirNum = Number(
      typeof empDirRaw === "string"
        ? empDirRaw.replace(/\./g, "").replace(/,/g, ".")
        : empDirRaw
    );

    const empIndNum = !isNaN(empDirNum) ? Math.round(empDirNum * EMP_IND_MULT) : null;

    const empleoDirectoEl = document.getElementById("empleoDirecto");
    const empleoIndirectoEl = document.getElementById("empleoIndirecto");
    const poblacionEl = document.getElementById("poblacionInfluencia");

    if (empleoDirectoEl) empleoDirectoEl.textContent = (!isNaN(empDirNum) && empDirNum !== null) ? formatNumber(empDirNum) : "–";
    if (empleoIndirectoEl) empleoIndirectoEl.textContent = (empIndNum !== null && !isNaN(empIndNum)) ? formatNumber(empIndNum) : "–";

    const pobRaw = a["Población del Área de Influencia (Censo 2022)"];
    if (poblacionEl) poblacionEl.textContent = safeVal(pobRaw);

    /* ---------- SERVICIOS Y AYUDAS ---------- */
    const radioChipsEl = document.getElementById("radioayudasChips");
    const ayudasEl = document.getElementById("ayudasVisuales");
    const awosEl = document.getElementById("awos");

    const radioRaw = clean(a["Radioayudas"]);
    const radioItems = splitField(radioRaw.replace(/,/g, ";"));
    setChipList(radioChipsEl, radioItems);
    setText(ayudasEl, clean(a["Ayudas visuales"]), "Sin dato");

    if (awosEl) {
      const awosVal = clean(a["AWOS"]) || "Sin dato";
      awosEl.textContent = awosVal;
      const awosNorm = awosVal.toLowerCase();
      const isActive = awosVal !== "Sin dato" && !/^no/.test(awosNorm) && awosNorm !== "n/a";
      awosEl.classList.toggle("is-active", isActive);
      awosEl.classList.toggle("is-muted", !isActive);
    }

    const operadorCargasEl = document.getElementById("operadorCargas");
    const terminalCargasM2El = document.getElementById("terminalCargasM2");
    const terminalCargasUnitEl = document.getElementById("terminalCargasUnit");

    const operadorCargasVal = clean(a["OperadorCargas"]);
    setText(operadorCargasEl, operadorCargasVal || "No registra", "No registra");

    const termRaw = a["TerminalCargasM2"];
    const termText = safeVal(termRaw);
    const hasTerm = termText !== "–" && termText !== "0";
    if (terminalCargasM2El) terminalCargasM2El.textContent = hasTerm ? termText : "No registra";
    if (terminalCargasUnitEl) terminalCargasUnitEl.style.display = hasTerm ? "inline" : "none";

    const avgasEl = document.getElementById("aeroplantaAvgas");
    const jp1El = document.getElementById("aeroplantaJp1");
    setText(avgasEl, clean(a["Aeroplantas AV GAS"]) || "No", "No");
    setText(jp1El, clean(a["Aeroplantas JP1"]) || "No", "No");

    const claveRefEl = document.getElementById("claveRef");
    const categoriaEl = document.getElementById("categoriaSEI");
    setText(claveRefEl, clean(a["CLAVE DE REFERENCIA DE AERÓDROMO"]), "–");
    setText(categoriaEl, clean(a["CATEGORÍA SEI NORMAL"]), "–");

    /* ---------- PASAJEROS (SERIE MENSUAL) ---------- */
renderPasajerosPanel(iata);
    renderPaxPatterns(iata);
    renderPaxRanking(iata);

    /* ---------- FOOTER ---------- */
    const footerNoteEl = document.getElementById("footerNote");
    if (footerNoteEl) footerNoteEl.textContent = `Fuente: ORSNA – Datos básicos por aeropuerto · Año ${a["Año"] || ""}.`;

    /* ---------- MAPAS ---------- */
    updateMapForAirport(a);
    updatePSNMapForAirport(a);
    updateUbicacionMapForAirport(a);
    updateTransporteMapForAirport(a);
    updateInfluenciaMapForAirport(a);
  }

  /* ============================================================
     I. CARGA DE DATOS (GeoJSON + CSV)
     ============================================================ */

  async function loadData() {
    try {
      // 1) Datos principales
      const resp = await fetch("fuentes/Datos_aeropuertos.geojson");
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
          const nombre = clean(p["Aeropuerto"]) || clean(p["Nombre del Aeropuerto"]) || p.IATA;
          opt.value = p.IATA;
          opt.textContent = `${nombre} (${p.IATA})`;
          selectEl.appendChild(opt);
        });
      }

      // 2) Polígonos aeropuertos
      try {
        const respPoly = await fetch("fuentes/poligonos_aeropuertos.geojson");
        const gjPoly = await respPoly.json();
        poligonos = gjPoly.features || [];
      } catch (e) {
        console.warn("No se pudieron cargar los polígonos de aeropuertos:", e);
        poligonos = [];
      }

      // 3) PSN
      try {
        const respPSN = await fetch("fuentes/psn_posiciones.geojson");
        const gjPSN = await respPSN.json();
        psnFeatures = gjPSN.features || [];
      } catch (e) {
        console.warn("No se pudieron cargar las posiciones de estacionamiento:", e);
        psnFeatures = [];
      }

      // 4) Pistas
      try {
        const respPistas = await fetch("fuentes/pistas.geojson");
        const gjPistas = await respPistas.json();
        pistasFeatures = gjPistas.features || [];
      } catch (e) {
        console.warn("No se pudieron cargar las pistas:", e);
        pistasFeatures = [];
      }

      // 5) Provincias
      try {
        const respProv = await fetch("fuentes/provincias.geojson");
        const gjProv = await respProv.json();
        provinciasFeatures = gjProv.features || [];
      } catch (e) {
        console.warn("No se pudieron cargar las provincias:", e);
        provinciasFeatures = [];
      }

      // 6) Contactos
      try {
        const respContactos = await fetch("fuentes/Datos_aeropuertos_contactos.geojson");
        const gjContactos = await respContactos.json();
        (gjContactos.features || []).forEach(f => {
          const p = f.properties || {};
          const code = p.IATA;
          if (code) contactosPorIATA[String(code).toUpperCase()] = p;
        });
      } catch (e) {
        console.warn("No se pudieron cargar los contactos de aeropuertos:", e);
        contactosPorIATA = {};
      }

      // 7) Inversiones
      try {
        const respInv = await fetch("fuentes/Programacion_por_aeropuerto_aprobada2025_web.csv");
        const textInv = await respInv.text();
        inversionesPorIATA = parseInversionesCSV(textInv);
      } catch (e) {
        console.warn("No se pudieron cargar las inversiones por aeropuerto:", e);
        inversionesPorIATA = {};
      }

      // 8) Transporte (CSV)
      try {
        const respTransp = await fetch("fuentes/Paradasapp.csv");
        const textTransp = await respTransp.text();
        transportePorIATA = parseTransporteCSV(textTransp);
      } catch (e) {
        console.warn("No se pudieron cargar las líneas de transporte público:", e);
        transportePorIATA = {};
      }

      // 9) Paradas (GeoJSON)
      try {
        const respParadas = await fetch("fuentes/paradasapp.geojson");
        const gjParadas = await respParadas.json();
        paradasFeatures = gjParadas.features || [];
      } catch (e) {
        console.warn("No se pudieron cargar las paradas de transporte:", e);
        paradasFeatures = [];
      }

      // 10) Terminales (GeoJSON)
      try {
        const respTerm = await fetch("fuentes/terminalpax.geojson");
        const gjTerm = await respTerm.json();
        terminalesFeatures = gjTerm.features || [];
      } catch (e) {
        console.warn("No se pudieron cargar las terminales:", e);
        terminalesFeatures = [];
      }

      // 11) Áreas de influencia (GeoJSON)
      try {
        const respAreas = await fetch("fuentes/Areasinfluencia39.geojson");
        const gjAreas = await respAreas.json();
        areasInfluenciaFeatures = gjAreas.features || [];
      } catch (e) {
        console.warn("No se pudieron cargar las áreas de influencia:", e);
        areasInfluenciaFeatures = [];
      }

      // 12) Pasajeros mensuales (CSV)
      try {
        const respPax = await fetch("fuentes/pasajeros_aeropuerto_mensual.csv");
        const textPax = await respPax.text();
        pasajerosMensualRows = parsePasajerosMensualCSV(textPax);
      } catch (e) {
        console.warn("No se pudieron cargar los pasajeros mensuales:", e);
        pasajerosMensualRows = [];
      }

      // Inicial (URL ?airport=)
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("airport");

      let initial = aeropuertos[0]?.IATA;
      if (fromUrl && aeropuertos.find(x => String(x.IATA) === String(fromUrl))) {
        initial = fromUrl;
      }

      if (initial && selectEl) {
        selectEl.value = initial;
        renderAirport(initial);
      }

      // Cambio selector
      if (selectEl) {
        selectEl.addEventListener("change", (e) => {
          const value = e.target.value;
          if (!value) return;

          renderAirport(value);

          // persiste en URL
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
     J. MODAL: ACLARACIÓN METODOLÓGICA (ROBUSTO)
     ============================================================ */

  function initModalImpacto() {
    const btnInfo = document.getElementById("btnInfoImpacto");
    const modalImpacto = document.getElementById("modalImpacto");
    if (!btnInfo || !modalImpacto) return;

    const open = () => {
      modalImpacto.classList.add("is-open");
      modalImpacto.setAttribute("aria-hidden", "false");

      // mejora: focus al card si existe
      const card = modalImpacto.querySelector(".modal-card");
      if (card) card.focus();
    };

    const close = () => {
      modalImpacto.classList.remove("is-open");
      modalImpacto.setAttribute("aria-hidden", "true");
      btnInfo.focus();
    };

    // abrir
    btnInfo.addEventListener("click", open);

    // cerrar con botones
    modalImpacto.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", close);
    });

    // cerrar clic fondo
    modalImpacto.addEventListener("click", (e) => {
      if (e.target === modalImpacto) close();
    });

    // cerrar con ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalImpacto.classList.contains("is-open")) {
        close();
      }
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

        const mapType = btn.dataset.map; // "transporte" | "influencia"
        const url = `mapa_${mapType}.html?airport=${encodeURIComponent(iata)}`;
        window.open(url, "_blank");
      });
    });

    // Flechas del carrusel KPI
    const kpiStrip = document.querySelector(".kpi-strip");
    const arrowLeft = document.querySelector(".kpi-arrow-left");
    const arrowRight = document.querySelector(".kpi-arrow-right");

    if (kpiStrip && arrowLeft && arrowRight) {
      const scrollAmount = 220;
      arrowLeft.addEventListener("click", () => {
        kpiStrip.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      });
      arrowRight.addEventListener("click", () => {
        kpiStrip.scrollBy({ left: scrollAmount, behavior: "smooth" });
      });
    }
  });


  
})();
