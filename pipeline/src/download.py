"""Download OpenSkiMap GeoJSON and cut out the features of the resorts in resorts.yaml.

OpenSkiMap terms: automated downloads at most once a day. The raw files are kept
gzip-compressed in the cache volume and re-downloaded only when a newer build
exists *and* the cached copy is older than 24 hours (or with --force).

Output (cache/subset/):
  ski_areas.geojson  matched ski areas, with a `resort` property
  runs.geojson       runs belonging to those ski areas, with `resorts`
  lifts.geojson      lifts belonging to those ski areas, with `resorts`
  meta.json          OpenSkiMap build metadata + slug -> current ski area ids
"""

from __future__ import annotations

import argparse
import gzip
import json
import time
from pathlib import Path

import requests

from .config import OPENSKIMAP_BASE, OSM_CACHE, SUBSET, USER_AGENT, load_resorts, log, read_json, setup_logging, write_json

LAYERS = ("ski_areas", "runs", "lifts")
ONE_DAY_S = 24 * 3600


def _get(url: str, **kwargs) -> requests.Response:
    resp = requests.get(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"}, timeout=120, **kwargs)
    resp.raise_for_status()
    return resp


def fetch_raw(force: bool = False) -> dict:
    """Download the three layers if needed; return the build metadata in use."""
    OSM_CACHE.mkdir(parents=True, exist_ok=True)
    meta_path = OSM_CACHE / "metadata.json"
    remote = _get(f"{OPENSKIMAP_BASE}/metadata.json").json()

    have_all = all((OSM_CACHE / f"{name}.geojson.gz").exists() for name in LAYERS)
    if have_all and meta_path.exists() and not force:
        cached = read_json(meta_path)
        age = time.time() - meta_path.stat().st_mtime
        if cached["run"]["finishedAt"] == remote["run"]["finishedAt"]:
            log.info("OpenSkiMap cache is current (build %s)", cached["run"]["finishedAt"])
            return cached
        if age < ONE_DAY_S:
            log.info("Newer OpenSkiMap build exists, but cache is < 24 h old; keeping build %s", cached["run"]["finishedAt"])
            return cached

    for name in LAYERS:
        dest = OSM_CACHE / f"{name}.geojson.gz"
        tmp = dest.with_suffix(".gz.part")
        url = f"{OPENSKIMAP_BASE}/geojson/{name}.geojson"
        log.info("Downloading %s", url)
        with _get(url, stream=True) as resp:
            if resp.headers.get("Content-Encoding") != "gzip":
                raise RuntimeError(f"expected a gzip response for {url}")
            with tmp.open("wb") as fh:
                # Keep the bytes compressed on disk; we stream-decompress when reading.
                for chunk in resp.raw.stream(1 << 20, decode_content=False):
                    fh.write(chunk)
        tmp.replace(dest)
        log.info("  %s: %.1f MB compressed", dest.name, dest.stat().st_size / 1e6)

    write_json(meta_path, remote)
    return remote


def iter_features(path: Path):
    """Yield features from an OpenSkiMap GeoJSON file (one feature per line)."""
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip().rstrip(",")
            if line.startswith('{"type":"Feature"'):
                yield line


def source_keys(props: dict) -> set[str]:
    return {f"{s['type']}:{s['id']}" for s in props.get("sources") or []}


def match_ski_areas(resorts) -> tuple[list[dict], dict[str, list[str]]]:
    wanted = {src: r.slug for r in resorts for src in r.skiarea_sources}
    matched: list[dict] = []
    ids_by_slug: dict[str, list[str]] = {r.slug: [] for r in resorts}
    with gzip.open(OSM_CACHE / "ski_areas.geojson.gz", "rt", encoding="utf-8") as fh:
        collection = json.load(fh)
    for feature in collection["features"]:
        props = feature["properties"]
        hits = source_keys(props) & wanted.keys()
        for src in hits:
            slug = wanted[src]
            ids_by_slug[slug].append(props["id"])
            feature["properties"] = {**props, "resort": slug}
            matched.append(feature)
    for slug, ids in ids_by_slug.items():
        if not ids:
            log.warning("No OpenSkiMap ski area found for %s (check skiarea_sources)", slug)
    return matched, ids_by_slug


def subset_layer(name: str, area_to_slug: dict[str, str]) -> list[dict]:
    out = []
    needles = tuple(area_to_slug)
    for line in iter_features(OSM_CACHE / f"{name}.geojson.gz"):
        # Cheap substring filter before parsing: only ~1 line in 1000 is relevant.
        if not any(n in line for n in needles):
            continue
        feature = json.loads(line)
        area_ids = {sa["properties"]["id"] for sa in feature["properties"].get("skiAreas") or []}
        slugs = sorted({area_to_slug[i] for i in area_ids if i in area_to_slug})
        if slugs:
            feature["properties"]["resorts"] = slugs
            out.append(feature)
    return out


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="download even if the cache is current")
    args = parser.parse_args()

    resorts = load_resorts()
    meta = fetch_raw(force=args.force)

    areas, ids_by_slug = match_ski_areas(resorts)
    area_to_slug = {i: slug for slug, ids in ids_by_slug.items() for i in ids}
    SUBSET.mkdir(parents=True, exist_ok=True)
    write_json(SUBSET / "ski_areas.geojson", {"type": "FeatureCollection", "features": areas}, indent=None)
    for layer in ("runs", "lifts"):
        features = subset_layer(layer, area_to_slug)
        write_json(SUBSET / f"{layer}.geojson", {"type": "FeatureCollection", "features": features}, indent=None)
        log.info("Subset %s: %d features", layer, len(features))
    write_json(
        SUBSET / "meta.json",
        {
            "openskimap_build": meta["run"]["finishedAt"],
            "osm_data_timestamp": meta["source"]["openStreetMap"]["dataTimestamp"],
            "skiarea_ids": ids_by_slug,
        },
    )


if __name__ == "__main__":
    main()
