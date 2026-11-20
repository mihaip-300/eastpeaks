"""Paths and constants shared by all pipeline steps."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

PIPELINE = Path(__file__).resolve().parents[1]
ROOT = PIPELINE.parent

CACHE = PIPELINE / "cache"
OSM_CACHE = CACHE / "openskimap"
SUBSET = CACHE / "subset"
DEM_CACHE = CACHE / "dem"

OUT = PIPELINE / "out"
WORK = OUT / "work"  # processed runs/lifts with stats, read by previews and qa
TILES_SRC = OUT / "tiles"

GENERATED = ROOT / "data" / "generated"
MAPS = ROOT / "public" / "maps"
PUBLIC_DATA = ROOT / "public" / "data"
EDITORIAL = ROOT / "src" / "content" / "statiuni"

OPENSKIMAP_BASE = "https://tiles.openskimap.org"
USER_AGENT = "eastpeaks-pipeline/0.1 (+https://eastpeaks.eu)"

# Copernicus GLO-30 on the public AWS bucket (eu-central-1, no account needed).
COPERNICUS_BASE = "https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com"
DEM_NAME = "Copernicus GLO-30"

SAMPLE_STEP_M = 10.0
MAX_GRADIENT_WINDOW_M = 100.0
MERGE_TOLERANCE_M = 15.0

DIFFICULTIES = ("novice", "easy", "intermediate", "advanced", "expert", "freeride", "unknown")

# European piste colours, keep in sync with CLAUDE.md, DESIGN.md and src/styles/tokens.css.
PISTE_COLORS = {
    "novice": "#2e9e44",
    "easy": "#2a6fdb",
    "intermediate": "#d63a3a",
    "advanced": "#111111",
    "expert": "#111111",
    "freeride": "#f08c00",
    "unknown": "#8a8a8a",
}
LIFT_COLOR = "#1a1a1a"

log = logging.getLogger("pipeline")


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")


@dataclass(frozen=True)
class Resort:
    slug: str
    name: str
    country: str
    skiarea_sources: tuple[str, ...]


def load_resorts(path: Path = PIPELINE / "resorts.yaml") -> list[Resort]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    resorts = []
    seen: set[str] = set()
    for item in data["resorts"]:
        slug = item["slug"]
        if slug in seen:
            raise ValueError(f"duplicate slug in resorts.yaml: {slug}")
        seen.add(slug)
        resorts.append(
            Resort(
                slug=slug,
                name=item["name"],
                country=item["country"],
                skiarea_sources=tuple(item["skiarea_sources"]),
            )
        )
    return resorts


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any, *, indent: int | None = 2) -> None:
    """Write UTF-8 JSON atomically (diacritics kept as-is, LF endings)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    text = json.dumps(data, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
    tmp.write_text(text + "\n", encoding="utf-8", newline="\n")
    tmp.replace(path)
