(() => {
"use strict";

const DATA_VERSION="20261116-2";
const DATA_URL=`/geodata/fuentes/ANAC/aerodromos_madhel_2026.geojson?v=${DATA_VERSION}`;

const dom={
  search:document.getElementById("searchInput"),
  province:document.getElementById("provinceSelect"),
  control:document.getElementById("controlSelect"),
  snaToggle:document.getElementById("snaToggle"),
  otherToggle:document.getElementById("otherToggle"),
  visibleCount:document.getElementById("visibleCount"),
  snaCount:document.getElementById("snaCount"),
  publicCount:document.getElementById("publicCount"),
  privateCount:document.getElementById("privateCount"),
  resultList:document.getElementById("resultList"),
  reset:document.getElementById("resetFilters"),
  fit:document.getElementById("fitMapButton"),
  fullscreen:document.getElementById("fullscreenButton"),
  legend:document.getElementById("mapLegend"),
  legendToggle:document.getElementById("legendToggle"),
  basemapButtons:document.getElementById("basemapButtons"),
  aboutButton:document.getElementById("aboutButton"),
  aboutDialog:document.getElementById("aboutDialog"),
  aboutClose:document.getElementById("aboutClose"),
  loading:document.getElementById("loadingOverlay")
};

const argenmap=L.tileLayer(
  "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
  {tms:true,maxZoom:14,attribution:"© IGN Argentina"}
);

const osm=L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {maxZoom:19,attribution:"© OpenStreetMap"}
);

const satellite=L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {maxZoom:19,attribution:"Tiles © Esri"}
);

const baseLayers={argenmap,osm,satellite};
let currentBase="argenmap";

const map=L.map("map",{
  zoomControl:false,
  minZoom:3,
  maxZoom:19,
  zoomSnap:.25,
  zoomDelta:.25,
  worldCopyJump:false,
  layers:[argenmap]
}).setView([-38.4,-63.6],4);

L.control.zoom({position:"topleft"}).addTo(map);

const airportLayer=L.layerGroup().addTo(map);
let features=[];
let visible=[];
let layerById=new Map();

function esc(v){
  return String(v??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function norm(v){
  return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function boolText(v){
  return v===true ? "Sí" : v===false ? "No" : "Sin dato";
}

function codeLabel(p){
  return p.codigo_iata || p.codigo_oaci || p.codigo_local || "—";
}


function displayName(p) {
  const etiqueta = String(p.etiqueta || "").trim();
  if (etiqueta) return etiqueta;

  const full = String(p.nombre_madhel || "");
  const clean = full.split(" - (")[0].trim();

  return clean || p.localidad_referencia || "Aeródromo";
}


function featureId(f,index){
  const p=f.properties||{};
  return [p.codigo_local,p.codigo_oaci,p.codigo_iata,index].filter(Boolean).join("-");
}



function conditionKey(p) {
  const control = String(p.control || "").toLowerCase();
  const condicion = String(p.condicion || "").toUpperCase();

  // Simbología militar según el campo CONTROL
  if (control === "militar controlado") {
    return "other-military";
  }

  if (p.incluido_sna) return "sna-public";
  if (condicion === "MILITAR") return "other-military";
  if (condicion === "PRIVADO") return "other-private";

  return "other-public";
}





function conditionLabel(p) {
  const control = String(p.control || "").toLowerCase();

  if (control === "militar controlado") {
    return "Militar controlado · No SNA";
  }

  const condicion = String(p.condicion || "").toUpperCase();

  if (p.incluido_sna) return "SNA";
  if (condicion === "PRIVADO") return "Privado · No SNA";
  if (condicion === "MILITAR") return "Militar · No SNA";

  return "Público · No SNA";
}




function airportIcon(p) {
  const key = conditionKey(p);
  const size = p.incluido_sna ? 24 : 18;

  return L.divIcon({
    className: "aerodromo-marker " + key,
    html: `
      <span class="aerodromo-plane" aria-hidden="true">✈</span>
      <span class="aerodromo-name">${esc(displayName(p))}</span>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    tooltipAnchor: [0, -size / 2]
  });
}

function updateAirportLabels() {
  map.getContainer().classList.toggle(
    "show-airport-names",
    map.getZoom() >= 7
  );
}

map.on("zoomend", updateAirportLabels);
updateAirportLabels();


function popupHtml(p){
  const sna=Boolean(p.incluido_sna);
  const codes=[
    p.codigo_local?`Local ${p.codigo_local}`:null,
    p.codigo_oaci?`OACI ${p.codigo_oaci}`:null,
    p.codigo_iata?`IATA ${p.codigo_iata}`:null
  ].filter(Boolean).join(" · ") || "Sin códigos informados";

  return `
    <div class="popup-badge ${conditionKey(p)}">${esc(conditionLabel(p))}</div>
    <div class="popup-title">${esc(displayName(p))}</div>
    <div class="popup-subtitle">${esc(codes)}</div>

    <div class="popup-grid">
      <div class="popup-cell"><span>Provincia</span><strong>${esc(p.provincia||"—")}</strong></div>
      <div class="popup-cell"><span>Localidad</span><strong>${esc(p.localidad_referencia||"—")}</strong></div>
      <div class="popup-cell"><span>Condición</span><strong>${esc(p.condicion||"—")}</strong></div>
      <div class="popup-cell"><span>Control</span><strong>${esc(p.control||"—")}</strong></div>
      <div class="popup-cell"><span>Elevación</span><strong>${Number.isFinite(Number(p.elevacion_m))?`${Number(p.elevacion_m).toLocaleString("es-AR")} m`:"—"}</strong></div>
      <div class="popup-cell"><span>Pistas</span><strong>${p.cantidad_pistas??"—"}</strong></div>
      <div class="popup-cell"><span>Pavimentadas</span><strong>${p.cantidad_pistas_pavimentadas??"—"}</strong></div>
      <div class="popup-cell"><span>Concesionado</span><strong>${boolText(p.concesionado)}</strong></div>
      <div class="popup-cell"><span>Navegación</span><strong>${esc(p.proveedor_navegacion||"—")}</strong></div>
    </div>

    ${p.pistas_texto?`<div class="popup-wide"><span>Información de pistas</span><strong>${esc(p.pistas_texto)}</strong></div>`:""}
    ${p.descripcion_ubicacion?`<div class="popup-wide"><span>Ubicación MADHEL</span><strong>${esc(p.descripcion_ubicacion)}</strong></div>`:""}

    <div class="popup-note">Última actualización MADHEL: ${esc(p.fecha_ultima_actualizacion_madhel||"sin dato")}. Para información operacional vigente, verificar la documentación aeronáutica oficial.</div>
  `;
}

function fillSelect(el,values){
  [...new Set(values.filter(v=>String(v??"").trim()))]
    .sort((a,b)=>String(a).localeCompare(String(b),"es"))
    .forEach(v=>{
      const o=document.createElement("option");
      o.value=String(v);
      o.textContent=String(v);
      el.appendChild(o);
    });
}

function buildFilters(){
  const props=features.map(f=>f.properties||{});
  fillSelect(dom.province,props.map(p=>p.provincia));
  fillSelect(dom.control,props.map(p=>p.control));
}

function matches(f){
  const p=f.properties||{};
  const isSna=Boolean(p.incluido_sna);
  if(isSna && !dom.snaToggle.checked) return false;
  if(!isSna && !dom.otherToggle.checked) return false;
  if(dom.province.value && p.provincia!==dom.province.value) return false;
  if(dom.control.value && p.control!==dom.control.value) return false;

  const q=norm(dom.search.value);
  if(q){
    const haystack=norm([
      p.etiqueta,p.nombre_madhel,p.localidad_referencia,p.provincia,p.codigo_local,p.codigo_oaci,p.codigo_iata
    ].join(" "));
    if(!haystack.includes(q)) return false;
  }
  return true;
}

function renderMap(){
  airportLayer.clearLayers();
  layerById.clear();
  visible=features.filter(matches);

  visible.forEach((f,index)=>{
    const p=f.properties||{};
    const [lon,lat]=f.geometry?.coordinates||[];
    if(!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return;

    const id=featureId(f,index);

    const marker = L.marker([lat, lon], {
      icon: airportIcon(p)
    })
    .bindTooltip(
      `${esc(codeLabel(p))} · ${esc(displayName(p))}`,
      { direction: "top", offset: [0, -5] }
    )
    .bindPopup(popupHtml(p), { maxWidth: 390 });

    marker.addTo(airportLayer);
    layerById.set(id,marker);
    f.__mapId=id;
  });

  renderCounts();
  renderList();
}

function renderCounts(){
  dom.visibleCount.textContent=visible.length.toLocaleString("es-AR");
  dom.snaCount.textContent=visible.filter(f=>Boolean(f.properties?.incluido_sna)).length.toLocaleString("es-AR");
  dom.publicCount.textContent=visible.filter(f=>String(f.properties?.condicion||"").toUpperCase()==="PUBLICO").length.toLocaleString("es-AR");
  dom.privateCount.textContent=visible.filter(f=>String(f.properties?.condicion||"").toUpperCase()==="PRIVADO").length.toLocaleString("es-AR");
}

function renderList(){
  const rows=[...visible].sort((a,b)=>{
    const pa=a.properties||{},pb=b.properties||{};
    return String(pa.provincia||"").localeCompare(String(pb.provincia||""),"es") ||
      displayName(pa).localeCompare(displayName(pb),"es");
  });

  if(!rows.length){
    dom.resultList.innerHTML='<p class="empty-note">No hay aeródromos para los filtros seleccionados.</p>';
    return;
  }

  dom.resultList.innerHTML=rows.map(f=>{
    const p=f.properties||{};
    return `<button class="airport-item" type="button" data-airport="${esc(f.__mapId)}">
      <span class="airport-code ${conditionKey(p)}">${esc(codeLabel(p))}</span>
      <span class="airport-copy">
        <strong>${esc(displayName(p))}</strong>
        <span>${esc(p.localidad_referencia||"")} · ${esc(p.provincia||"")}</span>
      </span>
      <span class="airport-meta">${esc(conditionLabel(p))}</span>
    </button>`;
  }).join("");
}

function fitVisible(){
  const latlngs=visible.map(f=>{
    const [lon,lat]=f.geometry?.coordinates||[];
    return [lat,lon];
  }).filter(([lat,lon])=>Number.isFinite(Number(lat))&&Number.isFinite(Number(lon)));

  if(!latlngs.length) return;
  const bounds=L.latLngBounds(latlngs);
  if(bounds.isValid()) map.fitBounds(bounds,{padding:[26,26],maxZoom:7});
}

function focusAirport(id){
  const layer=layerById.get(id);
  if(!layer) return;
  map.setView(layer.getLatLng(),Math.max(map.getZoom(),8),{animate:true});
  layer.openPopup();
}

function setBasemap(name){
  if(!baseLayers[name] || name===currentBase) return;
  map.removeLayer(baseLayers[currentBase]);
  baseLayers[name].addTo(map);
  baseLayers[name].bringToBack?.();
  currentBase=name;
  dom.basemapButtons.querySelectorAll("button").forEach(b=>{
    const active=b.dataset.basemap===name;
    b.classList.toggle("is-active",active);
    b.setAttribute("aria-pressed",String(active));
  });
}

function resetFilters(){
  dom.search.value="";
  dom.province.value="";
  dom.control.value="";
  dom.snaToggle.checked=true;
  dom.otherToggle.checked=true;
  renderMap();
  fitVisible();
}


function bind(){
  [dom.province,dom.control,dom.snaToggle,dom.otherToggle].forEach(el=>{
    el.addEventListener("change",renderMap);
  });
  dom.search.addEventListener("input",renderMap);

  dom.resultList.addEventListener("click",e=>{
    const b=e.target.closest("[data-airport]");
    if(b) focusAirport(b.dataset.airport);
  });

  dom.reset.addEventListener("click",resetFilters);
  dom.fit.addEventListener("click",fitVisible);

  dom.fullscreen.addEventListener("click",async()=>{
    const target=document.getElementById("mapStage");
    try{
      if(!document.fullscreenElement) await target.requestFullscreen();
      else await document.exitFullscreen();
      setTimeout(()=>map.invalidateSize(),120);
    }catch{}
  });

  dom.legendToggle.addEventListener("click",()=>{
    const collapsed=dom.legend.classList.toggle("is-collapsed");
    dom.legendToggle.setAttribute("aria-expanded",String(!collapsed));
  });

  dom.basemapButtons.addEventListener("click",e=>{
    const b=e.target.closest("[data-basemap]");
    if(b) setBasemap(b.dataset.basemap);
  });

  dom.aboutButton.addEventListener("click",()=>dom.aboutDialog.showModal());
  dom.aboutClose.addEventListener("click",()=>dom.aboutDialog.close());
}


async function init(){
  try{
    const response=await fetch(DATA_URL,{cache:"no-store"});
    if(!response.ok) throw new Error("No fue posible cargar la capa de aeródromos.");
    const data=await response.json();
    features=Array.isArray(data.features)?data.features:[];

    buildFilters();
    bind();
    renderMap();
    fitVisible();

    dom.loading.classList.add("is-hidden");
  }catch(error){
    console.error(error);
    dom.loading.innerHTML=`<strong>No fue posible cargar el mapa</strong><span>${esc(error.message||error)}</span>`;
  }
}

init();
})();
