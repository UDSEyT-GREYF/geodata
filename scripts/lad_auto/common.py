from __future__ import annotations

import base64
import io
import json
import math
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import requests
import rasterio
from PIL import Image, ImageDraw
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from shapely.geometry import Point, shape

STAC_SEARCH = "https://data.inpe.br/bdc/stac/v1/search"
COLLECTION = "CB4A-WPM-PCA-FUSED-1"

def parse_first_number(value: str | None) -> float | None:
    import re
    m = re.search(r"(\d+(?:[.,]\d+)?)", str(value or ""))
    return float(m.group(1).replace(",", ".")) if m else None

def runway_heading(value: str | None) -> float | None:
    import re
    m = re.search(r"(\d{1,2})\s*/\s*(\d{1,2})", str(value or ""))
    return float(m.group(1)) * 10.0 if m else None

def bbox_around(lon: float, lat: float, radius_m: float) -> list[float]:
    dlat = radius_m / 111_320.0
    dlon = radius_m / max(1.0, 111_320.0 * math.cos(math.radians(lat)))
    return [lon - dlon, lat - dlat, lon + dlon, lat + dlat]

def query_scenes(lon: float, lat: float, radius_m: float = 1000, limit: int = 100,
                 retries: int = 4) -> list[dict[str, Any]]:
    params = {
        "collections": COLLECTION,
        "bbox": ",".join(map(str, bbox_around(lon, lat, radius_m))),
        "limit": limit,
    }
    last = None
    for attempt in range(retries):
        try:
            r = requests.get(STAC_SEARCH, params=params, timeout=60)
            r.raise_for_status()
            feats = r.json().get("features", [])
            feats.sort(key=lambda x: x.get("properties", {}).get("datetime", ""), reverse=True)
            return feats
        except Exception as exc:
            last = exc
            time.sleep(2 ** attempt)
    raise RuntimeError(f"No fue posible consultar INPE STAC: {last}")

def asset_href(item: dict[str, Any]) -> str | None:
    assets = item.get("assets", {})
    for key in ("tci", "visual", "image", "data"):
        href = assets.get(key, {}).get("href")
        if href:
            return href
    for v in assets.values():
        href = v.get("href")
        if href and (href.lower().endswith(".tif") or href.lower().endswith(".tiff")):
            return href
    return None

@dataclass
class CropResult:
    image: Image.Image
    valid_fraction: float
    item_id: str
    item_datetime: str
    asset_url: str
    half_size_m: float

def _normalize_rgb(arr: np.ndarray) -> np.ndarray:
    if arr.dtype == np.uint8:
        return arr
    out = np.zeros_like(arr, dtype=np.uint8)
    for b in range(min(3, arr.shape[0])):
        x = arr[b].astype(np.float32)
        valid = np.isfinite(x)
        if not np.any(valid):
            continue
        lo, hi = np.percentile(x[valid], [2, 98])
        if hi <= lo:
            hi = lo + 1
        out[b] = np.clip((x - lo) * 255 / (hi - lo), 0, 255).astype(np.uint8)
    return out

def crop_from_item(item: dict[str, Any], lon: float, lat: float, half_size_m: float,
                   out_size: int = 1536) -> CropResult:
    href = asset_href(item)
    if not href:
        raise RuntimeError("La escena no contiene un activo raster utilizable.")

    with rasterio.Env(
        GDAL_HTTP_MULTIRANGE="YES",
        GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff",
    ):
        with rasterio.open(href) as ds:
            transformer = Transformer.from_crs("EPSG:4326", ds.crs, always_xy=True)
            x, y = transformer.transform(lon, lat)

            bounds = (
                x - half_size_m,
                y - half_size_m,
                x + half_size_m,
                y + half_size_m,
            )
            window = from_bounds(*bounds, transform=ds.transform)

            count = min(3, ds.count)
            indexes = list(range(1, count + 1))
            arr = ds.read(
                indexes,
                window=window,
                out_shape=(count, out_size, out_size),
                boundless=True,
                fill_value=0,
                resampling=Resampling.bilinear,
            )

            if count == 1:
                arr = np.repeat(arr, 3, axis=0)
            elif count == 2:
                arr = np.concatenate([arr, arr[1:2]], axis=0)

            rgb = _normalize_rgb(arr[:3])
            valid = np.any(rgb > 0, axis=0)
            valid_fraction = float(valid.mean())

            img = Image.fromarray(np.moveaxis(rgb, 0, -1), mode="RGB")
            props = item.get("properties", {})
            return CropResult(
                image=img,
                valid_fraction=valid_fraction,
                item_id=item.get("id", ""),
                item_datetime=props.get("datetime", "") or props.get("start_datetime", ""),
                asset_url=href,
                half_size_m=half_size_m,
            )

def choose_crop(scenes: Iterable[dict[str, Any]], lon: float, lat: float,
                half_size_m: float, out_size: int = 1536,
                min_valid: float = 0.55, max_scenes: int = 8) -> CropResult | None:
    best = None
    for item in list(scenes)[:max_scenes]:
        try:
            crop = crop_from_item(item, lon, lat, half_size_m, out_size)
        except Exception:
            continue
        if best is None or crop.valid_fraction > best.valid_fraction:
            best = crop
        if crop.valid_fraction >= min_valid:
            return crop
    return best

def draw_reference(image: Image.Image, rec: dict[str, Any], half_size_m: float) -> Image.Image:
    img = image.copy()
    draw = ImageDraw.Draw(img)
    w, h = img.size
    cx, cy = w / 2, h / 2

    # Cruz: coordenada fuente
    red = (232, 93, 63)
    white = (255, 255, 255)
    yellow = (255, 210, 63)
    draw.line((cx - 22, cy, cx + 22, cy), fill=white, width=6)
    draw.line((cx, cy - 22, cx, cy + 22), fill=white, width=6)
    draw.line((cx - 20, cy, cx + 20, cy), fill=red, width=3)
    draw.line((cx, cy - 20, cx, cy + 20), fill=red, width=3)

    typ = str(rec.get("Tipo", "LAD")).upper()
    dim = parse_first_number(rec.get("Dimensiones"))
    heading = runway_heading(rec.get("RWY"))

    if typ == "LADH":
        diameter_m = dim or 20.0
        radius_px = max(7, diameter_m / (2 * half_size_m) * w / 2)
        draw.ellipse(
            (cx-radius_px, cy-radius_px, cx+radius_px, cy+radius_px),
            outline=yellow, width=4
        )
    elif heading is not None and dim:
        length_px = dim / (2 * half_size_m) * w
        theta = math.radians(heading)
        dx = math.sin(theta) * length_px / 2
        dy = -math.cos(theta) * length_px / 2
        draw.line((cx-dx, cy-dy, cx+dx, cy+dy), fill=yellow, width=4)

    return img

def to_data_url(image: Image.Image, quality: int = 90) -> str:
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=quality, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

def detail_half_size(rec: dict[str, Any]) -> float:
    typ = str(rec.get("Tipo", "")).upper()
    length = parse_first_number(rec.get("Dimensiones")) or 0
    if typ == "LADH":
        return 350.0
    return max(900.0, min(2500.0, length * 1.05 if length else 1200.0))

def context_half_size(rec: dict[str, Any]) -> float:
    typ = str(rec.get("Tipo", "")).upper()
    length = parse_first_number(rec.get("Dimensiones")) or 0
    if typ == "LADH":
        return 2500.0
    return max(3500.0, min(6000.0, length * 3.0 if length else 4500.0))

def province_check(rec: dict[str, Any], province_features: list[dict[str, Any]]) -> dict[str, str]:
    pt = Point(float(rec["lon_fuente"]), float(rec["lat_fuente"]))
    hit = None
    for f in province_features:
        try:
            if shape(f["geometry"]).contains(pt) or shape(f["geometry"]).touches(pt):
                hit = f
                break
        except Exception:
            continue

    if not hit:
        return {
            "dentro_argentina": "NO",
            "dentro_provincia": "NO",
            "provincia_geometrica": "",
        }

    p = hit.get("properties", {})
    name = (
        p.get("nombre") or p.get("NOMBRE") or p.get("provincia")
        or p.get("Provincia") or p.get("name") or p.get("NAME_1") or ""
    )

    def norm(s: str) -> str:
        import unicodedata
        s = unicodedata.normalize("NFD", str(s or ""))
        return "".join(c for c in s if unicodedata.category(c) != "Mn").upper().strip()

    return {
        "dentro_argentina": "SI",
        "dentro_provincia": "SI" if norm(name) == norm(rec.get("Provincia", "")) else "NO",
        "provincia_geometrica": name,
    }
