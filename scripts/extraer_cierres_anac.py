#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Extrae candidatos a cierres operativos aeroportuarios desde informes mensuales ANAC.

Uso local:
  pip install requests beautifulsoup4 pypdf
  python scripts/extraer_cierres_anac.py

Salida:
  fuentes/cierres_operativos_aeropuertos_anac_2016_2026.candidatos.json

Criterio:
  - Busca informes mensuales ANAC 2016-2026.
  - Descarga los PDF publicados en Estadísticas DNTA.
  - Extrae solamente la sección de Notas Generales / aclaraciones metodológicas
    ubicada en las primeras páginas.
  - No revisa rankings, gráficos ni notas al pie de páginas posteriores.
  - Detecta párrafos con términos de cierre/suspensión/cese + obra/mantenimiento/infraestructura.
  - NO reemplaza validación manual: genera candidatos para revisar y pasar a "eventos".
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader


BASE_URL = "https://consultas-publicas.anac.gob.ar/estadisticas-dnta/"
OUTPUT_PATH = Path("fuentes/cierres_operativos_aeropuertos_anac_2016_2026.candidatos.json")
FINAL_BASE_PATH = Path("fuentes/cierres_operativos_aeropuertos_anac_2016_2026.json")
CACHE_DIR = Path(".cache/anac_informes_mensuales")

YEARS = list(range(2016, 2027))

# Para evitar notas de rankings posteriores. La sección útil suele estar
# en las primeras páginas, generalmente como "Notas Generales".
MAX_NOTE_SCAN_PAGES = 6

NOTE_SECTION_START_PATTERNS = [
    r"\bnotas generales\b",
    r"\baclaraciones metodol[oó]gicas\b",
    r"\bconsideraciones metodol[oó]gicas\b",
    r"\bnotas metodol[oó]gicas\b",
]

NOTE_SECTION_STOP_PATTERNS = [
    r"\bpasajeros por aeropuerto\b",
    r"\bpasajeros totales por aeropuerto\b",
    r"\branking\b",
    r"\btop 10\b",
    r"\bvariaci[oó]n pasajeros\b",
    r"\bcabotaje del mes\b",
    r"\binternacional del mes\b",
    r"\bmovimientos por aeropuerto\b",
    r"\baeronaves por aeropuerto\b",
    r"\bdepartamento de estad[ií]stica\s+pasajeros\b",
    r"\boferta por aeropuerto\b",
    r"\bdemanda por aeropuerto\b",
]

# Indicadores de páginas que no deben procesarse como notas metodológicas.
RANKING_PAGE_PATTERNS = [
    r"\branking\b",
    r"\btop 10\b",
    r"\bdecrecimiento\b",
    r"\baumento pasajeros\b",
    r"\bdisminuci[oó]n pasajeros\b",
    r"\bvariaci[oó]n pax\b",
    r"\bpasajeros por aeropuerto\b",
    r"\bpasajeros totales por aeropuerto\b",
]

MONTHS = {
    "enero": "01",
    "febrero": "02",
    "marzo": "03",
    "abril": "04",
    "mayo": "05",
    "junio": "06",
    "julio": "07",
    "agosto": "08",
    "septiembre": "09",
    "setiembre": "09",
    "octubre": "10",
    "noviembre": "11",
    "diciembre": "12",
}

# Palabras que indican afectación operativa.
CLOSURE_TERMS = [
    "cerrado",
    "cerrada",
    "cierre",
    "clausurado",
    "clausurada",
    "cese de operaciones",
    "cesó operaciones",
    "suspendió sus operaciones",
    "suspension de operaciones",
    "suspensión de operaciones",
    "suspendido",
    "suspendida",
    "suspendida su operatividad",
    "inoperativo",
    "inoperativa",
    "sin operaciones",
    "no operó",
    "no opero",
    "no registró operaciones",
    "permaneció cerrado",
    "permanecio cerrado",
]

# Palabras que indican obra/infraestructura.
WORK_TERMS = [
    "obra",
    "obras",
    "mantenimiento",
    "reparación",
    "reparacion",
    "rehabilitación",
    "rehabilitacion",
    "remodelación",
    "remodelacion",
    "modernización",
    "modernizacion",
    "repavimentación",
    "repavimentacion",
    "pista",
    "calle de rodaje",
    "calles de rodaje",
    "rodaje",
    "plataforma",
    "balizamiento",
    "infraestructura",
    "terminal",
    "trabajos esenciales",
    "ampliación",
    "ampliacion",
    "autobomba",
    "equipamiento aeroportuario",
]

# Términos a excluir cuando no son obra aeroportuaria.
EXCLUDE_TERMS = [
    "paro",
    "medida de fuerza",
    "huelga",
    "covid",
    "pandemia",
    "restricciones sanitarias",
    "meteorolog",
    "niebla",
    "neblina",
    "tormenta",
    "viento",
    "ceniza",
    "volcán",
    "volcan",
]

AIRPORT_CODES = {
    # IATA: (OACI, nombre corto)
    "AEP": ("SABE", "Aeroparque Jorge Newbery"),
    "EZE": ("SAEZ", "Aeropuerto Internacional Ministro Pistarini"),
    "COR": ("SACO", "Aeropuerto Internacional Ingeniero Ambrosio Taravella"),
    "ROS": ("SAAR", "Aeropuerto Internacional de Rosario Islas Malvinas"),
    "RGL": ("SAWG", "Aeropuerto Internacional de Río Gallegos"),
    "RGA": ("SAWE", "Aeropuerto Internacional de Río Grande"),
    "USH": ("SAWH", "Aeropuerto Internacional de Ushuaia Malvinas Argentinas"),
    "BRC": ("SAZS", "Aeropuerto Internacional de San Carlos de Bariloche"),
    "MDZ": ("SAME", "Aeropuerto Internacional Gobernador Francisco Gabrielli"),
    "NQN": ("SAZN", "Aeropuerto Internacional Presidente Perón"),
    "REL": ("SAVT", "Aeropuerto Almirante Marcos A. Zar"),
    "CRD": ("SAVC", "Aeropuerto Internacional General Enrique Mosconi"),
    "FTE": ("SAWC", "Aeropuerto Internacional Comandante Armando Tola"),
    "IGR": ("SARI", "Aeropuerto Internacional Cataratas del Iguazú"),
    "SLA": ("SASA", "Aeropuerto Internacional Martín Miguel de Güemes"),
    "JUJ": ("SASJ", "Aeropuerto Internacional Gobernador Horacio Guzmán"),
    "TUC": ("SANT", "Aeropuerto Internacional Teniente General Benjamín Matienzo"),
    "CNQ": ("SARC", "Aeropuerto Internacional Doctor Fernando Piragine Niveyro"),
    "RES": ("SARE", "Aeropuerto Internacional de Resistencia"),
    "FMA": ("SARF", "Aeropuerto Internacional de Formosa"),
    "PSS": ("SARP", "Aeropuerto Libertador General José de San Martín"),
    "PRA": ("SAAP", "Aeropuerto General Justo José de Urquiza"),
    "SFN": ("SAAV", "Aeropuerto de Sauce Viejo"),
    "LUQ": ("SAOU", "Aeropuerto Brigadier Mayor César Raúl Ojeda"),
    "UAQ": ("SANU", "Aeropuerto Domingo Faustino Sarmiento"),
    "IRJ": ("SANL", "Aeropuerto Capitán Vicente Almandos Almonacid"),
    "CTC": ("SANC", "Aeropuerto Coronel Felipe Varela"),
    "RSA": ("SAZR", "Aeropuerto Santa Rosa"),
    "BHI": ("SAZB", "Aeropuerto Comandante Espora"),
    "MDQ": ("SAZM", "Aeropuerto Internacional Astor Piazzolla"),
    "VDM": ("SAVV", "Aeropuerto Gobernador Castello"),
    "CPC": ("SAZY", "Aeropuerto Aviador Carlos Campos"),
    "EQS": ("SAVE", "Aeropuerto Brigadier General Antonio Parodi"),
    "PMY": ("SAVY", "Aeropuerto El Tehuelche"),
    "RHD": ("SANR", "Aeropuerto Internacional Termas de Río Hondo"),
}

AIRPORT_NAME_HINTS = {
    "aeroparque": "AEP",
    "jorge newbery": "AEP",
    "ezeiza": "EZE",
    "pistarini": "EZE",
    "cordoba": "COR",
    "córdoba": "COR",
    "rosario": "ROS",
    "rio gallegos": "RGL",
    "río gallegos": "RGL",
    "rio grande": "RGA",
    "río grande": "RGA",
    "ushuaia": "USH",
    "bariloche": "BRC",
    "mendoza": "MDZ",
    "neuquen": "NQN",
    "neuquén": "NQN",
    "trelew": "REL",
    "comodoro rivadavia": "CRD",
    "calafate": "FTE",
    "iguazu": "IGR",
    "iguazú": "IGR",
    "salta": "SLA",
    "jujuy": "JUJ",
    "tucuman": "TUC",
    "tucumán": "TUC",
    "corrientes": "CNQ",
    "resistencia": "RES",
    "formosa": "FMA",
    "posadas": "PSS",
    "parana": "PRA",
    "paraná": "PRA",
    "sauce viejo": "SFN",
    "santa fe": "SFN",
    "san luis": "LUQ",
    "san juan": "UAQ",
    "la rioja": "IRJ",
    "catamarca": "CTC",
    "santa rosa": "RSA",
    "bahia blanca": "BHI",
    "bahía blanca": "BHI",
    "mar del plata": "MDQ",
    "viedma": "VDM",
    "chapelco": "CPC",
    "esquel": "EQS",
    "puerto madryn": "PMY",
    "termas de rio hondo": "RHD",
    "termas de río hondo": "RHD",
    "rio hondo": "RHD",
    "río hondo": "RHD",
}


@dataclass
class Informe:
    year: int
    month_name: str
    month: str
    page_url: str
    download_url: str
    filename: str


def norm(text: str) -> str:
    text = text or ""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fetch(url: str, timeout: int = 60) -> requests.Response:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; orsna-anac-closures/1.0)"}
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp


def discover_year_channels() -> dict[int, str]:
    html = fetch(BASE_URL).text
    soup = BeautifulSoup(html, "html.parser")

    channels: dict[int, str] = {}

    for a in soup.find_all("a", href=True):
        label = norm(a.get_text(" "))
        href = urljoin(BASE_URL, a["href"])

        for year in YEARS:
            if str(year) == label or str(year) in label:
                if "/canal/" in href:
                    channels[year] = href

    if not channels:
        raise RuntimeError("No se pudieron descubrir canales por año desde la página principal.")

    return channels


def resolve_download_url(page_url: str) -> tuple[str, str]:
    # Si el enlace ya es un PDF directo, no hay que agregar /download.
    clean_url = page_url.split("?")[0].lower()
    if clean_url.endswith(".pdf"):
        filename = Path(unquote(urlparse(page_url).path)).name or "informe_anac.pdf"
        return page_url, filename

    html = fetch(page_url).text
    soup = BeautifulSoup(html, "html.parser")

    filename = ""
    for text in soup.stripped_strings:
        if ".pdf" in text.lower():
            filename = text.strip()
            break

    for a in soup.find_all("a", href=True):
        label = norm(a.get_text(" "))
        href = urljoin(page_url, a["href"])

        if "download" in label or "/download" in href:
            return href, filename or "informe_anac.pdf"

    # Fallback Nextcloud public share download pattern.
    return page_url.rstrip("/") + "/download", filename or "informe_anac.pdf"


def discover_monthly_reports(channels: dict[int, str]) -> list[Informe]:
    informes: list[Informe] = []

    for year, channel_url in sorted(channels.items()):
        html = fetch(channel_url).text
        soup = BeautifulSoup(html, "html.parser")

        for a in soup.find_all("a", href=True):
            label_raw = a.get_text(" ")
            label = norm(label_raw)
            href = urljoin(channel_url, a["href"])

            month_name = ""
            month = ""

            for name, num in MONTHS.items():
                if label == name or label.startswith(name + " ") or name in label:
                    month_name = name
                    month = num
                    break

            if not month:
                continue

            # Evita anexos si no son el informe mensual principal.
            if "anexo" in label or "complementario" in label or "puntualidad" in label:
                continue

            try:
                download_url, filename = resolve_download_url(href)
            except Exception as e:
                print(f"[WARN] No se pudo resolver descarga {year} {label_raw}: {e}")
                continue

            filename = filename or f"Informe_Mensual_{year}{month}.pdf"
            informes.append(
                Informe(
                    year=year,
                    month_name=month_name,
                    month=month,
                    page_url=href,
                    download_url=download_url,
                    filename=filename,
                )
            )

    # Deduplicar por año-mes.
    seen = set()
    unique: list[Informe] = []

    for inf in informes:
        key = (inf.year, inf.month)
        if key in seen:
            continue
        seen.add(key)
        unique.append(inf)

    return sorted(unique, key=lambda x: (x.year, x.month))


def download_pdf(informe: Informe) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", informe.filename)
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"

    path = CACHE_DIR / f"{informe.year}_{informe.month}_{safe_name}"

    if path.exists() and path.stat().st_size > 1024:
        return path

    print(f"[DESCARGA] {informe.year}-{informe.month} {informe.download_url}")
    resp = fetch(informe.download_url, timeout=120)
    path.write_bytes(resp.content)
    time.sleep(0.4)

    return path


def page_looks_like_ranking(page_text: str, note_start: int) -> bool:
    """
    Evita capturar notas al pie de rankings/gráficos.
    Si antes del título de notas aparece ranking/top 10/pasajeros por aeropuerto,
    se interpreta como una página de gráfico y no como notas metodológicas.
    """
    prefix = page_text[:note_start]
    prefix_norm = norm(prefix)
    page_norm = norm(page_text)

    for pattern in RANKING_PAGE_PATTERNS:
        if re.search(pattern, prefix_norm, flags=re.IGNORECASE):
            return True

    # Si la página completa es claramente ranking, se descarta salvo que sea
    # una página explícita de Notas Generales.
    has_notas_generales = re.search(r"\bnotas generales\b", page_norm, flags=re.IGNORECASE)
    has_ranking = any(re.search(pattern, page_norm, flags=re.IGNORECASE) for pattern in RANKING_PAGE_PATTERNS)

    return bool(has_ranking and not has_notas_generales)


def extract_note_text_from_pdf(pdf_path: Path) -> str:
    """
    Extrae solamente la sección de Notas Generales / aclaraciones metodológicas
    ubicada en las primeras páginas del informe.

    No revisa rankings, gráficos ni notas al pie de páginas posteriores.
    """
    reader = PdfReader(str(pdf_path))
    parts = []

    max_pages = min(len(reader.pages), MAX_NOTE_SCAN_PAGES)

    start_re = re.compile(
        "|".join(NOTE_SECTION_START_PATTERNS),
        flags=re.IGNORECASE,
    )

    stop_re = re.compile(
        "|".join(NOTE_SECTION_STOP_PATTERNS),
        flags=re.IGNORECASE,
    )

    for i in range(max_pages):
        try:
            page_text = reader.pages[i].extract_text() or ""
        except Exception as e:
            print(f"[WARN] Error extrayendo página {i + 1} de {pdf_path.name}: {e}")
            continue

        page_text = re.sub(r"\r", "\n", page_text)
        page_text = re.sub(r"[ \t]+", " ", page_text)

        match = start_re.search(page_text)

        if not match:
            continue

        if page_looks_like_ranking(page_text, match.start()):
            continue

        section = page_text[match.start():]

        stop_match = stop_re.search(section)

        if stop_match and stop_match.start() > 40:
            section = section[:stop_match.start()]

        section = re.sub(r"\s+", " ", section).strip()

        if section:
            parts.append(f"\n\n--- PAGE {i + 1} ---\n{section}")

    return "\n".join(parts)


def split_candidate_paragraphs(text: str) -> list[str]:
    text = re.sub(r"\r", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)

    raw = re.split(r"\n\s*\n|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ])", text)

    candidates = []
    for p in raw:
        p = re.sub(r"\s+", " ", p).strip()

        if len(p) < 60:
            continue

        if len(p) > 1600:
            # Recorte razonable para revisión humana.
            p = p[:1600].strip()

        candidates.append(p)

    return candidates


def is_relevant(text: str) -> bool:
    n = norm(text)
    has_closure = any(norm(term) in n for term in CLOSURE_TERMS)
    has_work = any(norm(term) in n for term in WORK_TERMS)
    excluded = any(norm(term) in n for term in EXCLUDE_TERMS)

    return has_closure and has_work and not excluded


def closure_window(text: str) -> str:
    pieces = re.split(r"[▪•]|\n|(?<=\.)\s+", text)

    closure_terms = [
        "cerrado",
        "cerrada",
        "cierre",
        "cese de operaciones",
        "suspendio",
        "suspendió",
        "suspendera",
        "suspenderá",
        "suspendida su operatividad",
        "permanecio cerrado",
        "permaneció cerrado",
    ]

    selected = [
        p.strip()
        for p in pieces
        if any(norm(term) in norm(p) for term in closure_terms)
    ]

    return " ".join(selected) if selected else text


def infer_airport(text: str) -> tuple[str, str, str]:
    search_text = closure_window(text)
    n = norm(search_text)

    # 1. Nombre textual dentro de la oración/viñeta del cierre.
    # Esto evita confundir aeropuertos que aparecen en rankings.
    for hint, iata in AIRPORT_NAME_HINTS.items():
        if norm(hint) in n:
            oaci, name = AIRPORT_CODES.get(iata, ("", ""))
            return iata, oaci, name

    # 2. IATA explícito dentro de la oración/viñeta del cierre.
    for iata, (oaci, name) in AIRPORT_CODES.items():
        if re.search(rf"\b{iata}\b", search_text.upper()):
            return iata, oaci, name

    return "", "", ""


def extract_dates(text: str) -> dict:
    """
    Devuelve texto crudo de fechas encontradas.
    La normalización final debe validarse manualmente.
    """
    date_patterns = [
        r"\b\d{1,2}/\d{1,2}/\d{2,4}\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4}\b",
        r"\b\d{1,2}\s+de\s+[a-záéíóúñ]+\b",
        r"\b[Aa]br[’']?\d{2}\b",
        r"\b[Aa]go[’']?\d{2}\b",
        r"\b[Ee]ne[’']?\d{2}\b",
    ]

    found = []
    for pat in date_patterns:
        found.extend(re.findall(pat, text, flags=re.IGNORECASE))

    return {"fechas_detectadas": list(dict.fromkeys(found))}


def classify_event(text: str) -> tuple[str, str]:
    n = norm(text)

    if "suspension de operaciones" in n or "suspendio sus operaciones" in n:
        tipo = "suspension_operaciones"
    elif "suspendida su operatividad" in n:
        tipo = "suspension_operaciones"
    elif "cese de operaciones" in n:
        tipo = "cese_operaciones"
    elif "pista" in n and ("cerrad" in n or "clausurad" in n):
        tipo = "cierre_pista"
    else:
        tipo = "cierre_operativo"

    if "autobomba" in n:
        causa = "equipamiento_operativo"
    elif "mantenimiento" in n:
        causa = "mantenimiento"
    elif "rehabilitacion" in n:
        causa = "rehabilitacion"
    elif "modernizacion" in n:
        causa = "modernizacion"
    elif "remodelacion" in n:
        causa = "remodelacion"
    elif "repavimentacion" in n:
        causa = "repavimentacion"
    else:
        causa = "obra"

    return tipo, causa


def candidate_signature(candidate: dict) -> tuple:
    """
    Firma para detectar candidatos repetidos aunque provengan de informes
    mensuales distintos.

    No incluye fuente ni mes de publicación, porque muchas Notas Generales se
    repiten literalmente durante meses.
    """
    text = candidate.get("texto_fuente", "")
    window = closure_window(text)
    window = norm(window)
    window = re.sub(r"[^a-z0-9]+", " ", window).strip()

    fechas = "|".join(candidate.get("fechas_detectadas", []))

    return (
        candidate.get("iata") or "",
        candidate.get("oaci") or "",
        candidate.get("tipo_evento_sugerido") or "",
        candidate.get("causa_categoria_sugerida") or "",
        fechas,
        window[:700],
    )


def dedupe_candidates(candidates: list[dict]) -> tuple[list[dict], int]:
    """
    Elimina candidatos repetidos originados por la misma nota publicada en
    varios informes mensuales.
    """
    seen = set()
    unique = []
    removed = 0

    for candidate in candidates:
        sig = candidate_signature(candidate)

        if sig in seen:
            removed += 1
            continue

        seen.add(sig)
        unique.append(candidate)

    return unique, removed


def spanish_date_variants(date_iso: str) -> list[str]:
    """
    Genera variantes simples de una fecha ISO para compararlas contra el texto
    extraído de los PDF, que suele estar redactado como "01 de agosto de 2020"
    o "15 de marzo 2021".
    """
    if not date_iso:
        return []

    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", date_iso)
    if not match:
        return [norm(date_iso)]

    year, month, day = match.groups()
    month_names = {
        "01": "enero",
        "02": "febrero",
        "03": "marzo",
        "04": "abril",
        "05": "mayo",
        "06": "junio",
        "07": "julio",
        "08": "agosto",
        "09": "septiembre",
        "10": "octubre",
        "11": "noviembre",
        "12": "diciembre",
    }

    month_name = month_names.get(month, month)
    day_int = str(int(day))

    variants = [
        f"{day} de {month_name} de {year}",
        f"{day_int} de {month_name} de {year}",
        f"{day} de {month_name} {year}",
        f"{day_int} de {month_name} {year}",
        f"{day}/{month}/{year}",
        f"{day_int}/{int(month)}/{year}",
    ]

    return [norm(v) for v in variants]


def load_validated_events() -> list[dict]:
    """
    Lee la base consolidada, si existe, para no volver a emitir como candidatos
    eventos que ya están en 'eventos'.
    """
    if not FINAL_BASE_PATH.exists():
        return []

    try:
        data = json.loads(FINAL_BASE_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[WARN] No se pudo leer base final para filtrar validados: {e}")
        return []

    eventos = data.get("eventos", [])
    return eventos if isinstance(eventos, list) else []


def candidate_matches_validated_event(candidate: dict, event: dict) -> bool:
    """
    Detecta si un candidato corresponde a un evento ya validado.

    Usa IATA y las fechas inicio/fin cuando están presentes en el texto fuente.
    Esto elimina, por ejemplo, la nota repetida de AEP 2020-2021 ya cargada
    como evento validado.
    """
    candidate_iata = candidate.get("iata")
    event_iata = event.get("iata")

    if not candidate_iata or not event_iata or candidate_iata != event_iata:
        return False

    text_norm = norm(candidate.get("texto_fuente", ""))

    start_variants = spanish_date_variants(event.get("fecha_inicio", ""))
    end_variants = spanish_date_variants(event.get("fecha_fin", ""))

    has_start = any(v and v in text_norm for v in start_variants)
    has_end = any(v and v in text_norm for v in end_variants)

    if has_start and has_end:
        return True

    # Fallback conservador para AEP: los informes repiten esta nota en forma
    # textual, pero a veces el extractor no captura todas las fechas como campo.
    if candidate_iata == "AEP":
        return (
            "01 de agosto de 2020" in text_norm
            and "15 de marzo 2021" in text_norm
            and "aeroparque" in text_norm
            and "cese de operaciones" in text_norm
        )

    return False


def filter_already_validated(candidates: list[dict], eventos: list[dict]) -> tuple[list[dict], int]:
    """
    Quita candidatos que ya están en la base principal como eventos validados.
    """
    if not eventos:
        return candidates, 0

    filtered = []
    removed = 0

    for candidate in candidates:
        if any(candidate_matches_validated_event(candidate, event) for event in eventos):
            removed += 1
            continue

        filtered.append(candidate)

    return filtered, removed


def build_candidates(informes: Iterable[Informe]) -> dict:
    candidates = []
    fuentes_revisadas = []

    for informe in informes:
        try:
            pdf_path = download_pdf(informe)
            text = extract_note_text_from_pdf(pdf_path)

            if not text.strip():
                fuentes_revisadas.append({
                    "anio": informe.year,
                    "mes": informe.month,
                    "documento": informe.filename,
                    "estado": "ok",
                    "candidatos_detectados": 0,
                    "criterio_busqueda": "solo_notas_generales_primeras_paginas",
                    "url": informe.page_url,
                    "download_url": informe.download_url,
                })
                print(f"[OK] {informe.year}-{informe.month}: sin Notas Generales en primeras páginas")
                continue

        except Exception as e:
            print(f"[ERROR] {informe.year}-{informe.month}: {e}")
            fuentes_revisadas.append({
                "anio": informe.year,
                "mes": informe.month,
                "documento": informe.filename,
                "estado": "error",
                "error": str(e),
                "url": informe.page_url,
                "download_url": informe.download_url,
            })
            continue

        paragraphs = split_candidate_paragraphs(text)
        hits = [p for p in paragraphs if is_relevant(p)]

        for idx, hit in enumerate(hits, start=1):
            iata, oaci, airport_name = infer_airport(hit)
            tipo, causa = classify_event(hit)
            dates = extract_dates(hit)

            candidates.append({
                "id_candidato": f"CAND_{informe.year}_{informe.month}_{idx:03d}",
                "iata": iata or None,
                "oaci": oaci or None,
                "aeropuerto_detectado": airport_name or None,
                "tipo_evento_sugerido": tipo,
                "causa_categoria_sugerida": causa,
                "fechas_detectadas": dates["fechas_detectadas"],
                "texto_fuente": hit,
                "fuente_anac": {
                    "anio": informe.year,
                    "mes": informe.month,
                    "mes_nombre": informe.month_name,
                    "documento": informe.filename,
                    "pagina": informe.page_url,
                    "download_url": informe.download_url,
                    "archivo_local": str(pdf_path),
                },
                "estado_revision": "pendiente",
                "incluir_en_base": None,
                "observaciones_revision": "",
            })

        fuentes_revisadas.append({
            "anio": informe.year,
            "mes": informe.month,
            "documento": informe.filename,
            "estado": "ok",
            "candidatos_detectados": len(hits),
            "criterio_busqueda": "solo_notas_generales_primeras_paginas",
            "url": informe.page_url,
            "download_url": informe.download_url,
        })

        print(f"[OK] {informe.year}-{informe.month}: {len(hits)} candidatos")

    candidatos_detectados_brutos = len(candidates)

    candidates, duplicados_eliminados = dedupe_candidates(candidates)

    eventos_validados = load_validated_events()
    candidates, ya_validados_eliminados = filter_already_validated(candidates, eventos_validados)

    return {
        "metadata": {
            "nombre": "cierres_operativos_aeropuertos_anac_2016_2026_candidatos",
            "descripcion": (
                "Candidatos extraídos automáticamente desde la sección Notas Generales "
                "/ aclaraciones metodológicas de las primeras páginas de los informes "
                "mensuales ANAC. Requieren validación manual antes de incorporarse a "
                "eventos confirmados."
            ),
            "fuente": BASE_URL,
            "alcance_extraccion": "solo_notas_generales_primeras_paginas",
            "max_paginas_revisadas_por_pdf": MAX_NOTE_SCAN_PAGES,
            "criterio": {
                "incluye": [
                    "cierre/cese/suspensión/inoperatividad",
                    "obra/mantenimiento/infraestructura/equipamiento operativo",
                ],
                "excluye": [
                    "paros",
                    "pandemia",
                    "meteorología puntual",
                    "cambios comerciales",
                    "notas al pie de rankings o gráficos posteriores",
                ],
            },
            "total_candidatos_brutos": candidatos_detectados_brutos,
            "duplicados_eliminados": duplicados_eliminados,
            "candidatos_ya_validados_eliminados": ya_validados_eliminados,
            "total_candidatos": len(candidates),
            "generado_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "fuentes_revisadas": fuentes_revisadas,
        "candidatos": candidates,
    }


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("[INFO] Descubriendo canales ANAC...")
    channels = discover_year_channels()
    print(f"[INFO] Canales encontrados: {sorted(channels.keys())}")

    print("[INFO] Descubriendo informes mensuales...")
    informes = discover_monthly_reports(channels)
    print(f"[INFO] Informes mensuales encontrados: {len(informes)}")

    result = build_candidates(informes)

    OUTPUT_PATH.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[OK] Escrito {OUTPUT_PATH}")
    print(f"[OK] Candidatos detectados: {result['metadata']['total_candidatos']}")


if __name__ == "__main__":
    main()
