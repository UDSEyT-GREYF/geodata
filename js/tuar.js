(() => {
"use strict";

const DATA_VERSION="20261019-4";
const ROUTES_URL=`/geodata/data/tuar/tuar_rutas_2026.geojson?v=${DATA_VERSION}`;
const AIRPORTS_URL=`/geodata/data/tuar/tuar_aeropuertos_2026.geojson?v=${DATA_VERSION}`;
const METRICS_URL=`/geodata/data/tuar/tuar_metricas_2026.json?v=${DATA_VERSION}`;
const HISTORY_URL=`/geodata/data/tuar/tuar_pasajeros_historicos.json?v=${DATA_VERSION}`;
const POTENTIAL_URL=`/geodata/data/tuar/tuar_rutas_potenciales.geojson?v=${DATA_VERSION}`;

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
  potentialToggle:document.getElementById("potentialToggle"),
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
  benefitKpiPax:document.getElementById("benefitKpiPax"),
  benefitKpiNote:document.getElementById("benefitKpiNote"),
  historyPanel:document.getElementById("historyPanel"),
  historyToggle:document.getElementById("historyToggle"),
  historyHead:document.getElementById("historyHead"),
  historyRows:document.getElementById("historyRows"),
  historyNote:document.getElementById("historyNote")
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
const potentialLayer=L.layerGroup().addTo(map);

let routes=[];
let airports=[];
let visibleRoutes=[];
let routeMarkers=new Map();
let potentialRoutes=[];
let visiblePotentialRoutes=[];
let potentialRouteMarkers=new Map();
let historyData=null;
let airportByIata=new Map();

const CURVE_FACTORS={
  "AEP-MVD":-0.20,
  "EZE-MVD":0.18,
  "MDZ-SCL":0.34,
  "AEP-PDP":0.22,
  "AEP-POA":-0.18,
  "BRC-SCL":-0.28,
  "COR-ASU":-0.18,
  "COR-SCL":-0.34,
  "NQN-SCL":0.24
};

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
function fmtPaxCompact(v){
  const n=Number(v);
  if(!Number.isFinite(n)) return "–";
  if(n>=1000000){
    return `≈ ${(n/1000000).toLocaleString("es-AR",{maximumFractionDigits:1})} millones de pasajeros/año`;
  }
  if(n>=1000){
    return `≈ ${Math.round(n/1000).toLocaleString("es-AR")} mil pasajeros/año`;
  }
  return `≈ ${Math.round(n).toLocaleString("es-AR")} pasajeros/año`;
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
    return {color:COLORS[p.categoria_tasa],weight:4.3,opacity:.96,lineCap:"round",lineJoin:"round"};
  }
  if(p.categoria_tasa==="TUAR previa"){
    return {color:COLORS[p.categoria_tasa],weight:3.3,opacity:.9,lineCap:"round",lineJoin:"round"};
  }
  return {color:COLORS[p.categoria_tasa],weight:1.1,opacity:.22,lineCap:"round",lineJoin:"round"};
}
function popup(p){
  const cls=catClass(p.categoria_tasa);
  const airlines=Array.isArray(p.aerolineas)?p.aerolineas:[];
  const airlineNames=airlines.length
    ? airlines.map(a=>a.aerolinea).filter(Boolean).join(" · ")
    : "Sin dato";

  const weekPct=Number(p.porcentaje_semanas_frecuencia_ge3);
  const annualPax=Number(p.pasajeros_anuales_estimados);
  const annualSaving=Number(p.ahorro_anual_estimado_usd);

  const econ = Number.isFinite(annualPax)
    ? `<div class="popup-economic-summary">
        <div>
          <span>Pasajeros anuales estimados</span>
          <strong>${fmt(annualPax)} pasajeros</strong>
        </div>
        ${p.beneficiada_ampliacion && Number.isFinite(annualSaving)
          ? `<div class="is-benefit">
              <span>Ahorro anual estimado</span>
              <strong>${fmtUsd(annualSaving)}</strong>
            </div>`
          : `<div>
              <span>Situación tarifaria</span>
              <strong>${p.categoria_tasa==="TUAR previa" ? "TUAR ya vigente" : esc(p.tasa_nueva||"TUAI")}</strong>
            </div>`
        }
      </div>`
    : "";

  return `
    <div class="popup-category ${cls}">${esc(p.categoria_tasa)}</div>
    <div class="popup-title">${esc(p.ruta)}</div>

    <div class="popup-row"><span>Distancia</span><span>${fmt(p.distancia_km)} km</span></div>
    <div class="popup-row"><span>Frecuencia típica</span><span>${fmt(p.frecuencia_semanal_mediana,1)} despegues/semana</span></div>
    <div class="popup-row">
      <span>Semanas con ≥3 frec.</span>
      <span class="popup-week-share">${Number.isFinite(weekPct) ? fmt(weekPct,0)+"%" : "–"}</span>
    </div>
    <div class="popup-row"><span>Tasa anterior</span><span>${esc(p.tasa_antes)}</span></div>
    <div class="popup-row"><span>Tasa actual</span><span>${esc(p.tasa_nueva)}</span></div>

    <div class="popup-airline-list">
      <span>Aerolíneas</span>
      <strong>${esc(airlineNames)}</strong>
    </div>

    ${p.beneficiada_ampliacion && p.base_estimacion_pasajeros
      ? `<div class="popup-method">Estimación de pasajeros: promedio histórico de ${fmt(p.anios_con_dato_promedio)} año${Number(p.anios_con_dato_promedio)===1?"":"s"} con datos${p.ruta_historica_base==="BUE - POA" ? " · BUE = AEP + EZE" : ""}.</div>`
      : ""}

    ${econ}
  `;
}



function potentialPopup(p){
  const years=["2015","2016","2017","2018","2019"];
  const hist=p.pasajeros_por_anio_2015_2019||{};
  const airlines=Array.isArray(p.aerolineas_historicas)?p.aerolineas_historicas:[];

  return `
    <div class="popup-category potential">Ruta potencial</div>
    <div class="popup-title">${esc(p.ruta)}</div>

    <div class="popup-row"><span>Distancia</span><span>${fmt(p.distancia_km)} km</span></div>
    <div class="popup-airline-list">
      <span>Aerolíneas documentadas</span>
      <strong>${airlines.length ? esc(airlines.join(" · ")) : "Sin dato"}</strong>
    </div>

    <div class="potential-summary">
      <div>
        <span>Pasajeros 2015–2019</span>
        <strong>${fmt(p.pasajeros_2015_2019)}</strong>
      </div>
      <div>
        <span>Máximo anual</span>
        <strong>${fmt(p.max_pasajeros_anual)} · ${esc(p.anio_max_pasajeros)}</strong>
      </div>
    </div>

    <div class="potential-history">
      <div class="potential-history-title">Pasajeros por año</div>
      <div class="potential-history-grid">
        ${years.map(y=>`
          <div>
            <span>${y}</span>
            <strong>${hist[y]===null || hist[y]===undefined ? "—" : fmt(hist[y])}</strong>
          </div>`).join("")}
      </div>
    </div>

    <div class="potential-note">
      Antecedente histórico. La línea discontinua no representa un servicio regular activo en la capa 2026.
    </div>
  `;
}

function potentialCurvedLatLngs(f){
  const coords=f?.geometry?.coordinates||[];
  if(coords.length<2) return [];

  const [lon1,lat1]=coords[0];
  const [lon2,lat2]=coords[coords.length-1];
  const [x1,y1]=projectMercator(lon1,lat1);
  const [x2,y2]=projectMercator(lon2,lat2);
  const dx=x2-x1,dy=y2-y1;
  const len=Math.hypot(dx,dy);
  if(!len) return [[lat1,lon1],[lat2,lon2]];

  const px=-dy/len,py=dx/len;
  let offset=len*(Number(f.properties?.curvatura_mapa)||.14);
  offset=Math.max(-420000,Math.min(420000,offset));

  const cx=(x1+x2)/2+px*offset;
  const cy=(y1+y2)/2+py*offset;
  const points=[];
  const n=56;

  for(let i=0;i<n;i++){
    const t=i/(n-1),u=1-t;
    const x=u*u*x1+2*u*t*cx+t*t*x2;
    const y=u*u*y1+2*u*t*cy+t*t*y2;
    const [lon,lat]=unprojectMercator(x,y);
    points.push([lat,lon]);
  }
  return points;
}

function renderPotentialRoutes(){
  potentialLayer.clearLayers();
  potentialRouteMarkers.clear();

  const origin=dom.origin.value;
  visiblePotentialRoutes=(dom.potentialToggle?.checked ? potentialRoutes : []).filter(f=>{
    const p=f.properties||{};
    return !origin || p.origen_iata===origin;
  });

  for(const f of visiblePotentialRoutes){
    const p=f.properties||{};
    const latlngs=potentialCurvedLatLngs(f);
    if(!latlngs.length) continue;

    const style={
      color:"#7357a6",
      weight:2.7,
      opacity:.82,
      dashArray:"8 6",
      lineCap:"round",
      lineJoin:"round"
    };

    const line=L.polyline(latlngs,style)
      .bindPopup(potentialPopup(p),{maxWidth:420});

    line.on("mouseover",()=>{
      line.setStyle({
        ...style,
        weight:4,
        opacity:1
      });
      line.bringToFront();
    });

    line.on("mouseout",()=>{
      line.setStyle(style);
    });

    line.addTo(potentialLayer);
    potentialRouteMarkers.set(`POT-${p.id}`,line);
  }
}

function renderHistoryTable(){
  if(!historyData || !dom.historyHead || !dom.historyRows) return;

  const years=historyData.anios||[];
  const routes=historyData.rutas||[];

  dom.historyHead.innerHTML=`
    <tr>
      <th>Ruta</th>
      ${years.map(y=>`<th>${esc(y)}</th>`).join("")}
      <th>Promedio</th>
    </tr>`;

  dom.historyRows.innerHTML=routes.map(r=>`
    <tr>
      <td>${esc(r.ruta)}</td>
      ${years.map(y=>{
        const v=r.valores?.[String(y)];
        return v===null || v===undefined
          ? `<td class="missing">—</td>`
          : `<td>${fmt(v)}</td>`;
      }).join("")}
      <td><strong>${r.promedio_anual===null || r.promedio_anual===undefined ? "—" : fmt(r.promedio_anual)}</strong></td>
    </tr>`).join("");

  if(dom.historyNote){
    dom.historyNote.textContent="Promedio = años con datos disponibles · BUE = AEP + EZE · — sin registro";
  }
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
  for(const f of visiblePotentialRoutes){
    needed.add(f.properties.origen_iata);
    needed.add(f.properties.destino_iata);
  }

  const rendered=new Set();

  function addAirportMarker(iata,city,lon,lat,isOrigin){
    if(!iata || rendered.has(iata)) return;

    const icon=L.divIcon({
      className:"",
      html:`<div class="airport-marker ${isOrigin?"":"foreign"}"></div>`,
      iconSize:isOrigin?[16,16]:[11,11],
      iconAnchor:isOrigin?[8,8]:[5.5,5.5]
    });

    L.marker([lat,lon],{icon,keyboard:false,interactive:true})
      .bindTooltip(`${esc(iata)} · ${esc(city||"")}`,{direction:"top",offset:[0,-6]})
      .addTo(airportLayer);

    rendered.add(iata);
  }

  // Aeropuertos de la capa principal.
  for(const f of airports){
    const p=f.properties||{};
    if(!needed.has(p.iata)) continue;

    const [lon,lat]=f.geometry.coordinates;
    const isOrigin=
      visibleRoutes.some(r=>r.properties.origen_iata===p.iata) ||
      visiblePotentialRoutes.some(r=>r.properties.origen_iata===p.iata);

    addAirportMarker(p.iata,p.ciudad,lon,lat,isOrigin);
  }

  // Fallback para aeropuertos que sólo aparecen en la capa potencial.
  // Esto incorpora, entre otros, IQQ como destino de SLA–IQQ.
  for(const f of visiblePotentialRoutes){
    const p=f.properties||{};
    const coords=f.geometry?.coordinates||[];
    if(coords.length<2) continue;

    const originCoord=coords[0];
    const destCoord=coords[coords.length-1];

    if(!rendered.has(p.origen_iata)){
      addAirportMarker(
        p.origen_iata,
        p.origen_ciudad,
        Number(originCoord[0]),
        Number(originCoord[1]),
        true
      );
    }

    if(!rendered.has(p.destino_iata)){
      addAirportMarker(
        p.destino_iata,
        p.destino_ciudad,
        Number(destCoord[0]),
        Number(destCoord[1]),
        false
      );
    }
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
  if(!dom.benefitKpiValue || !dom.benefitKpiPax || !dom.benefitKpiNote) return;

  const origin=dom.origin.value;
  const benefited=routes.filter(f=>{
    const p=f.properties||{};
    return p.categoria_tasa==="Nueva TUAR"
      && (!origin || p.origen_iata===origin);
  });

  const totalSaving=benefited.reduce(
    (acc,f)=>acc+(Number(
      f.properties?.ahorro_anual_estimado_usd ??
      f.properties?.ahorro_anual_proxy_usd
    )||0),
    0
  );

  const totalPax=benefited.reduce(
    (acc,f)=>acc+(Number(
      f.properties?.pasajeros_anuales_estimados ??
      f.properties?.pasajeros_anuales_proxy
    )||0),
    0
  );

  // Respaldo para la vista general si el navegador conserva una versión vieja del GeoJSON.
  const savingValue = (!origin && totalSaving===0) ? 4462939 : totalSaving;
  const paxValue = (!origin && totalPax===0) ? 140168 : totalPax;

  dom.benefitKpiValue.textContent=fmtUsdCompact(savingValue);
  dom.benefitKpiPax.textContent=fmtPaxCompact(paxValue);

  if(origin){
    dom.benefitKpiNote.textContent=
      `Estimación anual · promedio histórico · ${benefited.length} ruta${benefited.length===1?"":"s"} desde ${origin}`;
  }else{
    dom.benefitKpiNote.textContent=
      `Estimación anual · promedio histórico · ${benefited.length || 5} rutas TUAR nuevas`;
  }
}


function projectMercator(lon,lat){
  const R=6378137;
  const clamped=Math.max(-85.05112878,Math.min(85.05112878,lat));
  return [
    R*lon*Math.PI/180,
    R*Math.log(Math.tan(Math.PI/4+(clamped*Math.PI/180)/2))
  ];
}

function unprojectMercator(x,y){
  const R=6378137;
  return [
    x/R*180/Math.PI,
    (2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI
  ];
}

function curveFactorFor(p){
  if(CURVE_FACTORS[p.id]!==undefined) return CURVE_FACTORS[p.id];

  // Curvatura suave para las rutas TUAI de contexto.
  const id=String(p.id||p.ruta||"");
  let hash=0;
  for(let i=0;i<id.length;i++) hash=(hash+id.charCodeAt(i)*(i+1))%997;
  const sign=(hash%2===0)?1:-1;
  const mag=.055+(hash%4)*.012;
  return sign*mag;
}

function curvedLatLngs(p){
  const a=airportByIata.get(p.origen_iata);
  const b=airportByIata.get(p.destino_iata);

  if(!a||!b){
    return [];
  }

  const [x1,y1]=projectMercator(a.lon,a.lat);
  const [x2,y2]=projectMercator(b.lon,b.lat);
  const dx=x2-x1,dy=y2-y1;
  const len=Math.hypot(dx,dy);
  if(!len) return [[a.lat,a.lon],[b.lat,b.lon]];

  const factor=curveFactorFor(p);
  const px=-dy/len,py=dx/len;

  let offset=len*factor;
  const maxOffset=p.categoria_tasa==="TUAI"?600000:420000;
  offset=Math.max(-maxOffset,Math.min(maxOffset,offset));

  const cx=(x1+x2)/2+px*offset;
  const cy=(y1+y2)/2+py*offset;

  const points=[];
  const n=56;
  for(let i=0;i<n;i++){
    const t=i/(n-1);
    const u=1-t;
    const x=u*u*x1+2*u*t*cx+t*t*x2;
    const y=u*u*y1+2*u*t*cy+t*t*y2;
    const [lon,lat]=unprojectMercator(x,y);
    points.push([lat,lon]);
  }
  return points;
}

function renderRoutes(){
  routeLayer.clearLayers();
  routeMarkers.clear();

  const origin=dom.origin.value;
  visibleRoutes=routes.filter(f=>{
    const p=f.properties||{};
    return categoryEnabled(p.categoria_tasa) && (!origin || p.origen_iata===origin);
  });

  // Dibujar primero el contexto TUAI y luego las rutas destacadas.
  const ordered=[...visibleRoutes].sort(
    (a,b)=>(b.properties.categoria_orden||9)-(a.properties.categoria_orden||9)
  );

  for(const f of ordered){
    const p=f.properties||{};
    const latlngs=curvedLatLngs(p);
    if(!latlngs.length) continue;

    const baseStyle=routeStyle(p);

    const line=L.polyline(latlngs,baseStyle)
      .bindPopup(popup(p),{maxWidth:410});

    const resetLine=()=>{
      line.setStyle(baseStyle);

      // Las TUAI vuelven siempre al fondo y a su trazo fino.
      if(p.categoria_tasa==="TUAI"){
        line.bringToBack();
      }
    };

    line.on("mouseover",()=>{
      if(p.categoria_tasa==="TUAI"){
        // Contexto: resaltado moderado, sin llevar la línea al frente.
        line.setStyle({
          ...baseStyle,
          weight:2,
          opacity:.65
        });
      }else{
        line.setStyle({
          ...baseStyle,
          weight:baseStyle.weight+1.5,
          opacity:1
        });
        line.bringToFront();
      }
    });

    line.on("mouseout",resetLine);
    line.on("popupclose",resetLine);

    line.addTo(routeLayer);
    routeMarkers.set(p.id,line);
  }

  renderPotentialRoutes();
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
  const priority={"Nueva TUAR":0,"TUAR previa":1,"TUAI":3};
  const current=[...visibleRoutes].map(f=>({kind:"current",feature:f}));
  const potential=[...visiblePotentialRoutes].map(f=>({kind:"potential",feature:f}));

  const list=[...current,...potential].sort((a,b)=>{
    const pa=a.feature.properties||{},pb=b.feature.properties||{};
    const pra=a.kind==="potential"?2:(priority[pa.categoria_tasa]??9);
    const prb=b.kind==="potential"?2:(priority[pb.categoria_tasa]??9);
    return (pra-prb)
      || String(pa.origen_iata||"").localeCompare(String(pb.origen_iata||""))
      || String(pa.destino_iata||"").localeCompare(String(pb.destino_iata||""));
  });

  if(!list.length){
    dom.resultList.innerHTML='<p class="empty-note">No hay rutas para los filtros seleccionados.</p>';
    return;
  }

  dom.resultList.innerHTML=list.map(item=>{
    const p=item.feature.properties||{};

    if(item.kind==="potential"){
      return `<button class="route-item" type="button" data-route="POT-${esc(p.id)}">
        <span class="route-code potential">${esc(p.origen_iata)}–${esc(p.destino_iata)}</span>
        <span class="route-copy">
          <strong>${esc(p.origen_ciudad)} → ${esc(p.destino_ciudad)}</strong>
          <span>Ruta potencial · ${fmt(p.pasajeros_2015_2019)} pax 2015–2019</span>
        </span>
        <span class="route-km">${fmt(p.distancia_km)} km</span>
      </button>`;
    }

    const cls=catClass(p.categoria_tasa);
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
  const layer=routeMarkers.get(id) || potentialRouteMarkers.get(id);
  if(!layer) return;
  const bounds=layer.getBounds?.();
  if(bounds?.isValid()) map.fitBounds(bounds,{padding:[80,80],maxZoom:6.75});
  layer.openPopup?.();
}

function fitTUAR(){
  const origin=dom.origin.value;

  const activeTUAR=routes.filter(f=>{
    const p=f.properties||{};
    return p.categoria_tasa!=="TUAI"
      && (!origin || p.origen_iata===origin);
  });

  const potential=(dom.potentialToggle?.checked ? potentialRoutes : [])
    .filter(f=>{
      const p=f.properties||{};
      return !origin || p.origen_iata===origin;
    });

  const latlngs=[
    ...activeTUAR.flatMap(f=>curvedLatLngs(f.properties)),
    ...potential.flatMap(f=>potentialCurvedLatLngs(f))
  ];

  if(!latlngs.length) return;

  const b=L.latLngBounds(latlngs);

  if(b.isValid()){
    map.fitBounds(b,{
      padding:[28,28],
      maxZoom:6
    });
  }
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
  if(dom.potentialToggle) dom.potentialToggle.checked=true;
  renderRoutes();
  fitTUAR();
}

function bind(){
  [dom.origin,dom.previousToggle,dom.newToggle,dom.potentialToggle,dom.contextToggle].filter(Boolean).forEach(el=>{
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


  if(dom.historyToggle){
    dom.historyToggle.addEventListener("click",()=>{
      const collapsed=dom.historyPanel.classList.toggle("is-collapsed");
      dom.historyToggle.setAttribute("aria-expanded",String(!collapsed));
    });
  }

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


async function updateDomesticKpiUsd(){
  const TOTAL_ARS = 117914550000;
  const usdEl = document.getElementById("domesticKpiUsd");
  const fxEl = document.getElementById("domesticKpiFx");
  if(!usdEl || !fxEl) return;

  try{
    const response = await fetch(
      "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/REF",
      {cache:"no-store"}
    );
    if(!response.ok) throw new Error("BCRA no disponible");

    const data = await response.json();
    const ultimo = data.results?.[0];
    const detalle = ultimo?.detalle?.[0];
    const tc = Number(detalle?.tipoCotizacion);
    const fecha = ultimo?.fecha;

    if(!Number.isFinite(tc) || tc<=0) throw new Error("Cotización inválida");

    const totalUsd=TOTAL_ARS/tc;
    usdEl.textContent=`≈ USD ${(totalUsd/1000000).toLocaleString("es-AR",{
      minimumFractionDigits:1,maximumFractionDigits:1
    })} millones adicionales/año`;

    fxEl.textContent=`TC BCRA A 3500: ARS ${tc.toLocaleString("es-AR",{
      minimumFractionDigits:2,maximumFractionDigits:2
    })} por USD · ${fecha}`;
  }catch(error){
    console.error("Error al consultar BCRA:",error);
    usdEl.textContent="Equivalencia en USD no disponible";
    fxEl.textContent="Fuente: BCRA · Comunicación A 3500";
  }
}

async function init(){
  try{
    const [rr,aa,mm,hh,pp]=await Promise.all([
      fetch(ROUTES_URL,{cache:"no-store"}),
      fetch(AIRPORTS_URL,{cache:"no-store"}),
      fetch(METRICS_URL,{cache:"no-store"}),
      fetch(HISTORY_URL,{cache:"no-store"}),
      fetch(POTENTIAL_URL,{cache:"no-store"})
    ]);
    if(!rr.ok||!aa.ok||!mm.ok||!hh.ok||!pp.ok) throw new Error("No fue posible cargar los datos del mapa.");
    const rj=await rr.json();
    const aj=await aa.json();
    const mj=await mm.json();
    historyData=await hh.json();
    const pj=await pp.json();
    potentialRoutes=pj.features||[];

    routes=rj.features||[];
    airports=aj.features||[];

    airportByIata=new Map(
      airports
        .filter(f=>f?.geometry?.type==="Point" && f?.properties?.iata)
        .map(f=>[
          f.properties.iata,
          {lon:Number(f.geometry.coordinates[0]),lat:Number(f.geometry.coordinates[1])}
        ])
    );

    const metricsByRoute=mj.rutas||{};
    routes.forEach(f=>{
      const m=metricsByRoute[f.properties?.id];
      if(m) Object.assign(f.properties,m);
    });

    buildOriginOptions();
    renderHistoryTable();
    renderPotentialHistoryTable();
    bind();
    renderRoutes();
    fitTUAR();
    updateDomesticKpiUsd();

    dom.loading.classList.add("is-hidden");
  }catch(err){
    console.error(err);
    dom.loading.innerHTML=`<strong>No fue posible cargar el mapa</strong><span>${esc(err.message)}</span>`;
  }
}

init();
})();
