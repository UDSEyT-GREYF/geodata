(() => {
  "use strict";

  const YEAR_REF = 2025;
  const q = id => document.getElementById(id);

  let coverBooted = false;
  let coverData = [];
  let coverIndex = new Map();

  const COVER_THEME_OVERRIDES = {
    AEP: { main: "#234B6B", dark: "#17344A", soft: "#E8EFF4", accent: "#AFC3D3" },
    EZE: { main: "#2F5D62", dark: "#1E4145", soft: "#E7F0F0", accent: "#A8C4C6" },
    COR: { main: "#6A4152", dark: "#4A2D38", soft: "#F1E9EC", accent: "#C8B0B8" },
    MDZ: { main: "#7A5A46", dark: "#573F31", soft: "#F3ECE7", accent: "#CDB7A8" },
    USH: { main: "#40627A", dark: "#2C4658", soft: "#E8EEF2", accent: "#AFC0CC" },
    BRC: { main: "#355A73", dark: "#233C4E", soft: "#E7EEF3", accent: "#A9BDCB" },
    IGR: { main: "#46633F", dark: "#2F452B", soft: "#EBF1E8", accent: "#B8C8B1" },
    REL: { main: "#5A6470", dark: "#3E4650", soft: "#ECEFF2", accent: "#BDC5CD" }
  };

  const COVER_THEMES = [
    { main: "#234B6B", dark: "#17344A", soft: "#E8EFF4", accent: "#AFC3D3" },
    { main: "#2F5D62", dark: "#1E4145", soft: "#E7F0F0", accent: "#A8C4C6" },
    { main: "#6A4152", dark: "#4A2D38", soft: "#F1E9EC", accent: "#C8B0B8" },
    { main: "#7A5A46", dark: "#573F31", soft: "#F3ECE7", accent: "#CDB7A8" },
    { main: "#40627A", dark: "#2C4658", soft: "#E8EEF2", accent: "#AFC0CC" },
    { main: "#355A73", dark: "#233C4E", soft: "#E7EEF3", accent: "#A9BDCB" },
    { main: "#46633F", dark: "#2F452B", soft: "#EBF1E8", accent: "#B8C8B1" },
    { main: "#5A6470", dark: "#3E4650", soft: "#ECEFF2", accent: "#BDC5CD" },
    { main: "#5E536D", dark: "#41394D", soft: "#EEEAF2", accent: "#BEB6C9" },
    { main: "#6A5F3D", dark: "#4B432A", soft: "#F1EFE7", accent: "#CBC4A8" }
  ];

  function clean(v) {
    return v === null || v === undefined ? "" : String(v).trim();
  }

  function firstNonEmpty(obj, keys, fallback = "") {
    for (const key of keys) {
      if (!obj) continue;
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  }

  function setText(id, value) {
    const el = q(id);
    if (el) el.textContent = value;
  }

  function hashIATA(str) {
    let h = 0;
    const s = String(str || "");
    for (let i = 0; i < s.length; i += 1) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function getCoverTheme(iata) {
    const code = clean(iata).toUpperCase();
    if (COVER_THEME_OVERRIDES[code]) return COVER_THEME_OVERRIDES[code];
    return COVER_THEMES[hashIATA(code) % COVER_THEMES.length];
  }

  function applyCoverTheme(iata) {
    const cover = q("reportCover");
    if (!cover) return;

    const theme = getCoverTheme(iata);
    cover.style.setProperty("--cover-main", theme.main);
    cover.style.setProperty("--cover-dark", theme.dark);
    cover.style.setProperty("--cover-soft", theme.soft);
    cover.style.setProperty("--cover-accent", theme.accent);
  }

  function loadImageWithFallback(imgEl, candidates) {
    if (!imgEl) return;

    const sources = candidates.filter(Boolean);
    let idx = 0;

    const tryNext = () => {
      if (idx >= sources.length) {
        imgEl.classList.add("is-hidden");
        return;
      }

      imgEl.src = sources[idx++];
      imgEl.onerror = tryNext;
      imgEl.onload = () => imgEl.classList.remove("is-hidden");
    };

    tryNext();
  }

  function formatCoverAirportName(a, iata) {
    const official = clean(firstNonEmpty(a, [
      "Nombre del Aeropuerto",
      "Aeropuerto",
      "Denominacion"
    ]));

    if (iata === "AEP") return "AEROPARQUE JORGE NEWBERY";
    if (official) return official.toUpperCase();

    return `AEROPUERTO ${iata}`;
  }

  function renderCover(iata) {
    const code = clean(iata).toUpperCase();
    if (!code) return false;

    const airport = coverIndex.get(code);
    if (!airport) return false;

    setText("coverYear", String(YEAR_REF));
    setText("coverAirportName", formatCoverAirportName(airport, code));
    setText("coverReportTitle", "INFORME DE IMPACTO SOCIOECONÓMICO Y TERRITORIAL");

    loadImageWithFallback(q("coverImg1"), [`img/Portadas/portada1(${code}).png`]);
    loadImageWithFallback(q("coverImg2"), [`img/Portadas/portada2(${code}).png`]);
    loadImageWithFallback(q("coverImg3"), [`img/Portadas/portada3(${code}).png`]);
    loadImageWithFallback(q("coverImg4"), [`img/Portadas/portada4(${code}).png`]);

    applyCoverTheme(code);
    return true;
  }

  async function loadAirportData() {
    const resp = await fetch("fuentes/Datos_aeropuertos.geojson");
    if (!resp.ok) throw new Error("No se pudo cargar Datos_aeropuertos.geojson");

    const geojson = await resp.json();
    coverData = (geojson.features || []).map(f => f.properties || {}).filter(p => clean(p.IATA));

    coverIndex = new Map(
      coverData.map(a => [clean(a.IATA).toUpperCase(), a])
    );
  }

  function syncCoverFromSelect() {
    const select = q("airportSelect");
    const code = clean(select?.value).toUpperCase();
    if (!code) return false;
    return renderCover(code);
  }

  function bindCoverSelect() {
    const select = q("airportSelect");
    if (!select) return;

    select.addEventListener("change", () => {
      syncCoverFromSelect();
    });
  }

  async function bootCover() {
    if (coverBooted) return;
    if (!q("reportCover")) return;

    coverBooted = true;
    bindCoverSelect();

    try {
      await loadAirportData();
      syncCoverFromSelect();

      let attempts = 0;
      const timer = setInterval(() => {
        const ok = syncCoverFromSelect();
        attempts += 1;
        if (ok || attempts > 40) clearInterval(timer);
      }, 250);
    } catch (err) {
      console.error("No se pudo inicializar la portada.", err);
    }
  }

  document.addEventListener("report:partials-ready", bootCover);
})();
