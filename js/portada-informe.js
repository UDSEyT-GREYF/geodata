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
    REL: { main: "#5A6470", dark: "#3E4650", soft: "#ECEFF2", accent: "#BDC5CD" },
    PMY: { main: "#4E687A", dark: "#364856", soft: "#EAF0F4", accent: "#B7C6CF" },
    NQN: { main: "#6B5B47", dark: "#4B4032", soft: "#F2EEE8", accent: "#C8BCA9" },
    SLA: { main: "#6F5C3B", dark: "#4E402A", soft: "#F3F0E7", accent: "#D1C3A8" },
    TUC: { main: "#7A613F", dark: "#563A27", soft: "#F5EFE7", accent: "#D5C1A9" },
    CRD: { main: "#4A6270", dark: "#33444E", soft: "#ECF1F4", accent: "#B5C2C9" },
    JUJ: { main: "#7A6542", dark: "#58462D", soft: "#F4EFE6", accent: "#D2C1A8" },
    FTE: { main: "#54697A", dark: "#394956", soft: "#EDF2F5", accent: "#BAC6CF" },
    RGL: { main: "#526371", dark: "#36424C", soft: "#EDF1F4", accent: "#BBC4CC" }
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

  function buildCoverAirportType(a, iata) {
    const code = clean(iata).toUpperCase();
    const official = clean(firstNonEmpty(a, [
      "Nombre del Aeropuerto",
      "Aeropuerto",
      "Denominacion"
    ])).toUpperCase();

    const habilitacion = clean(firstNonEmpty(a, [
      "Habilitación",
      "Habilitacion"
    ])).toUpperCase();

    if (code === "AEP" || official.includes("AEROPARQUE")) return "AEROPARQUE";
    if (official.includes("AERÓDROMO") || official.includes("AERODROMO")) return "AERÓDROMO";
    if (
      official.includes("AEROPUERTO INTERNACIONAL") ||
      official.includes("INTERNACIONAL") ||
      habilitacion.includes("INTERNACIONAL")
    ) {
      return "AEROPUERTO INTERNACIONAL";
    }

    return "AEROPUERTO";
  }

  function buildCoverAirportName(a, iata) {
    const code = clean(iata).toUpperCase();
    const city = clean(firstNonEmpty(a, [
      "Ciudad",
      "Localidad",
      "Municipio",
      "Ciudad / Localidad"
    ]));

    let official = clean(firstNonEmpty(a, [
      "Nombre del Aeropuerto",
      "Aeropuerto",
      "Denominacion"
    ]));

    if (code === "AEP") return "JORGE NEWBERY";

    official = official
      .replace(/^Aeropuerto Internacional\s+/i, "")
      .replace(/^Aeropuerto\s+/i, "")
      .replace(/^Aeródromo\s+/i, "")
      .replace(/^Aerodromo\s+/i, "")
      .replace(/^Aeroparque\s+/i, "")
      .trim();

    return (official || city || `Aeropuerto ${code}`).toUpperCase();
  }

  function getCurrentAirportCode() {
    const select = q("airportSelect");
    const fromSelect = clean(select?.value).toUpperCase();
    if (fromSelect) return fromSelect;

    const params = new URLSearchParams(window.location.search);
    const fromUrl = clean(params.get("airport")).toUpperCase();
    if (fromUrl) return fromUrl;

    return clean(coverData[0]?.IATA).toUpperCase();
  }

  function renderCover(iata) {
    const code = clean(iata).toUpperCase();
    if (!code) return false;

    const airport = coverIndex.get(code);
    if (!airport) return false;

    setText("coverKicker", "Informe de impacto");
    setText("coverTitleLine1", "SOCIOECONÓMICO");
    setText("coverTitleLine2", "Y TERRITORIAL");
    setText("coverYear", String(YEAR_REF));
    setText("coverAirportType", buildCoverAirportType(airport, code));
    setText("coverAirportName", buildCoverAirportName(airport, code));
    setText("coverAirportIATA", code);

    loadImageWithFallback(q("coverImg1"), [
      `img/Portadas/portada1(${code}).png`,
      `img/Portadas/portada1(${code}).jpg`,
      `img/Portadas/portada1(${code}).jpeg`,
      `img/portadas/portada1(${code}).png`
    ]);

    loadImageWithFallback(q("coverImg2"), [
      `img/Portadas/portada2(${code}).png`,
      `img/Portadas/portada2(${code}).jpg`,
      `img/Portadas/portada2(${code}).jpeg`,
      `img/portadas/portada2(${code}).png`
    ]);

    loadImageWithFallback(q("coverImg3"), [
      `img/Portadas/portada3(${code}).png`,
      `img/Portadas/portada3(${code}).jpg`,
      `img/Portadas/portada3(${code}).jpeg`,
      `img/portadas/portada3(${code}).png`
    ]);

    loadImageWithFallback(q("coverImg4"), [
      `img/Portadas/portada4(${code}).png`,
      `img/Portadas/portada4(${code}).jpg`,
      `img/Portadas/portada4(${code}).jpeg`,
      `img/portadas/portada4(${code}).png`
    ]);

    applyCoverTheme(code);
    return true;
  }

  async function loadAirportData() {
    if (coverData.length) return;

    const resp = await fetch("fuentes/Datos_aeropuertos.geojson");
    if (!resp.ok) throw new Error("No se pudo cargar Datos_aeropuertos.geojson");

    const geojson = await resp.json();
    coverData = (geojson.features || [])
      .map(f => f.properties || {})
      .filter(p => clean(p.IATA));

    coverIndex = new Map(
      coverData.map(a => [clean(a.IATA).toUpperCase(), a])
    );
  }

  function syncCoverFromSelect() {
    const code = getCurrentAirportCode();
    if (!code) return false;
    return renderCover(code);
  }

  function bindCoverSelect() {
    const select = q("airportSelect");
    if (!select || select.dataset.coverBound === "1") return;

    select.dataset.coverBound = "1";
    select.addEventListener("change", () => {
      syncCoverFromSelect();
    });
  }

  async function bootCover() {
    if (coverBooted) return;
    if (!q("reportCover")) return;

    bindCoverSelect();

    try {
      await loadAirportData();
      coverBooted = true;

      syncCoverFromSelect();

      let attempts = 0;
      const timer = setInterval(() => {
        const ok = syncCoverFromSelect();
        attempts += 1;
        if (ok || attempts > 40) clearInterval(timer);
      }, 250);
    } catch (err) {
      coverBooted = false;
      console.error("No se pudo inicializar la portada.", err);
    }
  }

  document.addEventListener("DOMContentLoaded", bootCover);
  document.addEventListener("report:partials-ready", bootCover);
})();
