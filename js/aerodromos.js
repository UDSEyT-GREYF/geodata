(() => {
"use strict";

const DATA_VERSION="20261119-2";
const DATA_URL=`/geodata/fuentes/ANAC/aerodromos_madhel_2026.geojson?v=${DATA_VERSION}`;

// Los valores coinciden con categoria_mapa del GeoJSON publicado.
const CATEGORIES = [
  {label:"Aeropuertos del SNA", key:"cat-sna"},
  {label:"Aeródromos con pista pavimentada", key:"cat-paved"},
  {label:"Aeroclubes con pista asfaltada", key:"cat-club-paved"},
  {label:"Aeroclubes", key:"cat-club", display:"Aeroclubes con pista de tierra"},
  {label:"Aeródromos con pista no pavimentada", key:"cat-unpaved"},
  {label:"Aeródromos con cierre indicado", key:"cat-closed", display:"Aeródromos cerrados"},
  {label:"Aeródromos militares", key:"cat-military"},
  {label:"Helipuertos", key:"cat-heli"},
  {label:"LAD con pista asfaltada", key:"cat-lad"},
  {label:"Aeródromos sin información suficiente de pista", key:"cat-unknown"}
];
const categoryLookup = new Map(CATEGORIES.map(c=>[c.label,c]));

const dom={
  search:document.getElementById("searchInput"),
  province:document.getElementById("provinceSelect"),
  control:document.getElementById("controlSelect"),
  categories:document.getElementById("categoryFilters"),
  categoriesAll:document.getElementById("categoryAllButton"),
  visibleCount:document.getElementById("visibleCount"),
  snaCount:document.getElementById("snaCount"),
  pavedCount:document.getElementById("pavedCount"),
  militaryCount:document.getElementById("militaryCount"),
  aboutTotal:document.getElementById("aboutTotal"),
  aboutMadhel:document.getElementById("aboutMadhel"),
  aboutLad:document.getElementById("aboutLad"),
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
  return p.codigo_iata || p.codigo_oaci || p.codigo_local || p.codigo_lad || "—";
}


function displayName(p) {
  const etiqueta = String(p.etiqueta_normalizada || p.etiqueta || "").trim();
  if (etiqueta) return etiqueta;

  const full = String(p.nombre_madhel || "");
  const clean = full.split(" - (")[0].trim();

  return clean || p.localidad_referencia || "Aeródromo";
}


function featureId(f,index){
  const p=f.properties||{};
  return [p.codigo_local,p.codigo_oaci,p.codigo_iata,index].filter(Boolean).join("-");
}



function isLad(p){
  return p.categoria_mapa === "LAD con pista asfaltada" || String(p.origen_registro||"").toUpperCase().startsWith("ANAC LAD");
}

function provinceOf(p){
  // El LAD 2026-09 coloca la provincia en localidad_referencia.
  return p.provincia || (isLad(p) ? p.localidad_referencia : "") || "";
}

function localityOf(p){
  return isLad(p) ? "" : (p.localidad_referencia||"");
}

function categoryInfo(p){
  return categoryLookup.get(String(p.categoria_mapa||"")) || {label:"Sin categoría",key:"cat-unknown"};
}

function airportIcon(p){
  const cat=categoryInfo(p);
  const size=cat.key==="cat-sna" ? 24 : cat.key==="cat-heli" ? 12 : 19;
  const glyph=cat.key==="cat-heli" ? "H" : "✈";
  return L.divIcon({
    className:"aerodromo-marker "+cat.key,
    html:`<span class="aerodromo-plane" aria-hidden="true">${glyph}</span><span class="aerodromo-name">${esc(displayName(p))}</span>`,
    iconSize:[size,size], iconAnchor:[size/2,size/2],
    popupAnchor:[0,-size/2], tooltipAnchor:[0,-size/2]
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
  const codes=[
    p.codigo_local?`Local ${esc(p.codigo_local)}`:null,
    p.codigo_oaci?`OACI ${esc(p.codigo_oaci)}`:null,
    p.codigo_iata?`IATA ${esc(p.codigo_iata)}`:null,
    p.codigo_lad?`LAD ${esc(p.codigo_lad)}`:null
  ].filter(Boolean).join(" · ") || "Sin códigos informados";
  const cat=categoryInfo(p);
  const fuente=String(p.origen_registro||"MADHEL");
  const elevacion=(p.elevacion_m!==null && p.elevacion_m!==undefined && p.elevacion_m!=="")
    ? `${Number(p.elevacion_m).toLocaleString("es-AR")} m` : "—";
  const casilla=(titulo,valor)=>`<div class="popup-cell"><span>${esc(titulo)}</span><strong>${esc(valor??"—")}</strong></div>`;
  const extendida=(titulo,valor)=>valor ? `<div class="popup-wide"><span>${esc(titulo)}</span><strong>${esc(valor)}</strong></div>` : "";
  const notaFecha=isLad(p) ? "Registro LAD, septiembre de 2026" :
    `Actualización MADHEL: ${esc(p.fecha_ultima_actualizacion_madhel||"sin dato")}`;
  return `
    <div class="popup-badge ${cat.key}">${esc(cat.display || cat.label)}</div>
    <div class="popup-title">${esc(displayName(p))}</div>
    <div class="popup-subtitle">${codes}</div>
    <div class="popup-grid">
      ${casilla("Provincia",provinceOf(p)||"—")}
      ${casilla("Localidad",localityOf(p)||"—")}
      ${casilla("Superficie",p.superficie_pista||"Sin información")}
      ${casilla("Pistas",p.cantidad_pistas??"—")}
      ${casilla("Pistas pavimentadas",p.cantidad_pistas_pavimentadas??"—")}
      ${casilla("Fuente",fuente)}
      ${casilla("Condición MADHEL",p.condicion||"—")}
      ${casilla("Control MADHEL",p.control||"—")}
      ${casilla("Elevación",elevacion)}
      ${casilla("Navegación",p.proveedor_navegacion||"—")}
    </div>
    ${extendida("Información de pistas",p.pistas_texto)}
    ${extendida("Pista y dimensiones",[p.pista_designacion,p.pista_dimensiones].filter(Boolean).join(" · "))}
    ${extendida("Verificación de pista",p.verificacion_pista)}
    ${extendida("Fuente de pistas",p.fuente_pistas)}
    ${extendida("Referencia AIP",p.referencia_aip)}
    ${extendida("Uso civil / militar",p.uso_civil_militar && p.uso_civil_militar!=="Sin verificar" ? p.uso_civil_militar : "")}
    ${extendida("Restricción operacional",p.restriccion_operacional && p.restriccion_operacional!=="Sin verificación operacional en esta capa" ? p.restriccion_operacional : "")}
    ${extendida("Ubicación informada",p.descripcion_ubicacion)}
    <div class="popup-note">${notaFecha}. Datos cartográficos; verificar AIP/NOTAM para uso operacional.</div>
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

function categoryCheckboxes(){
  if (!dom.categories.querySelector('input[name="category"]')) {
    dom.categories.innerHTML=CATEGORIES.map((cat,i)=>`
      <label class="category-option">
        <input type="checkbox" name="category" value="${esc(cat.label)}" checked>
        <span class="category-color ${cat.key}" aria-hidden="true"></span>
        <span class="category-name">${esc(cat.display || cat.label)}</span>
        <span class="category-count" data-category-index="${i}">—</span>
      </label>
    `).join("");
  }
document.getElementById("legendBody").innerHTML =
  [...dom.categories.querySelectorAll(".category-option")]
    .filter(elemento => {
      const valor = elemento.querySelector('input[name="category"]').value;
      return features.some(f => f.properties?.categoria_mapa === valor);
    })
    .map(elemento => {
      const valor = elemento.querySelector('input[name="category"]').value;
      const cat = categoryLookup.get(valor);
      const nombre = elemento.querySelector(".category-name").textContent.trim();

      return `<div>
        <span class="legend-dot ${cat.key}" aria-hidden="true"></span>
        <span>${esc(nombre)}</span>
      </div>`;
    }).join("");
}

function buildFilters(){
  const props=features.map(f=>f.properties||{});
  fillSelect(dom.province,props.map(provinceOf));
  fillSelect(dom.control,props.map(p=>p.control));
  categoryCheckboxes();
  const total=features.length;
  const lad=features.filter(f=>isLad(f.properties||{})).length;
  dom.aboutTotal.textContent=total.toLocaleString("es-AR");
  dom.aboutMadhel.textContent=(total-lad).toLocaleString("es-AR");
  dom.aboutLad.textContent=lad.toLocaleString("es-AR");
}

function categorySelection(){
  return new Set([...dom.categories.querySelectorAll('input[name="category"]:checked')].map(el=>el.value));
}

function matches(f,applyCategory=true,selected=null){
  const p=f.properties||{};
  if(dom.province.value && provinceOf(p)!==dom.province.value) return false;
  if(dom.control.value && p.control!==dom.control.value) return false;
  if(applyCategory && !(selected||categorySelection()).has(p.categoria_mapa)) return false;
  const q=norm(dom.search.value);
  if(q){
    const haystack=norm([
      p.etiqueta_normalizada,p.etiqueta,p.nombre_madhel,p.localidad_referencia,
      provinceOf(p),p.codigo_local,p.codigo_oaci,p.codigo_iata,p.codigo_lad,p.categoria_mapa
    ].join(" "));
    if(!haystack.includes(q)) return false;
  }
  return true;
}

function renderCategoryCounts(){
  const valid=features.filter(f=>matches(f,false));
  const counts=new Map();
  for(const f of valid){
    const cat=f.properties?.categoria_mapa;
    counts.set(cat,(counts.get(cat)||0)+1);
  }
  dom.categories.querySelectorAll("[data-category-index]").forEach(el=>{
    const cat=CATEGORIES[Number(el.dataset.categoryIndex)].label;
    el.textContent=(counts.get(cat)||0).toLocaleString("es-AR");

    const total = features.filter(
  f => f.properties?.categoria_mapa === cat
).length;

el.closest(".category-option").style.display =
  total === 0 ? "none" : "";
    
  });
  const inputs=[...dom.categories.querySelectorAll('input[name="category"]')];
  dom.categoriesAll.textContent=inputs.every(x=>x.checked)?"Quitar todas":"Seleccionar todas";
}

function renderMap(){
  airportLayer.clearLayers();
  layerById.clear();
  const selected=categorySelection();
  visible=features.filter(f=>matches(f,true,selected));
  renderCategoryCounts();

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
  dom.visibleCount.textContent =
    visible.length.toLocaleString("es-AR");

  dom.snaCount.textContent =
    visible.filter(f =>
      f.properties?.categoria_mapa === "Aeropuertos del SNA"
    ).length.toLocaleString("es-AR");

  dom.pavedCount.textContent =
    visible.filter(f =>
      f.properties?.categoria_mapa === "Aeródromos con pista pavimentada"
    ).length.toLocaleString("es-AR");

  dom.militaryCount.textContent =
    visible.filter(f =>
      f.properties?.categoria_mapa === "Aeródromos militares"
    ).length.toLocaleString("es-AR");
}

function renderList(){
  const rows=[...visible].sort((a,b)=>{
    const pa=a.properties||{},pb=b.properties||{};
    return String(provinceOf(pa)).localeCompare(String(provinceOf(pb)),"es") ||
      displayName(pa).localeCompare(displayName(pb),"es");
  });

  if(!rows.length){
    dom.resultList.innerHTML='<p class="empty-note">No hay aeródromos para los filtros seleccionados.</p>';
    return;
  }

  dom.resultList.innerHTML=rows.map(f=>{
    const p=f.properties||{};
    return `<button class="airport-item" type="button" data-airport="${esc(f.__mapId)}">
      <span class="airport-code ${categoryInfo(p).key}">${esc(codeLabel(p))}</span>
      <span class="airport-copy">
        <strong>${esc(displayName(p))}</strong>
        <span>${esc(localityOf(p))}${localityOf(p)?" · ":""}${esc(provinceOf(p))}</span>
      </span>
      <span class="airport-meta">${esc(categoryInfo(p).display || categoryInfo(p).label)}</span>
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
  dom.categories.querySelectorAll('input[name="category"]').forEach(el=>{el.checked=true;});
  renderMap();
  fitVisible();
}

function bind(){
  [dom.province,dom.control].forEach(el=>{
    el.addEventListener("change",renderMap);
  });
  dom.categories.addEventListener("change",renderMap);
  dom.categoriesAll.addEventListener("click",()=>{
    const inputs=[...dom.categories.querySelectorAll('input[name="category"]')];
    const mark=!inputs.every(x=>x.checked);
    inputs.forEach(x=>{x.checked=mark;});
    renderMap();
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
    if(!features.length) throw new Error("El GeoJSON no contiene registros.");
    const desconocidas=[...new Set(features.map(f=>f.properties?.categoria_mapa||"(sin categoría)"))]
      .filter(c=>!categoryLookup.has(c));
    if(desconocidas.length) throw new Error("El GeoJSON contiene categorías no reconocidas: "+desconocidas.join(", "));
    // El archivo anterior de 135 puntos carece de categoria_mapa.
    // La validación anterior evita publicar datos viejos con apariencia correcta.

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
