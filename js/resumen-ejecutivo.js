(() => {
  "use strict";

  const YEAR_REF = 2025;
  const q = id => document.getElementById(id);

  let summaryBooted = false;
  let airportsData = [];
  let impactData = [];
  let paxRows = [];
  let movRows = [];

  const AIRPORTS_URL = "fuentes/Datos_aeropuertos.geojson";
  const IMPACT_URL = "data/ResumenImpacto2025.geojson";
  const PAX_URL = "fuentes/pasajeros_aeropuerto_mensual.csv";
  const MOV_URL = "fuentes/movimientos_aeropuerto_mensual.csv";

  const PAX_DATASET_CAB = "pasajeros_comerciales_cabotaje_aeropuerto";
  const PAX_DATASET_INT = "pasajeros_comerciales_internacional_aeropuerto";

  function clean(v) {
    return v === null || v === undefined ? "" : String(v).trim();
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
    const headers = lines[0].split(sep).map(h => clean(h).toLowerCase());

    return lines.slice(1).map(line => {
      const cols = line.split(sep);
      const row = {};
      headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
      return row;
    });
  }

  function parsePasajerosMensualCSV(text) {
    return parseCSV(text).map(r => ({
      iata: clean(r["iata"]).toUpperCase(),
      dataset: clean(r["dataset"]),
      date: parseFechaFlexible(r["fecha"]),
      valor: parseNumber(r["valor_pax"] || r["valor"] || r["pasajeros"])
    })).filter(r => r.iata && r.date && Number.isFinite(r.valor));
  }

  function parseMovimientosMensualCSV(text) {
    return parseCSV(text).map(r => ({
      iata: clean(r["iata"]).toUpperCase(),
      dataset: clean(r["dataset"]),
      date: parseFechaFlexible(r["fecha"]),
      valor: parseNumber(r["valor_movimientos"] || r["valor"] || r["movimientos"])
    })).filter(r => r.iata && r.date && Number.isFinite(r.valor));
  }

  async function readTextSmart(response) {
    const buffer = await response.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    return text;
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

  function buildAirportDisplay(a, iata) {
    const ciudad = clean(firstNonEmpty(a, [
      "Ciudad",
      "Localidad",
      "Municipio",
      "Ciudad / Localidad",
      "Aeropuerto"
    ]));

    const nombre = clean(firstNonEmpty(a, [
      "Nombre del Aeropuerto",
      "Aeropuerto",
      "Denominacion"
    ]));

    if (iata === "AEP") return "Aeroparque Jorge Newbery";
    if (ciudad && nombre && ciudad !== nombre) return `Aeropuerto de ${ciudad} – ${nombre}`;
    if (ciudad) return `Aeropuerto de ${ciudad}`;
    if (nombre) return nombre;
    return `Aeropuerto ${iata}`;
  }

  function buildAirportLine(a, iata) {
    return `${buildAirportDisplay(a, iata)}. Argentina`;
  }

  function getImpactRecord(iata) {
    return impactData.find(f => clean(f?.properties?.IATA).toUpperCase() === iata)?.properties || null;
  }

  function sumYear(rows, iata, year, datasets = null) {
    return rows
      .filter(r =>
        r.iata === iata &&
        r.date.getFullYear() === year &&
        (!datasets || datasets.includes(r.dataset))
      )
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
  }

  function buildNarrative(a, impact, iata) {
    const nombreAeropuerto = buildAirportDisplay(a, iata);
    const departamentos = clean(firstNonEmpty(a, [
      "Departamentos",
      "DepartamentosAreaInfluencia",
      "NombresDepartamentos",
      "Área de influencia",
      "Area de influencia"
    ])) || "los departamentos definidos en su área de influencia";

    const poblacion2022 = formatNumber(firstNonEmpty(a, [
      "Población del Área de Influencia (Censo 2022)",
      "Poblacion del Area de Influencia (Censo 2022)",
      "Poblacion 2022"
    ]));

    const pasajeros2025 =
      sumYear(paxRows, iata, 2025, [PAX_DATASET_CAB, PAX_DATASET_INT]);

    const pasajeros2024 =
      sumYear(paxRows, iata, 2024, [PAX_DATASET_CAB, PAX_DATASET_INT]);

    const variacionPct =
      pasajeros2024 > 0 ? ((pasajeros2025 - pasajeros2024) / pasajeros2024) * 100 : NaN;

    const movimientos2025 = sumYear(movRows, iata, 2025, null);

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
        El presente informe de Impacto socioeconómico y territorial ${YEAR_REF} del <strong>${nombreAeropuerto}</strong>, caracteriza y cuantifica el aporte económico y laboral generado por los servicios aeronáuticos y aeroportuarios en el área de influencia, definida como el espacio geográfico sobre el cual el aeropuerto ejerce un poder de atracción y define el universo de potenciales pasajeros. En el caso de <strong>${nombreAeropuerto}</strong>, incluye los departamentos de <strong>${departamentos}</strong>, y beneficia a <strong>${poblacion2022}</strong> habitantes (Censo 2022).
      </p>

      <p>
        La evaluación del papel del transporte aerocomercial en el desarrollo territorial requiere considerar tanto sus impactos positivos como los efectos adversos que puede tener sobre las desigualdades regionales. Este análisis constituye un insumo relevante para el diseño de políticas orientadas a fortalecer su aporte al desarrollo local, regional y nacional.
      </p>

      <p>
        Los beneficios socioeconómicos del transporte aéreo están vinculados, por un lado, a la dinámica propia de las actividades aerocomerciales y aeroportuarias —facturación, salarios, utilidades, impuestos, etc.— y, por otro, a la conectividad aérea, que constituye un factor estratégico para el crecimiento y desarrollo de los mercados en el largo plazo, al facilitar el comercio, promover la inversión y estimular el turismo.
      </p>

      <p>
        En ${YEAR_REF}, el <strong>${nombreAeropuerto}</strong> registró <strong>${formatNumber(pasajeros2025)}</strong> pasajeros, lo que representó una variación de <strong>${formatPercent(variacionPct)}</strong> respecto del año anterior. Además, el aeropuerto contabilizó <strong>${formatNumber(movimientos2025)}</strong> movimientos de aeronaves.
      </p>

      <p>
        En ${YEAR_REF}, el impacto socioeconómico y territorial positivo generado por el Aeropuerto de <strong>${nombreAeropuerto}</strong> en su área de influencia ascendió a <strong>${impactoPositivo}</strong> y posibilitó la creación de <strong>${empleoTotal}</strong> puestos de trabajo. Este resultado reúne los impactos directos, indirectos, inducidos y catalíticos positivos de la aviación, integrados por un Producto Bruto Aeroportuario de <strong>${pba}</strong>, un aporte del turismo receptivo de <strong>${turismoReceptivo}</strong> y beneficios económicos para los pasajeros por <strong>${beneficiosPax}</strong>. Por su parte, el turismo emisivo representó un impacto negativo de <strong>${turismoEmisivo}</strong>, asociado a gastos realizados fuera del área de influencia, en otras regiones del país y del exterior. En consecuencia, el saldo neto de impactos del transporte aéreo en el área de influencia aeroportuaria fue de <strong>${saldoImpacto}</strong>.
      </p>
    `;
  }

  function loadImageWithFallback(imgEl, candidates) {
    if (!imgEl) return;
    const list = candidates.filter(Boolean);
    let idx = 0;

    const tryNext = () => {
      if (idx >= list.length) {
        imgEl.classList.add("is-hidden");
        return;
      }
      imgEl.src = list[idx++];
      imgEl.onerror = tryNext;
      imgEl.onload = () => imgEl.classList.remove("is-hidden");
    };

    tryNext();
  }

  function renderSummary(iata) {
    const code = clean(iata).toUpperCase();
    if (!code) return false;

    const airport = airportsData.find(a => clean(a.IATA).toUpperCase() === code);
    const impact = getImpactRecord(code);

    if (!airport || !impact) {
      setHTML("summaryText", "<p>No se pudo construir el resumen ejecutivo para este aeropuerto.</p>");
      return false;
    }

    setHTML("summaryAirportLine", buildAirportLine(airport, code));
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
    const [airportsResp, impactResp, paxResp, movResp] = await Promise.all([
      fetch(AIRPORTS_URL),
      fetch(IMPACT_URL),
      fetch(PAX_URL).catch(() => null),
      fetch(MOV_URL).catch(() => null)
    ]);

    const airportsGeo = await airportsResp.json();
    airportsData = (airportsGeo.features || []).map(f => f.properties || {}).filter(p => clean(p.IATA));

    const impactGeo = await impactResp.json();
    impactData = impactGeo.features || [];

    if (paxResp && paxResp.ok) {
      paxRows = parsePasajerosMensualCSV(await readTextSmart(paxResp));
    }

    if (movResp && movResp.ok) {
      movRows = parseMovimientosMensualCSV(await readTextSmart(movResp));
    }
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
      setHTML("summaryText", "<p>No se pudieron cargar los datos del resumen ejecutivo.</p>");
    }
  }

  document.addEventListener("DOMContentLoaded", bootResumen);
  document.addEventListener("report:partials-ready", bootResumen);
})();
