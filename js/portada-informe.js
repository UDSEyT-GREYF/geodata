(() => {
  "use strict";

  const YEAR_REF = 2025;
  const q = id => document.getElementById(id);

  let coverBooted = false;
  let coverData = [];
  let coverIndex = new Map();

  const COVER_THEME_OVERRIDES = {
    AEP: { main: "#234B6B", dark: "#17344A", soft: "#DDEAF2", accent: "#B8CDD8" },
    AFA: { main: "#7B5D49", dark: "#573F32", soft: "#F1E6DE", accent: "#D7C0B0" },
    AOL: { main: "#6F5C3B", dark: "#4E402A", soft: "#F3EEDF", accent: "#D5C7A7" },
    BHI: { main: "#2E6670", dark: "#1D4A52", soft: "#DDECF0", accent: "#B3D0D6" },
    BRC: { main: "#355A73", dark: "#233C4E", soft: "#DFEAF2", accent: "#BED1DF" },
    CNQ: { main: "#5A6B46", dark: "#3E4A31", soft: "#E7EEDA", accent: "#C5D2B3" },
    COC: { main: "#7A6542", dark: "#58462D", soft: "#F3EBDD", accent: "#D9C7A7" },
    COR: { main: "#6A4152", dark: "#4A2D38", soft: "#EEDFE5", accent: "#D2BCC5" },
    CPC: { main: "#4F6876", dark: "#374955", soft: "#E2EBF0", accent: "#C1CFD8" },
    CRD: { main: "#4A6270", dark: "#33444E", soft: "#E2EBEF", accent: "#C0CDD5" },
    CTC: { main: "#7A613F", dark: "#563A27", soft: "#F4E9DD", accent: "#D8BFA4" },
    CUT: { main: "#6B5B47", dark: "#4B4032", soft: "#EFE7DD", accent: "#CCBDAA" },
    ELO: { main: "#4E6B52", dark: "#354A38", soft: "#E2EDE1", accent: "#BFD1BF" },
    EQS: { main: "#4F6473", dark: "#364450", soft: "#E3EAF0", accent: "#C1CCD6" },
    EZE: { main: "#2F5D62", dark: "#1E4145", soft: "#DCEBED", accent: "#B8D0D2" },
    FDO: { main: "#58626E", dark: "#3E4650", soft: "#E7EAEE", accent: "#C8CFD6" },
    FMA: { main: "#735B3F", dark: "#503E2A", soft: "#F2EBDF", accent: "#D6C4A8" },
    FTE: { main: "#54697A", dark: "#394956", soft: "#E2EBF1", accent: "#C2D0D9" },
    GNR: { main: "#5E6A4F", dark: "#424A37", soft: "#E8ECDC", accent: "#C8D0B6" },
    GPO: { main: "#65705A", dark: "#465040", soft: "#E9EDE6", accent: "#CAD2C4" },
    HOS: { main: "#556A5F", dark: "#3B4A42", soft: "#E4ECE8", accent: "#C2D0C9" },
    IGR: { main: "#46633F", dark: "#2F452B", soft: "#E0ECD9", accent: "#C2D6B9" },
    IRJ: { main: "#7B6545", dark: "#57482F", soft: "#F3EBDD", accent: "#D9C6A8" },
    JNI: { main: "#6E6B53", dark: "#4C4A39", soft: "#ECEBDF", accent: "#D1CEB9" },
    JUJ: { main: "#7A6542", dark: "#58462D", soft: "#F4EBDD", accent: "#D2C1A8" },
    LCM: { main: "#7B5D4B", dark: "#5A4235", soft: "#F3E6DF", accent: "#D7BEB2" },
    LGS: { main: "#6A5F4C", dark: "#4A4134", soft: "#EFEADE", accent: "#CEC2B1" },
    MDQ: { main: "#3F6478", dark: "#2A4454", soft: "#DFEBF2", accent: "#B9CEDB" },
    MDZ: { main: "#7A5A46", dark: "#573F31", soft: "#F0E3D8", accent: "#D6C0AE" },
    NEC: { main: "#486A6D", dark: "#314A4D", soft: "#E0ECEC", accent: "#BDD0D0" },
    NQN: { main: "#6B5B47", dark: "#4B4032", soft: "#F0E8DD", accent: "#C8BCA9" },
    OYA: { main: "#6D644C", dark: "#4A4434", soft: "#EFEADE", accent: "#D1C7B2" },
    PMY: { main: "#4E687A", dark: "#364856", soft: "#E2EBF1", accent: "#C2D0D9" },
    PRA: { main: "#5B6A59", dark: "#3F4A3E", soft: "#E6EDE4", accent: "#C6D2C3" },
    PSS: { main: "#56704B", dark: "#3C5033", soft: "#E3ECD9", accent: "#C2D3B7" },
    RCU: { main: "#73624D", dark: "#514534", soft: "#F0E9DE", accent: "#D1C2AE" },
    RCQ: { main: "#6C6148", dark: "#4C4332", soft: "#EFE9DD", accent: "#CEC0A9" },
    RDS: { main: "#5E6B74", dark: "#414B52", soft: "#E6EBEE", accent: "#C8D0D5" },
    REL: { main: "#5A6470", dark: "#3E4650", soft: "#E4E8ED", accent: "#C6CFD7" },
    RES: { main: "#597148", dark: "#3E5032", soft: "#E4ECD9", accent: "#C4D3B7" },
    RGA: { main: "#58707B", dark: "#3B4D56", soft: "#E3EBF0", accent: "#C0CED6" },
    RGL: { main: "#526371", dark: "#36424C", soft: "#E3E8EE", accent: "#C3CCD5" },
    RHD: { main: "#6A6A5A", dark: "#49483E", soft: "#ECECE6", accent: "#D0D0C3" },
    RLO: { main: "#745D46", dark: "#523F31", soft: "#F2E8DE", accent: "#D5C0AE" },
    ROS: { main: "#4F6476", dark: "#374654", soft: "#E3EAF0", accent: "#C0CCD7" },
    RSA: { main: "#627160", dark: "#434D41", soft: "#E8ECE5", accent: "#C9D0C4" },
    RYO: { main: "#5A6E78", dark: "#3D4C55", soft: "#E4EBEF", accent: "#C3CFD6" },
    SDE: { main: "#7C6341", dark: "#584528", soft: "#F4EBDD", accent: "#D9C3A4" },
    SFN: { main: "#55646F", dark: "#39444C", soft: "#E4E9ED", accent: "#C3CCD4" },
    SLA: { main: "#6F5C3B", dark: "#4E402A", soft: "#F3EEDF", accent: "#D1C3A8" },
    TUC: { main: "#7A613F", dark: "#563A27", soft: "#F5EBDD", accent: "#D5C1A9" },
    UAQ: { main: "#7A5C44", dark: "#563F2F", soft: "#F3E8DE", accent: "#D8C1AD" },
    ULA: { main: "#71624D", dark: "#4F4436", soft: "#F0E9E0", accent: "#D2C4B3" },
    USH: { main: "#40627A", dark: "#2C4658", soft: "#DDEAF2", accent: "#B8CDD8" },
    VDM: { main: "#48677A", dark: "#314855", soft: "#E1EBF2", accent: "#BED0DB" },
    VLG: { main: "#556A74", dark: "#394850", soft: "#E4EBEE", accent: "#C3CED4" },
    VME: { main: "#775D44", dark: "#553F2F", soft: "#F3E7DC", accent: "#D8C0AD" }
  };

  const COVER_THEMES = [
    { main: "#234B6B", dark: "#17344A", soft: "#DDEAF2", accent: "#B8CDD8" },
    { main: "#2F5D62", dark: "#1E4145", soft: "#DCEBED", accent: "#B8D0D2" },
    { main: "#6A4152", dark: "#4A2D38", soft: "#EEDFE5", accent: "#D2BCC5" },
    { main: "#7A5A46", dark: "#573F31", soft: "#F0E3D8", accent: "#D6C0AE" },
    { main: "#46633F", dark: "#2F452B", soft: "#E0ECD9", accent: "#C2D6B9" },
    { main: "#5A6470", dark: "#3E4650", soft: "#E4E8ED", accent: "#C6CFD7" }
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
    if (el) el.textContent = value ?? "";
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

  function markImageState(imgEl, isEmpty) {
    if (!imgEl || !imgEl.parentElement) return;
    imgEl.parentElement.classList.toggle("is-empty", !!isEmpty);
  }

  function loadImageWithFallback(imgEl, candidates) {
    if (!imgEl) return;

    const sources = candidates.filter(Boolean);
    let idx = 0;

    const tryNext = () => {
      if (idx >= sources.length) {
        imgEl.classList.add("is-hidden");
        markImageState(imgEl, true);
        return;
      }

      imgEl.src = sources[idx++];
      imgEl.onerror = tryNext;
      imgEl.onload = () => {
        imgEl.classList.remove("is-hidden");
        markImageState(imgEl, false);
      };
    };

    tryNext();
  }

  function normalizeAirportName(raw) {
    return clean(raw)
      .replace(/\s+/g, " ")
      .replace(/\s*\/\s*/g, " / ")
      .split(" / ")[0]
      .replace(/^Aeropuerto Internacional\s+/i, "")
      .replace(/^Aeropuerto\s+/i, "")
      .replace(/^Aeródromo\s+/i, "")
      .replace(/^Aerodromo\s+/i, "")
      .replace(/^Aeroparque\s+/i, "")
      .trim();
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

    if (code === "AEP") return "JORGE NEWBERY";

    const official = normalizeAirportName(firstNonEmpty(a, [
      "Nombre del Aeropuerto",
      "Aeropuerto",
      "Denominacion"
    ]));

    const candidate = official || city || `Aeropuerto ${code}`;
    return candidate.toUpperCase();
  }

  function renderCover(iata) {
    const code = clean(iata).toUpperCase();
    if (!code) return false;

    const airport = coverIndex.get(code);
    if (!airport) return false;

    setText("coverAirportType", identity.type);
    setText("coverAirportName", identity.name);
    setText("coverAirportIATA", code);
    setText("coverKicker", "INFORME DE IMPACTO");
    setText("coverTitleLine1", "SOCIOECONÓMICO Y");
    setText("coverTitleLine2", "TERRITORIAL");
    setText("coverYear", String(YEAR_REF));

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

  function getSelectedIATA() {
    const select = q("airportSelect");
    const fromSelect = clean(select?.value).toUpperCase();
    if (fromSelect) return fromSelect;

    const params = new URLSearchParams(window.location.search);
    const fromUrl = clean(params.get("airport")).toUpperCase();
    if (fromUrl) return fromUrl;

    return clean(coverData[0]?.IATA).toUpperCase();
  }

  function syncCoverFromSelect() {
    const code = getSelectedIATA();
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
