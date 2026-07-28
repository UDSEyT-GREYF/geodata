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
  - Busca en informes mensuales ANAC 2016-2026.
  - Detecta párrafos con términos de cierre/suspensión/cese + obra/mantenimiento/pista/plataforma.
  - NO reemplaza validación manual: genera candidatos para revisar y pasar a "eventos".
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader


BASE_URL = "https://consultas-publicas.anac.gob.ar/estadisticas-dnta/"
OUTPUT_PATH = Path("fuentes/cierres_operativos_aeropuertos_anac_2016_2026.candidatos.json")
CACHE_DIR = Path(".cache/anac_informes_mensuales")

YEARS = list(range(2016, 2027))
MAX_NOTE_SCAN_PAGES = 8

NOTE_SECTION_START_PATTERNS = [
    r"\bnotas generales\b",
    r"\bnotas\b",
    r"\baclaraciones metodol[oó]gicas\b",
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
    "cerrado", "cerrada", "cierre", "clausurado", "clausurada",
    "cese de operaciones", "cesó operaciones", "suspendió sus operaciones",
    "suspension de operaciones", "suspensión de operaciones",
    "suspendido", "suspendida", "inoperativo", "inoperativa",
    "sin operaciones", "no operó", "no opero", "no registró operaciones",
    "permaneció cerrado", "permanecio cerrado"
]

# Palabras que indican obra/infraestructura.
WORK_TERMS = [
    "obra", "obras", "mantenimiento", "reparación", "reparacion",
    "rehabilitación", "rehabilitacion", "remodelación", "remodelacion",
    "modernización", "modernizacion", "repavimentación", "repavimentacion",
    "pista", "calle de rodaje", "calles de rodaje", "rodaje",
    "plataforma", "balizamiento", "infraestructura", "terminal",
    "trabajos esenciales", "ampliación", "ampliacion"
]

# Términos a excluir cuando no son obra aeroportuaria.
EXCLUDE_TERMS = [
    "paro", "medida de fuerza", "huelga", "covid", "pandemia",
    "restricciones sanitarias", "meteorolog", "niebla", "neblina",
    "tormenta", "viento", "ceniza", "volcán", "volcan"
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
    "santa fe": "SFN",
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

    # fallback Nextcloud public share download pattern
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

    # Deduplicar por año-mes
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


def extract_note_text_from_pdf(pdf_path: Path) -> str:
    """
    Extrae solamente la sección de Notas / Notas Generales ubicada
    en las primeras páginas del informe.

    No revisa rankings, gráficos ni notas al pie de páginas posteriores.
    """
    reader = PdfReader(str(pdf_path))
    parts = []

    max_pages = min(len(reader.pages), MAX_NOTE_SCAN_PAGES)

    start_re = re.compile(
        "|".join(NOTE_SECTION_START_PATTERNS),
        flags=re.IGNORECASE
    )

    stop_re = re.compile(
        "|".join(NOTE_SECTION_STOP_PATTERNS),
        flags=re.IGNORECASE
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
            # recorte razonable para revisión humana
            p = p[:1600].strip()
        candidates.append(p)
    return candidates


def is_relevant(text: str) -> bool:
    n = norm(text)
    has_closure = any(term in n for term in map(norm, CLOSURE_TERMS))
    has_work = any(term in n for term in map(norm, WORK_TERMS))
    excluded = any(term in n for term in map(norm, EXCLUDE_TERMS))
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
        "permaneció cerrado"
    ]

    selected = [
        p.strip()
        for p in pieces
        if any(term in norm(p) for term in map(norm, closure_terms))
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
    # Devuelve texto crudo de fechas encontradas; la normalización final debe validarse manualmente.
    date_patterns = [
        r"\b\d{1,2}/\d{1,2}/\d{2,4}\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4}\b",
        r"\b\d{1,2}\s+de\s+[a-záéíóúñ]+\b",
    ]
    found = []
    for pat in date_patterns:
        found.extend(re.findall(pat, text, flags=re.IGNORECASE))
    return {"fechas_detectadas": list(dict.fromkeys(found))}


def classify_event(text: str) -> tuple[str, str]:
    n = norm(text)

    if "suspension de operaciones" in n or "suspendio sus operaciones" in n:
        tipo = "suspension_operaciones"
    elif "cese de operaciones" in n:
        tipo = "cese_operaciones"
    elif "pista" in n and ("cerrad" in n or "clausurad" in n):
        tipo = "cierre_pista"
    else:
        tipo = "cierre_operativo"

    if "mantenimiento" in n:
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
                "criterio_busqueda": "solo_notas_primeras_paginas",
                "url": informe.page_url,
                "download_url": informe.download_url,
            })
            print(f"[OK] {informe.year}-{informe.month}: sin sección de notas en primeras páginas")
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
                "observaciones_revision": ""
            })

        fuentes_revisadas.append({
            "anio": informe.year,
            "mes": informe.month,
            "documento": informe.filename,
            "estado": "ok",
            "candidatos_detectados": len(hits),
            "url": informe.page_url,
            "download_url": informe.download_url,
        })

        print(f"[OK] {informe.year}-{informe.month}: {len(hits)} candidatos")

    return {
        "metadata": {
            "nombre": "cierres_operativos_aeropuertos_anac_2016_2026_candidatos",
           "descripcion": "Candidatos extraídos automáticamente desde la sección Notas / Notas Generales de las primeras páginas de los informes mensuales ANAC. Requieren validación manual antes de incorporarse a eventos confirmados.",
"fuente": BASE_URL,
"alcance_extraccion": "solo_notas_primeras_paginas",
"max_paginas_revisadas_por_pdf": MAX_NOTE_SCAN_PAGES,
          
            "criterio": {
                "incluye": ["cierre/cese/suspensión/inoperatividad", "obra/mantenimiento/infraestructura"],
                "excluye": ["paros", "pandemia", "meteorología puntual", "cambios comerciales"]
            },
            "total_candidatos": len(candidates),
            "generado_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "fuentes_revisadas": fuentes_revisadas,
        "candidatos": candidates
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
        encoding="utf-8"
    )

    print(f"[OK] Escrito {OUTPUT_PATH}")
    print(f"[OK] Candidatos detectados: {result['metadata']['total_candidatos']}")


if __name__ == "__main__":
    main()
