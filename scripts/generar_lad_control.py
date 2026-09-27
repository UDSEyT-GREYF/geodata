#!/usr/bin/env python3
"""
Genera/actualiza el catálogo LAD y el CSV de control por Registro.

Uso:
  python scripts/generar_lad_control.py --kml "AD y LAD Argentina v5.kml"

Si no se pasa --kml, intenta descargar el KML original de Google My Maps.
Al regenerar el CSV conserva los campos de revisión existentes por Registro.
"""
from pathlib import Path
import argparse, csv, json, re, urllib.request
import xml.etree.ElementTree as ET
from html import unescape

KML_URL="https://www.google.com/maps/d/kml?mid=13BCxH0lhQw9sGNiQKtAdVoavn7y21EC9&forcekml=1"
NS={"k":"http://www.opengis.net/kml/2.2"}

def clean(s): return re.sub(r"\s+"," ",str(s or "").replace("\xa0"," ")).strip()
def lines(html):
    html=re.sub(r"<br\s*/?>","\n",str(html or ""),flags=re.I)
    html=re.sub(r"<[^>]+>","",html)
    return [clean(unescape(x)) for x in html.splitlines() if clean(unescape(x))]
def identity(name):
    m=re.match(r"^(LAD(?:/LADH|H|A)?)\s+(\d+)\s*-\s*(.+)$",clean(name),re.I)
    return (m.group(1).upper(),int(m.group(2)),clean(m.group(3))) if m else ("LAD",None,clean(name))
def desc(html):
    out={"FIR":"","Provincia":"","Coordenadas":"","RWY":"","Elevacion":"","Dimensiones":"","Superficie":"","Ubicacion":""}
    pats={"FIR":r"^FIR:\s*(.+)$","Provincia":r"^PROVINCIA:\s*(.+)$","Coordenadas":r"^COORDENADAS:\s*(.+)$",
          "RWY":r"^RWY:\s*(.+)$","Elevacion":r"^Elevaci[oó]n:\s*(.+)$","Dimensiones":r"^Dimensiones:\s*(.+)$",
          "Superficie":r"^Superficie:\s*(.+)$","Ubicacion":r"^Ubicaci[oó]n:\s*(.+)$"}
    ls=lines(html)
    for x in ls:
        for k,p in pats.items():
            m=re.match(p,x,re.I)
            if m: out[k]=clean(m.group(1))
    return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--kml");ap.add_argument("--root",default=".")
    a=ap.parse_args();root=Path(a.root)
    data_dir=root/"data"/"lad-control";data_dir.mkdir(parents=True,exist_ok=True)
    if a.kml: kml=Path(a.kml).read_bytes()
    else:
        with urllib.request.urlopen(KML_URL,timeout=60) as r:kml=r.read()
    doc=ET.fromstring(kml);folder=None
    for f in doc.findall(".//k:Folder",NS):
        if clean(f.findtext("k:name",default="",namespaces=NS)).upper()=="LAD":folder=f;break
    if folder is None: raise RuntimeError("No se encontró la carpeta LAD.")
    rows=[]
    for pm in folder.findall("k:Placemark",NS):
        tipo,reg,den=identity(pm.findtext("k:name",default="",namespaces=NS))
        c=clean(pm.findtext(".//k:Point/k:coordinates",default="",namespaces=NS)).split(",")
        if len(c)<2: continue
        d=desc(pm.findtext("k:description",default="",namespaces=NS))
        criterio=("Verificar que el punto coincida con el centro del helipuerto o área de aterrizaje." if tipo=="LADH"
                  else "Verificar la posición respecto de la pista y del helipuerto declarados." if tipo=="LAD/LADH"
                  else "Verificar que el punto coincida aproximadamente con el centro/eje de la pista declarada.")
        rows.append({"Registro":reg,"Tipo":tipo,"Denominacion":den,**d,"lat_fuente":float(c[1]),"lon_fuente":float(c[0]),"criterio_visual":criterio})
    rows.sort(key=lambda x:x["Registro"] or 999999)
    (data_dir/"lad_catalogo.json").write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf-8")

    fields=["Registro","Tipo","Denominacion","Provincia","FIR","RWY","Dimensiones","Superficie","Elevacion","Ubicacion","lat_fuente","lon_fuente","criterio_visual","dentro_argentina","dentro_provincia","provincia_geometrica","estado_revision","motivo_revision","observacion","lat_corregida","lon_corregida","desplazamiento_m","fecha_revision"]
    old={}
    csvp=data_dir/"lad_control_posicion.csv"
    if csvp.exists():
        with csvp.open(encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                if r.get("Registro"): old[str(r["Registro"])]=r
    with csvp.open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for r in rows:
            out={k:r.get(k,"") for k in fields}
            prev=old.get(str(r["Registro"]),{})
            for k in fields[13:]:
                if prev.get(k,"")!="": out[k]=prev[k]
            w.writerow(out)
    print(f"{len(rows)} LAD procesados.")

if __name__=="__main__": main()
