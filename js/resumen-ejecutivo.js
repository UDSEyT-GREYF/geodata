(() => {
  "use strict";

  const YEAR_REF = 2025;
  const q = id => document.getElementById(id);

  let summaryBooted = false;
  let airportsData = [];
  let impactData = [];
  let deptosData = [];
  let paxRows = [];
  let movRows = [];
  let gentiliciosMap = new Map();

  const AIRPORTS_URL = "fuentes/Datos_aeropuertos.geojson";
  const DEPTOS_URL = "fuentes/Areasinfluencia55deptos.geojson";
  const GENTILICIOS_URL = "fuentes/gentilicios.csv";

  // Estos archivos deben existir publicados dentro de geodata/data/
  const IMPACT_URL = "data/ResumenImpacto2025.geojson";
  const PAX_SIAC_URL = "data/4paxxaeropuerto2021a2025SIACANAC.geojson";
  const PAX_ALT_URL = "data/4paxxaeropuerto2021a2025SinSIIAC.geojson";
  const MOV_SIAC_URL = "data/4movxaeropuerto2021a2025SIACANAC.geojson";
  const MOV_ALT_URL = "data/4movxaeropuerto2021a2025SinSIIAC.geojson";

  const ALT_IATAS = new Set([
    "RLO", "AOL", "COC", "GNR", "JNI", "LPG", "NEC",
    "PMQ", "RYO", "SST", "TDL", "TTG", "VLG"
  ]);

  const PAX_DATASET_CAB = "pasajeros_comerciales_cabotaje_aeropuerto";
  const PAX_DATASET_INT = "pasajeros_comerciales_internacional_aeropuerto";

  const MOV_DATASET_CAB = "movimientos_comerciales_cabotaje_aeropuerto";
  const MOV_DATASET_INT = "movimientos_comerciales_internacional_aeropuerto";

  function clean(v) {
    return v === null || v === undefined ? "" : String(v).trim();
  }

  function normalizeKey(v) {
    return clean(v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function firstNonEmpty(obj, keys, fallback = "") {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  }

  function setHTML(id, value) {
    const el = q(id);
    if (el) el.innerHTML = value;
  }

  function setText(id, value) {
    const el = q(id);
    if (el) el.textContent = value ?? "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseNumber(v) {
    if (v === null || v === undefined) return NaN;
    let s = String(v).trim();
    if (!s) return NaN;

    s = s.replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
    if (!s) return NaN;

    const commaCount = (s.match(/,/g) || []).length;
    const dotCount = (s.match(/\./g) || []).length;

    if (commaCount && dotCount) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (commaCount) {
      if (commaCount > 1) {
        const parts = s.split(",");
        const dec = parts.pop();
        s = parts.join("") + "." + dec;
      } else {
        const decimals = s.length - s.indexOf(",") - 1;
        s = decimals === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
      }
    } else if (dotCount > 1) {
      const parts = s.split(".");
      const dec = parts.pop();
      s = parts.join("") + "." + dec;
    } else if (dotCount === 1) {
      const decimals = s.length - s.indexOf(".") - 1;
      if (decimals === 3) s = s.replace(".", "");
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatNumber(n) {
    const val = Number(n);
    if (!Number.isFinite(val)) return "–";
    return Math.round(val).toLocaleString("es-AR");
  }

  function formatPercent(n) {
    const val = Number(n);
    if (!Number.isFinite(val)) return "–";
    return val.toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + "%";
  }

  function formatUSD(n) {
    const val = Number(n);
    if (!Number.isFinite(val)) return "–";
    return "USD " + Math.round(val).toLocaleString("es-AR");
  }

  function parseFechaFlexible(raw) {
    if (!raw) return null;
    const s = String(raw).trim();

    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

    m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  async function fetchJSON(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`No se pudo cargar ${url}`);
    return resp.json();
  }

  async function fetchText(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`No se pudo cargar ${url}`);
    return resp.text();
  }

  function detectSep(headerLine) {
    if (headerLine.includes("\t")) return "\t";
    if (headerLine.includes(";")) return ";";
    return ",";
  }

  function parseCSV(text) {
    if (!text) return [];
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const sep = detectSep(lines[0]);
    const headers = lines[0].split(sep).map(h => clean(h));

    return lines.slice(1).map(line => {
      const cols = line.split(sep);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      return row;
    });
  }

function parseGentiliciosCSV(text) {
  const rows = parseCSV(text);

  rows.forEach(row => {
    const provincia = clean(firstNonEmpty(row, [
      "provincia",
      "Provincia",
      "PROVINCIA",
      "jurisdiccion",
      "Jurisdicción",
      "Jurisdiccion",
      "nombre_provincia",
      "NombreProvincia"
    ]));

    const gentilicio = clean(firstNonEmpty(row, [
      "gentilicio_plural",
      "GentilicioPlural",
      "gentilicio_pl",
      "GentilicioPl",
      "gentilicio",
      "Gentilicio",
      "GENTILICIO"
    ]));

    if (provincia && gentilicio) {
      gentiliciosMap.set(normalizeKey(provincia), gentilicio);
    }
  });
}

  function getSelectedIATA() {
    const select = q("airportSelect");
    const fromSelect = clean(select?.value).toUpperCase();
    if (fromSelect) return fromSelect;

    const params = new URLSearchParams(window.location.search);
    const fromUrl = clean(params.get("airport")).toUpperCase();
    if (fromUrl) return fromUrl;

    return clean(airportsData[0]?.IATA).toUpperCase();
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

  function getAirportRecord(iata) {
    const code = clean(iata).toUpperCase();
    return airportsData.find(a => clean(a.IATA).toUpperCase() === code) || null;
  }

  function getAirportCity(a, iata) {
    const code = clean(iata).toUpperCase();

    if (code === "AEP") return "Aeroparque";

    const ciudad = clean(firstNonEmpty(a, [
      "Ciudad",
      "Localidad",
      "Municipio",
      "Ciudad / Localidad",
      "Aeropuerto"
    ]));

    if (ciudad) return ciudad;

    return normalizeAirportName(firstNonEmpty(a, [
      "Nombre del Aeropuerto",
      "Aeropuerto",
      "Denominacion"
    ])) || code;
  }

  function buildAirportDisplay(a, iata) {
    const code = clean(iata).toUpperCase();

    if (code === "AEP") return "Aeroparque";

    const ciudad = getAirportCity(a, iata);
    return ciudad ? `Aeropuerto de ${ciudad}` : `Aeropuerto ${code}`;
  }

  function buildAirportLine(a, iata) {
    return `${buildAirportDisplay(a, iata)}. Argentina`;
  }

  function getImpactRecord(iata) {
    const code = clean(iata).toUpperCase();
    return impactData.find(f => clean(f?.properties?.IATA).toUpperCase() === code)?.properties || null;
  }

  function getDeptosFeaturesByIATA(iata) {
    const code = clean(iata).toUpperCase();

    return deptosData.filter(f => {
      const p = f?.properties || {};
      return clean(
        p.IATA || p.iata || p.codigo_iata || p.Codigo_IATA
      ).toUpperCase() === code;
    });
  }

  function joinListEs(items) {
    if (!items.length) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} y ${items[1]}`;
    return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
  }

  function getDeptoName(props) {
    return clean(firstNonEmpty(props, [
      "departamento",
      "Departamento",
      "departamento_nombre",
      "Departamento_nombre",
      "depto",
      "Depto",
      "depto_nombre",
      "Depto_nombre",
      "nombre",
      "Nombre",
      "name",
      "NAME"
    ]));
  }

  function getProvinciaName(props) {
    return clean(firstNonEmpty(props, [
      "provincia",
      "Provincia",
      "provincia_nombre",
      "Provincia_nombre",
      "jurisdiccion",
      "Jurisdicción",
      "Jurisdiccion",
      "prov",
      "Prov"
    ]));
  }

function getDepartamentosText(iata) {
  const features = getDeptosFeaturesByIATA(iata);
  if (!features.length) return "definidos en su área de influencia";

  const groups = new Map();

  features.forEach(f => {
    const p = f.properties || {};
    const depto = getDeptoName(p);
    const provincia = getProvinciaName(p) || "";
    const key = normalizeKey(provincia || "sin-provincia");

    if (!groups.has(key)) {
      groups.set(key, {
        provincia,
        gentilicio: clean(gentiliciosMap.get(key) || ""),
        deptos: []
      });
    }

    if (depto) groups.get(key).deptos.push(depto);
  });

  const provinceFragments = Array.from(groups.values()).map(group => {
    const deptosUnique = [...new Set(group.deptos)].filter(Boolean);
    const deptosTxt = joinListEs(deptosUnique);
    const gentilicio = clean(group.gentilicio);
    const provincia = clean(group.provincia);

    if (!deptosTxt) {
      if (gentilicio) return gentilicio;
      if (provincia) return `de la provincia de ${provincia}`;
      return "definidos en su área de influencia";
    }

    if (gentilicio) {
      return `${gentilicio} de ${deptosTxt}`;
    }

    if (provincia) {
      return `de la provincia de ${provincia}: ${deptosTxt}`;
    }

    return deptosTxt;
  });

  if (!provinceFragments.length) return "definidos en su área de influencia";

  if (provinceFragments.length === 1) {
    return provinceFragments[0];
  }

  if (provinceFragments.length === 2) {
    return `${provinceFragments[0]}, y ${provinceFragments[1]}`;
  }

  return `${provinceFragments.slice(0, -1).join("; ")}, y ${provinceFragments[provinceFragments.length - 1]}`;
}

  function parsePaxSiacGeojson(geojson) {
    return (geojson.features || []).map(f => {
      const p = f.properties || {};
      return {
        iata: clean(p.iata || p.IATA).toUpperCase(),
        dataset: clean(p.dataset),
        date: parseFechaFlexible(p.fecha),
        year: Number(p.anio),
        month: Number(p.mes),
        valor: parseNumber(p.valor_pax ?? p.valor)
      };
    }).filter(r =>
      r.iata &&
      r.date &&
      Number.isFinite(r.valor) &&
      (r.dataset === PAX_DATASET_CAB || r.dataset === PAX_DATASET_INT)
    );
  }

  function parseMovSiacGeojson(geojson) {
    return (geojson.features || []).map(f => {
      const p = f.properties || {};
      return {
        iata: clean(p.iata || p.IATA).toUpperCase(),
        dataset: clean(p.dataset),
        date: parseFechaFlexible(p.fecha),
        year: Number(p.anio),
        month: Number(p.mes),
        valor: parseNumber(p.valor_movimientos ?? p.valor)
      };
    }).filter(r =>
      r.iata &&
      r.date &&
      Number.isFinite(r.valor) &&
      (r.dataset === MOV_DATASET_CAB || r.dataset === MOV_DATASET_INT)
    );
  }

  function parseWideMonthlyGeojson(geojson, iataSet, datasetName) {
    const monthMap = {
      ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
      jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12
    };

    const rows = [];

    (geojson.features || []).forEach(f => {
      const p = f.properties || {};
      const year = Number(p["Año"] || p["Anio"] || p["anio"] || p["year"]);
      const mesTxt = clean(p["Mes"] || p["mes"]).toLowerCase();
      const month = monthMap[mesTxt];

      if (!Number.isFinite(year) || !Number.isFinite(month)) return;

      iataSet.forEach(iata => {
        const raw = p[iata];
        if (raw === undefined || raw === null || raw === "") return;

        const valor = parseNumber(raw);
        if (!Number.isFinite(valor)) return;

        rows.push({
          iata,
          dataset: datasetName,
          date: new Date(year, month - 1, 1),
          year,
          month,
          valor
        });
      });
    });

    return rows;
  }

  function getYearTotal(rows, iata, year) {
    const code = clean(iata).toUpperCase();
    return rows
      .filter(r => r.iata === code && r.year === year)
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
  }

  function loadImageWithFallback(imgEl, candidates) {
    if (!imgEl) return;

    const list = candidates.filter(Boolean);
    let idx = 0;

    const markEmpty = (isEmpty) => {
      if (!imgEl.parentElement) return;
      imgEl.parentElement.classList.toggle("is-empty", !!isEmpty);
    };

    const tryNext = () => {
      if (idx >= list.length) {
        imgEl.classList.add("is-hidden");
        markEmpty(true);
        return;
      }

      imgEl.src = list[idx++];
      imgEl.onerror = tryNext;
      imgEl.onload = () => {
        imgEl.classList.remove("is-hidden");
        markEmpty(false);
      };
    };

    tryNext();
  }

  function buildNarrative(a, impact, iata) {
    const airportDisplay = buildAirportDisplay(a, iata);
    const airportAreaLabel = airportDisplay;
    const departamentos = getDepartamentosText(iata);

    const poblacion2022 = formatNumber(firstNonEmpty(a, [
      "Población del Área de Influencia (Censo 2022)",
      "Poblacion del Area de Influencia (Censo 2022)",
      "Poblacion 2022"
    ]));

    const pasajeros2025 = getYearTotal(paxRows, iata, 2025);
    const pasajeros2024 = getYearTotal(paxRows, iata, 2024);

    const variacionPct =
      pasajeros2024 > 0
        ? ((pasajeros2025 - pasajeros2024) / pasajeros2024) * 100
        : NaN;

    const movimientos2025 = getYearTotal(movRows, iata, 2025);

    const impactoPositivo = formatUSD(impact["Impacto económico positivo"]);
    const empleoTotal = formatNumber(impact["EmpleoAeroTotal2025"]);
    const pba = formatUSD(impact["PBA 2025 USD"]);
    const turismoReceptivo = formatUSD(impact["Saldo del Turismo Receptivo (USD)2023"]);
    const beneficiosPax = formatUSD(impact["Beneficios al pax 2025 (USD)"]);
    const turismoEmisivo = formatUSD(
      Math.abs(parseNumber(impact["Saldo del Turismo Emisivo (USD)2023"]))
    );
    const saldoImpacto = formatUSD(impact["Saldo de impactos totales (USD)"]);

    return `
      <p>
        El transporte aerocomercial es un componente esencial de la economía e incide en el desarrollo y el bienestar de las poblaciones y los territorios. En este sentido, los servicios aerocomerciales y la infraestructura aeroportuaria cumplen un papel central en la cohesión territorial, al generar condiciones para la atracción, retención y expansión de la actividad económica.
      </p>

<p>
  El presente informe de Impacto socioeconómico y territorial ${YEAR_REF} del <strong>${escapeHtml(airportDisplay)}</strong>, caracteriza y cuantifica el aporte económico y laboral generado por los servicios aeronáuticos y aeroportuarios en el área de influencia, definida como el espacio geográfico sobre el cual el aeropuerto ejerce un poder de atracción y define el universo de potenciales pasajeros. En el caso del <strong>${escapeHtml(airportAreaLabel)}</strong>, incluye los departamentos <strong>${escapeHtml(departamentos)}</strong>, y benefició a <strong>${escapeHtml(poblacion2022)}</strong> habitantes (Censo 2022).
</p>

      <p>
        La evaluación del papel del transporte aerocomercial en el desarrollo territorial requiere considerar tanto <strong>sus impactos positivos como los efectos adversos que puede tener sobre las desigualdades regionales</strong>. Este análisis constituye un insumo relevante para el diseño de políticas orientadas a fortalecer su aporte al desarrollo local, regional y nacional.
      </p>

      <p>
        <strong>Los beneficios socioeconómicos del transporte aéreo están vinculados, por un lado, a la dinámica propia de las actividades aerocomerciales y aeroportuarias</strong> —facturación, salarios, utilidades, impuestos, etc.— <strong>y, por otro, a la conectividad aérea</strong>, que constituye un factor estratégico para el crecimiento y desarrollo de los mercados en el largo plazo, al facilitar el comercio, promover la inversión y estimular el turismo.
      </p>

      <p>
        En ${YEAR_REF}, el <strong>${escapeHtml(airportDisplay)}</strong> registró <strong>${escapeHtml(formatNumber(pasajeros2025))}</strong> pasajeros, lo que representó una variación de <strong>${escapeHtml(formatPercent(variacionPct))}</strong> respecto del año anterior. Además, el aeropuerto contabilizó <strong>${escapeHtml(formatNumber(movimientos2025))}</strong> movimientos de aeronaves.
      </p>

<p>
  En ${YEAR_REF}, el impacto socioeconómico y territorial positivo generado por el <strong>${escapeHtml(airportDisplay)}</strong> en su área de influencia ascendió a <strong>${escapeHtml(impactoPositivo)}</strong> y posibilitó la creación de <strong>${escapeHtml(empleoTotal)}</strong> puestos de trabajo. Este resultado reúne los impactos directos, indirectos, inducidos y catalíticos positivos de la aviación, integrados por un Producto Bruto Aeroportuario de <strong>${escapeHtml(pba)}</strong>, un aporte del turismo receptivo de <strong>${escapeHtml(turismoReceptivo)}</strong> y beneficios económicos para los pasajeros por <strong>${escapeHtml(beneficiosPax)}</strong>. Por su parte, el turismo emisivo representó un impacto negativo de <strong>${escapeHtml(turismoEmisivo)}</strong>, asociado a gastos realizados fuera del área de influencia, en otras regiones del país y del exterior. En consecuencia, el saldo neto de impactos del transporte aéreo en el área de influencia aeroportuaria fue de <strong>${escapeHtml(saldoImpacto)}</strong>.
</p>
    `;
  }

  function renderSummary(iata) {
    const code = clean(iata).toUpperCase();
    if (!code) return false;

    const airport = getAirportRecord(code);
    const impact = getImpactRecord(code);

    if (!airport || !impact) {
      setHTML("summaryText", "<p>No se pudo construir el resumen ejecutivo para este aeropuerto.</p>");
      return false;
    }

    setText("summaryAirportLine", buildAirportLine(airport, code));
    setHTML("summaryText", buildNarrative(airport, impact, code));

    loadImageWithFallback(q("summaryImgAirport"), [
      `img/resumenejecutivo/resumen(${code}).png`,
      `img/resumenejecutivo/resumen(${code}).PNG`,
      `img/resumenejecutivo/resumen(${code}).jpg`,
      `img/resumenejecutivo/resumen(${code}).jpeg`
    ]);

    return true;
  }

  async function loadData() {
    const [
      airportsGeo,
      impactGeo,
      deptosGeo,
      paxSiacGeo,
      paxAltGeo,
      movSiacGeo,
      movAltGeo,
      gentiliciosCsv
    ] = await Promise.all([
      fetchJSON(AIRPORTS_URL),
      fetchJSON(IMPACT_URL),
      fetchJSON(DEPTOS_URL),
      fetchJSON(PAX_SIAC_URL),
      fetchJSON(PAX_ALT_URL),
      fetchJSON(MOV_SIAC_URL),
      fetchJSON(MOV_ALT_URL),
      fetchText(GENTILICIOS_URL).catch(() => "")
    ]);

    airportsData = (airportsGeo.features || [])
      .map(f => f.properties || {})
      .filter(p => clean(p.IATA));

    impactData = impactGeo.features || [];
    deptosData = deptosGeo.features || [];

    if (gentiliciosCsv) parseGentiliciosCSV(gentiliciosCsv);

    const paxSiacRows = parsePaxSiacGeojson(paxSiacGeo);
    const paxAltRows = parseWideMonthlyGeojson(
      paxAltGeo,
      ALT_IATAS,
      "pasajeros_totales_aeropuerto"
    );

    paxRows = [
      ...paxSiacRows.filter(r => !ALT_IATAS.has(r.iata)),
      ...paxAltRows
    ];

    const movSiacRows = parseMovSiacGeojson(movSiacGeo);
    const movAltRows = parseWideMonthlyGeojson(
      movAltGeo,
      ALT_IATAS,
      "movimientos_totales_aeropuerto"
    );

    movRows = [
      ...movSiacRows.filter(r => !ALT_IATAS.has(r.iata)),
      ...movAltRows
    ];
  }

  function bindSelector() {
    const select = q("airportSelect");
    if (!select || select.dataset.summaryBound === "1") return;

    select.dataset.summaryBound = "1";
    select.addEventListener("change", () => {
      renderSummary(getSelectedIATA());
    });
  }

  async function bootResumen() {
    if (summaryBooted) return;
    if (!q("summaryPage")) return;

    try {
      await loadData();
      bindSelector();
      summaryBooted = true;
      renderSummary(getSelectedIATA());
    } catch (err) {
      console.error("No se pudo inicializar el resumen ejecutivo.", err);
      setHTML(
        "summaryText",
        "<p>No se pudieron cargar los datos del resumen ejecutivo. Verifica que los archivos JSON estén expuestos en <strong>geodata/data/</strong> y que existan <strong>fuentes/Areasinfluencia55deptos.geojson</strong> y <strong>fuentes/gentilicios.csv</strong>.</p>"
      );
    }
  }

  document.addEventListener("DOMContentLoaded", bootResumen);
  document.addEventListener("report:partials-ready", bootResumen);
})();
