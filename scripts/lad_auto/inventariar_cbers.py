from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from common import asset_href, query_scenes

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", default="data/lad-control/lad_catalogo.json")
    ap.add_argument("--output", default="data/lad-control/lad_cobertura_imagenes.csv")
    ap.add_argument("--registro", type=int)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    catalog = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    if args.registro:
        catalog = [r for r in catalog if int(r.get("Registro", -1)) == args.registro]
    if args.limit:
        catalog = catalog[:args.limit]

    fields = [
        "Registro","Tipo","Denominacion","Provincia","lat_fuente","lon_fuente",
        "cobertura_cbers","cantidad_escenas","ultima_escena_id","ultima_escena_fecha",
        "asset_tci"
    ]
    out = []
    for i, rec in enumerate(catalog, 1):
        lon, lat = float(rec["lon_fuente"]), float(rec["lat_fuente"])
        try:
            scenes = query_scenes(lon, lat, radius_m=1000)
            latest = scenes[0] if scenes else None
            out.append({
                "Registro": rec["Registro"],
                "Tipo": rec.get("Tipo",""),
                "Denominacion": rec.get("Denominacion",""),
                "Provincia": rec.get("Provincia",""),
                "lat_fuente": lat,
                "lon_fuente": lon,
                "cobertura_cbers": "SI" if latest else "NO",
                "cantidad_escenas": len(scenes),
                "ultima_escena_id": latest.get("id","") if latest else "",
                "ultima_escena_fecha": latest.get("properties",{}).get("datetime","") if latest else "",
                "asset_tci": asset_href(latest) if latest else "",
            })
        except Exception as exc:
            out.append({
                "Registro": rec["Registro"], "Tipo": rec.get("Tipo",""),
                "Denominacion": rec.get("Denominacion",""), "Provincia": rec.get("Provincia",""),
                "lat_fuente": lat, "lon_fuente": lon, "cobertura_cbers": "ERROR",
                "cantidad_escenas": 0, "ultima_escena_id": "",
                "ultima_escena_fecha": "", "asset_tci": str(exc),
            })
        print(f"[{i}/{len(catalog)}] Registro {rec['Registro']}: {out[-1]['cobertura_cbers']}")

    p = Path(args.output)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(out)

if __name__ == "__main__":
    main()
