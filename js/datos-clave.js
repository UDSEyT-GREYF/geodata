// js/datos-clave.js
// Lógica de "datos-clave.html" separada a archivo externo
/* global L, Chart */

(() => {
  "use strict";

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

  // Pasajeros (CSV mensual)
  // - paxRows: filas crudas ya normalizadas
  // - paxIndex: índice por IATA y región para graficar rápido
  //   { IATA: { cabotaje: [{t: Date, y: number}], internacional: [...] } }
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

  /**
   * Parse numérico "seguro" para tu CSV:
   * - tu campo valor_pax viene como entero "428234" (ideal)
   * - también tolera "428.234" o "428,234" si apareciera
   */
  function parseEsNumber(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s) return null;

    // Normaliza separadores: quita puntos y comas (en pasajeros no hay decimales)
    const normalized = s.replace(/\./g, "").replace(/,/g, "");
    const n = Number(normalized);
    return isNaN(n) ? null : n;
  }

  /**
   * IMPORTANTE:
   * Tu CSV trae fecha como "1/1/2001" (d/m/yyyy).
   * new Date("1/1/2001") puede interpretarse distinto según navegador/locale.
   * Por eso parseamos manualmente.
   */
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
     G2. PASAJEROS (CSV mensual)
     ============================================================ */

  /**
   * Carga e indexa el CSV de pasajeros mensuales.
   * Nota: lo parseamos "a mano" para no depender de PapaParse.
   *
   * REQUISITO DE DATOS:
   * - Debe existir columna "iata"
   * - Debe existir columna "region" con valores "cabotaje" / "internacional"
   * - Debe existir "fecha" en formato d/m/yyyy (ej: 1/1/2001)
   * - Debe existir "valor_pax" numérico
   */
  async function loadPaxCSV() {
    // IMPORTANTE: ajustá el nombre real del archivo en tu carpeta fuentes/
    const paxPath = "fuentes/pasajeros_aeropuerto_mensual.csv"; // <-- AJUSTAR si tu archivo se llama distinto

    try {
      const resp = await fetch(paxPath);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} al leer ${paxPath}`);
      const text = await resp.text();

      // Detecta separador (tu ejemplo parece tabulado, pero en web suele ser ";" o ",")
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) return;

      // separador probable por cabecera
      const headerLine = lines[0];
      const sep =
        headerLine.indexOf("\t") !== -1 ? "\t" :
        (headerLine.indexOf(";") !== -1 ? ";" : ",");

      const headers = headerLine.split(sep).map(h => h.trim().toLowerCase());

      const idxIata = headers.indexOf("iata");
      const idxRegion = headers.indexOf("region");
      const idxFecha = headers.indexOf("fecha");
      const idxValorPax = headers.indexOf("valor_pax");

      // Si falta alguna columna clave, no rompemos el resto de la página
      if (idxIata === -1 || idxRegion === -1 || idxFecha === -1 || idxValorPax === -1) {
        console.warn("CSV pasajeros: faltan columnas esperadas (iata/region/fecha/valor_pax).");
        return;
      }

      // Normalizamos filas
      paxRows = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(sep);

        const iata = String(cols[idxIata] || "").trim().toUpperCase();
        const region = String(cols[idxRegion] || "").trim().toLowerCase(); // cabotaje / internacional
        const fecha = parseDMYDate(cols[idxFecha]);
        const valor_pax = parseEsNumber(cols[idxValorPax]);

        if (!iata || !fecha || valor_pax === null) continue;
        if (region !== "cabotaje" && region !== "internacional") continue;

        paxRows.push({ iata, region, fecha, valor_pax });
      }

      // Indexación para graficar rápido
      paxIndex = {};
      paxRows.forEach(r => {
        if (!paxIndex[r.iata]) paxIndex[r.iata] = { cabotaje: [], internacional: [] };
        paxIndex[r.iata][r.region].push({ t: r.fecha, y: r.valor_pax });
      });

      // Orden cronológico
      Object.keys(paxIndex).forEach(iata => {
        paxIndex[iata].cabotaje.sort((a, b) => a.t - b.t);
        paxIndex[iata].internacional.sort((a, b) => a.t - b.t);
      });

      // UI del panel (solo el selector de región, no de aeropuerto)
      initPaxUI();
    } catch (e) {
      console.warn("No se pudo cargar el CSV de pasajeros:", e);
      // Si falla, dejamos el panel en “–” y no rompemos nada más
      updatePaxPanel("", "ambos");
    }
  }

  /**
   * Inicializa el selector de región del panel de pasajeros.
   * - Usa el aeropuerto actual del selector principal (airportSelect).
   * - No crea ni usa un selector de aeropuerto adicional.
   */
  function initPaxUI() {
    const paxRegionSelect = document.getElementById("paxRegionSelect");
    if (!paxRegionSelect) return;

    paxRegionSelect.addEventListener("change", () => {
      const iata = (selectEl && selectEl.value) ? String(selectEl.value).toUpperCase() : "";
      updatePaxPanel(iata, paxRegionSelect.value);
    });
  }

  /**
   * Arma datasets para Chart.js y calcula KPIs (último mes y variación interanual).
   */
  function buildPaxSeries(iata, regionMode) {
    const entry = paxIndex[iata];
    if (!entry) return { datasets: [], last: null, yoy: null };

    const cab = entry.cabotaje || [];
    const intl = entry.internacional || [];

    // Datasets para el gráfico
    const datasets = [];
    if (regionMode === "cabotaje" || regionMode === "ambos") {
      datasets.push({
        label: "Cabotaje",
        data: cab,
        tension: 0.2,
        pointRadius: 0
      });
    }
    if (regionMode === "internacional" || regionMode === "ambos") {
      datasets.push({
        label: "Internacional",
        data: intl,
        tension: 0.2,
        pointRadius: 0
      });
    }

    // KPI último mes y yoy (sobre el agregado según regionMode)
    const merged = mergeSeriesForKpis(cab, intl, regionMode);
    const last = merged.length ? merged[merged.length - 1] : null;

    let yoy = null;
    if (merged.length >= 13 && last) {
      const lastDate = last.t;
      const prevYear = merged.find(p => sameMonthYearShift(p.t, lastDate, 12));
      if (prevYear && prevYear.y && last.y) {
        yoy = (last.y / prevYear.y) - 1;
      }
    }

    return { datasets, last, yoy };
  }

  /**
   * Construye una serie mensual agregada (por fecha) para calcular KPI.
   * - Si regionMode="ambos": suma cabotaje + internacional.
   */
  function mergeSeriesForKpis(cab, intl, regionMode) {
    const map = new Map(); // key=YYYY-MM, value=sum

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

  /**
   * True si dCandidate es el mismo mes que dRef pero "monthsBack" meses atrás.
   * Ej: dRef=2025-01, monthsBack=12 -> compara con 2024-01.
   */
  function sameMonthYearShift(dCandidate, dRef, monthsBack) {
    if (!(dCandidate instanceof Date) || !(dRef instanceof Date)) return false;
    const ref = new Date(dRef.getFullYear(), dRef.getMonth() - monthsBack, 1);
    return dCandidate.getFullYear() === ref.getFullYear() && dCandidate.getMonth() === ref.getMonth();
  }

  /**
   * Actualiza KPIs + gráfico del panel pasajeros para el aeropuerto actual.
   * Si el aeropuerto no tiene serie, deja “–” y destruye el gráfico.
   */
  function updatePaxPanel(iata, regionMode) {
    const kpiLastEl = document.getElementById("paxKpiLast");
    const kpiYoYEl = document.getElementById("paxKpiYoY");

    // Si no hay IATA o no existe en el índice, vaciamos panel
    if (!iata || !paxIndex[iata]) {
      if (kpiLastEl) kpiLastEl.textContent = "–";
      if (kpiYoYEl) kpiYoYEl.textContent = "–";
      if (paxChart) { paxChart.destroy(); paxChart = null; }
      return;
    }

    const { datasets, last, yoy } = buildPaxSeries(iata, regionMode);

    if (kpiLastEl) {
      if (last) {
        kpiLastEl.textContent = `${formatNumber(last.y)} (${formatShortMonthYYYY(last.t)})`;
      } else {
        kpiLastEl.textContent = "–";
      }
    }

    if (kpiYoYEl) {
      if (typeof yoy === "number" && isFinite(yoy)) {
        const pct = (yoy * 100);
        kpiYoYEl.textContent = `${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
      } else {
        kpiYoYEl.textContent = "–";
      }
    }

    drawPaxChart(datasets);
  }

  /**
   * Dibuja el gráfico con Chart.js.
   *
   * REQUISITO (HTML):
   * - Chart.js debe estar cargado
   * - Para eje temporal (type: "time") necesitás un adapter (ej: chartjs-adapter-date-fns)
   *   Si no lo cargás, el gráfico puede no renderizar.
   */
  function drawPaxChart(datasets) {
    const canvas = document.getElementById("paxChart");
    if (!canvas) return;

    if (paxChart) {
      paxChart.destroy();
      paxChart = null;
    }

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
          x: {
            type: "time",
            time: { unit: "month" },
            ticks: { maxRotation: 0, autoSkip: true }
          },
          y: {
            ticks: { callback: (value) => formatNumber(value) }
          }
        }
      }
    });
  }

  /* ============================================================
     H. RENDER PRINCIPAL (AEROPUERTO SELECCIONADO)
     ============================================================ */

  function renderAirport(iataCode) {
    const a = aeropuertos.find(x => x.IATA === iataCode);
    if (!a) return;

    const iata = String(a.IATA || "").toUpperCase();
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
    const hdrEmpleoEl = document.getElementById("hdrEmpleo");

    if (hdrSuperficie) hdrSuperficie.innerHTML = `Explotación <small>${tituloAeroSeccion}</small>`;
    if (hdrMovimiento) hdrMovimiento.innerHTML = `Área de movimiento <small>${tituloAeroSeccion}</small>`;
    if (hdrTerminal) hdrTerminal.innerHTML = `Terminal de pasajeros <small>${tituloAeroSeccion}</small>`;
    if (hdrUbicacion) hdrUbicacion.innerHTML = `Ubicación y accesibilidad <small>${tituloAeroSeccion}</small>`;
    if (hdrServicios) hdrServicios.innerHTML = `Servicios y ayudas <small>${tituloAeroSeccion}</small>`;

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

    /* ============================================================
       (Acá continúa tu código igual: pistas, PSN, terminal, etc.)
       ============================================================ */

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

    /* ---------- PASAJEROS (panel nuevo) ----------
       - NO hay selector de aeropuerto para pasajeros.
       - Siempre usa el aeropuerto seleccionado en el selector principal.
       - Si el aeropuerto no está en paxIndex, el panel queda en “–”.
    */
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

      // (2..11) tus cargas igual...

      // 12) Pasajeros (CSV)
      // Se carga antes del render inicial para que el gráfico ya pueda mostrarse
      await loadPaxCSV();

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

      // Cambio selector principal
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
