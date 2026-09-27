(() => {
"use strict";

const CATALOG_URL="/geodata/data/lad-control/lad_catalogo.json";
const CONTROL_URL="/geodata/data/lad-control/lad_control_posicion.csv";
const PROVINCES_URL="/geodata/fuentes/provincias.geojson";
const STORAGE_KEY="geodata_lad_control_reviews_v1";

const dom={
  search:document.getElementById("searchInput"),statusFilter:document.getElementById("statusFilter"),
  typeFilter:document.getElementById("typeFilter"),gallery:document.getElementById("galleryList"),
  visibleCount:document.getElementById("visibleCount"),reviewedCount:document.getElementById("reviewedCount"),
  problemCount:document.getElementById("problemCount"),detailType:document.getElementById("detailType"),
  detailTitle:document.getElementById("detailTitle"),detailSub:document.getElementById("detailSub"),
  facts:document.getElementById("facts"),criterion:document.getElementById("criterion"),
  reason:document.getElementById("reasonInput"),observation:document.getElementById("observationInput"),
  correctedLat:document.getElementById("correctedLat"),correctedLon:document.getElementById("correctedLon"),
  shiftDistance:document.getElementById("shiftDistance"),correctionMode:document.getElementById("correctionMode"),
  clearCorrection:document.getElementById("clearCorrection"),saveReview:document.getElementById("saveReview"),
  saveStatus:document.getElementById("saveStatus"),geoCheck:document.getElementById("geoCheck"),
  prev:document.getElementById("prevButton"),next:document.getElementById("nextButton"),
  nextPending:document.getElementById("nextPendingButton"),copyLink:document.getElementById("copyLinkButton"),
  recenter:document.getElementById("recenterButton"),
  exportCsv:document.getElementById("exportCsv"),importCsv:document.getElementById("importCsv")
};

const state={catalog:[],reviews:{},filtered:[],selected:null,map:null,sourceMarker:null,correctedMarker:null,
  expectedLayer:null,correctionMode:false,provinceFeatures:[],geoByRegistro:{}};

function norm(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatNum(v,d=6){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):""}

function parseCSV(text){
  const rows=[];let row=[],cell="",q=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
    if(q){if(c=='"'&&n=='"'){cell+='"';i++}else if(c=='"')q=false;else cell+=c}
    else{if(c=='"')q=true;else if(c==","){row.push(cell);cell=""}else if(c=="\n"){row.push(cell);rows.push(row);row=[];cell=""}else if(c!="\r")cell+=c}}
  if(cell||row.length){row.push(cell);rows.push(row)}
  const headers=rows.shift()||[];
  return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
}
function csvCell(v){const s=String(v??"");return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s}

function loadLocalReviews(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}catch{return {}}}
function saveLocalReviews(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state.reviews))}

function reviewFor(reg){return state.reviews[String(reg)]||{}}
function merged(rec){return {...rec,...reviewFor(rec.Registro),...(state.geoByRegistro[String(rec.Registro)]||{})}}

async function load(){
  const [cat,ctrl,prov]=await Promise.all([
    fetch(CATALOG_URL,{cache:"no-store"}).then(r=>r.json()),
    fetch(CONTROL_URL,{cache:"no-store"}).then(r=>r.text()),
    fetch(PROVINCES_URL,{cache:"no-store"}).then(r=>r.json()).catch(()=>null)
  ]);
  state.catalog=cat;
  const seed={};
  parseCSV(ctrl).forEach(r=>{if(r.Registro)seed[String(r.Registro)]=r});
  state.reviews={...seed,...loadLocalReviews()};
  state.provinceFeatures=prov?.features||[];
  buildGeoChecks();
  populateTypes();
  initMap();
  bind();
  applyFilters();
  const requested=Number(new URLSearchParams(location.search).get("registro"));
  const first=(Number.isFinite(requested)&&state.catalog.find(x=>x.Registro===requested))
    ||state.catalog.find(x=>x.Registro===2330)||state.catalog[0];
  selectRecord(first.Registro,{updateUrl:false});
}

function populateTypes(){
  [...new Set(state.catalog.map(x=>x.Tipo))].sort().forEach(t=>{
    const o=document.createElement("option");o.value=t;o.textContent=t;dom.typeFilter.appendChild(o);
  });
}

function pointInRing(pt,ring){
  const [x,y]=pt;let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    const hit=((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi);
    if(hit)inside=!inside;
  } return inside;
}
function pointInPolygon(pt,coords){
  if(!pointInRing(pt,coords[0]))return false;
  for(let i=1;i<coords.length;i++)if(pointInRing(pt,coords[i]))return false;
  return true;
}
function contains(feature,lon,lat){
  const g=feature.geometry;if(!g)return false;
  if(g.type==="Polygon")return pointInPolygon([lon,lat],g.coordinates);
  if(g.type==="MultiPolygon")return g.coordinates.some(p=>pointInPolygon([lon,lat],p));
  return false;
}
  
function provinceName(f){
  const p = f.properties || {};
  return (
    p.Nombre ||
    p.nombre ||
    p.NOMBRE ||
    p.provincia ||
    p.Provincia ||
    p.name ||
    p.NAME_1 ||
    ""
  );
}
  
function buildGeoChecks(){
  if(!state.provinceFeatures.length)return;
  for(const r of state.catalog){
    const hit=state.provinceFeatures.find(f=>contains(f,Number(r.lon_fuente),Number(r.lat_fuente)));
    const geom=hit?provinceName(hit):"";
    state.geoByRegistro[String(r.Registro)]={
      dentro_argentina:hit?"SI":"NO",
      dentro_provincia:hit && norm(geom)===norm(r.Provincia)?"SI":"NO",
      provincia_geometrica:geom
    };
  }
}

function initMap(){
  const sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{
    maxZoom:20,attribution:"Tiles © Esri"
  });
  state.map=L.map("detailMap",{zoomControl:true,layers:[sat],maxZoom:20,zoomSnap:0.25,zoomDelta:0.25}).setView([-38,-64],5);
  L.control.scale({imperial:false,metric:true,position:"bottomright",maxWidth:140}).addTo(state.map);
  state.map.on("click",e=>{
    if(!state.correctionMode||!state.selected)return;
    const rev=reviewFor(state.selected.Registro);
    rev.lat_corregida=e.latlng.lat;
    rev.lon_corregida=e.latlng.lng;
    state.reviews[String(state.selected.Registro)]=rev;
    renderCorrection();
  });
}

function expectedRunwayLayer(rec){
  if(state.expectedLayer){state.map.removeLayer(state.expectedLayer);state.expectedLayer=null}
  const lat=Number(rec.lat_fuente),lon=Number(rec.lon_fuente);
  if(rec.Tipo==="LADH"){
    const m=String(rec.Dimensiones||"").match(/([\d.]+)\s*m/i);const radius=m?Math.max(5,Number(m[1])/2):10;
    state.expectedLayer=L.circle([lat,lon],{radius,color:"#ffd23f",weight:2,fill:false,dashArray:"5 4"}).addTo(state.map);return;
  }
  const rw=String(rec.RWY||"").match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  const dm=String(rec.Dimensiones||"").match(/([\d.]+)\s*m/i);
  if(!rw||!dm)return;
  const bearing=Number(rw[1])*10,length=Number(dm[1]);
  if(!Number.isFinite(length)||length<=0)return;
  const a=destination(lat,lon,bearing+180,length/2),b=destination(lat,lon,bearing,length/2);
  state.expectedLayer=L.polyline([a,b],{color:"#ffd23f",weight:3,dashArray:"7 5",opacity:.95}).addTo(state.map);
}
function destination(lat,lon,bearing,meters){
  const R=6378137,δ=meters/R,θ=bearing*Math.PI/180,φ1=lat*Math.PI/180,λ1=lon*Math.PI/180;
  const φ2=Math.asin(Math.sin(φ1)*Math.cos(δ)+Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
  const λ2=λ1+Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1),Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2));
  return [φ2*180/Math.PI,λ2*180/Math.PI];
}
function distanceMeters(a,b){
  const R=6371000,toR=x=>x*Math.PI/180;
  const dLat=toR(b[0]-a[0]),dLon=toR(b[1]-a[1]),la1=toR(a[0]),la2=toR(b[0]);
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function zoomFor(rec){
  if(rec.Tipo==="LADH")return 19.5;
  const m=String(rec.Dimensiones||"").match(/([\d.]+)\s*m/i);
  const len=m?Number(m[1]):0;
  if(len>=1800)return 16.5;if(len>=1000)return 17;if(len>=500)return 17.5;if(len>0)return 18;return 18;
}

function selectRecord(reg,{updateUrl=true}={}){
  const rec=state.catalog.find(x=>String(x.Registro)===String(reg));if(!rec)return;
  state.selected=rec;
  if(updateUrl){
    const u=new URL(location.href);u.searchParams.set("registro",rec.Registro);
    history.replaceState(null,"",u);
  }
  document.querySelectorAll(".gallery-card").forEach(x=>x.classList.toggle("is-active",x.dataset.registro==reg));
  requestAnimationFrame(()=>document.querySelector(`.gallery-card[data-registro="${rec.Registro}"]`)?.scrollIntoView({block:"nearest"}));
  dom.detailType.textContent=rec.Tipo;
  dom.detailTitle.textContent=`Registro ${rec.Registro} · ${rec.Denominacion}`;
  dom.detailSub.textContent=[rec.Provincia,rec.FIR].filter(Boolean).join(" · ");
  dom.criterion.textContent=rec.criterio_visual;
  dom.facts.innerHTML=[
    ["Provincia",rec.Provincia],["RWY",rec.RWY],["Dimensiones",rec.Dimensiones],["Superficie",rec.Superficie],
    ["Elevación",rec.Elevacion],["Coordenada fuente",`${formatNum(rec.lat_fuente)} / ${formatNum(rec.lon_fuente)}`],
    ["Ubicación",rec.Ubicacion,"wide"]
  ].filter(x=>x[1]).map(x=>`<div class="fact ${x[2]||""}"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></div>`).join("");
  renderGeo(rec);
  const rev=reviewFor(rec.Registro);
  dom.reason.value=rev.motivo_revision||"";
  dom.observation.value=rev.observacion||"";
  setStatus(rev.estado_revision||"sin_revisar",false);
  const lat=Number(rec.lat_fuente),lon=Number(rec.lon_fuente);
  state.map.setView([lat,lon],zoomFor(rec));
  if(state.sourceMarker)state.map.removeLayer(state.sourceMarker);
  state.sourceMarker=L.marker([lat,lon],{icon:L.divIcon({className:"",html:'<div class="source-marker"><span></span></div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(state.map);
  expectedRunwayLayer(rec);
  renderCorrection();
  updateNav();
}

function renderGeo(rec){
  const g=state.geoByRegistro[String(rec.Registro)];
  if(!g){dom.geoCheck.className="geo-check";dom.geoCheck.textContent="Control geográfico automático no disponible.";return}
  if(g.dentro_argentina==="NO"){
    dom.geoCheck.className="geo-check error";dom.geoCheck.textContent="Control automático: la coordenada no cae dentro de ninguna provincia argentina.";return
  }
  if(g.dentro_provincia==="NO"){
    dom.geoCheck.className="geo-check warning";dom.geoCheck.textContent=`Control automático: la coordenada cae en ${g.provincia_geometrica||"otra jurisdicción"}, no en la provincia declarada (${rec.Provincia}).`;return
  }
  dom.geoCheck.className="geo-check ok";dom.geoCheck.textContent=`Control automático: la coordenada cae dentro de ${g.provincia_geometrica||rec.Provincia}.`;
}

function renderCorrection(){
  if(state.correctedMarker){state.map.removeLayer(state.correctedMarker);state.correctedMarker=null}
  if(!state.selected)return;
  const rev=reviewFor(state.selected.Registro),lat=Number(rev.lat_corregida),lon=Number(rev.lon_corregida);
  if(Number.isFinite(lat)&&Number.isFinite(lon)&&String(rev.lat_corregida)!==""){
    state.correctedMarker=L.marker([lat,lon],{icon:L.divIcon({className:"",html:'<div class="corrected-marker"></div>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(state.map);
    const d=distanceMeters([Number(state.selected.lat_fuente),Number(state.selected.lon_fuente)],[lat,lon]);
    rev.desplazamiento_m=Math.round(d);
    dom.correctedLat.textContent=formatNum(lat);dom.correctedLon.textContent=formatNum(lon);dom.shiftDistance.textContent=`${Math.round(d)} m`;
  }else{dom.correctedLat.textContent="—";dom.correctedLon.textContent="—";dom.shiftDistance.textContent="—"}
}

function setStatus(status,write=true){
  document.querySelectorAll("[data-status]").forEach(b=>b.classList.toggle("is-active",b.dataset.status===status));
  if(write&&state.selected){const r=reviewFor(state.selected.Registro);r.estado_revision=status;state.reviews[String(state.selected.Registro)]=r}
}

function applyFilters(){
  const q=norm(dom.search.value),st=dom.statusFilter.value,tp=dom.typeFilter.value;
  state.filtered=state.catalog.filter(r=>{
    const rev=reviewFor(r.Registro),status=rev.estado_revision||"sin_revisar";
    return (!q||norm([r.Registro,r.Denominacion,r.Provincia].join(" ")).includes(q))&&(!st||status===st)&&(!tp||r.Tipo===tp);
  });
  renderGallery();renderCounts();
}
function renderGallery(){
  dom.visibleCount.textContent=`${state.filtered.length} visibles`;
  dom.gallery.innerHTML=state.filtered.map(r=>{
    const status=reviewFor(r.Registro).estado_revision||"sin_revisar";
    return `<button class="gallery-card ${state.selected?.Registro===r.Registro?"is-active":""}" data-registro="${r.Registro}">
      <span class="gallery-code">${esc(r.Tipo)} ${r.Registro}</span>
      <span class="gallery-copy"><strong>${esc(r.Denominacion)}</strong><small>${esc(r.Provincia||"")}</small></span>
      <span class="status-dot ${status}"></span></button>`;
  }).join("");
}
function renderCounts(){
  let reviewed=0,problem=0;
  state.catalog.forEach(r=>{const s=reviewFor(r.Registro).estado_revision||"sin_revisar";if(s!=="sin_revisar")reviewed++;if(s==="incorrecta")problem++});
  dom.reviewedCount.textContent=reviewed;dom.problemCount.textContent=problem;
}
function updateNav(){
  const arr=state.filtered.length?state.filtered:state.catalog,idx=arr.findIndex(x=>x.Registro===state.selected?.Registro);
  dom.prev.disabled=idx<=0;dom.next.disabled=idx<0||idx>=arr.length-1;
}
function nav(delta){
  const arr=state.filtered.length?state.filtered:state.catalog,idx=arr.findIndex(x=>x.Registro===state.selected?.Registro);
  const n=arr[idx+delta];if(n)selectRecord(n.Registro);
}

function nextUnreviewed(){
  if(!state.selected)return;
  const start=state.catalog.findIndex(x=>x.Registro===state.selected.Registro);
  for(let step=1;step<=state.catalog.length;step++){
    const r=state.catalog[(start+step)%state.catalog.length];
    const s=reviewFor(r.Registro).estado_revision||"sin_revisar";
    if(s==="sin_revisar"){selectRecord(r.Registro);return;}
  }
}
function recenterSelected(){
  if(!state.selected)return;
  state.map.setView([Number(state.selected.lat_fuente),Number(state.selected.lon_fuente)],zoomFor(state.selected));
}
async function copyCurrentLink(){
  if(!state.selected)return;
  const u=new URL(location.href);u.searchParams.set("registro",state.selected.Registro);
  try{await navigator.clipboard.writeText(u.href);dom.saveStatus.textContent="Enlace copiado.";}
  catch{dom.saveStatus.textContent=u.href;}
}

function saveCurrent(){
  if(!state.selected)return;
  const r=reviewFor(state.selected.Registro);
  r.motivo_revision=dom.reason.value;r.observacion=dom.observation.value;
  r.fecha_revision=new Date().toISOString().slice(0,10);
  const g=state.geoByRegistro[String(state.selected.Registro)]||{};
  Object.assign(r,g);
  state.reviews[String(state.selected.Registro)]=r;
  saveLocalReviews();dom.saveStatus.textContent="Revisión guardada en este navegador.";applyFilters();
}
function exportCSV(){
  const fields=["Registro","Tipo","Denominacion","Provincia","FIR","RWY","Dimensiones","Superficie","Elevacion","Ubicacion","lat_fuente","lon_fuente","criterio_visual","dentro_argentina","dentro_provincia","provincia_geometrica","estado_revision","motivo_revision","observacion","lat_corregida","lon_corregida","desplazamiento_m","fecha_revision"];
  const lines=[fields.join(",")];
  state.catalog.forEach(rec=>{const m=merged(rec);lines.push(fields.map(f=>csvCell(m[f]??"")).join(","))});
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`lad_control_posicion_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
}
async function importCSV(file){
  const text=await file.text();parseCSV(text).forEach(r=>{if(r.Registro)state.reviews[String(r.Registro)]={...reviewFor(r.Registro),...r}});
  saveLocalReviews();applyFilters();if(state.selected)selectRecord(state.selected.Registro);
}

function bind(){
  [dom.search,dom.statusFilter,dom.typeFilter].forEach(el=>el.addEventListener(el.tagName==="INPUT"?"input":"change",applyFilters));
  dom.gallery.addEventListener("click",e=>{const b=e.target.closest("[data-registro]");if(b)selectRecord(Number(b.dataset.registro))});
  document.querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",()=>setStatus(b.dataset.status)));
  dom.correctionMode.addEventListener("click",()=>{state.correctionMode=!state.correctionMode;dom.correctionMode.classList.toggle("is-active",state.correctionMode);dom.correctionMode.textContent=state.correctionMode?"Haga clic en el mapa":"Definir posición corregida"});
  dom.clearCorrection.addEventListener("click",()=>{if(!state.selected)return;const r=reviewFor(state.selected.Registro);delete r.lat_corregida;delete r.lon_corregida;delete r.desplazamiento_m;state.reviews[String(state.selected.Registro)]=r;renderCorrection()});
  dom.saveReview.addEventListener("click",saveCurrent);dom.prev.addEventListener("click",()=>nav(-1));dom.next.addEventListener("click",()=>nav(1));
  dom.nextPending.addEventListener("click",nextUnreviewed);dom.copyLink.addEventListener("click",copyCurrentLink);dom.recenter.addEventListener("click",recenterSelected);
  dom.exportCsv.addEventListener("click",exportCSV);dom.importCsv.addEventListener("change",e=>{if(e.target.files?.[0])importCSV(e.target.files[0])});
  window.addEventListener("popstate",()=>{const r=Number(new URLSearchParams(location.search).get("registro"));if(Number.isFinite(r))selectRecord(r,{updateUrl:false})});
}
load().catch(err=>{console.error(err);document.body.innerHTML=`<pre style="padding:30px">No fue posible iniciar la galería: ${esc(err.message)}</pre>`});
})();
