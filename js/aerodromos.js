:root{
  --navy-950:#071522;--navy-900:#0b1f33;--navy-800:#12324f;--navy-700:#1d486d;
  --slate-900:#17212b;--slate-700:#425466;--slate-600:#5c6f82;--slate-500:#728498;
  --slate-300:#c9d3dd;--slate-200:#dde4eb;--slate-100:#edf2f6;--slate-50:#f7f9fb;--white:#fff;
  --sna:#306fb0;--other:#1d486d;--public:#1d486d;--private:#7357a6;--military:#66778a;
  --topbar-h:72px;--sidebar-w:380px;
  --shadow-sm:0 2px 10px rgba(7,21,34,.08);--shadow-md:0 12px 34px rgba(7,21,34,.16);
}
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0}
body{overflow:hidden;color:var(--slate-900);background:var(--slate-100);font-family:Inter,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
button,input,select{font:inherit;color:inherit}button,select{cursor:pointer}
button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,#map:focus-visible{outline:3px solid rgba(26,132,202,.34);outline-offset:2px}
svg{display:block;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.8}
.skip-link{position:fixed;top:-60px;left:16px;z-index:3000;padding:10px 14px;color:#fff;background:var(--navy-950);border-radius:0 0 8px 8px;text-decoration:none}.skip-link:focus{top:0}

.topbar{position:relative;z-index:1100;display:flex;align-items:center;justify-content:space-between;height:var(--topbar-h);padding:0 20px;color:#fff;background:linear-gradient(105deg,var(--navy-950),var(--navy-800));border-bottom:1px solid rgba(255,255,255,.1);box-shadow:0 3px 16px rgba(7,21,34,.24)}
.brand-block,.topbar-actions{display:flex;align-items:center}.brand-block{min-width:0;gap:12px}.topbar-actions{gap:10px;flex:0 0 auto}
.back-link,.brand-mark,.header-button{display:inline-flex;align-items:center;justify-content:center}.back-link{width:34px;height:34px;color:rgba(255,255,255,.82);border-radius:9px;text-decoration:none}.back-link:hover{color:#fff;background:rgba(255,255,255,.1)}.back-link svg{width:22px;height:22px}
.brand-mark{flex:0 0 auto;width:38px;height:38px;color:#a8e1e3;background:rgba(74,185,192,.16);border:1px solid rgba(168,225,227,.25);border-radius:11px}.brand-mark svg{width:23px;height:23px}
.eyebrow{margin:0 0 2px;color:var(--slate-600);font-size:10px;font-weight:750;letter-spacing:.105em;text-transform:uppercase}.topbar .eyebrow{color:#a8bbce}
h1{margin:0;overflow:hidden;font-size:clamp(17px,2vw,22px);font-weight:680;letter-spacing:-.025em;white-space:nowrap;text-overflow:ellipsis}
.header-button{gap:7px;min-height:36px;padding:0 12px;color:#e9f1f7;background:transparent;border:1px solid rgba(255,255,255,.17);border-radius:9px;font-size:12px;font-weight:650}.header-button:hover{background:rgba(255,255,255,.1)}.header-button svg{width:17px;height:17px}

.app-shell{display:grid;grid-template-columns:var(--sidebar-w) minmax(0,1fr);height:calc(100% - var(--topbar-h))}
.sidebar{position:relative;z-index:900;display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0;background:#fff;border-right:1px solid var(--slate-200);box-shadow:5px 0 24px rgba(7,21,34,.08)}
.sidebar-scroll{overflow-y:auto;min-height:0}.intro-section,.filter-section,.summary-section,.results-section{padding:15px 18px;border-bottom:1px solid var(--slate-200)}
.intro-section{background:linear-gradient(180deg,#f7fbfc,#fff)}.intro-section p{margin:0;color:var(--slate-600);font-size:11.5px;line-height:1.48}.intro-section p+p{margin-top:5px}
.field-label,.results-heading h2{display:block;margin:0 0 8px;color:var(--slate-700);font-size:10.5px;font-weight:760;letter-spacing:.055em;text-transform:uppercase}

.search-wrap{position:relative}.search-wrap svg{position:absolute;left:11px;top:50%;width:16px;height:16px;color:var(--slate-500);transform:translateY(-50%)}.search-wrap input{width:100%;height:40px;padding:0 11px 0 36px;background:var(--slate-50);border:1px solid var(--slate-300);border-radius:9px;outline:none}.search-wrap input::placeholder{color:#8a9aab;font-size:10px}
.select-wrap{position:relative}.select-wrap select{width:100%;height:38px;padding:0 32px 0 10px;background:var(--slate-50);border:1px solid var(--slate-300);border-radius:9px;appearance:none;outline:none;font-size:11px}.select-wrap svg{position:absolute;right:10px;top:50%;width:15px;height:15px;color:var(--slate-500);transform:translateY(-50%);pointer-events:none}
.filter-grid-section{display:grid;grid-template-columns:1fr 1fr;gap:12px 10px}.filter-grid-section .field-label{margin-bottom:6px}

.switch-row{position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:56px;cursor:pointer}.switch-row+.switch-row{border-top:1px solid var(--slate-100)}.switch-row strong,.switch-row small{display:block}.switch-row strong{font-size:11.5px;font-weight:680}.switch-row small{margin-top:3px;color:var(--slate-500);font-size:9.5px}.switch-row input{position:absolute;opacity:0}.switch{position:relative;flex:0 0 auto;width:36px;height:20px;background:#b8c4cf;border-radius:999px}.switch:after{position:absolute;top:3px;left:3px;width:14px;height:14px;background:#fff;border-radius:50%;box-shadow:0 1px 4px rgba(7,21,34,.28);content:"";transition:.2s}.switch-row input:checked+.switch{background:var(--navy-700)}.switch-row input:checked+.switch:after{transform:translateX(16px)}
.inline-dot{display:inline-block;width:10px;height:10px;margin:0 7px 0 0;border-radius:50%;vertical-align:-1px}.inline-dot.sna{background:var(--sna)}.inline-dot.other{background:var(--other)}

.summary-section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;background:var(--slate-50)}.summary-card{padding:9px 4px;text-align:center;background:#fff;border:1px solid var(--slate-200);border-radius:9px}.summary-primary{background:#fff2ee;border-color:#f1c4b8}.summary-value,.summary-label{display:block}.summary-value{font-size:20px;font-weight:760;color:var(--navy-900)}.summary-label{margin-top:4px;color:var(--slate-500);font-size:8px;font-weight:680;text-transform:uppercase;line-height:1.15}

.results-heading{display:flex;align-items:center;justify-content:space-between}.results-heading h2{margin:0}.text-button{padding:0;color:var(--navy-700);background:transparent;border:0;font-size:10px;font-weight:700}
.result-list{display:grid;gap:4px;margin-top:8px}.airport-item{display:grid;grid-template-columns:52px minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;padding:7px;background:transparent;border:1px solid transparent;border-radius:8px;text-align:left;cursor:pointer}.airport-item:hover{background:var(--slate-50);border-color:var(--slate-200)}.airport-code{display:grid;place-items:center;min-height:28px;color:#fff;border-radius:6px;font-size:9px;font-weight:800}.airport-code.sna-public{background:var(--sna)}.airport-code.other-public{background:var(--public)}.airport-code.other-private{background:var(--private)}.airport-code.other-military{background:var(--military)}.airport-copy{min-width:0}.airport-copy strong,.airport-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.airport-copy strong{font-size:10.5px}.airport-copy span{margin-top:2px;color:var(--slate-500);font-size:9px}.airport-meta{color:var(--slate-600);font-size:8.5px;font-weight:700;text-align:right}.empty-note{margin:6px 0;color:var(--slate-500);font-size:10px;line-height:1.45}
.sidebar-footer{display:flex;justify-content:space-between;gap:10px;padding:8px 13px;color:var(--slate-500);background:#fff;border-top:1px solid var(--slate-200);font-size:8px}

.map-stage{position:relative;min-width:0;min-height:0;overflow:hidden;background:#dbe5ea}.map-stage,#map{width:100%;height:100%}.leaflet-container{font-family:inherit;background:#e8eef2}.leaflet-control-zoom{overflow:hidden;border:0!important;border-radius:10px!important;box-shadow:var(--shadow-sm)!important}.leaflet-control-zoom a{width:36px!important;height:36px!important;color:var(--navy-900)!important;border-color:var(--slate-200)!important;font:20px/36px Arial,sans-serif!important}.leaflet-control-attribution{font-size:8px!important;background:rgba(255,255,255,.88)!important}
.map-tools{position:absolute;z-index:500;top:12px;right:12px;display:grid;overflow:hidden;background:#fff;border:1px solid var(--slate-200);border-radius:10px;box-shadow:var(--shadow-sm)}.map-tools button{display:grid;place-items:center;width:37px;height:37px;padding:0;color:var(--navy-900);background:#fff;border:0}.map-tools button+button{border-top:1px solid var(--slate-200)}.map-tools svg{width:19px;height:19px}

.map-legend{position:absolute;z-index:500;left:18px;bottom:92px;width:245px;overflow:hidden;background:rgba(255,255,255,.96);border:1px solid rgba(201,211,221,.8);border-radius:10px;box-shadow:var(--shadow-sm);backdrop-filter:blur(8px)}.legend-title{display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;color:var(--slate-700);background:transparent;border:0;font-size:10px;font-weight:760;letter-spacing:.05em;text-transform:uppercase}.legend-title svg{width:15px;height:15px;transition:.2s}.map-legend.is-collapsed .legend-title svg{transform:rotate(180deg)}.legend-body{display:grid;gap:7px;padding:0 12px 11px;color:var(--slate-700);font-size:9.5px}.map-legend.is-collapsed .legend-body{display:none}.legend-body>div{display:flex;align-items:center;gap:8px}.legend-dot{display:inline-block;flex:0 0 auto;width:12px;height:12px;border-radius:50%;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(7,21,34,.28)}.legend-dot.sna-public{background:var(--sna)}.legend-dot.other-public{background:var(--public)}.legend-dot.other-private{background:var(--private)}.legend-dot.other-military{background:var(--military)}.legend-body p{margin:3px 0 0;padding-top:7px;color:var(--slate-500);border-top:1px solid var(--slate-200);font-size:8px;line-height:1.4}

.basemap-buttons{position:absolute;z-index:500;left:18px;bottom:38px;display:grid;grid-template-columns:repeat(3,1fr);width:245px;overflow:hidden;background:rgba(255,255,255,.96);border:1px solid var(--slate-200);border-radius:10px;box-shadow:var(--shadow-sm);backdrop-filter:blur(8px)}.basemap-buttons button{min-height:35px;padding:0 5px;color:var(--slate-600);background:transparent;border:0;font-size:9px;font-weight:700}.basemap-buttons button+button{border-left:1px solid var(--slate-200)}.basemap-buttons button.is-active{color:#fff;background:var(--navy-800)}
.loading-overlay{position:absolute;z-index:800;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:rgba(237,242,246,.94);color:var(--slate-700);transition:.2s}.loading-overlay.is-hidden{visibility:hidden;opacity:0;pointer-events:none}.loader{width:35px;height:35px;border:3px solid #c7d7e0;border-top-color:var(--sna);border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}

.leaflet-popup-content-wrapper{border-radius:12px;box-shadow:var(--shadow-md)}.leaflet-popup-content{margin:13px 14px 14px;min-width:285px;max-width:360px}.popup-badge{display:inline-flex;padding:4px 7px;color:#fff;border-radius:999px;font-size:8px;font-weight:800;letter-spacing:.045em;text-transform:uppercase}.popup-badge.sna-public{background:var(--sna)}.popup-badge.other-public{background:var(--public)}.popup-badge.other-private{background:var(--private)}.popup-badge.other-military{background:var(--military)}.popup-title{margin:7px 0 3px;color:var(--navy-900);font-size:16px;font-weight:780;line-height:1.18}.popup-subtitle{margin:0 0 9px;color:var(--slate-500);font-size:9px;line-height:1.35}.popup-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.popup-cell{padding:7px 8px;background:var(--slate-50);border:1px solid var(--slate-200);border-radius:7px}.popup-cell span,.popup-cell strong{display:block}.popup-cell span{color:var(--slate-500);font-size:7.5px;font-weight:750;letter-spacing:.04em;text-transform:uppercase}.popup-cell strong{margin-top:3px;color:var(--slate-900);font-size:10px;line-height:1.25}.popup-wide{margin-top:7px;padding:8px 9px;background:#fff;border:1px solid var(--slate-200);border-radius:7px}.popup-wide span,.popup-wide strong{display:block}.popup-wide span{color:var(--slate-500);font-size:7.5px;font-weight:750;text-transform:uppercase}.popup-wide strong{margin-top:3px;color:var(--slate-900);font-size:9.5px;line-height:1.35}.popup-note{margin-top:8px;padding-top:7px;color:#7c8996;border-top:1px dashed #c9d3dd;font-size:7.8px;line-height:1.4}

.about-dialog{width:min(680px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;padding:22px;color:var(--slate-900);background:#fff;border:0;border-radius:14px;box-shadow:0 22px 70px rgba(7,21,34,.3)}.about-dialog::backdrop{background:rgba(7,21,34,.58);backdrop-filter:blur(2px)}.about-dialog h2{margin:2px 0 10px;color:var(--navy-900);font-size:22px}.about-dialog h3{margin:18px 0 6px;color:var(--navy-800);font-size:12px}.about-dialog p{margin:0;color:var(--slate-600);font-size:11px;line-height:1.55}.dialog-close{position:absolute;top:13px;right:13px;display:grid;place-items:center;width:32px;height:32px;color:var(--slate-600);background:var(--slate-50);border:1px solid var(--slate-200);border-radius:8px}.dialog-close svg{width:16px;height:16px}.about-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0}.about-grid>div{padding:10px;background:var(--slate-50);border:1px solid var(--slate-200);border-radius:8px}.about-grid strong,.about-grid span{display:block}.about-grid strong{color:var(--navy-900);font-size:15px}.about-grid span{margin-top:3px;color:var(--slate-500);font-size:8px;text-transform:uppercase}.primary-button{width:100%;min-height:38px;margin-top:18px;color:#fff;background:var(--navy-800);border:0;border-radius:8px;font-weight:700}

@media(max-width:900px){:root{--sidebar-w:330px}.topbar{padding:0 12px}.brand-mark{display:none}.filter-grid-section{grid-template-columns:1fr}}
@media(max-width:720px){:root{--topbar-h:64px}.app-shell{grid-template-columns:44% 56%}.topbar h1{font-size:15px}.header-button span{display:none}.sidebar{font-size:92%}.intro-section,.filter-section,.summary-section,.results-section{padding:11px}.map-legend,.basemap-buttons{left:10px;width:205px}}

/* ICONOS DE AERODROMOS - ESTILO SIGA */

.aerodromo-marker {
  background: transparent;
  border: 0;
  overflow: visible !important;
}

.aerodromo-plane {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--public);
  color: #fff;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.35);
  font: 800 10px/1 Arial, sans-serif;
}

.aerodromo-marker.sna-public .aerodromo-plane {
  width: 24px;
  height: 24px;
  background: var(--sna);
  font-size: 14px;
}

.aerodromo-marker.other-public .aerodromo-plane {
  background: var(--public);
}

.aerodromo-marker.other-private .aerodromo-plane {
  background: var(--private);
}

.aerodromo-marker.other-military .aerodromo-plane {
  background: var(--military);
}

/* ETIQUETAS A ESCALA PROVINCIAL */

.aerodromo-name {
  display: none;
  position: absolute;
  left: 50%;
  bottom: calc(100% + 7px);
  transform: translateX(-50%);
  width: max-content;
  max-width: 112px;
  text-align: center;
  white-space: normal;
  overflow-wrap: break-word;
  color: #17212b;
  font: 600 10px/1.12 "Segoe UI", Arial, sans-serif;
  text-shadow:
    0 0 3px #fff,
    0 0 5px #fff,
    1px 1px 2px #fff;
  pointer-events: none;
}

#map.show-airport-names .aerodromo-name {
  display: block;
}

/* REFERENCIAS CON ICONO DE AVION */

.legend-dot {
  position: relative;
  display: inline-grid;
  place-items: center;
  color: #fff;
}

.legend-dot::after {
  content: "✈";
  font: 800 9px/1 Arial, sans-serif;
}

.legend-dot.sna-public {
  width: 18px;
  height: 18px;
  background: var(--sna);
}

.legend-dot.sna-public::after {
  font-size: 12px;
}
