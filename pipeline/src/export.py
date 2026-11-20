"""Write data/generated/, the tippecanoe inputs and the ODbL download (HANDOFF 4.1, 5.2 step 4)."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

from .config import DEM_NAME, DIFFICULTIES, GENERATED, PUBLIC_DATA, TILES_SRC, write_json

STEEPEST_MIN_LENGTH_M = 150
STEEPEST_COUNT = 5


def _fc(features: list[dict], **extra) -> dict:
    return {"type": "FeatureCollection", **extra, "features": features}


def resort_summary(work: dict, meta: dict, generated_at: str) -> dict:
    resort = work["resort"]
    runs = [f["properties"] for f in work["runs"]]
    lifts = [f["properties"] for f in work["lifts"]]

    km_by = {d: 0.0 for d in DIFFICULTIES}
    for r in runs:
        km_by[r["difficulty"]] += r["length_m"] / 1000
    km_by = {d: round(v, 1) for d, v in km_by.items()}

    tops = [r["top_m"] for r in runs] + [lf["top_m"] for lf in lifts]
    bottoms = [r["bottom_m"] for r in runs] + [lf["bottom_m"] for lf in lifts]

    candidates = [r for r in runs if r["length_m"] >= STEEPEST_MIN_LENGTH_M and not r["suspect"]]
    candidates.sort(key=lambda r: r["max_gradient_100m_pct"], reverse=True)
    steepest = [
        {
            "id": r["id"],
            "name": r["name"],
            "name_local": r["name_local"] if r["name_local"] != r["name"] else None,
            "difficulty": r["difficulty"],
            "length_m": round(r["length_m"]),
            "drop_m": round(r["drop_m"]),
            "avg_gradient_pct": r["avg_gradient_pct"],
            "max_gradient_100m_pct": r["max_gradient_100m_pct"],
        }
        for r in candidates[:STEEPEST_COUNT]
    ]

    return {
        "slug": resort["slug"],
        "skiarea_sources": list(resort["skiarea_sources"]),
        "openskimap_ids": work["skiarea_ids"],
        "name": resort["name"],
        "country": resort["country"],
        "center": [round(v, 5) for v in work["center"]],
        "bbox": [round(v, 5) for v in work["bbox"]],
        "elevation_m": {"min": round(min(bottoms)), "max": round(max(tops))},
        "runs": {
            "count": len(runs),
            "km_total": round(sum(r["length_m"] for r in runs) / 1000, 1),
            "km_by_difficulty": km_by,
        },
        "lifts": {
            "count": len(lifts),
            "by_type": dict(sorted(Counter(lf["lift_type"] for lf in lifts).items())),
        },
        "steepest_runs": steepest,
        "forest_share": None,
        "generated_at": generated_at,
        "sources": {
            "openskimap_date": meta["osm_data_timestamp"],
            "openskimap_build": meta["openskimap_build"],
            "dem": DEM_NAME,
        },
    }


def tile_layers(works: list[dict]) -> dict[str, list[dict]]:
    runs, lifts, stations, areas = [], [], [], []
    for w in works:
        for f in w["runs"]:
            p = f["properties"]
            runs.append(
                {
                    "type": "Feature",
                    "geometry": f["geometry"],
                    "properties": {
                        "id": p["id"],
                        "name": p["name"],
                        "difficulty": p["difficulty"],
                        "length_m": round(p["length_m"]),
                        "drop_m": round(p["drop_m"]),
                        "avg_pct": p["avg_gradient_pct"],
                        "max_pct": p["max_gradient_100m_pct"],
                        "resort": p["resort"],
                    },
                }
            )
        for f in w["lifts"]:
            p = f["properties"]
            props = {"id": p["id"], "name": p["name"], "lift_type": p["lift_type"], "resort": p["resort"]}
            lifts.append({"type": "Feature", "geometry": f["geometry"], "properties": props})
            coords = f["geometry"]["coordinates"]
            for end in (coords[0], coords[-1]):
                stations.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": end}, "properties": props})
        for a in w["areas"]:
            if a["geometry"]["type"] in ("Polygon", "MultiPolygon"):
                areas.append(
                    {
                        "type": "Feature",
                        "geometry": a["geometry"],
                        "properties": {"name": a["properties"].get("name"), "resort": a["properties"]["resort"]},
                    }
                )
    return {"runs": runs, "lifts": lifts, "lift_stations": stations, "areas": areas}


def export_all(works: list[dict], meta: dict) -> None:
    generated_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    index = []
    for w in sorted(works, key=lambda w: w["resort"]["slug"]):
        summary = resort_summary(w, meta, generated_at)
        write_json(GENERATED / f"{summary['slug']}.json", summary)
        index.append(
            {
                "slug": summary["slug"],
                "name": summary["name"],
                "country": summary["country"],
                "center": summary["center"],
                "elevation_m": summary["elevation_m"],
                "km_total": summary["runs"]["km_total"],
                "runs_count": summary["runs"]["count"],
                "lifts_count": summary["lifts"]["count"],
            }
        )
    write_json(GENERATED / "index.json", {"generated_at": generated_at, "resorts": index})

    layers = tile_layers(works)
    for name, features in layers.items():
        write_json(TILES_SRC / f"{name}.geojson", _fc(features), indent=None)
    write_json(TILES_SRC / "version.json", {"osm_data_timestamp": meta["osm_data_timestamp"]})

    # Derived database (merged runs + stats), offered under ODbL (HANDOFF 5.4).
    write_json(
        PUBLIC_DATA / "pistes.geojson",
        _fc(
            layers["runs"] + layers["lifts"],
            license="ODbL-1.0",
            attribution="© OpenStreetMap contributors (ODbL); OpenSkiMap.org; slopes computed from Copernicus DEM GLO-30",
            source_date=meta["osm_data_timestamp"],
        ),
        indent=None,
    )
