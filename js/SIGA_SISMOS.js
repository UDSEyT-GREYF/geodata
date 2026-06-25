/* global L */
(() => {
  "use strict";

const params = new URLSearchParams(window.location.search);
const EMBED_MODE = params.get("embed") === "1";
const MINI_MODE = params.get("mini") === "1";
const URL_AIRPORT = (params.get("airport") || "").trim().toUpperCase();
const URL_FOCUS = params.get("focus") === "1";

if (EMBED_MODE) document.body.classList.add("embed");
if (MINI_MODE) document.body.classList.add("mini");

  const AIRPORTS_SOURCE = "fuentes/Datos_aeropuertos.geojson";
  const PARADAS_APP_CSV_SOURCE = "fuentes/Paradasapp.csv";
  const USGS_EARTHQUAKES_SOURCE = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-56&maxlatitude=-20&minlongitude=-76&maxlongitude=-50&eventtype=earthquake&orderby=time";
  const DEFAULT_CENTER = [-38.4, -63.6];
  const DEFAULT_ZOOM = 4;

  const FIELD_IATA_CANDIDATES = [
    "IATA", "iata", "iata_code", "cod_iata", "COD_IATA", "codigo_iata", "Código IATA"
  ];

  const SIGA_COLORS = {
    azulOrsna: "#306fb0",
    azulOscuro: "#002855",
    azulMedio: "#2a5fa0",
    azulLink: "#0072bb",
    azulClaro: "#4fa3ff",
    celesteCab: "#75AADB",
    verdeLima: "#8DE000",
    violeta: "#6b2f82",
    rojoTerminal: "#b22222",
    rojoSuave: "#ffdede",
    grisPista: "#222222",
    amarilloPista: "#ffff00",
    grisContexto: "#b0b0b0",
    grisFondo: "#f5f5f5",
    grisChip: "#b3b3b3",
    verdeInternacional: "#16c41e",
    amarilloSeleccion: "#FFD700"
  };

  const BASEMAP_CONFIGS = [
    {
      id: "argenmap",
      name: "Argenmap IGN",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 19,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#bfe6fb"
    },
    {
      id: "argenmap_gris",
      name: "Argenmap IGN gris",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 19,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#d5d8dc"
    },
    {
      id: "argenmap_oscuro",
      name: "Argenmap IGN oscuro",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/argenmap_oscuro@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 19,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#23272d"
    },
    {
      id: "argenmap_topografico",
      name: "Argenmap IGN topográfico",
      url: "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_topo@EPSG%3A3857@png/{z}/{x}/{-y}.png",
      tms: true,
      minZoom: 3,
      maxZoom: 13,
      attribution: "© Instituto Geográfico Nacional + OpenStreetMap",
      swatch: "#cfe8d0"
    },
    {
      id: "osm",
      name: "OpenStreetMap",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors",
      swatch: "#d8edf7"
    },
    {
      id: "osm_humanitario",
      name: "OpenStreetMap humanitario",
      url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors, Humanitarian OpenStreetMap Team",
      swatch: "#f2e1d6"
    },
    {
      id: "opentopo",
      name: "Openstreetmap Topográfico",
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      maxZoom: 17,
      attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap",
      swatch: "#e9dcc1"
    },
    {
      id: "carto_claro",
      name: "Carto claro",
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors © CARTO",
      swatch: "#edf2f6"
    },
    {
      id: "carto_voyager",
      name: "Carto Voyager",
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors © CARTO",
      swatch: "#e7f0ef"
    },
    {
      id: "carto_oscuro",
      name: "Carto oscuro",
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors © CARTO",
      swatch: "#242a31"
    },
    {
      id: "google_imagery",
      name: "Google satelital",
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      minZoom: 3,
      maxZoom: 21,
      attribution: "Imágenes satelitales © Google",
      swatchImage: "https://mt1.google.com/vt/lyrs=s&x=0&y=0&z=0"
    },
    {
      id: "esri_imagery",
      name: "Esri satelital",
      url: "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19,
      attribution: "Imágenes satelitales © Esri",
      swatchImage: "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/0/0/0"
    },

    {
      id: "esri_calles",
      name: "Esri calles",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 20,
      attribution: "Tiles © Esri",
      swatch: "#ece2d0"
    },
    {
      id: "esri_topografico",
      name: "Esri topográfico",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 20,
      attribution: "Mapa topográfico © Esri",
      swatch: "#c4d7ef"
    },
    {
      id: "esri_gris",
      name: "Esri gris claro",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 16,
      attribution: "Tiles © Esri",
      swatch: "#d7dce2"
    },
    {
      id: "esri_oceanico",
      name: "Esri Oceánico",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
      minZoom: 3,
      maxZoom: 10,
      attribution: "Tiles © Esri — Fuente: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ y Esri",
      swatchImage: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/0/0/0"
    }
  ];

  // Relieve permanente: no forma parte del selector de mapas base.
  // Se dibuja siempre sobre el mapa base elegido y debajo de las capas vectoriales.
  const PERMANENT_HILLSHADE_CONFIG = {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
    minZoom: 0,
    maxZoom: 20,
    nativeMaxZoom: 13,
    opacity: 0.52,
    pane: "sigaHillshadePane",
    attribution: "Sombra de montaña © Esri y proveedores de datos de elevación"
  };

  const DEFAULT_BASEMAP_ID = "argenmap";
  const AIRPORT_BASEMAP_ID = "esri_imagery";

  const LAYER_CONFIGS = [
    {
      id: "inpres_sismos_zonificacion",
      group: "Amenazas geodinámicas",
      name: "Zonificación sísmica INPRES",
      url: "fuentes/sismos/inpres_sismos_zonificacion.geojson",
      active: true,
      opacity: 0.82,
      color: "#d73027",
      style: {
        color: "#7f1d1d",
        weight: 1.1,
        opacity: 0.9,
        fillColor: "#fee08b",
        fillOpacity: 0.28
      },
      styleByFeature: seismicZoneStyle,
      tooltipTitle: "Zonificación sísmica",
      tooltipFields: [
        { label: "Zona sísmica", keys: ["zona_sismo", "Zona_sismo", "ZONA_SISMO", "zona", "Zona"] },
        { label: "Peligrosidad", keys: ["p_sismica", "P_sismica", "P_SISMICA", "peligrosidad"] },
        { label: "Aceleración", keys: ["acelerac", "Acelerac", "ACELERAC", "aceleracion"] }
      ],
      popupTitle: "Zonificación sísmica INPRES",
      popupFields: [
        { label: "Zona sísmica", keys: ["zona_sismo", "Zona_sismo", "ZONA_SISMO", "zona"] },
        { label: "Peligrosidad sísmica", keys: ["p_sismica", "P_sismica", "P_SISMICA", "peligrosidad"] },
        { label: "Aceleración máxima", keys: ["acelerac", "Acelerac", "ACELERAC", "aceleracion"] },
        { label: "Fuente", keys: ["fuente", "Fuente", "FUENTE"] }
      ],
      legendItems: [
        { label: "Zona 0 — Peligrosidad muy reducida", color: "#ffffcc" },
        { label: "Zona 1 — Peligrosidad reducida", color: "#ffeda0" },
        { label: "Zona 2 — Peligrosidad moderada", color: "#feb24c" },
        { label: "Zona 3 — Peligrosidad elevada", color: "#f03b20" },
        { label: "Zona 4 — Peligrosidad muy elevada", color: "#bd0026" }
      ]
    },
    {
      id: "inpres_sismos",
      group: "Amenazas geodinámicas",
      name: "Sismos sentidos INPRES (2012–2023)",
      url: "fuentes/sismos/inpres_sismos.geojson",
      active: true,
      opacity: 0.95,
      color: "#d73027",
      point: {
        radius: 4.5,
        color: "#7f1d1d",
        weight: 1.2,
        fillColor: "#ef4444",
        fillOpacity: 0.84
      },
      pointStyle: earthquakePointStyle,
      tooltipTitle: "Sismo sentido",
      tooltipFields: [
        { label: "Fecha", keys: ["fecha", "Fecha", "FECHA"] },
        { label: "Magnitud", keys: ["magnitud", "Magnitud", "MAGNITUD", "mag"] },
        { label: "Profundidad", keys: ["profund", "Profund", "PROFUND", "profundidad"] },
        { label: "Intensidad", keys: ["intensidad", "Intensidad", "INTENSIDAD"] },
        { label: "Provincia / área", keys: ["nam", "NAM", "provincia", "Provincia"] }
      ],
      popupTitle: "Sismo sentido INPRES",
      popupFields: [
        { label: "Fecha", keys: ["fecha", "Fecha", "FECHA"] },
        { label: "Magnitud", keys: ["magnitud", "Magnitud", "MAGNITUD", "mag"] },
        { label: "Profundidad", keys: ["profund", "Profund", "PROFUND", "profundidad"], suffix: "km" },
        { label: "Intensidad", keys: ["intensidad", "Intensidad", "INTENSIDAD"] },
        { label: "Categoría", keys: ["categoria", "Categoria", "CATEGORIA"] },
        { label: "Provincia / área", keys: ["nam", "NAM", "provincia", "Provincia"] },
        { label: "Latitud", keys: ["lat", "Lat", "LAT"] },
        { label: "Longitud", keys: ["long", "Long", "LONG", "lon"] },
        { label: "Fuente", keys: ["fuente", "Fuente", "FUENTE"] }
      ],
      legendItems: [
        { label: "Magnitud menor a 3", color: "#ffd54f", shape: "point" },
        { label: "Magnitud 3,0–3,9", color: "#ff9800", shape: "point" },
        { label: "Magnitud 4,0–4,9", color: "#f4511e", shape: "point" },
        { label: "Magnitud 5 o más", color: "#b71c1c", shape: "point" }
      ]
    },
    {
      id: "usgs_sismos_recientes",
      group: "Amenazas geodinámicas",
      name: "Sismos recientes USGS",
      url: USGS_EARTHQUAKES_SOURCE,
      active: true,
      opacity: 0.96,
      color: "#7f1d1d",
      point: {
        radius: 4.5,
        color: "#4c0519",
        weight: 1.2,
        fillColor: "#ef4444",
        fillOpacity: 0.88
      },
      pointStyle: earthquakePointStyle,
      tooltipTitle: "Sismo reciente USGS",
      tooltipFields: [
        { label: "Fecha y hora", keys: ["fecha", "Fecha"] },
        { label: "Magnitud", keys: ["mag", "magnitud", "Magnitud"] },
        { label: "Profundidad", keys: ["profundidad", "depth"] },
        { label: "Ubicación", keys: ["place", "lugar", "Lugar"] },
        { label: "Estado", keys: ["status", "estado", "Estado"] }
      ],
      popupTitle: "Sismo reciente USGS",
      popupFields: [
        { label: "Fecha y hora", keys: ["fecha", "Fecha"] },
        { label: "Magnitud", keys: ["mag", "magnitud", "Magnitud"] },
        { label: "Profundidad", keys: ["profundidad", "depth"], suffix: "km" },
        { label: "Ubicación", keys: ["place", "lugar", "Lugar"] },
        { label: "Estado", keys: ["status", "estado", "Estado"] },
        { label: "Código", keys: ["code", "id"] },
        { label: "Fuente", keys: ["fuente", "Fuente"] }
      ],
      legendItems: [
        { label: "Magnitud menor a 3", color: "#ffd54f", shape: "point" },
        { label: "Magnitud 3,0–3,9", color: "#ff9800", shape: "point" },
        { label: "Magnitud 4,0–4,9", color: "#f4511e", shape: "point" },
        { label: "Magnitud 5 o más", color: "#b71c1c", shape: "point" }
      ]
    },
    {
      id: "segemar_riesgo_volcanico_2025",
      group: "Amenazas geodinámicas",
      name: "Riesgo volcánico relativo SEGEMAR 2025",
      url: "fuentes/sismos/segemar_riesgo_volcanico_2025.geojson",
      active: false,
      opacity: 0.9,
      color: "#ff7f00",
      style: {
        color: "#9a3412",
        weight: 1.2,
        opacity: 0.95,
        fillColor: "#fb923c",
        fillOpacity: 0.3
      },
      point: {
        radius: 7,
        color: "#7c2d12",
        weight: 1.5,
        fillColor: "#fb923c",
        fillOpacity: 0.9
      },
      tooltipTitle: "Riesgo volcánico relativo 2025",
      tooltipFields: [
        { label: "Volcán", keys: ["nombre", "Nombre", "NOMBRE", "volcan", "Volcan", "VOLCAN", "nam", "NAM"] },
        { label: "Riesgo", keys: ["riesgo", "Riesgo", "RIESGO", "riesgo_rel", "nivel_ries"] },
        { label: "Ranking", keys: ["ranking", "Ranking", "RANKING", "rango", "Rango"] },
        { label: "Provincia", keys: ["provincia", "Provincia", "PROVINCIA"] }
      ]
    },
    {
      id: "segemar_volcanes",
      group: "Amenazas geodinámicas",
      name: "Volcanes SEGEMAR",
      url: "fuentes/sismos/segemar_volcanes.geojson",
      active: false,
      opacity: 0.92,
      color: "#7f1d1d",
      style: {
        color: "#5f1515",
        weight: 1.2,
        opacity: 0.95,
        fillColor: "#b91c1c",
        fillOpacity: 0.22
      },
      point: {
        radius: 5.5,
        color: "#450a0a",
        weight: 1.4,
        fillColor: "#b91c1c",
        fillOpacity: 0.9
      },
      tooltipTitle: "Volcán",
      tooltipFields: [
        { label: "Nombre", keys: ["nombre", "Nombre", "NOMBRE", "volcan", "Volcan", "VOLCAN", "nam", "NAM"] },
        { label: "Provincia", keys: ["provincia", "Provincia", "PROVINCIA"] },
        { label: "Estado", keys: ["estado", "Estado", "ESTADO", "actividad", "Actividad"] },
        { label: "Tipo", keys: ["tipo", "Tipo", "TIPO"] }
      ]
    },
    {
      id: "provincias",
      group: "Contexto territorial",
      name: "Provincias",
      url: "fuentes/provincias.geojson",
      active: true,
      opacity: 0.9,
      color: SIGA_COLORS.grisContexto,
      style: {
        color: SIGA_COLORS.grisContexto,
        weight: 1,
        fillColor: "transparent",
        fillOpacity: 0
      }
    },
    {
      id: "predios",
      group: "Explotación",
      name: "Predios aeroportuarios",
      url: "fuentes/poligonos_aeropuertos.geojson",
      active: true,
      opacity: 0.95,
      color: "#5DFF3A",
      tooltipTitle: "Predio aeroportuario",
      tooltipFields: [
      { label: "Aeropuerto", keys: ["Aeropuerto", "aeropuerto", "nombre", "Nombre"] },
      { label: "IATA", keys: ["IATA", "iata"] },
      { label: "OACI", keys: ["OACI", "oaci"] }
    ],
  popupFields: [
    { label: "IATA", keys: ["IATA", "iata"] },
    { label: "Grupo", keys: ["Grupo"] },
    { label: "Aeropuerto", keys: ["Nom_aerop", "Aeropuerto", "aeropuerto", "Nombre"] },
    { label: "Ciudad", keys: ["Ciudad", "ciudad"] },
    { label: "Provincia", keys: ["Provincia", "provincia"] },
    { label: "Habilitación", keys: ["Habilitaci", "Habilitación", "habilitacion"] },
    { label: "Sup. Hectáreas", keys: ["SupHaText", "Supha"],suffix: "Ha."  },
    { label: "Sup. Kilómetros", keys: ["SupKm2Text", "SupKm2"], suffix: "km²" },
    { label: "Descripción", keys: ["Descrip"] }
  ],
style: {
  color: "#5DFF3A",
  weight: 2.4,
  opacity: 0.95,
  fill: false,
  fillColor: "transparent",
  fillOpacity: 0
}
    },
    {
      id: "pistas",
      group: "Área de movimiento",
      name: "Pistas",
      url: "fuentes/pistas.geojson",
      active: true,
      opacity: 1,
      color: SIGA_COLORS.grisPista,
      tooltipTitle: "Pistas",
      tooltipFields: [
      { label: "Pista", keys: ["tipo", "Tipo",] },
      { label: "IATA", keys: ["IATA", "iata"] },
    ],
  popupFields: [
    { label: "IATA", keys: ["IATA", "iata"] },
    { label: "Longitud", keys: ["largxanchm"], suffix: "metros" },
    { label: "Orientación", keys: ["orientacio", "Orientacion"] },
    { label: "Material", keys: ["material", "Material"] }
  ],
      
      style: {
        color: SIGA_COLORS.grisPista,
        weight: 2,
        fillColor: SIGA_COLORS.amarilloPista,
        fillOpacity: 0.16
      }
    },
    {
      id: "cabeceras",
      group: "Área de movimiento",
      name: "Cabeceras de pista",
      url: "fuentes/Cabeceras2026.geojson",
      active: true,
      opacity: 1,
      color: SIGA_COLORS.azulMedio,

      tooltipTitle: "Cabeceras",
      tooltipFields: [
      { label: "Cabecera", keys: ["Cabecera", "cabecera",] },
      { label: "IATA", keys: ["IATA", "iata"] },
    ],
  popupFields: [
    { label: "IATA", keys: ["IATA", "iata"] },
    { label: "Cabecera", keys: ["Cabecera", "cabecera"], }
  ],
      style: {
        color: SIGA_COLORS.azulOscuro,
        weight: 1.8,
        fillColor: SIGA_COLORS.azulMedio,
        fillOpacity: 0.36
      }
    },
    {
      id: "plataformas",
      group: "Área de movimiento",
      name: "Plataformas",
      url: "fuentes/Plataformas2026.geojson",
      active: true,
      opacity: 0.92,
      color: SIGA_COLORS.celesteCab,
      tooltipTitle: "Plataformas",
      tooltipFields: [
      { label: "Tipo", keys: ["Tipo", "tipo"] },
      { label: "IATA", keys: ["IATA", "iata"] },
    ],
  popupFields: [
    { label: "IATA", keys: ["IATA", "iata"] },
    { label: "Tipo", keys: ["Tipo", "tipo"] },
    { label: "Superficie", keys: ["Metros2", "Metros", "Metros2"], suffix: "metros²" },
  ],
      
      style: {
        color: SIGA_COLORS.azulLink,
        weight: 1.5,
        fillColor: SIGA_COLORS.celesteCab,
        fillOpacity: 0.42
      }
    },

    {
      id: "psn",
      group: "Área de movimiento",
      name: "Posiciones aeronaves",
      url: "fuentes/psn_posiciones.geojson",
      active: true,
      opacity: 1,
      color: SIGA_COLORS.violeta,
      point: {
        radius: 2.2,
        color: "#000000",
        fillColor: SIGA_COLORS.violeta,
        fillOpacity: 0.5
      },
      tooltipTitle: "Posiciones de aeronaves",
      tooltipFields: [
      { label: "IATA", keys: ["IATA", "iata"] },
      { label: "Posición", keys: ["Posicion"] },
    ],
  popupFields: [
    { label: "IATA", keys: ["IATA", "iata"] },
    { label: "Posición", keys: ["Posicion"] },
  ],
    },
{
  id: "aeroplantas",
  group: "Área de movimiento",
  name: "Aeroplantas",
  url: "fuentes/Aeroplantas.geojson",
  active: true,
  opacity: 1,
color: "#d71920",
style: {
  color: "#d71920",
  weight: 1.4,
  fillColor: "#d71920",
  // Relleno prácticamente invisible, pero mantiene
  // toda la superficie del polígono consultable.
  fillOpacity: 0.015
},
polygonIcon: {
  html: `
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M7 3h8c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2Z"
            fill="currentColor"/>
      <path d="M8 6h6v3H8V6Z" fill="#ffffff" opacity="0.9"/>
      <path d="M17 7h1.4c.5 0 .9.4.9.9v3.8c0 .8.5 1.3 1.1 1.3s1.1-.5 1.1-1.3V9.2"
            fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
  `,
    className: "siga-poly-center-icon siga-poly-center-icon-aeroplanta siga-zoom-detail-icon"
}
},
    {
      id: "terminales2026",
      group: "Edificios e infraestructura",
      name: "Terminales",
      url: "fuentes/Terminales2026.geojson",
      active: true,
      opacity: 0.94,
      color: SIGA_COLORS.rojoTerminal,
      style: {
        color: SIGA_COLORS.rojoTerminal,
        weight: 1.2,
        fillColor: SIGA_COLORS.rojoSuave,
        fillOpacity: 0.45
      }
    },
    {
      id: "torres",
      group: "Edificios e infraestructura",
      name: "Torres de control",
      url: "fuentes/Torres_control_2026.geojson",
      active: true,
      opacity: 1,
      color: SIGA_COLORS.azulOscuro,
      point: {
        radius: 6,
        color: SIGA_COLORS.azulOscuro,
        fillColor: SIGA_COLORS.azulMedio,
        fillOpacity: 0.95
      }
    },
    {
      id: "hangares",
      group: "Edificios e infraestructura",
      name: "Hangares",
      url: "fuentes/Hangares2026.geojson",
      active: true,
      opacity: 0.9,
      color: "#8a5a35",
      style: {
        color: "#6f4627",
        weight: 1.1,
        fillColor: "#b5835a",
        fillOpacity: 0.38
      }
    },
    {
      id: "otros",
      group: "Edificios e infraestructura",
      name: "Otros edificios",
      url: "fuentes/Otros_edificios2026.geojson",
      active: true,
      opacity: 0.9,
      color: "#6c757d",
      style: {
        color: "#555555",
        weight: 1.1,
        fillColor: "#b3b3b3",
        fillOpacity: 0.38
      }
    },
    {
      id: "estacionamientos",
      group: "Edificios e infraestructura",
      name: "Estacionamientos vehiculares",
      url: "fuentes/Estacionamientos_vehiculares2026.geojson",
      active: true,
      opacity: 0.9,
      color: SIGA_COLORS.grisChip,
      style: {
        color: "#777777",
        weight: 1.1,
        fillColor: SIGA_COLORS.grisChip,
        fillOpacity: 0.48
      }
    },
{
  id: "paradasapp",
  group: "Servicios y apoyo",
  name: "Paradas transporte público",
  url: "fuentes/paradasapp.geojson",
  active: true,
  opacity: 1,
  color: SIGA_COLORS.verdeInternacional,

  tooltipTitle: "Parada de transporte público",
  tooltipFields: [
    { label: "IATA", keys: ["IATA", "iata"] },
    { label: "Línea", keys: ["LINEA", "Linea", "linea", "Línea"] },
    { label: "Parada", keys: ["Parada", "PARADA", "parada"] }
  ],

  popupFields: [
    { label: "IATA", keys: ["IATA", "iata"] },
    { label: "Línea", keys: ["LINEA", "Linea", "linea", "Línea"] },
    { label: "Parada", keys: ["Parada", "PARADA", "parada"] }
  ],

  point: {
    radius: 4.8,
    color: "#1a7a3e",
    fillColor: SIGA_COLORS.verdeInternacional,
    fillOpacity: 0.9
  }
},
    {
      id: "smn",
      group: "Servicios y apoyo",
      name: "Estaciones meteorológicas SMN",
      url: "fuentes/smn_estaciones_meteorologicas2026.geojson",
      active: true,

      // Visible solo cuando el zoom ya está cerca del aeropuerto
      minVisibleZoom: 12,

      opacity: 1,
      color: SIGA_COLORS.azulLink,
      point: {
        radius: 5.2,
        color: SIGA_COLORS.azulOscuro,
        fillColor: SIGA_COLORS.azulLink,
        fillOpacity: 0.92
      }
    }
  ];
const LAYER_GROUP_ORDER = [
  "Amenazas geodinámicas",
  "Explotación",
  "Edificios e infraestructura",
  "Área de movimiento",
  "Servicios y apoyo",
  "Contexto territorial"
];
  const state = {
    map: null,
    baseLayers: {},
    baseLayerConfigs: new Map(),
    activeBaseLayerId: "",
    userChangedBaseLayer: false,
    autoSwitchingBaseLayer: false,
    hillshadeLayer: null,
    layerDefs: new Map(),
    airports: [],
    airportIndex: new Map(),
    selectedAirport: "",
    airportLabelLayer: null,
    drawnItems: null,
    paradasAppRowsByIata: new Map()
  };

  const q = (id) => document.getElementById(id);

  function clean(v) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  }

  function formatValue(v) {
    if (v === null || v === undefined || v === "") return "–";
    if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("es-AR") : v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
    return String(v);
  }

  function getFirstProp(props, names) {
    for (const n of names) {
      if (props && props[n] !== undefined && props[n] !== null && String(props[n]).trim() !== "") return props[n];
    }
    return "";
  }

  function getFeatureIata(feature) {
    const props = feature?.properties || {};
    return clean(getFirstProp(props, FIELD_IATA_CANDIDATES)).toUpperCase();
  }

  function parseGeoNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const normalized = String(value)
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".")
      .replace(/[^0-9+\-.]/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function getNumericProp(props, keys) {
    return parseGeoNumber(getFirstProp(props || {}, keys));
  }

  function getSeismicZone(feature) {
    const props = feature?.properties || {};
    const raw = clean(getFirstProp(props, ["zona_sismo", "Zona_sismo", "ZONA_SISMO", "zona", "Zona"]));
    const match = raw.match(/[0-4]/);
    return match ? Number(match[0]) : null;
  }

  function seismicZoneStyle(feature) {
    const colors = {
      0: "#ffffcc",
      1: "#ffeda0",
      2: "#feb24c",
      3: "#f03b20",
      4: "#bd0026"
    };
    const zone = getSeismicZone(feature);
    const fillColor = colors[zone] || "#d9d9d9";

    return {
      color: zone !== null && zone >= 3 ? "#7f1d1d" : "#7c6f2e",
      weight: 1.15,
      opacity: 0.9,
      fillColor,
      fillOpacity: 0.34
    };
  }

  function earthquakePointStyle(feature) {
    const props = feature?.properties || {};
    const magnitude = getNumericProp(props, ["magnitud", "Magnitud", "MAGNITUD", "mag", "MAG"]);

    let fillColor = "#ffd54f";
    if (magnitude !== null && magnitude >= 5) fillColor = "#b71c1c";
    else if (magnitude !== null && magnitude >= 4) fillColor = "#f4511e";
    else if (magnitude !== null && magnitude >= 3) fillColor = "#ff9800";

    return {
      radius: magnitude === null ? 4.5 : Math.max(3.5, Math.min(10, 2.2 + magnitude * 1.25)),
      color: "#7f1d1d",
      weight: 1.15,
      opacity: 0.95,
      fillColor,
      fillOpacity: 0.84
    };
  }

  function featureTitle(feature, fallback) {
    const p = feature?.properties || {};
    return clean(getFirstProp(p, [
      "nombre", "Nombre", "NOMBRE", "name", "Name", "Aeropuerto", "aeropuerto",
      "etiqueta", "ETIQUETA", "tipo", "Tipo", "descripcion", "Descripción",
      "volcan", "Volcan", "VOLCAN", "nombre_volcan", "Nombre_volcan",
      "lugar", "Lugar", "ubicacion", "Ubicacion", "nam", "NAM", "fecha", "Fecha",
      "IATA", "iata"
    ])) || fallback || "Elemento";
  }

  function hasGeometry(feature) {
    return !!feature?.geometry;
  }
function isPolygonGeometry(feature) {
  const type = feature?.geometry?.type;
  return type === "Polygon" || type === "MultiPolygon";
}

function getDetailLabelValue(cfg, feature) {
  const props = feature?.properties || {};

  if (cfg.id === "paradasapp") return "Parada TP";

  const byLayer = {
    cabeceras: ["Cabecera", "cabecera", "CABECERA", "etiqueta", "ETIQUETA"],
    pistas: ["tipo", "Tipo", "TIPO"],

    plataformas: [
      "etiqueta", "Etiqueta", "ETIQUETA",
      "tipo", "Tipo", "TIPO",
      "nombre", "Nombre", "NOMBRE"
    ],

    psn: ["posicion", "Posicion", "posición", "Posición", "POSICION"],
    terminales2026: ["tipo", "Tipo", "TIPO"]
  };

  const candidates = byLayer[cfg.id];
  if (!candidates) return "";

  return clean(getFirstProp(props, candidates));
}

function getAirportShortName(airport) {
  const p = airport?.properties || {};

  return clean(
    p.Aeropuerto ||
    p.aeropuerto ||
    airport?.nombre ||
    airport?.iata
  ) || "Aeropuerto";
}

  function getPredioBoundsForAirport(iata) {
    const pred = state.layerDefs.get("predios")?.geojson;
    if (!pred?.features?.length) return null;
    const feats = pred.features.filter((f) => getFeatureIata(f) === iata && hasGeometry(f));
    if (!feats.length) return null;
    const layer = L.geoJSON(feats);
    const b = layer.getBounds();
    return b.isValid() ? b : null;
  }

  function makeBaseLayer(cfg) {
    return L.tileLayer(cfg.url, {
      minZoom: cfg.minZoom ?? 0,
      maxZoom: cfg.maxZoom ?? 20,
      maxNativeZoom: cfg.nativeMaxZoom,
      minNativeZoom: cfg.nativeMinZoom,
      tms: !!cfg.tms,
      attribution: cfg.attribution || ""
    });
  }

  function addPermanentHillshade(map) {
    const cfg = PERMANENT_HILLSHADE_CONFIG;

    const layer = L.tileLayer(cfg.url, {
      pane: cfg.pane,
      minZoom: cfg.minZoom,
      maxZoom: cfg.maxZoom,
      maxNativeZoom: cfg.nativeMaxZoom,
      opacity: cfg.opacity,
      attribution: cfg.attribution
    });

    layer.addTo(map);
    state.hillshadeLayer = layer;

    // Protección adicional: si alguna rutina externa intenta quitarla,
    // se vuelve a agregar automáticamente.
    map.on("layerremove", (event) => {
      if (event.layer !== state.hillshadeLayer) return;
      window.requestAnimationFrame(() => {
        if (state.map && state.hillshadeLayer && !state.map.hasLayer(state.hillshadeLayer)) {
          state.hillshadeLayer.addTo(state.map);
        }
      });
    });
  }

function createSigaPanes(map) {
  const panes = [
    ["sigaHillshadePane", 250],
    ["sigaContextPane", 410],
    ["sigaHazardAreaPane", 420],
    ["sigaPredioPane", 430],
    ["sigaMovimientoPane", 470],
    ["sigaInfraPane", 510],
    ["sigaServiciosPane", 540],
    ["sigaHazardPointPane", 545],
    ["sigaLabelsPane", 650]
  ];

  panes.forEach(([name, zIndex]) => {
    if (!map.getPane(name)) map.createPane(name);
    map.getPane(name).style.zIndex = zIndex;
  });

  const hillshadePane = map.getPane("sigaHillshadePane");
  if (hillshadePane) {
    hillshadePane.style.pointerEvents = "none";
    hillshadePane.style.mixBlendMode = "multiply";
  }
}

function getLayerPaneId(layerId) {
  if (layerId === "provincias") return "sigaContextPane";

  if (layerId === "inpres_sismos_zonificacion") return "sigaHazardAreaPane";

  if ([
    "inpres_sismos",
    "usgs_sismos_recientes",
    "segemar_riesgo_volcanico_2025",
    "segemar_volcanes"
  ].includes(layerId)) {
    return "sigaHazardPointPane";
  }

  if (layerId === "predios") return "sigaPredioPane";

  if ([
    "pistas",
    "cabeceras",
    "plataformas",
    "psn"
  ].includes(layerId)) {
    return "sigaMovimientoPane";
  }

  if ([
    "terminales2026",
    "hangares",
    "otros",
    "estacionamientos",
    "aeroplantas"
  ].includes(layerId)) {
    return "sigaInfraPane";
  }

  if ([
    "torres",
    "paradasapp",
    "smn"
  ].includes(layerId)) {
    return "sigaServiciosPane";
  }

  return "overlayPane";
}
  function createMap() {
    const map = L.map("sigaMap", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        wheelPxPerZoomLevel: 150,
      preferCanvas: false,
      fullscreenControl: !!L.Control.FullScreen
    });

    BASEMAP_CONFIGS.forEach((cfg) => {
      const layer = makeBaseLayer(cfg);
      state.baseLayers[cfg.name] = layer;
      state.baseLayerConfigs.set(cfg.id, { ...cfg, layer });
    });

state.map = map;

createSigaPanes(map);

setBaseLayer(DEFAULT_BASEMAP_ID, { auto: true, silent: true });
addPermanentHillshade(map);

    map.on("baselayerchange", (e) => {
      if (state.autoSwitchingBaseLayer) return;
      const found = BASEMAP_CONFIGS.find((cfg) => cfg.name === e.name);
      if (!found) return;
      state.activeBaseLayerId = found.id;
      state.userChangedBaseLayer = true;
      renderBaseLayerTree();
    });

    L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);
const zoomIndicator = L.control({ position: "bottomleft" });

zoomIndicator.onAdd = function () {
  const div = L.DomUtil.create("div", "siga-zoom-indicator");
  div.textContent = `Zoom: ${map.getZoom().toFixed(2)}`;
  return div;
};

zoomIndicator.addTo(map);

map.on("zoomend", () => {
  const el = document.querySelector(".siga-zoom-indicator");
  if (el) el.textContent = `Zoom: ${map.getZoom().toFixed(2)}`;
});
    addOptionalControls(map);
  }

  function addOptionalControls(map) {
    try {
      if (L.control.locate) L.control.locate({ position: "topleft", flyTo: true, strings: { title: "Mostrar mi ubicación" } }).addTo(map);
    } catch (e) { console.warn("Locate plugin no disponible", e); }

    try {
      if (L.Control.geocoder) L.Control.geocoder({ position: "topleft", defaultMarkGeocode: true, placeholder: "Buscar lugar…" }).addTo(map);
    } catch (e) { console.warn("Geocoder plugin no disponible", e); }

    try {
      if (L.control.measure) L.control.measure({ position: "topleft", primaryLengthUnit: "meters", primaryAreaUnit: "sqmeters", activeColor: SIGA_COLORS.azulMedio, completedColor: SIGA_COLORS.violeta }).addTo(map);
    } catch (e) { console.warn("Measure plugin no disponible", e); }

    try {
      state.drawnItems = new L.FeatureGroup();
      map.addLayer(state.drawnItems);
      if (L.Control.Draw) {
        const drawControl = new L.Control.Draw({
          position: "topleft",
          edit: { featureGroup: state.drawnItems },
          draw: { circle: false, circlemarker: false }
        });
        map.addControl(drawControl);
        map.on(L.Draw.Event.CREATED, (event) => state.drawnItems.addLayer(event.layer));
      }
    } catch (e) { console.warn("Draw plugin no disponible", e); }

    try {
      if (L.Control.MiniMap) {
        const miniLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 20 });
        new L.Control.MiniMap(miniLayer, { toggleDisplay: true, minimized: true, position: "bottomright" }).addTo(map);
      }
    } catch (e) { console.warn("MiniMap plugin no disponible", e); }

    try {
      if (L.control.mousePosition) L.control.mousePosition({ position: "bottomright", separator: " | ", prefix: "Lat/Lon" }).addTo(map);
    } catch (e) { console.warn("MousePosition plugin no disponible", e); }

    try {
      if (L.easyPrint) L.easyPrint({ title: "Imprimir mapa", position: "topleft", sizeModes: ["Current", "A4Landscape", "A4Portrait"] }).addTo(map);
    } catch (e) { console.warn("EasyPrint plugin no disponible", e); }
  }

  async function loadJson(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  }
async function loadText(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.text();
}

function parseCsvLine(line, separator = ";") {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === separator && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current.trim());
  return out;
}

function parseSemicolonCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0], ";").map(h => clean(h));

  return lines.slice(1).map(line => {
    const values = parseCsvLine(line, ";");
    const row = {};

    headers.forEach((header, idx) => {
      row[header] = clean(values[idx]);
    });

    return row;
  });
}

async function loadParadasAppCsv() {
  state.paradasAppRowsByIata = new Map();

  try {
    const text = await loadText(PARADAS_APP_CSV_SOURCE);
    const rows = parseSemicolonCsv(text);

    rows.forEach((row) => {
      const iata = clean(row.IATA || row.iata).toUpperCase();
      if (!iata) return;

      if (!state.paradasAppRowsByIata.has(iata)) {
        state.paradasAppRowsByIata.set(iata, []);
      }

      state.paradasAppRowsByIata.get(iata).push({
        IATA: iata,
        LINEA: clean(row.LINEA || row.Linea || row.linea || row["Línea"]),
        Parada: clean(row.Parada || row.PARADA || row.parada)
      });
    });
  } catch (e) {
    console.warn("No se pudo cargar Paradasapp.csv", e);
  }
}

function enrichParadasAppGeojson(geojson) {
  if (!geojson?.features?.length) return geojson;

  const assignedByIata = new Map();

  geojson.features.forEach((feature) => {
    const props = feature.properties || {};
    const iata = clean(props.IATA || props.iata || getFeatureIata(feature)).toUpperCase();

    if (!iata) return;

    const rows = state.paradasAppRowsByIata.get(iata) || [];
    if (!rows.length) return;

    const used = assignedByIata.get(iata) || 0;
    const row = rows[used] || rows[0];

    assignedByIata.set(iata, used + 1);

    feature.properties = {
      ...props,
      IATA: props.IATA || iata,
      LINEA: props.LINEA || row.LINEA || "",
      Parada: props.Parada || row.Parada || ""
    };
  });

  return geojson;
}

function enrichUsgsGeojson(geojson) {
  if (!geojson?.features?.length) return geojson;

  const dateFormatter = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Argentina/Buenos_Aires"
  });

  geojson.features.forEach((feature) => {
    const props = feature.properties || {};
    const coordinates = feature?.geometry?.coordinates || [];
    const timestamp = Number(props.time);

    feature.properties = {
      ...props,
      fecha: Number.isFinite(timestamp) ? dateFormatter.format(new Date(timestamp)) : "",
      profundidad: coordinates.length > 2 ? coordinates[2] : "",
      fuente: "USGS",
      id: feature.id || props.id || ""
    };
  });

  return geojson;
}
  async function loadAirports() {
    const gj = await loadJson(AIRPORTS_SOURCE);
    state.airports = (gj.features || [])
      .map((f) => {
        const p = f.properties || {};
        const iata = clean(p.IATA || p.iata).toUpperCase();
        const nombre = clean(p.Aeropuerto || p["Nombre del Aeropuerto"] || p.nombre || p.name || iata);
        return { iata, nombre, properties: p, feature: f };
      })
      .filter((a) => a.iata)
      .sort((a, b) => a.iata.localeCompare(b.iata));

    state.airports.forEach((a) => state.airportIndex.set(a.iata, a));
    renderAirportSelects();
  }

function normalizeSearchTerm(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getAirportSearchText(airport) {
  const p = airport?.properties || {};

  return normalizeSearchTerm([
    airport.iata,
    airport.nombre,
    p.Aeropuerto,
    p.aeropuerto,
    p["Nombre del Aeropuerto"],
    p.nombre,
    p.name,
    p.Ciudad,
    p["Ciudad/Localidad"],
    p.Localidad,
    p.Provincia,
    p.OACI,
    p.oaci
  ].filter(Boolean).join(" "));
}

function populateAirportSelect(select, airports) {
  const currentValue = select.value;

  select.innerHTML = `<option value="">Seleccionar aeropuerto…</option>`;

  airports.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.iata;
    opt.textContent = `${a.nombre} (${a.iata})`;
    select.appendChild(opt);
  });

  if (currentValue && airports.some((a) => a.iata === currentValue)) {
    select.value = currentValue;
  }
}

function wireAirportSearch() {
  const search = q("airportSearch");
  const select = q("airportSelect");
  const results = q("airportSearchResults");

  if (!search || !select || !results || search.dataset.bound === "1") return;

  search.dataset.bound = "1";

  let highlightedIndex = -1;
  let currentResults = [];

  function closeResults() {
    results.classList.remove("is-open");
    highlightedIndex = -1;
  }

  function selectAirport(iata) {
    if (!iata || !state.airportIndex.has(iata)) return;

    const airport = state.airportIndex.get(iata);

    select.value = iata;
    search.value = `${airport.nombre} (${airport.iata})`;

    closeResults();

    select.dispatchEvent(new Event("change"));
  }

  function renderResults(term = "") {
    const normalized = normalizeSearchTerm(term);

    currentResults = normalized
      ? state.airports.filter((a) => getAirportSearchText(a).includes(normalized))
      : state.airports;

    results.innerHTML = "";

    if (!currentResults.length) {
      results.innerHTML = `
        <div class="siga-search-result">
          No se encontraron aeropuertos.
        </div>
      `;
      results.classList.add("is-open");
      return;
    }

    currentResults.slice(0, 80).forEach((airport, index) => {
      const item = document.createElement("div");
      item.className = "siga-search-result";
      item.dataset.iata = airport.iata;
      item.dataset.index = String(index);

      item.innerHTML = `
        <span class="siga-search-result-code">${escapeHtml(airport.iata)}</span>
        ${escapeHtml(airport.nombre)}
      `;

      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectAirport(airport.iata);
      });

      results.appendChild(item);
    });

    results.classList.add("is-open");
  }

  function updateHighlight() {
    results.querySelectorAll(".siga-search-result").forEach((el, idx) => {
      el.classList.toggle("is-highlighted", idx === highlightedIndex);
    });
  }

  search.addEventListener("focus", () => {
    renderResults(search.value);
  });

  search.addEventListener("input", () => {
    highlightedIndex = -1;
    renderResults(search.value);
  });

  search.addEventListener("keydown", (e) => {
    if (!results.classList.contains("is-open")) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        renderResults(search.value);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, currentResults.length - 1);
      updateHighlight();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      updateHighlight();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const selected =
        highlightedIndex >= 0
          ? currentResults[highlightedIndex]
          : currentResults[0];

      if (selected) selectAirport(selected.iata);
      return;
    }

    if (e.key === "Escape") {
      closeResults();
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".siga-airport-combobox")) {
      closeResults();
    }
  });
}

function renderAirportSelects() {
  const selects = [q("airportSelect"), q("airportSelectEmbed")].filter(Boolean);

  selects.forEach((select) => {
    populateAirportSelect(select, state.airports);

    if (URL_AIRPORT && state.airportIndex.has(URL_AIRPORT)) {
      select.value = URL_AIRPORT;
    }

    if (select.dataset.bound === "1") return;
    select.dataset.bound = "1";

    select.addEventListener("change", (e) => {
      state.selectedAirport = e.target.value;

      syncAirportSelects(state.selectedAirport);

      if (select.id === "airportSelect") {
        const search = q("airportSearch");
        const airport = state.airportIndex.get(state.selectedAirport);

        if (search && airport) {
          search.value = `${airport.nombre} (${airport.iata})`;
        }

        populateAirportSelect(select, state.airports);
        select.value = state.selectedAirport;
      }

      if (state.selectedAirport) zoomToAirport(state.selectedAirport);

      updateUrl(false);
    });
  });

  wireAirportSearch();
}

  function syncAirportSelects(iata) {
    [q("airportSelect"), q("airportSelectEmbed")].forEach((select) => {
      if (select && select.value !== iata) select.value = iata || "";
    });
  }

function buildAirportLabelText(iata, name) {
  const code = `(${escapeHtml(clean(iata).toUpperCase())})`;
  const cleanName = clean(name);

  if (!cleanName) {
    return {
      line1: code,
      line2: ""
    };
  }

  const words = cleanName.split(/\s+/).filter(Boolean);

  // Si el nombre es corto, deja el código arriba y el nombre abajo.
  // Ejemplo:
  // (AEP)
  // Aeroparque
  if (cleanName.length <= 15 || words.length <= 1) {
    return {
      line1: code,
      line2: escapeHtml(cleanName)
    };
  }

  // Si el nombre es largo, usa el código al inicio de la primera línea.
  // Ejemplo:
  // (CPC) San Martín
  // de los Andes
  const maxFirstLineNameChars = 13;
  const firstLineWords = [];
  const secondLineWords = [...words];

  while (secondLineWords.length) {
    const next = secondLineWords[0];
    const test = [...firstLineWords, next].join(" ");

    if (firstLineWords.length > 0 && test.length > maxFirstLineNameChars) {
      break;
    }

    firstLineWords.push(secondLineWords.shift());
  }

  return {
    line1: `${code} ${escapeHtml(firstLineWords.join(" "))}`,
    line2: escapeHtml(secondLineWords.join(" "))
  };
}
  function createAirportLabels() {
    if (!state.map) return;

    if (state.airportLabelLayer) {
      state.map.removeLayer(state.airportLabelLayer);
      state.airportLabelLayer = null;
    }

    const group = L.layerGroup();

    state.airports.forEach((airport) => {
      const bounds = getPredioBoundsForAirport(airport.iata);
      const center = bounds?.getCenter() || getAirportCenterFromFeature(airport.feature, airport.properties);
      if (!center) return;

const shortName = getAirportShortName(airport);
const label = buildAirportLabelText(airport.iata, shortName);

const html = `
  <div class="siga-airport-center-icon" aria-hidden="true">✈</div>
  <div class="siga-airport-floating-text">
    <span class="siga-airport-label-line siga-airport-label-line-1">${label.line1}</span>
    <span class="siga-airport-label-line siga-airport-label-line-2">${label.line2}</span>
  </div>
`;

      const marker = L.marker(center, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "siga-airport-label-marker",
          html,
          iconSize: [1, 1],
          iconAnchor: [0, 0]
        })
      });

      group.addLayer(marker);
    });

    state.airportLabelLayer = group;
    updateZoomDependentLabels();
  }

  function updateZoomDependentLabels() {
    if (!state.map) return;

    const z = state.map.getZoom();
    const showAirportLabels = z <= 7;
    const showDetailLabels = z >= 15;

    if (state.airportLabelLayer) {
      if (showAirportLabels && !state.map.hasLayer(state.airportLabelLayer)) {
        state.airportLabelLayer.addTo(state.map);
      } else if (!showAirportLabels && state.map.hasLayer(state.airportLabelLayer)) {
        state.map.removeLayer(state.airportLabelLayer);
      }
    }

    state.map.getContainer().classList.toggle("siga-show-detail-labels", showDetailLabels);
  }
function layerPassesZoom(def) {
  if (!def?.cfg) return false;

  const minZoom = def.cfg.minVisibleZoom;

  // Si la capa no tiene minVisibleZoom, se comporta como siempre.
  if (minZoom === undefined || minZoom === null) return true;

  return state.map && state.map.getZoom() >= minZoom;
}

function refreshZoomDependentLayers() {
  if (!state.map) return;

  state.layerDefs.forEach((def) => {
    if (!def?.layer) return;

    const shouldShow = !!def.active && layerPassesZoom(def);
    const isShown = state.map.hasLayer(def.layer);

    if (shouldShow && !isShown) {
      def.layer.addTo(state.map);
    } else if (!shouldShow && isShown) {
      state.map.removeLayer(def.layer);
    }
  });

  renderLegend();
}
  function makeLayer(cfg, geojson) {
const paneId = getLayerPaneId(cfg.id);

const options = {
  pane: paneId,
  interactive: true,
  style: (feature) => featureStyle(cfg, feature),
  pointToLayer: (feature, latlng) => {
    const p = pointFeatureStyle(cfg, feature);

return L.circleMarker(latlng, {
  pane: paneId,
  interactive: true,
  radius: p.radius,
  color: p.color,
  weight: p.weight ?? 1,
  opacity: p.opacity ?? 1,
  fillColor: p.fillColor,
  fillOpacity: p.fillOpacity
});
  },
  onEachFeature: (feature, layer) => bindFeature(cfg, feature, layer)
};

    return L.geoJSON(geojson, options);
  }

  function featureStyle(cfg, feature) {
    const base = cfg.style || { color: cfg.color, weight: 1.5, fillColor: cfg.color, fillOpacity: 0.35 };
    const dynamic = typeof cfg.styleByFeature === "function"
      ? cfg.styleByFeature(feature)
      : {};
    return { ...base, ...dynamic };
  }

  function pointFeatureStyle(cfg, feature) {
    const base = cfg.point || {
      radius: 4,
      color: cfg.color,
      fillColor: cfg.color,
      fillOpacity: 0.9
    };
    const dynamic = typeof cfg.pointStyle === "function"
      ? cfg.pointStyle(feature)
      : {};
    return { ...base, ...dynamic };
  }

  function isPointGeometry(feature) {
    const type = feature?.geometry?.type;
    return type === "Point" || type === "MultiPoint";
  }
function buildHoverTooltip(cfg, feature) {
  if (cfg.tooltip === false) return "";

  const props = feature?.properties || {};
  const fields = cfg.tooltipFields || [];

  // Si la capa no define tooltipFields, usa el comportamiento actual.
  if (!fields.length) {
    const title = featureTitle(feature, cfg.name);
    const iata = getFeatureIata(feature);
    return iata ? `${escapeHtml(iata)} · ${escapeHtml(title)}` : escapeHtml(title);
  }

  const rows = fields
    .map((field) => {
      const label = field.label || "";
      const keys = Array.isArray(field.keys) ? field.keys : [field.key];
      const value = clean(getFirstProp(props, keys));

      if (!value) return "";

      return `
        <div class="siga-tooltip-row">
          <span class="siga-tooltip-key">${escapeHtml(label)}</span>
          <span class="siga-tooltip-value">${escapeHtml(formatValue(value))}</span>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  if (!rows) {
    return escapeHtml(featureTitle(feature, cfg.name));
  }

  const title = cfg.tooltipTitle || cfg.name;

  return `
    <div class="siga-tooltip-title">${escapeHtml(title)}</div>
    ${rows}
  `;
}
  function getFeatureHoverName(cfg, feature) {
  if (cfg.id === "inpres_sismos_zonificacion") {
    const zone = getSeismicZone(feature);
    return zone === null ? "Zona sísmica" : `Zona sísmica: Zona ${zone}`;
  }

  const detailLabel = getDetailLabelValue(cfg, feature);

  const layerNames = {
    predios: "Predio aeroportuario",
    pistas: "Pista",
    cabeceras: "Cabecera",
    plataformas: "Plataforma",
    psn: "Posición de aeronave",
    aeroplantas: "Aeroplanta",
    terminales2026: "Terminal",
    torres: "Torre de control",
    hangares: "Hangar",
    otros: "Edificio",
    estacionamientos: "Estacionamiento vehicular",
    paradasapp: "Parada de transporte público",
    smn: "Estación meteorológica SMN",
    provincias: "Provincia"
  };

  const base = layerNames[cfg.id] || cfg.tooltipTitle || cfg.name || "Elemento";
  const title = featureTitle(feature, "");

if (detailLabel) {
  if (cfg.id === "paradasapp") {
    return `${base} líneas: ${detailLabel}`;
  }

  return `${base}: ${detailLabel}`;
}

  if (
    title &&
    title !== "Elemento" &&
    title !== cfg.name &&
    title !== base
  ) {
    return `${base}: ${title}`;
  }

  return base;
}

function ensureHoverLabel() {
  if (!state.map) return null;

  let el = document.getElementById("sigaHoverLabel");

  if (!el) {
    el = document.createElement("div");
    el.id = "sigaHoverLabel";
    el.className = "siga-map-hover-label";
    state.map.getContainer().appendChild(el);
  }

  return el;
}

function moveHoverLabel(originalEvent) {
  const el = ensureHoverLabel();
  if (!el || !originalEvent || !state.map) return;

  const rect = state.map.getContainer().getBoundingClientRect();
  const x = originalEvent.clientX - rect.left;
  const y = originalEvent.clientY - rect.top;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function showHoverLabel(cfg, feature, originalEvent) {
  const el = ensureHoverLabel();
  if (!el) return;

  el.textContent = getFeatureHoverName(cfg, feature);
  el.style.display = "block";

  moveHoverLabel(originalEvent);
}

function hideHoverLabel() {
  const el = document.getElementById("sigaHoverLabel");
  if (el) el.style.display = "none";
}

  
function bindFeature(cfg, feature, layer) {
  const detailLabel = getDetailLabelValue(cfg, feature);

  /*
    Mantiene etiquetas permanentes para los elementos que ya las tienen,
    pero la identificación al pasar el mouse ahora se maneja con
    la etiqueta flotante siga-map-hover-label.
  */
  if (cfg.polygonIcon && isPolygonGeometry(feature)) {
    layer.bindTooltip(cfg.polygonIcon.html || "", {
      permanent: true,
      direction: "center",
      className: cfg.polygonIcon.className || "siga-poly-center-icon"
    });
  } else if (detailLabel) {
    layer.bindTooltip(detailLabel, {
      permanent: true,
      direction: cfg.id === "psn" ? "top" : "center",
      className: `siga-tooltip siga-label-detail siga-label-detail-${cfg.id}`
    });
  }

  /*
    Clic: la información va al panel lateral izquierdo.
    No dependemos del popup del mapa.
  */
  layer.on("click", (e) => {
    if (e?.originalEvent) {
      L.DomEvent.stopPropagation(e.originalEvent);
    }

    setFeatureInfo(cfg, feature);
  });

layer.on("mouseover", (e) => {
  showHoverLabel(cfg, feature, e.originalEvent);
  state.map?.getContainer()?.classList.add("is-feature-hovering");

  if (!layer.setStyle || cfg.id === "provincias") return;

    // Predios y aeroplantas: solo engrosar borde, sin relleno.
if (cfg.id === "predios") {
  layer.setStyle({
    weight: Math.max(3, Number((cfg.style || {}).weight || 1.4) + 1.4),
    fill: false,
    fillOpacity: 0
  });
  return;
}

if (cfg.id === "aeroplantas") {
  layer.setStyle({
    weight: Math.max(3, Number((cfg.style || {}).weight || 1.4) + 1.4),
    fill: true,
    fillColor: "#d71920",
    fillOpacity: 0.06
  });
  return;
}

    const baseStyle = isPointGeometry(feature)
      ? pointFeatureStyle(cfg, feature)
      : featureStyle(cfg, feature);

    layer.setStyle({
      weight: Math.max(3, Number(baseStyle.weight || 1.5) + 1.5),
      fillOpacity: Math.min(1, Number(baseStyle.fillOpacity ?? 0.35) + 0.14)
    });
  });

  layer.on("mousemove", (e) => {
    moveHoverLabel(e.originalEvent);
  });

layer.on("mouseout", () => {
  hideHoverLabel();
  state.map?.getContainer()?.classList.remove("is-feature-hovering");

  const def = state.layerDefs.get(cfg.id);
    if (layer.setStyle && def) {
      const baseStyle = isPointGeometry(feature)
        ? pointFeatureStyle(cfg, feature)
        : featureStyle(cfg, feature);
      layer.setStyle(baseStyle);
    }
  });
}

function getImportantProps(feature, cfg = {}) {
  const props = feature?.properties || {};

  if (Array.isArray(cfg.popupFields) && cfg.popupFields.length) {
    return cfg.popupFields
      .map((field) => {
        const label = field.label || field.key || "";
        const keys = Array.isArray(field.keys) ? field.keys : [field.key];
        const value = getFirstProp(props, keys);

        if (value === undefined || value === null || String(value).trim() === "") return null;

        const suffix = field.suffix ? ` ${field.suffix}` : "";
        return [label, `${formatValue(value)}${suffix}`];
      })
      .filter(Boolean);
  }

  const preferred = [
    "IATA", "iata", "OACI", "oaci", "ANAC", "Aeropuerto", "nombre", "Nombre", "NOMBRE",
    "tipo", "Tipo", "etiqueta", "ETIQUETA", "orientacion", "Orientacion", "PistaOrientacion",
    "longitud", "Longitud", "dimensiones", "Dimensiones", "superficie", "Superficie", "metros2", "m2",
    "posicion", "Posicion", "clase", "Clase", "estado", "Estado",
    "fecha", "Fecha", "magnitud", "Magnitud", "profund", "profundidad", "intensidad", "categoria",
    "nam", "provincia", "Provincia", "zona_sismo", "p_sismica", "acelerac",
    "volcan", "Volcan", "riesgo", "Riesgo", "ranking", "Ranking", "fuente", "Fuente"
  ];

  const out = [];
  preferred.forEach((key) => {
    if (props[key] !== undefined && props[key] !== null && String(props[key]).trim() !== "") {
      out.push([key, props[key]]);
    }
  });

  Object.keys(props).forEach((key) => {
    if (out.length >= 12) return;
    if (preferred.includes(key)) return;
    const val = props[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") out.push([key, val]);
  });

  return out.slice(0, 12);
}

function buildPopupHtml(cfg, feature) {
  const rows = getImportantProps(feature, cfg);
  const title = featureTitle(feature, cfg.name);

  return `
    <div class="siga-popup-title">${escapeHtml(cfg.popupTitle || cfg.name)} · ${escapeHtml(title)}</div>
    <table class="siga-popup-table">
      ${rows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(formatValue(v))}</td></tr>`).join("")}
    </table>
  `;
}

function setFeatureInfo(cfg, feature) {
  const el = q("featureInfo");
  if (!el) return;

  const title = featureTitle(feature, cfg.name);
  const rows = getImportantProps(feature, cfg);

  el.innerHTML = `
    <div class="feature-title">${escapeHtml(cfg.popupTitle || cfg.name)} · ${escapeHtml(title)}</div>
    <table class="feature-table">
      ${rows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(formatValue(v))}</td></tr>`).join("")}
    </table>
  `;
}

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function loadConfiguredLayers() {
    const status = q("mapStatus");
    let loaded = 0;
    let failed = 0;

    for (const cfg of LAYER_CONFIGS) {
      try {
        let gj = await loadJson(cfg.url);

if (cfg.id === "paradasapp") {
  gj = enrichParadasAppGeojson(gj);
}

if (cfg.id === "usgs_sismos_recientes") {
  gj = enrichUsgsGeojson(gj);
}

const layer = makeLayer(cfg, gj);
        const def = { cfg, geojson: gj, layer, active: false, opacity: cfg.opacity ?? 1 };
        state.layerDefs.set(cfg.id, def);

        applyLayerOpacity(layer, def.opacity);
        if (cfg.active) setLayerActive(cfg.id, true);
        loaded += 1;
        if (status) status.textContent = `Capas cargadas: ${loaded}/${LAYER_CONFIGS.length}`;
      } catch (e) {
        console.warn(`No se pudo cargar ${cfg.url}`, e);
        state.layerDefs.set(cfg.id, { cfg, geojson: null, layer: null, active: false, error: true, opacity: cfg.opacity ?? 1 });
        failed += 1;
      }
    }

    renderBaseLayerTree();
    renderLayerTree();
    renderLegend();
    if (status) status.textContent = failed ? `Capas cargadas: ${loaded}. No disponibles: ${failed}.` : `Capas cargadas: ${loaded}.`;
  }

function setLayerActive(id, active) {
  const def = state.layerDefs.get(id);
  if (!def || !def.layer) return;

  def.active = !!active;

  const shouldShow = def.active && layerPassesZoom(def);
  const isShown = state.map.hasLayer(def.layer);

  if (shouldShow && !isShown) {
    def.layer.addTo(state.map);
  } else if (!shouldShow && isShown) {
    state.map.removeLayer(def.layer);
  }

  renderLegend();
}

  function applyLayerOpacity(layer, opacity) {
    if (!layer) return;
    layer.eachLayer?.((l) => {
if (l.setStyle) {
  const style = {};

  if (l.options.fill === false) {
    style.fill = false;
    style.fillOpacity = 0;
  } else if (l.options.fillOpacity !== undefined) {
    style.fillOpacity = opacity * (l.options.fillOpacity ?? 0.5);
  }

  if (l.options.opacity !== undefined) style.opacity = opacity;

  l.setStyle(style);
}
      if (l.setOpacity) l.setOpacity(opacity);
    });
  }

  function setBaseLayer(id, opts = {}) {
    const { auto = false, silent = false } = opts;
    const def = state.baseLayerConfigs.get(id);
    if (!def || !def.layer) return;

    if (!auto && !silent) state.userChangedBaseLayer = true;

    Object.values(state.baseLayers).forEach((layer) => {
      if (state.map?.hasLayer(layer)) state.map.removeLayer(layer);
    });

    state.autoSwitchingBaseLayer = true;
    def.layer.addTo(state.map);
    state.activeBaseLayerId = id;
    state.autoSwitchingBaseLayer = false;

    renderBaseLayerTree();
  }

  function maybeSwitchBaseLayerForAirport() {
    if (!state.userChangedBaseLayer) {
      setBaseLayer(AIRPORT_BASEMAP_ID, { auto: true });
    }
  }

  function maybeSwitchBaseLayerForArgentina() {
    if (!state.userChangedBaseLayer) {
      setBaseLayer(DEFAULT_BASEMAP_ID, { auto: true });
    }
  }

  function renderBaseLayerTree() {
    const root = q("baseLayerTree");
    if (!root) return;

    root.innerHTML = BASEMAP_CONFIGS.map((cfg) => {
      const checked = state.activeBaseLayerId === cfg.id ? "checked" : "";
      const swatchStyle = cfg.swatchImage
        ? `background-image:url('${cfg.swatchImage}'); background-size:cover; background-position:center;`
        : `background:${cfg.swatch || "#d0d7e2"};`;

      return `
        <label class="basemap-row" title="${escapeHtml(cfg.name)}">
          <input type="radio" name="sigaBaseMap" value="${escapeHtml(cfg.id)}" ${checked}>
          <span class="basemap-thumb" style="${swatchStyle}"></span>
          <span class="basemap-name">${escapeHtml(cfg.name)}</span>
        </label>
      `;
    }).join("");

    root.querySelectorAll('input[name="sigaBaseMap"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        setBaseLayer(e.target.value, { auto: false });
      });
    });
  }

function renderLayerTree() {
  const root = q("layerTree");
  if (!root) return;

  const groups = new Map();
  LAYER_CONFIGS.forEach((cfg) => {
    if (!groups.has(cfg.group)) groups.set(cfg.group, []);
    groups.get(cfg.group).push(cfg);
  });

  const orderedGroups = [
    ...LAYER_GROUP_ORDER.filter((groupName) => groups.has(groupName)),
    ...Array.from(groups.keys()).filter((groupName) => !LAYER_GROUP_ORDER.includes(groupName))
  ];

  root.innerHTML = "";
  orderedGroups.forEach((groupName) => {
    const items = groups.get(groupName);
      const groupEl = document.createElement("div");
      groupEl.className = "layer-group";
      groupEl.innerHTML = `<div class="layer-group-title">${escapeHtml(groupName)}</div>`;

      items.forEach((cfg) => {
        const def = state.layerDefs.get(cfg.id);
        const row = document.createElement("label");
        row.className = "layer-row";
        row.innerHTML = `
          <input type="checkbox" ${def?.active ? "checked" : ""} ${def?.error ? "disabled" : ""} data-layer-id="${cfg.id}">
          <span class="layer-swatch" style="background:${cfg.color};"></span>
          <span class="layer-name" title="${escapeHtml(cfg.name)}">${escapeHtml(cfg.name)}${def?.error ? " (no disponible)" : ""}</span>
          <input class="layer-opacity" type="range" min="0.1" max="1" step="0.05" value="${def?.opacity ?? cfg.opacity ?? 1}" data-opacity-id="${cfg.id}" ${def?.error ? "disabled" : ""}>
        `;
        groupEl.appendChild(row);
      });

      root.appendChild(groupEl);
    });

    root.querySelectorAll("input[type='checkbox'][data-layer-id]").forEach((input) => {
      input.addEventListener("change", (e) => setLayerActive(e.target.dataset.layerId, e.target.checked));
    });

    root.querySelectorAll("input[type='range'][data-opacity-id]").forEach((input) => {
      input.addEventListener("input", (e) => {
        const def = state.layerDefs.get(e.target.dataset.opacityId);
        if (!def) return;
        def.opacity = Number(e.target.value);
        applyLayerOpacity(def.layer, def.opacity);
      });
    });
  }

  function renderLegend() {
    const el = q("mapLegend");
    if (!el) return;
    const active = Array.from(state.layerDefs.values()).filter((def) =>
    def.active && def.layer && state.map?.hasLayer(def.layer)
    );
    if (!active.length) {
      el.innerHTML = `<div class="siga-hint">No hay capas activas.</div>`;
      return;
    }
    el.innerHTML = active
      .map((def) => {
        const items = Array.isArray(def.cfg.legendItems) ? def.cfg.legendItems : [];

        if (items.length) {
          return `
            <div class="legend-layer">
              <div class="legend-layer-title">${escapeHtml(def.cfg.name)}</div>
              ${items.map((item) => `
                <div class="legend-item">
                  <span class="legend-swatch ${item.shape === "point" ? "legend-swatch-point" : ""}" style="background:${item.color};"></span>
                  <span>${escapeHtml(item.label)}</span>
                </div>
              `).join("")}
            </div>
          `;
        }

        return `<div class="legend-item"><span class="legend-swatch" style="background:${def.cfg.color};"></span><span>${escapeHtml(def.cfg.name)}</span></div>`;
      })
      .join("");
  }

  function setDefaultLayers() {
    LAYER_CONFIGS.forEach((cfg) => setLayerActive(cfg.id, !!cfg.active));
    renderLayerTree();
  }

  function setAllLayers(active) {
    LAYER_CONFIGS.forEach((cfg) => setLayerActive(cfg.id, !!active));
    renderLayerTree();
  }

  function zoomArgentina() {
    maybeSwitchBaseLayerForArgentina();
    clearAirportHighlight();
    state.selectedAirport = "";
    syncAirportSelects("");

    const prov = state.layerDefs.get("provincias")?.layer;
    if (prov) {
      const b = prov.getBounds();
      if (b.isValid()) state.map.fitBounds(b, { padding: [20, 20] });
      return;
    }
    state.map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  function zoomToAirport(iata) {
    const code = clean(iata).toUpperCase();
    if (!code) return;
    state.selectedAirport = code;
    syncAirportSelects(code);
    maybeSwitchBaseLayerForAirport();

    const bounds = findAirportBounds(code);
    if (bounds && bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 17 });
      // No dibujamos polígono de predio seleccionado: entorpece la lectura de capas internas.
      const hint = q("airportHint");
      if (hint) hint.textContent = `Vista centrada en ${code}.`;
      updateUrl(true);
      return;
    }

    const airport = state.airportIndex.get(code);
    const center = getAirportCenterFromFeature(airport?.feature, airport?.properties);
    if (center) {
      state.map.setView(center, 14);
      updateUrl(true);
    }
  }

  function findAirportBounds(iata) {
    let bounds = null;
    ["predios", "pistas", "plataformas", "terminales2026"].forEach((id) => {
      const def = state.layerDefs.get(id);
      if (!def?.geojson?.features?.length) return;
      const feats = def.geojson.features.filter((f) => getFeatureIata(f) === iata && hasGeometry(f));
      if (!feats.length) return;
      const layer = L.geoJSON(feats);
      const b = layer.getBounds();
      if (!b.isValid()) return;
      bounds = bounds ? bounds.extend(b) : b;
    });
    return bounds;
  }

  function getAirportCenterFromFeature(feature, props) {
    if (feature?.geometry) {
      try {
        const layer = L.geoJSON(feature);
        const b = layer.getBounds();
        if (b.isValid()) return b.getCenter();
      } catch (_) {}
    }
    const lat = Number(props?.Lat ?? props?.LAT ?? props?.latitud ?? props?.Latitud);
    const lon = Number(props?.Lon ?? props?.LON ?? props?.Long ?? props?.longitud ?? props?.Longitud);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return L.latLng(lat, lon);
    return null;
  }

  function highlightAirport(iata) {
    // Desactivado a pedido: no se dibuja un polígono de predio seleccionado,
    // para no tapar ni competir visualmente con las capas internas del aeropuerto.
  }

  function clearAirportHighlight() {
    // Sin resaltado persistente de predio.
  }

  function updateUrl(focused) {
    const url = new URL(window.location.href);
    if (state.selectedAirport) url.searchParams.set("airport", state.selectedAirport);
    else url.searchParams.delete("airport");
    if (focused) url.searchParams.set("focus", "1");
    else url.searchParams.delete("focus");
    if (EMBED_MODE) url.searchParams.set("embed", "1");
    window.history.replaceState({}, "", url);
  }

  function wireUi() {
    q("btnZoomAirport")?.addEventListener("click", () => zoomToAirport(q("airportSelect")?.value));
    q("btnZoomAirportEmbed")?.addEventListener("click", () => zoomToAirport(q("airportSelectEmbed")?.value));
    q("btnArgentina")?.addEventListener("click", zoomArgentina);
    q("btnArgentinaTop")?.addEventListener("click", zoomArgentina);
    q("btnDefaultLayers")?.addEventListener("click", setDefaultLayers);
    q("btnAllLayers")?.addEventListener("click", () => setAllLayers(true));
    q("btnNoLayers")?.addEventListener("click", () => setAllLayers(false));

    const openFull = () => {
      const iata = state.selectedAirport || q("airportSelect")?.value || q("airportSelectEmbed")?.value || "";
      const url = new URL("siga.html", window.location.href);
      if (iata) {
        url.searchParams.set("airport", iata);
        url.searchParams.set("focus", "1");
      }
      window.open(url.toString(), "_blank");
    };
    q("btnOpenFull")?.addEventListener("click", openFull);
    q("btnOpenFullEmbed")?.addEventListener("click", openFull);
  }

  async function init() {
    createMap();
    wireUi();
    renderBaseLayerTree();

    try {
await loadAirports();
await loadParadasAppCsv();
await loadConfiguredLayers();
      createAirportLabels();
      state.map.on("zoomend", () => {
      updateZoomDependentLabels();
      refreshZoomDependentLayers();
      });
      updateZoomDependentLabels();
      refreshZoomDependentLayers();

      setTimeout(() => state.map.invalidateSize(), 50);

      if (URL_AIRPORT && state.airportIndex.has(URL_AIRPORT)) {
        state.selectedAirport = URL_AIRPORT;
        syncAirportSelects(URL_AIRPORT);
        if (URL_FOCUS || EMBED_MODE) zoomToAirport(URL_AIRPORT);
        else zoomArgentina();
      } else {
        zoomArgentina();
      }
    } catch (e) {
      console.error("Error inicializando SIGA", e);
      const status = q("mapStatus");
      if (status) status.textContent = "Error al cargar el visor SIGA. Revisá la consola.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
