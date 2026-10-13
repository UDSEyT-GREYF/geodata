(() => {
"use strict";

const ROUTES_URL="/geodata/data/tuar/tuar_rutas_2026.geojson";
const AIRPORTS_URL="/geodata/data/tuar/tuar_aeropuertos_2026.geojson";

const COLORS={
  "TUAR previa":"#139b8d",
  "Nueva TUAR":"#e85d3f",
  "TUAI":"#8796a6"
};

const dom={
  origin:document.getElementById("originSelect"),
  previousToggle:document.getElementById("previousToggle"),
  newToggle:document.getElementById("newToggle"),
  contextToggle:document.getElementById("contextToggle"),
  previousCount:document.getElementById("previousCount"),
  newCount:document.getElementById("newCount"),
  contextCount:document.getElementById("contextCount"),
  resultList:document.getElementById("resultList"),
  reset:document.getElementById("resetFilters"),
  fit:document.getElementById("fitMapButton"),
  fullscreen:document.getElementById("fullscreenButton"),
  legend:document.getElementById("mapLegend"),
  legendToggle:document.getElementById("legendToggle"),
  aboutButton:document.getElementById("aboutButton"),
  aboutDialog:document.getElementById("aboutDialog"),
  aboutClose:document.getElementById("aboutClose"),
  loading:document.getElementById("loadingOverlay"),
  basemapButtons:document.getElementById("basemapButtons"),
  benefitKpi:document.getElementById("benefitKpi"),
  benefitKpiValue:document.getElementById("benefitKpiValue"),
  benefitKpiNote:document.getElementById("benefitKpiNote")
};

const argenmap=L.tileLayer(
  "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png",
  {tms:true,maxZoom:14,attribution:"© IGN Argentina"}
);

const light = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=cb1_325a_1_1e9283ed596ac884153a8003",
  {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }
);

const osm=L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {maxZoom:19,attribution:"© OpenStreetMap"}
);

const satellite=L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {maxZoom:19,attribution:"Tiles © Esri"}
);

const baseLayers={light,osm,satellite};
let currentBase="light";

const map=L.map("map",{
  zoomControl:false,
  minZoom:2,
  maxZoom:19,
  zoomSnap:0.25,
  zoomDelta:0.25,
  worldCopyJump:true,
  layers:[light]
}).setView([-31.8,-61.5],4.25);

L.control.zoom({position:"topleft"}).addTo(map);

const routeLayer=L.layerGroup().addTo(map);
const airportLayer=L.layerGroup().addTo(map);
const radiusLayer=L.layerGroup().addTo(map);

let routes=[];
let airports=[];
let visibleRoutes=[];
let routeMarkers=new Map();

function esc(v){
  return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function fmt(v,d=0){
  const n=Number(v);
  if(!Number.isFinite(n)) return "–";
  return n.toLocaleString("es-AR",{minimumFractionDigits:d,maximumFractionDigits:d});
}
function fmtUsd(v){
  const n=Number(v);
  if(!Number.isFinite(n)) return "–";
  return `USD ${n.toLocaleString("es-AR",{maximumFractionDigits:0})}`;
}
function fmtUsdCompact(v){
  const n=Number(v);
  if(!Number.isFinite(n)) return "–";
  if(n>=1000000){
    return `≈ USD ${(n/1000000).toLocaleString("es-AR",{minimumFractionDigits:1,maximumFractionDigits:1})} millones/año`;
  }
  if(n>=1000){
    return `≈ USD ${(n/1000).toLocaleString("es-AR",{maximumFractionDigits:0})} mil/año`;
  }
  return `≈ USD ${n.toLocaleString("es-AR",{maximumFractionDigits:0})}/año`;
}
function catClass(cat){
  if(cat==="TUAR previa") return "previous";
  if(cat==="Nueva TUAR") return "new";
  return "context";
}
function categoryEnabled(cat){
  if(cat==="TUAR previa") return dom.previousToggle.checked;
  if(cat==="Nueva TUAR") return dom.newToggle.checked;
  return dom.contextToggle.checked;
}
function routeStyle(p){
  if(p.categoria_tasa==="Nueva TUAR"){
    return {color:COLORS[p.categoria_tasa],weight:4.3,opacity:.96};
  }
  if(p.categoria_tasa==="TUAR previa"){
    return {color:COLORS[p.categoria_tasa],weight:3.3,opacity:.9};
  }
  return {color:COLORS[p.categoria_tasa],weight:1.25,opacity:.28};
}
function popup(p){
  const cls=catClass(p.categoria_tasa);
  const airlines=Array.isArray(p.aerolineas)?p.aerolineas:[];

  const airlineRows=airlines.slice(0,5).map(a=>{
    const savingLine=p.beneficiada_ampliacion
      ? `<span class="airline-saving">${fmtUsd(a.ahorro_anual_proxy_usd)} ahorro/año</span>`
      : "";
    return `<div class="airline-row">
      <strong>${esc(a.aerolinea)}</strong>
      <span>${fmt(a.pasajeros_promedio_semana,1)} pax/sem · ${fmt(a.pasajeros_anuales_proxy)} pax/año proxy</span>
      ${savingLine}
    </div>`;
  }).join("");

  const extra=airlines.length>5
    ? `<div class="airline-extra">+ ${airlines.length-5} operador${airlines.length-5===1?"":"es"} adicional${airlines.length-5===1?"":"es"}</div>`
    : "";

  const saving=p.beneficiada_ampliacion
    ? `<div class="popup-saving">
        <span>Ahorro anual estimado por la ampliación</span>
        <strong>${fmtUsd(p.ahorro_anual_proxy_usd)}</strong>
      </div>`
    : p.categoria_tasa==="TUAR previa"
      ? `<div class="popup-status previous">La ruta ya estaba alcanzada por TUAR antes de la ampliación.</div>`
      : "";

  const paxBlock=Number.isFinite(Number(p.pasajeros_anuales_proxy))
    ? `<div class="popup-proxy">
        <div><span>Pasajeros promedio</span><strong>${fmt(p.pasajeros_promedio_semana,1)}/semana</strong></div>
        <div><span>Proxy anual</span><strong>${fmt(p.pasajeros_anuales_proxy)} pax</strong></div>
      </div>`
    : "";

  const period=(p.periodo_pasajeros_desde&&p.periodo_pasajeros_hasta)
    ? `<div class="popup-method">Proxy de pasajeros calculado con información detallada disponible entre ${esc(p.periodo_pasajeros_desde)} y ${esc(p.periodo_pasajeros_hasta)}, extrapolada a 52 semanas.</div>`
    : "";

  return `
    <div class="popup-category ${cls}">${esc(p.categoria_tasa)}</div>
    <div class="popup-title">${esc(p.ruta)}</div>
    <div class="popup-row"><span>Distancia</span><span>${fmt(p.distancia_km)} km</span></div>
    <div class="popup-row"><span>Frecuencia típica</span><span>${fmt(p.frecuencia_semanal_mediana,1)} despegues/semana</span></div>
    <div class="popup-row"><span>Semanas ≥3</span><span>${fmt(p.semanas_frecuencia_ge3)}</span></div>
    <div class="popup-row"><span>Tasa anterior</span><span>${esc(p.tasa_antes)}</span></div>
    <div class="popup-row"><span>Tasa actual</span><span>${esc(p.tasa_nueva)}</span></div>
    ${paxBlock}
    ${saving}
    ${airlineRows ? `<div class="popup-airlines"><h4>Aerolíneas y pasajeros</h4>${airlineRows}${extra}</div>` : ""}
    ${period}
  `;
}

function buildOriginOptions(){
  const origins=[...new Set(routes.map(f=>f.properties.origen_iata))].sort();
  for(const code of origins){
    const p=routes.find(f=>f.properties.origen_iata===code)?.properties;
    const o=document.createElement("option");
    o.value=code;
    o.textContent=`${code} · ${p?.origen_ciudad||code}`;
    dom.origin.appendChild(o);
  }
}

function renderAirports(){
  airportLayer.clearLayers();
  const needed=new Set();
  for(const f of visibleRoutes){
    needed.add(f.properties.origen_iata);
    needed.add(f.properties.destino_iata);
  }
  for(const f of airports){
    const p=f.properties||{};
    if(!needed.has(p.iata)) continue;
    const [lon,lat]=f.geometry.coordinates;
    const isOrigin=visibleRoutes.some(r=>r.properties.origen_iata===p.iata);
    const icon=L.divIcon({
      className:"",
      html:`<div class="airport-marker ${isOrigin?"":"foreign"}"></div>`,
      iconSize:isOrigin?[16,16]:[11,11],
      iconAnchor:isOrigin?[8,8]:[5.5,5.5]
    });
    L.marker([lat,lon],{icon,keyboard:false,interactive:true})
      .bindTooltip(`${esc(p.iata)} · ${esc(p.ciudad||"")}`,{direction:"top",offset:[0,-6]})
      .addTo(airportLayer);
  }
}

function renderRadii(){
  radiusLayer.clearLayers();
  const code=dom.origin.value;
  if(!code) return;
  const f=airports.find(x=>x.properties?.iata===code);
  if(!f) return;
  const [lon,lat]=f.geometry.coordinates;

  L.circle([lat,lon],{
    radius:300000,color:"#139b8d",weight:1.5,opacity:.82,fill:true,fillColor:"#139b8d",fillOpacity:.025,dashArray:"6 5",
    interactive:false
  }).addTo(radiusLayer);

  L.circle([lat,lon],{
    radius:1000000,color:"#d89d16",weight:1.6,opacity:.82,fill:true,fillColor:"#d89d16",fillOpacity:.018,dashArray:"7 5",
    interactive:false
  }).addTo(radiusLayer);
}

function updateBenefitKpi(){
  if(!dom.benefitKpiValue || !dom.benefitKpiNote) return;

  const origin=dom.origin.value;
  const benefited=routes.filter(f=>{
    const p=f.properties||{};
    return p.categoria_tasa==="Nueva TUAR"
      && (!origin || p.origen_iata===origin);
  });

  const total=benefited.reduce(
    (acc,f)=>acc+(Number(f.properties?.ahorro_anual_proxy_usd)||0),
    0
  );

  dom.benefitKpiValue.textContent=fmtUsdCompact(total);

  if(origin){
    dom.benefitKpiNote.textContent=
      `Proxy anual · ${benefited.length} ruta${benefited.length===1?"":"s"} incorporada${benefited.length===1?"":"s"} desde ${origin}`;
  }else{
    dom.benefitKpiNote.textContent=
      `Proxy anual · ${benefited.length} rutas incorporadas a la TUAR`;
  }
}

function renderRoutes(){
  routeLayer.clearLayers();
  routeMarkers.clear();

  const origin=dom.origin.value;
  visibleRoutes=routes.filter(f=>{
    const p=f.properties||{};
    return categoryEnabled(p.categoria_tasa) && (!origin || p.origen_iata===origin);
  });

  // Context first; highlighted routes above it.
  const ordered=[...visibleRoutes].sort((a,b)=>(b.properties.categoria_orden||9)-(a.properties.categoria_orden||9));
  for(const f of ordered){
    const p=f.properties;
    const line=L.geoJSON(f,{style:routeStyle(p)}).bindPopup(popup(p),{maxWidth:390});
    line.on("mouseover",e=>{
      const layer=e.propagatedFrom||e.target;
      if(layer?.setStyle){
        const base=routeStyle(p);
        layer.setStyle({...base,weight:base.weight+2,opacity:1});
        layer.bringToFront();
      }
    });
    line.on("mouseout",e=>{
      const layer=e.propagatedFrom||e.target;
      if(layer?.setStyle) layer.setStyle(routeStyle(p));
    });
    line.addTo(routeLayer);
    routeMarkers.set(p.id,line);
  }

  renderAirports();
  renderRadii();
  renderList();
  updateCounts();
  updateBenefitKpi();
}

function updateCounts(){
  const filteredByOrigin=(cat)=>routes.filter(f=>{
    const p=f.properties||{};
    return p.categoria_tasa===cat && (!dom.origin.value || p.origen_iata===dom.origin.value);
  }).length;
  dom.previousCount.textContent=filteredByOrigin("TUAR previa");
  dom.newCount.textContent=filteredByOrigin("Nueva TUAR");
  dom.contextCount.textContent=filteredByOrigin("TUAI");
}

function renderList(){
  const priority={"Nueva TUAR":0,"TUAR previa":1,"TUAI":2};
  const list=[...visibleRoutes].sort((a,b)=>{
    const pa=a.properties,pb=b.properties;
    return (priority[pa.categoria_tasa]-priority[pb.categoria_tasa])
      || pa.origen_iata.localeCompare(pb.origen_iata)
      || pa.destino_iata.localeCompare(pb.destino_iata);
  });

  if(!list.length){
    dom.resultList.innerHTML='<p class="empty-note">No hay rutas para los filtros seleccionados.</p>';
    return;
  }

  dom.resultList.innerHTML=list.map(f=>{
    const p=f.properties,cls=catClass(p.categoria_tasa);
    return `<button class="route-item" type="button" data-route="${esc(p.id)}">
      <span class="route-code ${cls}">${esc(p.origen_iata)}–${esc(p.destino_iata)}</span>
      <span class="route-copy">
        <strong>${esc(p.origen_ciudad)} → ${esc(p.destino_ciudad)}</strong>
        <span>${esc(p.categoria_tasa)} · ${fmt(p.frecuencia_semanal_mediana,1)} frec./semana</span>
      </span>
      <span class="route-km">${fmt(p.distancia_km)} km</span>
    </button>`;
  }).join("");
}

function focusRoute(id){
  const layer=routeMarkers.get(id);
  if(!layer) return;
  const bounds=layer.getBounds?.();
  if(bounds?.isValid()) map.fitBounds(bounds,{padding:[80,80],maxZoom:6.75});
  layer.openPopup?.();
}

function fitTUAR(){
  const target=routes.filter(f=>{
    const p=f.properties||{};
    const isTUAR=p.categoria_tasa!=="TUAI";
    return isTUAR && (!dom.origin.value || p.origen_iata===dom.origin.value);
  });
  if(!target.length) return;
  const group=L.geoJSON({type:"FeatureCollection",features:target});
  const b=group.getBounds();
  if(b.isValid()) map.fitBounds(b,{padding:[28,28],maxZoom:6});
}

function setBasemap(name){
  if(!baseLayers[name]||name===currentBase) return;
  map.removeLayer(baseLayers[currentBase]);
  baseLayers[name].addTo(map);
  currentBase=name;
  dom.basemapButtons.querySelectorAll("button").forEach(b=>{
    const active=b.dataset.basemap===name;
    b.classList.toggle("is-active",active);
    b.setAttribute("aria-pressed",String(active));
  });
}

function reset(){
  dom.origin.value="";
  dom.previousToggle.checked=true;
  dom.newToggle.checked=true;
  dom.contextToggle.checked=true;
  renderRoutes();
  fitTUAR();
}

function bind(){
  [dom.origin,dom.previousToggle,dom.newToggle,dom.contextToggle].forEach(el=>{
    el.addEventListener("change",()=>{
      renderRoutes();
      if(dom.origin.value) fitTUAR();
    });
  });

  dom.resultList.addEventListener("click",e=>{
    const b=e.target.closest("[data-route]");
    if(b) focusRoute(b.dataset.route);
  });

  dom.reset.addEventListener("click",reset);
  dom.fit.addEventListener("click",fitTUAR);

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
    const [rr,aa]=await Promise.all([
      fetch(ROUTES_URL,{cache:"no-store"}),
      fetch(AIRPORTS_URL,{cache:"no-store"})
    ]);
    if(!rr.ok||!aa.ok) throw new Error("No fue posible cargar los archivos GeoJSON.");
    const rj=await rr.json();
    const aj=await aa.json();
    routes=rj.features||[];
    airports=aj.features||[];

    buildOriginOptions();
    bind();
    renderRoutes();
    fitTUAR();

    dom.loading.classList.add("is-hidden");
  }catch(err){
    console.error(err);
    dom.loading.innerHTML=`<strong>No fue posible cargar el mapa</strong><span>${esc(err.message)}</span>`;
  }
}

init();
})();
