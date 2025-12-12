// js/datos-clave.js
// Lógica de "datos-clave.html" separada a archivo externo

/* global L */

(() => {
  'use strict';

  /* ============================================
     A. VARIABLES GLOBALES
     ============================================ */
  let aeropuertos = [];
  let poligonos = [];
  let psnFeatures = [];
  let pistasFeatures = [];
  let contactosPorIATA = {};
  let inversionesPorIATA = {};
  let transportePorIATA = {};
  let paradasFeatures = [];
  let terminalesFeatures = [];
  let empleoPorIATA = {};
  let poblacionPorIATA = {};
  let provinciasFeatures = [];
  let areasInfluenciaFeatures = [];
  let influenciaLegend = null;   // ← NUEVO

  
  let selectEl = null;

  let map, mapMarker, poligonoLayer;
  let mapPSN, psnLayer, pistasLayerPSN;
  let mapUbicacion, ubicacionMarker, provinciasLayer;
  let mapTransporte, transporteLayer;
  let mapInfluencia, tiemposLayer, influenciaLayer, influenciaMarker;

  const EMP_IND_MULT = 5.8;

  const airportIcon = L.icon({
    iconUrl: "img/icons/AeropuertosSNA.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    tooltipAnchor: [0, -18]
  });

  /* ============================================
     B. HELPERS DE FORMATEO Y UTILIDADES
     ============================================ */
  function formatNumber(n) {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "–";
    return Number(n).toLocaleString("es-AR");
  }

  function clean(text) {
    if (text === null || text === undefined) return "";
    return String(text).trim();
  }

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

    let lat = a["Lat"] || a["LAT"];
    let lon = a["Lon"] || a["LON"] || a["Long"];

    if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      return [Number(lat), Number(lon)];
    }

    return null;
  }

  /* ============================================
     C. INICIALIZACIÓN DE MAPAS LEAFLET
     ============================================ */
  function initMap() {
    // 1) Mapa de predio
    map = L.map("mapPredio").setView([-34.6, -58.4], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    mapMarker = L.marker([-34.6, -58.4]).addTo(map);

    // 2) Mapa de PSN (satélite)
    mapPSN = L.map("mapPSN").setView([-34.6, -58.4], 5);
    L.esri.basemapLayer("Imagery").addTo(mapPSN);

    // 3) Mapa de ubicación nacional
    const mapUbDiv = document.getElementById("mapUbicacion");
    if (mapUbDiv) {
      mapUbDiv.style.height = "450px";
    }

    mapUbicacion = L.map("mapUbicacion", {
      zoomControl: true
    }).setView([-38, -64], 4);

    L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      {
        maxZoom: 14,
        tms: true,
        attribution: "© IGN Argentina - Argenmap"
      }
    ).addTo(mapUbicacion);

    // 4) Mapa de transporte público (paradas de colectivo)
    mapTransporte = L.map("mapTransporte").setView([-34.6, -58.4], 5);

    // Panes personalizados para controlar el orden de dibujo
    mapTransporte.createPane("pane_terminales");
    mapTransporte.getPane("pane_terminales").style.zIndex = 300;

    mapTransporte.createPane("pane_paradas");
    mapTransporte.getPane("pane_paradas").style.zIndex = 400;

    // Capa base
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapTransporte);

    // 5) Mapa de área de influencia / tiempos de viaje
    mapInfluencia = L.map("mapInfluencia").setView([-38, -64], 4);

    L.tileLayer(
      "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
      {
        maxZoom: 14,
        tms: true,
        attribution: "© IGN Argentina - Argenmap"
      }
    ).addTo(mapInfluencia);
  }

  /* ============================================
     D. ACTUALIZACIÓN DE MAPA DEL PREDIO
     ============================================ */
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

        if (mapMarker) {
          map.removeLayer(mapMarker);
        }
        return;
      }
    }

    let lat = a["Lat"] || a["LAT"];
    let lon = a["Lon"] || a["LON"] || a["Long"];

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
      if (mapMarker) {
        mapMarker.setLatLng([-34.6, -58.4]).addTo(map);
      }
    }
  }

  /* ============================================
     E. MAPA POSICIONES (PSN) + PISTAS
     ============================================ */
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

    let featsPSN = [];
    if (psnFeatures.length) {
      featsPSN = psnFeatures.filter(f => {
        const props = f.properties || {};
        const code = props.IATA || props.iata || props.iata_code;
        return String(code).toUpperCase() === String(iata).toUpperCase();
      });
    }

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

    let featsPistas = [];
    if (pistasFeatures.length) {
      featsPistas = pistasFeatures.filter(f => {
        const props = f.properties || {};
        const code = props.IATA || props.iata || props.iata_code;
        return String(code).toUpperCase() === String(iata).toUpperCase();
      });
    }

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

    let bounds = null;

    if (psnLayer) {
      const b1 = psnLayer.getBounds();
      if (b1.isValid()) bounds = b1;
    }

    if (pistasLayerPSN) {
      const b2 = pistasLayerPSN.getBounds();
      if (b2.isValid()) {
        if (bounds) bounds.extend(b2);
        else bounds = b2;
      }
    }

    if (bounds && bounds.isValid()) {
      setTimeout(() => {
        mapPSN.invalidateSize();
        mapPSN.fitBounds(bounds, { padding: [5, 5] });
      }, 0);
      return;
    }

    let lat = a["Lat"] || a["LAT"];
    let lon = a["Lon"] || a["LON"] || a["Long"];

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

  /* ============================================
     F. MAPA DE UBICACIÓN NACIONAL
     ============================================ */
  function updateUbicacionMapForAirport(a) {
    if (!mapUbicacion) return;

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

    if (ubicacionMarker) {
      mapUbicacion.removeLayer(ubicacionMarker);
      ubicacionMarker = null;
    }

    const center = getAirportCenterLatLng(a);

    if (center) {
      const [latNum, lonNum] = center;

      ubicacionMarker = L.marker([latNum, lonNum], {
        icon: airportIcon
      }).addTo(mapUbicacion);

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
      setTimeout(() => {
        mapUbicacion.invalidateSize();
      }, 0);
    }
  }

  /* ============================================
     F2. MAPA DE TRANSPORTE PÚBLICO
     ============================================ */
  function updateTransporteMapForAirport(a) {
    if (!mapTransporte) return;

    if (transporteLayer) {
      mapTransporte.removeLayer(transporteLayer);
      transporteLayer = null;
    }

    const iataUpper = String(a.IATA || "").trim().toUpperCase();
    if (!iataUpper) return;

    // 1) Paradas (puntos)
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

    // 2) Terminales (polígonos)
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
              const name =
                feature.properties?.etiqueta ||
                feature.properties?.tipo ||
                "Terminal";
              layer.bindTooltip(name, {
                permanent: false,
                direction: "center",
                className: "terminal-label"
              });
            }
          })
        : null;

    // 3) Layer group combinado
    transporteLayer = L.layerGroup();
    if (terminalesLayer) transporteLayer.addLayer(terminalesLayer);
    if (paradasLayer) transporteLayer.addLayer(paradasLayer);
    transporteLayer.addTo(mapTransporte);

    // 4) Bounds combinados
    let bounds = null;

    if (terminalesLayer) {
      const b = terminalesLayer.getBounds();
      if (b.isValid()) bounds = b;
    }

    if (paradasLayer) {
      const b = paradasLayer.getBounds();
      if (b.isValid()) {
        if (bounds) bounds.extend(b);
        else bounds = b;
      }
    }

    // 5) Fit bounds
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

/* ============================================
   F3. MAPA DE ÁREA DE INFLUENCIA / TIEMPOS DE VIAJE
   ============================================ */
async function updateInfluenciaMapForAirport(a) {
  if (!mapInfluencia) return;

  // Limpiar capas previas
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

  // Limpiar leyenda previa si existe
  if (influenciaLegend) {
    mapInfluencia.removeControl(influenciaLegend);
    influenciaLegend = null;
  }

  const iataUpper = String(a.IATA || "").trim().toUpperCase();
  if (!iataUpper) return;

  const center = getAirportCenterLatLng(a) || [-38, -64];

  /* --------------------------------------------
     1) Tiempos de viaje (anillos 1h / 2h / 3h)
     -------------------------------------------- */
  const tiemposPath = `img/Tiempos/Tiempos_${iataUpper}.geojson`;

  try {
    const resp = await fetch(tiemposPath);
    if (resp.ok) {
      const gj = await resp.json();
      if (gj && gj.features && gj.features.length) {
        tiemposLayer = L.geoJSON(gj, {
          style: (feature) => {
            const props = feature.properties || {};
            // Tomamos ToBreak y lo forzamos a número
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
            if (to === 60) {
              color = "#08306b";   // 1 hora (más oscuro)
            } else if (to === 120) {
              color = "#2171b5";   // 2 horas
            } else if (to === 180) {
              color = "#6baed6";   // 3 horas (más claro)
            } else {
              color = "#9ecae1";   // fallback por si aparece algún otro valor
            }

            return {
              color: color,        // borde
              weight: 1,
              fillColor: color,    // mismo color en relleno
              fillOpacity: 0.35    // todo semitransparente
            };
          }
        }).addTo(mapInfluencia);
      }
    }
  } catch (e) {
    console.warn("No se pudo cargar tiempos de viaje para", iataUpper, e);
  }

  /* --------------------------------------------
     2) Áreas de influencia (polígono azul)
     -------------------------------------------- */
  if (areasInfluenciaFeatures && areasInfluenciaFeatures.length) {
    const featsInfl = areasInfluenciaFeatures.filter(f => {
      const code = String(
        f.properties?.IATA || f.properties?.iata || ""
      ).trim().toUpperCase();
      return code === iataUpper;
    });

    if (featsInfl.length) {
      influenciaLayer = L.geoJSON(featsInfl, {
        style: {
          color: "#FFD700",     // borde amarillo
          weight: 2,
          /*fillColor: "#bfdbfe",*/
          dashArray: "6 4",     // línea segmentada
          fillOpacity: 0.0  // sin relleno
        }
      }).addTo(mapInfluencia);
    }
  }

  /* --------------------------------------------
     3) Punto del aeropuerto (como en mapa de ubicación)
     -------------------------------------------- */
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

  /* --------------------------------------------
     4) Ajustar vista combinando todo
     -------------------------------------------- */
  let bounds = null;

  if (tiemposLayer) {
    const b = tiemposLayer.getBounds();
    if (b.isValid()) bounds = b;
  }

  if (influenciaLayer) {
    const b = influenciaLayer.getBounds();
    if (b.isValid()) {
      if (bounds) bounds.extend(b);
      else bounds = b;
    }
  }

  if (influenciaMarker) {
    const mLatLng = influenciaMarker.getLatLng();
    const b = L.latLngBounds(mLatLng, mLatLng);
    if (bounds) bounds.extend(b);
    else bounds = b;
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

  /* --------------------------------------------
     5) Leyenda de los anillos (1h / 2h / 3h)
     -------------------------------------------- */
  influenciaLegend = L.control({ position: "bottomright" });

  influenciaLegend.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");

    // Estilos inline para no tocar CSS si no querés
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


  /* ============================================
     G. PARSEO CSV DE INVERSIONES POR AEROPUERTO
     ============================================ */
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

    Object.keys(result).forEach(iata => {
      ["obras2025", "obras2026", "obras2027"].forEach(k => {
        result[iata][k] = [...new Set(result[iata][k])];
      });
    });

    return result;
  }

  /* ============================================
     Helper: TRANSPORTE PÚBLICO (CSV Paradasapp)
     ============================================ */
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
    if (idxPARADA === -1) {
      idxPARADA = headers.indexOf("PARADAAEP");
    }

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

      result[iata] = {
        linea,
        parada
      };
    }

    return result;
  }

  /* ============================================
     H. RENDER PRINCIPAL DEL AEROPUERTO SELECCIONADO
     ============================================ */
  function renderAirport(iataCode) {
    const a = aeropuertos.find(x => x.IATA === iataCode);
    if (!a) return;

// ===============================
// TÍTULO PRINCIPAL DEL AEROPUERTO
// ===============================
let tituloFinal = "";

// Nombre oficial largo (si existe)
const nombreOficial =
  clean(a["Nombre del Aeropuerto"]) ||
  clean(a["Aeropuerto"]);

// Casos especiales
if (a.IATA === "AEP") {
  // Aeroparque no lleva "Aeropuerto de"
  tituloFinal = `Aeroparque Jorge Newbery (AEP)`;
} else if (nombreOficial && nombre !== nombreOficial) {
  // Caso general: Nombre corto + IATA + nombre oficial
  tituloFinal = `${nombre} (${a.IATA}) – ${nombreOficial}`;
} else {
  // Fallback limpio
  tituloFinal = `${nombre} (${a.IATA})`;
}

document.getElementById("pageTitle").textContent = tituloFinal;


    // Encabezados
    document.getElementById("hdrSuperficie").innerHTML =
      `Explotación <small>${tituloAeroSeccion}</small>`;
    document.getElementById("hdrMovimiento").innerHTML =
      `Área de movimiento <small>${tituloAeroSeccion}</small>`;
    document.getElementById("hdrTerminal").innerHTML =
      `Terminal de pasajeros <small>${tituloAeroSeccion}</small>`;
    document.getElementById("hdrUbicacion").innerHTML =
      `Ubicación y accesibilidad <small>${tituloAeroSeccion}</small>`;
    document.getElementById("hdrEmpleo").innerHTML =
      `Impacto territorial del aeropuerto <small>${tituloAeroSeccion}</small>`;
    document.getElementById("hdrServicios").innerHTML =
      `Servicios y ayudas <small>${tituloAeroSeccion}</small>`;

    // Título principal


   // document.getElementById("pageSubtitle").textContent = 
    //  `Sistema Nacional de Aeropuertos · Datos Clave ${a["Año"] || ""}`;

        /* ----- CONTACTO ----- */
    const contacto = contactosPorIATA[String(a.IATA).toUpperCase()] || {};
    

    
    /* ----- KPI SUPERIOR ----- */
    document.getElementById("kpiCheckin").textContent =
      safeVal(a["Mostradores Check in"]);
    document.getElementById("kpiPuertas").textContent =
      safeVal(a["PuertasEmbarqueTotal"]);
    document.getElementById("kpiCintas").textContent =
      safeVal(a["CintasTotal"]);
    document.getElementById("kpiPSN").textContent =
      safeVal(a["PSNTotal"]);
    document.getElementById("kpiEstac").textContent =
      safeVal(a["Estacionamiento Vehicular"]);
    document.getElementById("kpiMangas").textContent =
      safeVal(a["Mangas telescópicas"]);
    document.getElementById("kpiPSA").textContent =
      safeVal(a["PSAScanTotal"]);

    /* ----- EXPLOTACIÓN ----- */
    document.getElementById("supPredio").textContent =
      safeVal(a["SupPredioHa"]);
    document.getElementById("supConcesionadaHa").textContent =
      safeVal(a["SupConcesionadaHa"]);
    document.getElementById("areasConcesionadas").textContent =
      clean(a["AreasConcesionadas"]) || "–";
    document.getElementById("explotador").textContent =
      clean(a["Explotador"]) || "–";
    document.getElementById("grupo").textContent =
      clean(a["Grupo"]) || "–";
    document.getElementById("concesionHasta").textContent =
      clean(a["ConcesionHasta"]) || "–";

    const cods = [];
    if (clean(a["OACI"])) cods.push(`OACI: ${clean(a["OACI"])}`);
    if (clean(a["ANAC"])) cods.push(`ANAC: ${clean(a["ANAC"])}`);
    if (clean(a["IATA"])) cods.push(`IATA: ${clean(a["IATA"])}`);
    document.getElementById("codigos").textContent =
      cods.length ? cods.join(" · ") : "–";

    document.getElementById("habilitacion").textContent =
      clean(a["Habilitación"]) || "–";

    /* ----- INVERSIONES 2025–2027 ----- */
    const inv = inversionesPorIATA[String(a.IATA).toUpperCase()] || null;

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

      if (invObras2025El) {
        if (inv.obras2025 && inv.obras2025.length) {
          invObras2025El.innerHTML = inv.obras2025
            .map((o, idx) => `${idx + 1}) ${o}`)
            .join("<br>");
        } else {
          invObras2025El.textContent = "–";
        }
      }

      if (invObras2026El) {
        if (inv.obras2026 && inv.obras2026.length) {
          invObras2026El.innerHTML = inv.obras2026
            .map((o, idx) => `${idx + 1}) ${o}`)
            .join("<br>");
        } else {
          invObras2026El.textContent = "–";
        }
      }

      if (invObras2027El) {
        if (inv.obras2027 && inv.obras2027.length) {
          invObras2027El.innerHTML = inv.obras2027
            .map((o, idx) => `${idx + 1}) ${o}`)
            .join("<br>");
        } else {
          invObras2027El.textContent = "–";
        }
      }
    } else {
      if (inv2025El) inv2025El.textContent = "–";
      if (inv2026El) inv2026El.textContent = "–";
      if (inv2027El) inv2027El.textContent = "–";
      if (invObras2025El) invObras2025El.textContent = "–";
      if (invObras2026El) invObras2026El.textContent = "–";
      if (invObras2027El) invObras2027El.textContent = "–";
    }

    /* ----- TERMINAL (m² + imagen) ----- */
    document.getElementById("terminalM2").textContent =
      safeVal(a["TerminalM2"]);

    const imgTerminal = document.getElementById("imgTerminal");
    const iataUpper = String(a.IATA || "").toUpperCase();
    const terminalProp = clean(a["imagenAeropuerto"]);
    const terminalSrc = terminalProp || (iataUpper ? `img/Terminales/${iataUpper}_terminal.png` : "");

    imgTerminal.style.display = terminalSrc ? "block" : "none";
    imgTerminal.src = terminalSrc;
    imgTerminal.alt = `Terminal del aeropuerto ${nombre}`;
    imgTerminal.onerror = () => {
      imgTerminal.style.display = "none";
    };

    /* ----- PISTAS ----- */
    const orientRaw = clean(a["PistaOrientacion"]);
    const dimsRaw = clean(a["Dimensiones"]);
    const matRaw = clean(a["MaterialPista"]);

    const oriArr = splitField(orientRaw);
    const dimsArr = splitField(dimsRaw);
    const matArr = splitField(matRaw);

    const runways = oriArr.length
      ? oriArr.map((ori, idx) => ({
          ori,
          dim: dimsArr[idx] || "",
          mat: matArr[idx] || ""
        }))
      : [];

    const cant = runways.length || (orientRaw ? 1 : 0);
    const badgeCantEl = document.getElementById("badgeCantPistas");
    const pistasSubEl = document.getElementById("pistasSubtitulo");
    const pistasDetalleEl = document.getElementById("pistasDetalle");

    if (cant > 0) {
      if (badgeCantEl) badgeCantEl.textContent = formatNumber(cant);
      if (pistasSubEl) {
        pistasSubEl.textContent = cant === 1
          ? "1 pista registrada"
          : `${formatNumber(cant)} pistas registradas`;
      }
    } else {
      if (badgeCantEl) badgeCantEl.textContent = "–";
      if (pistasSubEl) pistasSubEl.textContent = "Sin información de pistas";
    }

    pistasDetalleEl.innerHTML = "";

    if (runways.length) {
      runways.forEach(r => {
        const row = document.createElement("div");
        row.className = "mov-runway-row";

        const dimText = r.dim || "";
        const matText = r.mat || "";

        row.innerHTML = `
          <span class="mov-runway-orient">Pista ${r.ori}</span>
          <span class="mov-runway-info">
            ${dimText ? `<span class="runway-chip">${dimText}</span>` : ""}
            ${matText ? `<span class="mov-runway-mat">${matText}</span>` : ""}
          </span>
        `;
        pistasDetalleEl.appendChild(row);
      });
    } else if (orientRaw || dimsRaw || matRaw) {
      const row = document.createElement("div");
      row.className = "mov-runway-row";

      const dimText = dimsRaw || "";
      const matText = matRaw || "";
      const oriText = orientRaw ? `Pista ${orientRaw}` : "";

      row.innerHTML = `
        <span class="mov-runway-orient">${oriText}</span>
        <span class="mov-runway-info">
          ${dimText ? `<span class="runway-chip">${dimText}</span>` : ""}
          ${matText ? `<span class="mov-runway-mat">${matText}</span>` : ""}
        </span>
      `;
      pistasDetalleEl.appendChild(row);
    } else {
      pistasDetalleEl.textContent = "–";
    }

    /* ----- PSN ----- */
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

    if (psnComEl) {
      psnComEl.textContent =
        hasPsnCom && !isNaN(psnComNum) ? formatNumber(psnComNum) : "–";
    }

    if (psnGenEl) {
      psnGenEl.textContent =
        hasPsnGen && !isNaN(psnGenNum) ? formatNumber(psnGenNum) : "–";
    }

    let totalPsn = 0;
    if (hasPsnCom && !isNaN(psnComNum)) totalPsn += psnComNum;
    if (hasPsnGen && !isNaN(psnGenNum)) totalPsn += psnGenNum;

    if (badgePsnTotalEl) {
      badgePsnTotalEl.textContent =
        totalPsn ? formatNumber(totalPsn) : "–";
    }

    /* ----- TERMINAL (recorrido) ----- */
    document.getElementById("terminalM2Dup").textContent =
      safeVal(a["TerminalM2"]);
    document.getElementById("mostradoresCheckin").textContent =
      safeVal(a["Mostradores Check in"]);
    document.getElementById("kioscosSelf").textContent =
      safeVal(a["Kioscos         (self check In)"]);
    document.getElementById("psaBadgeProxy").textContent =
      safeVal(a["PSAScanTotal"]);

    // PSA inter / cabotaje
    const interEl = document.getElementById("psaInter");
    const cabotEl = document.getElementById("psaCabot");
    if (interEl) interEl.textContent = safeVal(a["PSAScanInter"]);
    if (cabotEl) cabotEl.textContent = safeVal(a["PSAScanCabot"]);

    // Aduana
    const aduanaEl = document.getElementById("aduanaPuestos");
    if (aduanaEl) {
      aduanaEl.textContent = safeVal(a["Puestos de Aduanas"]);
    }

    // Migraciones
    const migrTotEl = document.getElementById("migracionesTotal");
    if (migrTotEl) {
      migrTotEl.textContent = safeVal(a["PuestosMigracionesTot"]);
    }
    const parts = [];
    if (a["PuestosMigracionesPartidas"]) {
      parts.push(`Partidas: ${safeVal(a["PuestosMigracionesPartidas"])}`);
    }
    if (a["PuestosMigracionesArribos"]) {
      parts.push(`Arribos: ${safeVal(a["PuestosMigracionesArribos"])}`);
    }
    const detEl = document.getElementById("migracionesDetalle");
    if (detEl) {
      detEl.textContent = parts.length ? parts.join(" · ") : "–";
    }

    document.getElementById("puertasTotal").textContent =
      safeVal(a["PuertasEmbarqueTotal"]);

    const puertasDetalle = [];
    if (a["PuertasEmbarqueInter"]) puertasDetalle.push(`Internacional: ${a["PuertasEmbarqueInter"]}`);
    if (a["PuertasEmbarqueCabot"]) puertasDetalle.push(`Cabotaje: ${a["PuertasEmbarqueCabot"]}`);
    if (a["PuertasEmbarqueFlex"]) puertasDetalle.push(`Flex: ${a["PuertasEmbarqueFlex"]}`);
    document.getElementById("puertasDetalle").textContent =
      puertasDetalle.length ? puertasDetalle.join(" · ") : "–";

    document.getElementById("mangas").textContent =
      safeVal(a["Mangas telescópicas"]);
    document.getElementById("cintasTotal").textContent =
      safeVal(a["CintasTotal"]);

    const cintasDetalle = [];
    if (a["CintasInter"]) cintasDetalle.push(`Internacional: ${a["CintasInter"]}`);
    if (a["CintasCabot"]) cintasDetalle.push(`Cabotaje: ${a["CintasCabot"]}`);
    if (a["CintasFlex"]) cintasDetalle.push(`Flex: ${a["CintasFlex"]}`);
    document.getElementById("cintasDetalle").textContent =
      cintasDetalle.length ? cintasDetalle.join(" · ") : "–";

    document.getElementById("estacionamiento").textContent =
      safeVal(a["Estacionamiento Vehicular"]);
    document.getElementById("carritos").textContent =
      safeVal(a["Carritos porta equipajes"]);

    /* ----- UBICACIÓN ----- */
    const loc = `${clean(a["Localidad"])} · ${clean(a["Provincia"])}`
      .replace(/^ · | · $/g, "");
    document.getElementById("ubicacionText").textContent = loc || "–";

    const dist = a["Distancia al centro de la ciudad (km)"];
    document.getElementById("distanciaCentro").textContent =
      dist ? `${formatNumber(dist)} km` : "–";

    document.getElementById("horarioOperacion").textContent =
      clean(a["Horario de operación"]) || "–";

    /* ----- TRANSPORTE PÚBLICO (KPI texto + visibilidad caja) ----- */
    const transpBox = document.querySelector(".transporte-kpi");
    const transpLines = document.getElementById("transporteLineas");
    const transpInfo = transportePorIATA[iataUpper] || null;

    const hasCSVInfo =
      transpInfo &&
      (clean(transpInfo.linea) !== "" || clean(transpInfo.parada) !== "");

    const hasParadasGeoJSON = (paradasFeatures || []).some(f => {
      const props = f.properties || {};
      const code = props.IATA || "";
      return String(code).trim().toUpperCase() === String(iataUpper).trim().toUpperCase();
    });

    if (transpBox) {
      if (hasCSVInfo || hasParadasGeoJSON) {
        transpBox.style.display = "flex";

        if (transpLines) {
          if (hasCSVInfo) {
            const partes = [];
            if (clean(transpInfo.linea)) {
              partes.push(`Líneas: ${transpInfo.linea}`);
            }
            if (clean(transpInfo.parada)) {
              partes.push(`Parada: ${transpInfo.parada}`);
            }
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



    document.getElementById("contactoAdminNombre").textContent =
      clean(contacto["Administrador"]) || "–";
    document.getElementById("contactoAdminTel").textContent =
      clean(contacto["AdmTelef"]) || "–";
    document.getElementById("contactoAdminCorreo").textContent =
      clean(contacto["AdmCorreo"]) || "–";

    document.getElementById("contactoJefeNombre").textContent =
      clean(contacto["JefeAeropuerto"] || contacto["Jefe de Aeropuerto"]) || "–";
    document.getElementById("contactoJefeTel").textContent =
      clean(contacto["JefeTelef"]) || "–";
    document.getElementById("contactoJefeCorreo").textContent =
      clean(contacto["JefeCorreo"]) || "–";

    // KPI superior: Administración / Jefatura
const adminNombre = clean(contacto["Administrador"]) || "Sin dato";
const adminTel    = clean(contacto["AdmTelef"]);
const adminMail   = clean(contacto["AdmCorreo"]);

const jefeNombre  = clean(contacto["JefeAeropuerto"] || contacto["Jefe de Aeropuerto"]) || "Sin dato";
const jefeTel     = clean(contacto["JefeTelef"]);
const jefeMail    = clean(contacto["JefeCorreo"]);

const adminContactoStr = [
  adminTel ? `☎ ${adminTel}` : "",
  adminMail ? `✉ ${adminMail}` : ""
].filter(Boolean).join(" · ") || "–";

const jefeContactoStr = [
  jefeTel ? `☎ ${jefeTel}` : "",
  jefeMail ? `✉ ${jefeMail}` : ""
].filter(Boolean).join(" · ") || "–";

const kpiAdminNombreEl   = document.getElementById("kpiAdminNombre");
const kpiAdminContactoEl = document.getElementById("kpiAdminContacto");
const kpiJefeNombreEl    = document.getElementById("kpiJefeNombre");
const kpiJefeContactoEl  = document.getElementById("kpiJefeContacto");

if (kpiAdminNombreEl)   kpiAdminNombreEl.textContent   = adminNombre;
if (kpiAdminContactoEl) kpiAdminContactoEl.textContent = adminContactoStr;
if (kpiJefeNombreEl)    kpiJefeNombreEl.textContent    = jefeNombre;
if (kpiJefeContactoEl)  kpiJefeContactoEl.textContent  = jefeContactoStr;


    /* ----- EMPLEO Y POBLACIÓN (desde datos de aeropuertos) ----- */
    const empDirRaw = a["EmpleoDirecto2024"];
    const empDirNum = Number(
      typeof empDirRaw === "string"
        ? empDirRaw.replace(/\./g, "").replace(/,/g, ".")
        : empDirRaw
    );

const empIndNum = !isNaN(empDirNum)
  ? Math.round(empDirNum * EMP_IND_MULT)
  : null;

    document.getElementById("empleoDirecto").textContent =
      !isNaN(empDirNum) && empDirNum !== null
        ? formatNumber(empDirNum)
        : "–";

    const empleoIndirectoEl = document.getElementById("empleoIndirecto");
    if (empleoIndirectoEl) {
      empleoIndirectoEl.textContent =
        !isNaN(empIndNum) && empIndNum !== null
          ? formatNumber(empIndNum)
          : "–";
    }

    const pobRaw = a["Población del Área de Influencia (Censo 2022)"];
    document.getElementById("poblacionInfluencia").textContent =
      safeVal(pobRaw);

    /* ----- SERVICIOS Y AYUDAS ----- */
    document.getElementById("radioayudas").textContent =
      clean(a["Radioayudas"]) || "–";
    document.getElementById("ayudasVisuales").textContent =
      clean(a["Ayudas visuales"]) || "–";
    document.getElementById("awos").textContent =
      clean(a["AWOS"]) || "–";

    document.getElementById("operadorCargas").textContent =
      clean(a["OperadorCargas"]) || "–";
    document.getElementById("terminalCargasM2").textContent =
      safeVal(a["TerminalCargasM2"]);

    const opCargasEl = document.getElementById("operadorCargas");
    const termCargasEl = document.getElementById("terminalCargasM2");

    const opCargasBox = opCargasEl ? opCargasEl.closest(".servicio-kpi") : null;
    const termCargasBox = termCargasEl ? termCargasEl.closest(".servicio-kpi") : null;

    if (opCargasBox) {
      if (!clean(a["OperadorCargas"])) {
        opCargasBox.style.display = "none";
      } else {
        opCargasBox.style.display = "flex";
      }
    }

    if (termCargasBox) {
      const hasTerm = a["TerminalCargasM2"] && a["TerminalCargasM2"] !== "0";
      termCargasBox.style.display = hasTerm ? "flex" : "none";
    }

    const aeroComb = [];
    if (a["Aeroplantas AV GAS"]) aeroComb.push(`AV GAS: ${a["Aeroplantas AV GAS"]}`);
    if (a["Aeroplantas JP1"]) aeroComb.push(`JP1: ${a["Aeroplantas JP1"]}`);
    document.getElementById("aeroplantas").textContent =
      aeroComb.length ? aeroComb.join(" · ") : "–";

    document.getElementById("claveRef").textContent =
      clean(a["CLAVE DE REFERENCIA DE AERÓDROMO"]) || "–";
    document.getElementById("categoriaSEI").textContent =
      clean(a["CATEGORÍA SEI NORMAL"]) || "–";

    /* ----- FOOTER ----- */
    document.getElementById("footerNote").textContent =
      `Fuente: ORSNA – Datos básicos por aeropuerto · Año ${a["Año"] || ""}.`;

    /* ----- ACTUALIZAR MAPAS ----- */
    updateMapForAirport(a);
    updatePSNMapForAirport(a);
    updateUbicacionMapForAirport(a);
    updateTransporteMapForAirport(a);
    updateInfluenciaMapForAirport(a);
  }

  /* ============================================
     I. CARGA DE DATOS (GeoJSON + CSV)
     ============================================ */
  async function loadData() {
    try {
      // 1) Datos principales
      const resp = await fetch("fuentes/Datos_aeropuertos.geojson");
      const geojson = await resp.json();

      const features = geojson.features || [];
      aeropuertos = features
        .map(f => f.properties || {})
        .filter(p => p.IATA);

      aeropuertos.sort((a, b) => String(a.IATA).localeCompare(String(b.IATA)));

      if (!selectEl) {
        selectEl = document.getElementById("airportSelect");
      }
      selectEl.innerHTML = "";
      aeropuertos.forEach(p => {
        const opt = document.createElement("option");
        const nombre = clean(p["Aeropuerto"]) || clean(p["Nombre del Aeropuerto"]) || p.IATA;
        opt.value = p.IATA;
        opt.textContent = `${nombre} (${p.IATA})`;
        selectEl.appendChild(opt);
      });

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
          const iata = p.IATA;
          if (iata) {
            contactosPorIATA[String(iata).toUpperCase()] = p;
          }
        });
      } catch (e) {
        console.warn("No se pudieron cargar los contactos de aeropuertos:", e);
        contactosPorIATA = {};
      }

      // 7) Programación de inversiones
      try {
        const respInv = await fetch("fuentes/Programacion_por_aeropuerto_aprobada2025_web.csv");
        const textInv = await respInv.text();
        inversionesPorIATA = parseInversionesCSV(textInv);
      } catch (e) {
        console.warn("No se pudieron cargar las inversiones por aeropuerto:", e);
        inversionesPorIATA = {};
      }

      // 8) Líneas de transporte (CSV)
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

      // 10) Terminales de pasajeros
      try {
        const respTerm = await fetch("fuentes/terminalpax.geojson");
        const gjTerm = await respTerm.json();
        terminalesFeatures = gjTerm.features || [];
      } catch (e) {
        console.warn("No se pudieron cargar las terminales:", e);
        terminalesFeatures = [];
      }

      // 11) Áreas de influencia
      try {
        const respAreas = await fetch("fuentes/Areasinfluencia39.geojson");
        const gjAreas = await respAreas.json();
        areasInfluenciaFeatures = gjAreas.features || [];
      } catch (e) {
        console.warn("No se pudieron cargar las áreas de influencia:", e);
        areasInfluenciaFeatures = [];
      }

      // Aeropuerto inicial
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("airport");
      let initial = aeropuertos[0]?.IATA;
      if (fromUrl && aeropuertos.find(a => String(a.IATA) === String(fromUrl))) {
        initial = fromUrl;
      }

      if (initial) {
        selectEl.value = initial;
        renderAirport(initial);
      }

      // Cambio desde selector
      selectEl.addEventListener("change", e => {
        const value = e.target.value;
        if (!value) return;
        renderAirport(value);
        const url = new URL(window.location.href);
        url.searchParams.set("airport", value);
        window.history.replaceState({}, "", url);
      });

    } catch (err) {
      console.error("Error cargando datos principales:", err);
      if (!selectEl) {
        selectEl = document.getElementById("airportSelect");
      }
      if (selectEl) {
        selectEl.innerHTML = "<option>Error al cargar datos</option>";
      }
    }
  }

  /* ============================================
     J. INICIO
     ============================================ */
  document.addEventListener("DOMContentLoaded", () => {
    selectEl = document.getElementById("airportSelect");
    initMap();
    loadData();

    // Botones "Abrir el mapa" (por ahora sólo transporte)
    document.querySelectorAll(".map-expand-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const iata = selectEl ? selectEl.value : "";
        if (!iata) return;

        const mapType = btn.dataset.map; // "transporte"
        const url = `mapa_${mapType}.html?airport=${encodeURIComponent(iata)}`;
        window.open(url, "_blank");
      });
    });

// Flechas del carrusel de KPI
const kpiStrip   = document.querySelector(".kpi-strip");
const arrowLeft  = document.querySelector(".kpi-arrow-left");
const arrowRight = document.querySelector(".kpi-arrow-right");

if (kpiStrip && arrowLeft && arrowRight) {
  const scrollAmount = 220; // píxeles por clic

  arrowLeft.addEventListener("click", () => {
    kpiStrip.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  });

  arrowRight.addEventListener("click", () => {
    kpiStrip.scrollBy({ left: scrollAmount, behavior: "smooth" });
  });
}

  });

})();

