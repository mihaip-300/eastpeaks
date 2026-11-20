"""clean -> slope -> export for every resort in resorts.yaml.

Reads cache/subset/ (from `make download`), writes:
  out/work/{slug}.geojson   runs and lifts with stats (for previews and qa)
  data/generated/{slug}.json, data/generated/index.json
  out/tiles/*.geojson       inputs for tippecanoe
  public/data/pistes.geojson  derived database, offered under ODbL
"""

from __future__ import annotations

from dataclasses import asdict

import numpy as np
from pyproj import CRS, Transformer
from pyproj.aoi import AreaOfInterest
from pyproj.database import query_utm_crs_info

from . import export
from .clean import Segment, is_active, merge_runs, normalize_difficulty
from .config import SUBSET, WORK, load_resorts, log, read_json, setup_logging, write_json
from .slope import DemGrid, run_stats
from .translit import to_latin


def utm_crs(lon: float, lat: float) -> CRS:
    info = query_utm_crs_info(datum_name="WGS 84", area_of_interest=AreaOfInterest(lon, lat, lon, lat))
    return CRS.from_epsg(info[0].code)


def line_parts(geometry: dict) -> list[list[list[float]]]:
    if geometry["type"] == "LineString":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiLineString":
        return geometry["coordinates"]
    return []


def bbox_of(features: list[dict]) -> tuple[float, float, float, float]:
    pts = [c for f in features for part in line_parts(f["geometry"]) for c in part]
    arr = np.array([p[:2] for p in pts])
    return (float(arr[:, 0].min()), float(arr[:, 1].min()), float(arr[:, 0].max()), float(arr[:, 1].max()))


def to_segments(features: list[dict], slug: str, country: str, fwd: Transformer) -> tuple[list[Segment], dict]:
    segs, skipped = [], {"not_downhill": 0, "inactive": 0, "not_line": 0}
    for f in features:
        p = f["properties"]
        if "downhill" not in (p.get("uses") or []):
            skipped["not_downhill"] += 1
            continue
        if not is_active(p):
            skipped["inactive"] += 1
            continue
        parts = line_parts(f["geometry"])
        if not parts:
            skipped["not_line"] += 1
            continue
        for part in parts:
            arr = np.asarray(part, dtype=float)
            if len(arr) < 2:
                continue
            x, y = fwd.transform(arr[:, 0], arr[:, 1])
            z = arr[:, 2] if arr.shape[1] > 2 else None
            segs.append(
                Segment(
                    ids=[p["id"]],
                    name=to_latin(p.get("name") or None, country),
                    difficulty=normalize_difficulty(p.get("difficulty")),
                    resort=slug,
                    xy=np.column_stack([x, y]),
                    z=z,
                    props={
                        "osm_sources": [s["id"] for s in p.get("sources") or [] if s.get("type") == "openstreetmap"],
                        "name_local": p.get("name") or None,
                    },
                )
            )
    return segs, skipped


def osm_avg_gradient(seg: Segment, length_m: float) -> float | None:
    """Average gradient from OpenSkiMap's own elevations, as a cross-check."""
    if seg.z is None or length_m <= 0:
        return None
    return round(abs(float(seg.z[0] - seg.z[-1])) / length_m * 100.0, 1)


def process_resort(resort, areas, runs, lifts) -> dict | None:
    r_areas = [a for a in areas if a["properties"]["resort"] == resort.slug]
    r_runs = [f for f in runs if resort.slug in f["properties"]["resorts"]]
    r_lifts = [f for f in lifts if resort.slug in f["properties"]["resorts"]]
    if not r_areas or not r_runs:
        log.warning("%s: no ski area or no runs in the subset, skipping", resort.slug)
        return None

    bbox = bbox_of(r_runs + r_lifts)
    center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
    crs = utm_crs(*center)
    fwd = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    inv = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)

    segments, skipped = to_segments(r_runs, resort.slug, resort.country, fwd)
    merged = merge_runs(segments)
    log.info("%s: %d run segments -> %d runs after merging (%s), UTM %s", resort.slug, len(segments), len(merged), skipped, crs.to_epsg())

    dem = DemGrid.for_bbox(bbox)
    sample = dem.sampler(inv)

    run_features = []
    for seg in merged:
        stats = run_stats(seg.xy, sample)
        lon, lat = inv.transform(seg.xy[:, 0], seg.xy[:, 1])
        run_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": np.round(np.column_stack([lon, lat]), 6).tolist()},
                "properties": {
                    "id": seg.ids[0],
                    "segment_ids": seg.ids,
                    "osm_sources": sorted({s for s in seg.props.get("osm_sources", [])}),
                    "name": seg.name,
                    "name_local": seg.props.get("name_local"),
                    "difficulty": seg.difficulty,
                    "resort": resort.slug,
                    **{k: v for k, v in asdict(stats).items() if k != "suspect"},
                    "suspect": list(stats.suspect),
                    "osm_avg_gradient_pct": osm_avg_gradient(seg, stats.length_m),
                },
            }
        )

    lift_features = []
    for f in r_lifts:
        p = f["properties"]
        if not is_active(p) or f["geometry"]["type"] != "LineString":
            continue
        arr = np.asarray(f["geometry"]["coordinates"], dtype=float)
        x, y = fwd.transform(arr[:, 0], arr[:, 1])
        xy = np.column_stack([x, y])
        ends_z = sample(xy[[0, -1]])
        lift_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": np.round(arr[:, :2], 6).tolist()},
                "properties": {
                    "id": p["id"],
                    "name": to_latin(p.get("name") or None, resort.country),
                    "name_local": p.get("name") or None,
                    "lift_type": p.get("liftType") or "unknown",
                    "resort": resort.slug,
                    "length_m": round(float(np.hypot(*np.diff(xy, axis=0).T).sum()), 1),
                    "bottom_m": round(float(np.nanmin(ends_z)), 1),
                    "top_m": round(float(np.nanmax(ends_z)), 1),
                },
            }
        )

    work = {
        "resort": asdict(resort),
        "bbox": [round(v, 6) for v in bbox],
        "center": [round(v, 6) for v in center],
        "utm_epsg": crs.to_epsg(),
        "skiarea_ids": [a["properties"]["id"] for a in r_areas],
        "skipped": skipped,
        "segments_in": len(segments),
        "areas": r_areas,
        "runs": run_features,
        "lifts": lift_features,
    }
    write_json(WORK / f"{resort.slug}.json", work, indent=None)
    return work


def main() -> None:
    setup_logging()
    meta = read_json(SUBSET / "meta.json")
    areas = read_json(SUBSET / "ski_areas.geojson")["features"]
    runs = read_json(SUBSET / "runs.geojson")["features"]
    lifts = read_json(SUBSET / "lifts.geojson")["features"]

    works = []
    for resort in load_resorts():
        work = process_resort(resort, areas, runs, lifts)
        if work:
            works.append(work)
    export.export_all(works, meta)


if __name__ == "__main__":
    main()
