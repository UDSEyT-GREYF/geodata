from pathlib import Path
import csv
import json
import math
import re
import unicodedata
from datetime import date

BASE_DIR = Path(__file__).resolve().parents[1]

AIRPORTS_PATH = BASE_DIR / "fuentes" / "Datos_aeropuertos.geojson"

INPUTS = {
    2025: BASE_DIR / "data" / "rutas_aereas_movimientos_2025.json",
    2026: BASE_DIR / "fuentes" / "Tabla rutasaereas2026_semestre1.csv",
}

OUT_JSON = BASE_DIR / "data" / "pasajeros_semestre_2025_2026.json"
OUT_CSV = BASE_DIR / "fuentes" / "pasajeros_semestre_2025_2026_aeropuerto.csv"


def normalize_key(value):
    text = str(value or "").strip()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower()
    return re.sub(r"[^a-z0-9]+", "", text)


def read_text(path):
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin1"):
        try:
            return path.read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="latin1")


def detect_delimiter(text):
    sample = text[:5000]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=[",", ";", "\t", "|"])
        return dialect.delimiter
    except csv.Error:
        if "\t" in sample:
            return "\t"
        if ";" in sample:
            return ";"
        return ","


def read_csv_rows(path):
    text = read_text(path)
    delimiter = detect_delimiter(text)
    reader = csv.DictReader(text.splitlines(), delimiter=delimiter)
    return list(reader)


def get_value(row, candidates):
    norm_map = {normalize_key(k): v for k, v in row.items()}

    for candidate in candidates:
        key = normalize_key(candidate)
        if key in norm_map:
            return norm_map[key]

    return ""


def parse_number(value):
    if value is None:
        return 0.0

    # Si viene desde JSON como número real o entero, no tocar separadores.
    # Ej.: 32964.0 debe seguir siendo 32964.0, no 329640.
    if isinstance(value, (int, float)):
        number = float(value)
        return number if math.isfinite(number) else 0.0

    text = str(value).strip()

    if not text:
        return 0.0

    text = text.replace(" ", "")

    # Caso 1: formato argentino con miles y decimal
    # Ej.: 32.964,0 -> 32964.0
    if "." in text and "," in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            # Formato inglés: 32,964.0 -> 32964.0
            text = text.replace(",", "")

    # Caso 2: solo coma
    # Ej.: 32964,0 -> 32964.0
    elif "," in text:
        text = text.replace(".", "").replace(",", ".")

    # Caso 3: solo punto
    # Puede ser decimal inglés: 32964.0
    # O miles: 32.964
    elif "." in text:
        parts = text.split(".")

        # Si parece separador de miles, lo quitamos.
        # Ej.: 32.964 -> 32964
        if len(parts) > 1 and all(len(part) == 3 for part in parts[1:]):
            text = text.replace(".", "")
        # Si no, lo dejamos como decimal normal.
        # Ej.: 32964.0 -> 32964.0

    try:
        return float(text)
    except ValueError:
        return 0.0


def parse_year_month(value):
    text = str(value or "").strip()

    # 2026-05, 2026/05, 202605
    match = re.search(r"(20\d{2})\D?([01]?\d)", text)
    if not match:
        return None, None

    year = int(match.group(1))
    month = int(match.group(2))

    if month < 1 or month > 12:
        return None, None

    return year, month


def normalize_flight_class(value):
    text = normalize_key(value)

    if "internacional" in text:
        return "internacional"

    if "cabotaje" in text:
        return "cabotaje"

    return "sin_clasificacion"


def normalize_service_class(value):
    text = normalize_key(value)

    if (
        "avgeneral" in text
        or "aviaciongeneral" in text
        or text == "general"
    ):
        return "av_general"

    if (
        "comercial" in text
        or "regular" in text
        or "noregular" in text
        or "noreg" in text
    ):
        return "comercial"

    return "sin_clase"


def load_airports_iata():
    geojson = json.loads(read_text(AIRPORTS_PATH))
    features = geojson.get("features", [])

    result = {}

    for feature in features:
        props = feature.get("properties", {}) or {}
        iata = str(props.get("IATA", "")).strip().upper()

        if not iata:
            continue

        name = (
            props.get("Aeropuerto")
            or props.get("Nombre del Aeropuerto")
            or iata
        )

        if iata == "AEP":
            name = "Aeroparque Jorge Newbery"

        result[iata] = str(name).strip()

    return result


def extract_iatas_from_route(route, valid_iatas):
    text = str(route or "").upper()

    # Toma códigos IATA de 3 letras. Ej.: AEP - COR, MOR - MOR
    tokens = re.findall(r"\b[A-Z]{3}\b", text)

    # Importante: set() para no contar dos veces un mismo registro local MOR-MOR
    return sorted(set(token for token in tokens if token in valid_iatas))


def empty_record(iata, airport_name):
    return {
        "iata": iata,
        "aeropuerto": airport_name,

        "pax_total": 0.0,

        "pax_cabotaje": 0.0,
        "pax_internacional": 0.0,
        "pax_sin_clasificacion": 0.0,

        "pax_comercial": 0.0,
        "pax_av_general": 0.0,
        "pax_sin_clase": 0.0,

        "pax_comercial_cabotaje": 0.0,
        "pax_comercial_internacional": 0.0,
        "pax_av_general_cabotaje": 0.0,
        "pax_av_general_internacional": 0.0,

        "registros": 0,
    }


def pct_change(current, previous):
    if previous is None or previous == 0:
        return None
    return ((current - previous) / previous) * 100


def round_record_values(record):
    out = {}

    for key, value in record.items():
        if isinstance(value, float):
            out[key] = round(value, 1)
        else:
            out[key] = value

    return out


def process_source(year, path, airports):
    valid_iatas = set(airports.keys())

    result = {
        iata: empty_record(iata, airports[iata])
        for iata in sorted(valid_iatas)
    }

    print(f"\nProcesando {year}: {path}")

    # ======================================================
    # CASO 2025: JSON ya integrado y agregado
    # data/rutas_aereas_movimientos_2025.json
    # ======================================================
    if path.suffix.lower() == ".json":
        data = json.loads(read_text(path))
        rows = data.get("records", [])

        print(f"Formato detectado: JSON")
        print(f"Registros leídos: {len(rows)}")

        for row in rows:
            try:
                year_value = int(row.get("year") or 0)
            except ValueError:
                year_value = None

            try:
                month = int(row.get("month") or 0)
            except ValueError:
                month = None

            if year_value != year:
                continue

            if month is None or month < 1 or month > 6:
                continue

            endpoint_a = str(row.get("endpointA") or "").strip().upper()
            endpoint_b = str(row.get("endpointB") or "").strip().upper()

            matched_iatas = sorted(set(
                code for code in [endpoint_a, endpoint_b]
                if code in valid_iatas
            ))

            # Fallback por si algún registro no trae endpointA/endpointB
            if not matched_iatas:
                route = row.get("rutaCompleta") or row.get("citypair_iata") or ""
                matched_iatas = extract_iatas_from_route(route, valid_iatas)

            if not matched_iatas:
                continue

            pax = parse_number(row.get("pax"))

            flight_class = normalize_flight_class(
                row.get("clasificacionVuelo")
            )

            service_class = normalize_service_class(
                row.get("claseVuelo")
            )

            for iata in matched_iatas:
                rec = result[iata]

                rec["pax_total"] += pax
                rec["registros"] += 1

                if flight_class == "cabotaje":
                    rec["pax_cabotaje"] += pax
                elif flight_class == "internacional":
                    rec["pax_internacional"] += pax
                else:
                    rec["pax_sin_clasificacion"] += pax

                if service_class == "comercial":
                    rec["pax_comercial"] += pax
                elif service_class == "av_general":
                    rec["pax_av_general"] += pax
                else:
                    rec["pax_sin_clase"] += pax

                if service_class == "comercial" and flight_class == "cabotaje":
                    rec["pax_comercial_cabotaje"] += pax

                if service_class == "comercial" and flight_class == "internacional":
                    rec["pax_comercial_internacional"] += pax

                if service_class == "av_general" and flight_class == "cabotaje":
                    rec["pax_av_general_cabotaje"] += pax

                if service_class == "av_general" and flight_class == "internacional":
                    rec["pax_av_general_internacional"] += pax

        total_registros = sum(item["registros"] for item in result.values())
        total_pax = sum(item["pax_total"] for item in result.values())

        print(f"Registros asignados {year}: {total_registros}")
        print(f"Pasajeros asignados {year}: {round(total_pax, 1)}")

        return result

    # ======================================================
    # CASO 2026: CSV del primer semestre
    # fuentes/Tabla rutasaereas2026_semestre1.csv
    # ======================================================
    rows = read_csv_rows(path)

    print(f"Formato detectado: CSV")
    print(f"Columnas detectadas: {list(rows[0].keys()) if rows else 'sin filas'}")
    print(f"Filas leídas: {len(rows)}")

    for row in rows:
        year_value, month = parse_year_month(
            get_value(row, ["AñoMes", "AnioMes", "anio_mes", "Periodo", "Mes"])
        )

        if year_value != year:
            continue

        if month is None or month < 1 or month > 6:
            continue

        route = get_value(row, ["RutaCompleta", "Ruta Completa", "ruta_completa"])
        matched_iatas = extract_iatas_from_route(route, valid_iatas)

        if not matched_iatas:
            continue

        pax = parse_number(get_value(row, ["Pax", "Pasajeros", "pasajeros"]))

        flight_class = normalize_flight_class(
            get_value(row, ["Clasificación Vuelo", "Clasificacion Vuelo", "clasificacion_vuelo"])
        )

        service_class = normalize_service_class(
            get_value(row, [
                "Clase de vuelo Comercial Av. Gral",
                "Clase de vuelo Comercial Av Gral",
                "Clase de vuelo",
                "Clase",
                "clase_vuelo",
                "clase_de_vuelo"
            ])
        )

        for iata in matched_iatas:
            rec = result[iata]

            rec["pax_total"] += pax
            rec["registros"] += 1

            if flight_class == "cabotaje":
                rec["pax_cabotaje"] += pax
            elif flight_class == "internacional":
                rec["pax_internacional"] += pax
            else:
                rec["pax_sin_clasificacion"] += pax

            if service_class == "comercial":
                rec["pax_comercial"] += pax
            elif service_class == "av_general":
                rec["pax_av_general"] += pax
            else:
                rec["pax_sin_clase"] += pax

            if service_class == "comercial" and flight_class == "cabotaje":
                rec["pax_comercial_cabotaje"] += pax

            if service_class == "comercial" and flight_class == "internacional":
                rec["pax_comercial_internacional"] += pax

            if service_class == "av_general" and flight_class == "cabotaje":
                rec["pax_av_general_cabotaje"] += pax

            if service_class == "av_general" and flight_class == "internacional":
                rec["pax_av_general_internacional"] += pax

    total_registros = sum(item["registros"] for item in result.values())
    total_pax = sum(item["pax_total"] for item in result.values())

    print(f"Registros asignados {year}: {total_registros}")
    print(f"Pasajeros asignados {year}: {round(total_pax, 1)}")

    return result


def build_output():
    airports = load_airports_iata()

    by_year = {
        year: process_source(year, path, airports)
        for year, path in INPUTS.items()
    }

    output = {
        "metadata": {
            "titulo": "Pasajeros por aeropuerto - primer semestre 2025/2026",
            "periodo": "enero-junio",
            "fuente_2025": str(INPUTS[2025].relative_to(BASE_DIR)).replace("\\", "/"),
            "fuente_2026": str(INPUTS[2026].relative_to(BASE_DIR)).replace("\\", "/"),
            "generado": date.today().isoformat(),
            "nota": "Para 2025 se asignan registros a cada aeropuerto según endpointA/endpointB del archivo integrado de rutas aéreas. Para 2026 se identifica el código IATA de cada aeropuerto en RutaCompleta. Si el mismo IATA aparece dos veces en una ruta local, se cuenta una sola vez para ese aeropuerto."
        },
        "aeropuertos": {}
    }

    csv_rows = []

    for iata in sorted(airports.keys()):
        rec2025 = round_record_values(by_year[2025][iata])
        rec2026 = round_record_values(by_year[2026][iata])

        variaciones = {
            "pax_total_pct": pct_change(rec2026["pax_total"], rec2025["pax_total"]),
            "pax_comercial_pct": pct_change(rec2026["pax_comercial"], rec2025["pax_comercial"]),
            "pax_av_general_pct": pct_change(rec2026["pax_av_general"], rec2025["pax_av_general"]),
            "pax_cabotaje_pct": pct_change(rec2026["pax_cabotaje"], rec2025["pax_cabotaje"]),
            "pax_internacional_pct": pct_change(rec2026["pax_internacional"], rec2025["pax_internacional"]),
        }

        variaciones = {
            key: None if value is None else round(value, 1)
            for key, value in variaciones.items()
        }

        output["aeropuertos"][iata] = {
            "iata": iata,
            "aeropuerto": airports[iata],
            "2025": rec2025,
            "2026": rec2026,
            "variaciones": variaciones,
        }

        row = {
            "IATA": iata,
            "Aeropuerto": airports[iata],

            "PaxTotal_2025": rec2025["pax_total"],
            "PaxTotal_2026": rec2026["pax_total"],
            "VarPaxTotal_pct": variaciones["pax_total_pct"],

            "PaxComercial_2025": rec2025["pax_comercial"],
            "PaxComercial_2026": rec2026["pax_comercial"],
            "VarPaxComercial_pct": variaciones["pax_comercial_pct"],

            "PaxAvGeneral_2025": rec2025["pax_av_general"],
            "PaxAvGeneral_2026": rec2026["pax_av_general"],
            "VarPaxAvGeneral_pct": variaciones["pax_av_general_pct"],

            "PaxCabotaje_2025": rec2025["pax_cabotaje"],
            "PaxCabotaje_2026": rec2026["pax_cabotaje"],
            "VarPaxCabotaje_pct": variaciones["pax_cabotaje_pct"],

            "PaxInternacional_2025": rec2025["pax_internacional"],
            "PaxInternacional_2026": rec2026["pax_internacional"],
            "VarPaxInternacional_pct": variaciones["pax_internacional_pct"],

            "Registros_2025": rec2025["registros"],
            "Registros_2026": rec2026["registros"],
        }

        csv_rows.append(row)

    return output, csv_rows


def write_outputs(output, csv_rows):
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    OUT_JSON.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    fieldnames = list(csv_rows[0].keys())

    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_rows)

    print(f"OK JSON: {OUT_JSON}")
    print(f"OK CSV : {OUT_CSV}")


if __name__ == "__main__":
    output, csv_rows = build_output()
    write_outputs(output, csv_rows)
