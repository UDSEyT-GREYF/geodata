from __future__ import annotations

import argparse
import csv
import json
import os
import tempfile
from datetime import date
from pathlib import Path

from openai import OpenAI

from common import (
    choose_crop,
    context_half_size,
    detail_half_size,
    draw_reference,
    province_check,
    query_scenes,
    to_data_url,
)

FIELDS = [
    "Registro","Tipo","Denominacion","Provincia","RWY","Dimensiones","Superficie",
    "lat_fuente","lon_fuente",
    "dentro_argentina","dentro_provincia","provincia_geometrica",
    "auto_estado","auto_confianza","auto_prioridad",
    "auto_instalacion_visible","auto_centro_coincide",
    "auto_orientacion_compatible","auto_dimension_compatible",
    "auto_tipo_detectado","auto_observacion",
    "auto_imagen_fuente","auto_imagen_id","auto_imagen_fecha",
    "auto_modelo","auto_fecha_revision"
]

SCHEMA = {
    "type": "object",
    "properties": {
        "estado": {"type":"string","enum":["compatible","revisar","no_evaluable"]},
        "confianza": {"type":"number","minimum":0,"maximum":1},
        "prioridad": {"type":"string","enum":["alta","media","baja"]},
        "instalacion_visible": {"type":"string","enum":["si","no","dudosa"]},
        "centro_coincide": {"type":"string","enum":["si","no","dudoso","no_aplica"]},
        "orientacion_compatible": {"type":"string","enum":["si","no","dudosa","no_aplica"]},
        "dimension_compatible": {"type":"string","enum":["si","no","dudosa","no_aplica"]},
        "tipo_detectado": {"type":"string"},
        "observacion": {"type":"string"},
    },
    "required": [
        "estado","confianza","prioridad","instalacion_visible","centro_coincide",
        "orientacion_compatible","dimension_compatible","tipo_detectado","observacion"
    ],
    "additionalProperties": False,
}

def load_existing(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8-sig") as f:
        return {str(r["Registro"]): r for r in csv.DictReader(f) if r.get("Registro")}

def save_rows(path: Path, catalog: list[dict], rows: dict[str, dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    order = {str(r["Registro"]): i for i,r in enumerate(catalog)}
    vals = sorted(rows.values(), key=lambda r: order.get(str(r.get("Registro","")), 999999))
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(vals)

def prompt_for(rec: dict, geo: dict) -> str:
    return f"""
Se realiza un control de calidad de la POSICIÓN de un Lugar Apto Declarado (LAD).
Las imágenes son recortes ortorrectificados CBERS-4A/WPM RGB, con norte hacia arriba.
La cruz ROJA marca la coordenada fuente. La geometría AMARILLA es sólo una guía
construida a partir de los datos declarados y NO es evidencia de que exista una pista.

Datos declarados:
- Registro: {rec.get('Registro')}
- Tipo: {rec.get('Tipo')}
- Denominación: {rec.get('Denominacion')}
- Provincia: {rec.get('Provincia')}
- RWY: {rec.get('RWY')}
- Dimensiones: {rec.get('Dimensiones')}
- Superficie: {rec.get('Superficie')}
- Ubicación descriptiva: {rec.get('Ubicacion')}
- Control territorial: dentro de Argentina={geo.get('dentro_argentina')};
  dentro de provincia declarada={geo.get('dentro_provincia')};
  provincia geométrica={geo.get('provincia_geometrica')}

Se proporcionan dos imágenes: una de CONTEXTO y otra de DETALLE.
Para LAD: buscar una franja de aterrizaje real, incluso de tierra o césped, razonablemente
recta y compatible con orientación y dimensiones declaradas.
Para LADH: buscar helipuerto o área de aterrizaje; no exigir una pista lineal.

Clasificación conservadora:
- compatible: hay evidencia visual clara de instalación compatible y la coordenada fuente
  cae aproximadamente en su centro/eje.
- revisar: el candidato está desplazado, no aparece instalación compatible, orientación o
  dimensiones no concuerdan, o el control territorial indica anomalía.
- no_evaluable: nubes, sombras, baja calidad, resolución insuficiente u otra limitación
  impiden una conclusión razonable.

No inventar una instalación. Si la evidencia es ambigua, usar revisar o no_evaluable.
La observación debe explicar brevemente qué se ve y por qué se asignó la clasificación.
"""

def analyze(client: OpenAI, model: str, rec: dict, geo: dict, context_img, detail_img) -> dict:
    response = client.responses.create(
        model=model,
        store=False,
        input=[{
            "role":"user",
            "content":[
                {"type":"input_text","text":prompt_for(rec, geo)},
                {"type":"input_image","image_url":to_data_url(context_img),"detail":"high"},
                {"type":"input_image","image_url":to_data_url(detail_img),"detail":"original"},
            ],
        }],
        text={
            "format":{
                "type":"json_schema",
                "name":"revision_lad",
                "strict":True,
                "schema":SCHEMA,
            }
        },
    )
    return json.loads(response.output_text)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", default="data/lad-control/lad_catalogo.json")
    ap.add_argument("--provinces", default="fuentes/provincias.geojson")
    ap.add_argument("--output", default="data/lad-control/lad_revision_automatica.csv")
    ap.add_argument("--registro", type=int)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only-pending", action="store_true")
    ap.add_argument("--model", default="gpt-5.4-mini")
    args = ap.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("Falta OPENAI_API_KEY.")

    catalog_all = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    provinces = json.loads(Path(args.provinces).read_text(encoding="utf-8")).get("features", [])
    output = Path(args.output)
    existing = load_existing(output)

    catalog = catalog_all
    if args.registro:
        catalog = [r for r in catalog if int(r.get("Registro",-1)) == args.registro]
    if args.only_pending:
        catalog = [r for r in catalog if str(r.get("Registro")) not in existing]
    if args.limit:
        catalog = catalog[:args.limit]

    client = OpenAI()

    for i, rec in enumerate(catalog, 1):
        key = str(rec["Registro"])
        geo = province_check(rec, provinces)

        row = {
            "Registro":rec["Registro"],"Tipo":rec.get("Tipo",""),
            "Denominacion":rec.get("Denominacion",""),"Provincia":rec.get("Provincia",""),
            "RWY":rec.get("RWY",""),"Dimensiones":rec.get("Dimensiones",""),
            "Superficie":rec.get("Superficie",""),"lat_fuente":rec["lat_fuente"],
            "lon_fuente":rec["lon_fuente"],**geo,
            "auto_modelo":args.model,"auto_fecha_revision":date.today().isoformat(),
        }

        # Anomalía territorial fuerte: ya es caso de revisión aunque igualmente se intenta
        # obtener imagen para aportar evidencia visual adicional.
        try:
            scenes = query_scenes(float(rec["lon_fuente"]), float(rec["lat_fuente"]), radius_m=1500)
            if not scenes:
                row.update({
                    "auto_estado":"no_evaluable","auto_confianza":"1",
                    "auto_prioridad":"alta" if geo["dentro_argentina"]=="NO" else "media",
                    "auto_instalacion_visible":"dudosa","auto_centro_coincide":"no_aplica",
                    "auto_orientacion_compatible":"no_aplica","auto_dimension_compatible":"no_aplica",
                    "auto_tipo_detectado":"","auto_observacion":"No se encontró cobertura CBERS-4A/WPM en la consulta STAC.",
                    "auto_imagen_fuente":"INPE CBERS-4A/WPM",
                })
                existing[key] = row
                save_rows(output, catalog_all, existing)
                print(f"[{i}/{len(catalog)}] {key}: sin cobertura")
                continue

            context = choose_crop(scenes, float(rec["lon_fuente"]), float(rec["lat_fuente"]),
                                  context_half_size(rec), out_size=1536)
            detail = choose_crop(scenes, float(rec["lon_fuente"]), float(rec["lat_fuente"]),
                                 detail_half_size(rec), out_size=1536)

            if not context or not detail or min(context.valid_fraction, detail.valid_fraction) < 0.25:
                row.update({
                    "auto_estado":"no_evaluable","auto_confianza":"1","auto_prioridad":"media",
                    "auto_instalacion_visible":"dudosa","auto_centro_coincide":"no_aplica",
                    "auto_orientacion_compatible":"no_aplica","auto_dimension_compatible":"no_aplica",
                    "auto_tipo_detectado":"","auto_observacion":"La escena disponible no cubre suficientemente el recorte solicitado.",
                    "auto_imagen_fuente":"INPE CBERS-4A/WPM",
                    "auto_imagen_id":(detail or context).item_id if (detail or context) else "",
                    "auto_imagen_fecha":(detail or context).item_datetime if (detail or context) else "",
                })
            else:
                context_annotated = draw_reference(context.image, rec, context.half_size_m)
                detail_annotated = draw_reference(detail.image, rec, detail.half_size_m)
                result = analyze(client, args.model, rec, geo, context_annotated, detail_annotated)

                # El control territorial prevalece: una coordenada fuera del país/provincia
                # nunca se etiqueta automáticamente como compatible.
                if geo["dentro_argentina"]=="NO":
                    result["estado"]="revisar"
                    result["prioridad"]="alta"
                    result["observacion"]="Anomalía territorial: coordenada fuera de Argentina. " + result["observacion"]
                elif geo["dentro_provincia"]=="NO" and result["estado"]=="compatible":
                    result["estado"]="revisar"
                    result["prioridad"]="alta"
                    result["observacion"]="Anomalía territorial: coordenada fuera de la provincia declarada. " + result["observacion"]

                row.update({
                    "auto_estado":result["estado"],
                    "auto_confianza":f"{float(result['confianza']):.3f}",
                    "auto_prioridad":result["prioridad"],
                    "auto_instalacion_visible":result["instalacion_visible"],
                    "auto_centro_coincide":result["centro_coincide"],
                    "auto_orientacion_compatible":result["orientacion_compatible"],
                    "auto_dimension_compatible":result["dimension_compatible"],
                    "auto_tipo_detectado":result["tipo_detectado"],
                    "auto_observacion":result["observacion"],
                    "auto_imagen_fuente":"INPE CBERS-4A/WPM · CC BY 4.0",
                    "auto_imagen_id":detail.item_id,
                    "auto_imagen_fecha":detail.item_datetime,
                })

        except Exception as exc:
            row.update({
                "auto_estado":"no_evaluable","auto_confianza":"0",
                "auto_prioridad":"media","auto_instalacion_visible":"dudosa",
                "auto_centro_coincide":"no_aplica","auto_orientacion_compatible":"no_aplica",
                "auto_dimension_compatible":"no_aplica","auto_tipo_detectado":"",
                "auto_observacion":f"Error de procesamiento: {exc}",
                "auto_imagen_fuente":"INPE CBERS-4A/WPM",
            })

        existing[key] = row
        save_rows(output, catalog_all, existing)
        print(f"[{i}/{len(catalog)}] Registro {key}: {row.get('auto_estado')} / {row.get('auto_prioridad')}")

if __name__ == "__main__":
    main()
