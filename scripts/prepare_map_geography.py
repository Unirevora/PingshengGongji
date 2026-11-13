"""Build the offline Natural Earth land and river layer, without dependencies.

Run: python scripts/prepare_map_geography.py
Missing source files are downloaded from the Natural Earth vector repository.
Coordinates use WGS84 longitude/latitude; no coastline simplification is applied.
"""

import json
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "source" / "maps"
ASSETS = ROOT / "assets"
BOUNDS = (69, 15, 139, 57)
BASE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
LAYERS = {
    "land": "ne_10m_land.geojson",
    "river": "ne_10m_rivers_lake_centerlines.geojson",
}


def ring_clip(ring):
    """Clip a closed ring against the regional rectangle; retain every vertex."""
    points = [list(point[:2]) for point in ring]
    if points and points[0] == points[-1]:
        points.pop()
    for axis, boundary, direction in ((0, 69, 1), (0, 139, -1), (1, 15, 1), (1, 57, -1)):
        if not points:
            break
        output = []
        previous = points[-1]
        previous_inside = direction * (previous[axis] - boundary) >= 0
        for current in points:
            current_inside = direction * (current[axis] - boundary) >= 0
            if current_inside != previous_inside:
                t = (boundary - previous[axis]) / (current[axis] - previous[axis])
                crossing = [previous[i] + t * (current[i] - previous[i]) for i in (0, 1)]
                crossing[axis] = boundary
                output.append(crossing)
            if current_inside:
                output.append(current)
            previous, previous_inside = current, current_inside
        points = output
    rounded = []
    for point in points:
        point = [round(value, 5) for value in point]
        if not rounded or point != rounded[-1]:
            rounded.append(point)
    if rounded and rounded[0] == rounded[-1]:
        rounded.pop()
    if len(rounded) < 3:
        return []
    return rounded + [rounded[0]]


def intersects(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return bool(xs) and max(xs) >= 69 and min(xs) <= 139 and max(ys) >= 15 and min(ys) <= 57


def polygon_clip(polygon):
    if not polygon or not intersects(polygon[0]):
        return []
    outer = ring_clip(polygon[0])
    if not outer:
        return []
    holes = [ring_clip(ring) for ring in polygon[1:] if intersects(ring)]
    return [outer] + [ring for ring in holes if ring]


def segment_clip(start, end):
    """Liang-Barsky line clipping, including interpolated boundary vertices."""
    dx, dy = end[0] - start[0], end[1] - start[1]
    lower, upper = 0.0, 1.0
    for p, q in ((-dx, start[0] - 69), (dx, 139 - start[0]), (-dy, start[1] - 15), (dy, 57 - start[1])):
        if p == 0:
            if q < 0:
                return None
            continue
        ratio = q / p
        if p < 0:
            lower = max(lower, ratio)
        else:
            upper = min(upper, ratio)
        if lower > upper:
            return None
    return [
        [round(start[0] + t * dx, 5), round(start[1] + t * dy, 5)]
        for t in (lower, upper)
    ]


def line_clip(line):
    parts, current = [], []
    for start, end in zip(line, line[1:]):
        segment = segment_clip(start, end)
        if segment is None or segment[0] == segment[1]:
            if len(current) > 1:
                parts.append(current)
            current = []
            continue
        if current and current[-1] == segment[0]:
            current.append(segment[1])
        else:
            if len(current) > 1:
                parts.append(current)
            current = segment
    if len(current) > 1:
        parts.append(current)
    return parts


def convert(feature, layer):
    geometry = feature.get("geometry") or {}
    kind, coordinates = geometry.get("type"), geometry.get("coordinates", [])
    if layer == "land":
        polygons = [coordinates] if kind == "Polygon" else coordinates if kind == "MultiPolygon" else []
        clipped = [polygon_clip(polygon) for polygon in polygons]
        clipped = [polygon for polygon in clipped if polygon]
        if not clipped:
            return None
        geometry = {"type": "MultiPolygon", "coordinates": clipped}
    else:
        lines = [coordinates] if kind == "LineString" else coordinates if kind == "MultiLineString" else []
        clipped = [part for line in lines for part in line_clip(line)]
        if not clipped:
            return None
        geometry = {"type": "MultiLineString", "coordinates": clipped}
    # Retain the source's cartographic rank and names for display decisions.
    properties = dict(feature.get("properties") or {})
    properties["layer"] = layer
    return {"type": "Feature", "properties": properties, "geometry": geometry}


def main():
    SOURCES.mkdir(parents=True, exist_ok=True)
    legacy_source = ASSETS / "ne_10m_land.source.geojson"
    land_source = SOURCES / LAYERS["land"]
    if legacy_source.exists() and not land_source.exists():
        legacy_source.rename(land_source)
    features = []
    for layer, filename in LAYERS.items():
        source = SOURCES / filename
        if not source.exists():
            with urlopen(BASE_URL + filename, timeout=120) as response:
                source.write_bytes(response.read())
        document = json.loads(source.read_text(encoding="utf-8"))
        for feature in document["features"]:
            converted = convert(feature, layer)
            if converted:
                features.append(converted)
    collection = {"type": "FeatureCollection", "features": features}
    (ASSETS / "map-geography.js").write_text(
        "/* Natural Earth 1:10m, public domain. See map-source.json. */\n"
        + "window.PSGJ_GEOGRAPHY="
        + json.dumps(collection, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    metadata = {
        "name": "Natural Earth 1:10m land and rivers + lake centerlines",
        "homepage": "https://www.naturalearthdata.com/",
        "repository": "https://github.com/nvkelso/natural-earth-vector",
        "license": "Public domain",
        "license_url": "https://www.naturalearthdata.com/about/terms-of-use/",
        "coordinate_system": "WGS84 longitude/latitude (EPSG:4326)",
        "bounds": list(BOUNDS),
        "coordinate_decimals": 5,
        "processing": "Rectangle clipping with original coastline vertices and polygon holes; no simplification.",
        "rebuild": "python scripts/prepare_map_geography.py",
        "sources": [
            {"layer": layer, "url": BASE_URL + filename, "local": "data/source/maps/" + filename}
            for layer, filename in LAYERS.items()
        ],
        "historical_note": "Physical geography is a modern reference layer; it does not represent Tang boundaries or historical river courses.",
    }
    (ASSETS / "map-source.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Wrote assets/map-geography.js and assets/map-source.json")


if __name__ == "__main__":
    main()
