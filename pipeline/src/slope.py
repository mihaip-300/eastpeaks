"""Run gradients from a DEM (HANDOFF 5.2 step 3).

The numeric functions here are pure (they take an elevation *sampler*), so they
can be tested on synthetic lines without a DEM.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import requests

from .config import COPERNICUS_BASE, DEM_CACHE, MAX_GRADIENT_WINDOW_M, SAMPLE_STEP_M, USER_AGENT, log

Sampler = Callable[[np.ndarray], np.ndarray]  # (n, 2) projected xy -> (n,) elevation


@dataclass(frozen=True)
class RunStats:
    length_m: float  # horizontal length
    drop_m: float  # top minus bottom, after orienting downhill
    avg_gradient_pct: float
    max_gradient_100m_pct: float
    top_m: float
    bottom_m: float
    suspect: tuple[str, ...]


def densify(xy: np.ndarray, step: float = SAMPLE_STEP_M) -> tuple[np.ndarray, np.ndarray]:
    """Resample a polyline every `step` metres (plus its last point).

    Returns (distance along the line, (n, 2) points).
    """
    seg = np.hypot(*np.diff(xy, axis=0).T)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    total = float(cum[-1])
    if total == 0:
        return np.array([0.0]), xy[:1].copy()
    dist = np.arange(0.0, total, step)
    if total - dist[-1] > 1e-9:
        dist = np.append(dist, total)
    x = np.interp(dist, cum, xy[:, 0])
    y = np.interp(dist, cum, xy[:, 1])
    return dist, np.column_stack([x, y])


def smooth3(z: np.ndarray) -> np.ndarray:
    """3-point moving average; the two end points are kept as they are."""
    if len(z) < 3:
        return z.astype(float).copy()
    out = z.astype(float).copy()
    out[1:-1] = (z[:-2] + z[1:-1] + z[2:]) / 3.0
    return out


def orient_downhill(dist: np.ndarray, z: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Reverse the profile if it was drawn bottom-up (OSM lines can go either way)."""
    if z[0] >= z[-1]:
        return dist, z
    return dist[-1] - dist[::-1], z[::-1]


def max_window_gradient(dist: np.ndarray, z: np.ndarray, window: float = MAX_GRADIENT_WINDOW_M) -> float:
    """Steepest descent (%) over any stretch of ~`window` metres.

    For runs shorter than the window, this is the average gradient of the whole run.
    """
    total = float(dist[-1])
    if total <= 0:
        return 0.0
    if total <= window:
        return (z[0] - z[-1]) / total * 100.0
    ends = np.searchsorted(dist, dist + window - 1e-9)
    valid = ends < len(dist)
    i = np.nonzero(valid)[0]
    j = ends[valid]
    grad = (z[i] - z[j]) / (dist[j] - dist[i]) * 100.0
    return float(grad.max()) if len(grad) else 0.0


def suspect_flags(length_m: float, drop_m: float, avg_pct: float, max_pct: float) -> tuple[str, ...]:
    flags = []
    if avg_pct > 100 or max_pct > 100:
        flags.append("gradient_over_100pct")
    if avg_pct < 2:
        flags.append("gradient_under_2pct")
    if drop_m < 5:
        flags.append("drop_under_5m")
    return tuple(flags)


def run_stats(xy: np.ndarray, sampler: Sampler, step: float = SAMPLE_STEP_M) -> RunStats:
    """Length, drop and gradients of a run given as projected (metric) coordinates."""
    dist, pts = densify(xy, step)
    z = smooth3(np.asarray(sampler(pts), dtype=float))
    dist, z = orient_downhill(dist, z)
    length = float(dist[-1])
    drop = float(z[0] - z[-1])
    avg = drop / length * 100.0 if length > 0 else 0.0
    mx = max(max_window_gradient(dist, z), avg)
    return RunStats(
        length_m=round(length, 1),
        drop_m=round(drop, 1),
        avg_gradient_pct=round(avg, 1),
        max_gradient_100m_pct=round(mx, 1),
        top_m=round(float(z.max()), 1),
        bottom_m=round(float(z.min()), 1),
        suspect=suspect_flags(length, drop, avg, mx),
    )


# --- Copernicus DEM ---------------------------------------------------------


def copernicus_tile_name(lat: int, lon: int) -> str:
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"Copernicus_DSM_COG_10_{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00_DEM"


def tiles_for_bbox(bbox: tuple[float, float, float, float]) -> list[str]:
    minx, miny, maxx, maxy = bbox
    return [
        copernicus_tile_name(lat, lon)
        for lat in range(math.floor(miny), math.floor(maxy) + 1)
        for lon in range(math.floor(minx), math.floor(maxx) + 1)
    ]


def fetch_dem_tiles(bbox: tuple[float, float, float, float]) -> list[Path]:
    DEM_CACHE.mkdir(parents=True, exist_ok=True)
    paths = []
    for name in tiles_for_bbox(bbox):
        dest = DEM_CACHE / f"{name}.tif"
        if not dest.exists():
            url = f"{COPERNICUS_BASE}/{name}/{name}.tif"
            log.info("Downloading DEM tile %s", name)
            with requests.get(url, headers={"User-Agent": USER_AGENT}, stream=True, timeout=120) as resp:
                resp.raise_for_status()
                tmp = dest.with_suffix(".part")
                with tmp.open("wb") as fh:
                    for chunk in resp.iter_content(1 << 20):
                        fh.write(chunk)
                tmp.replace(dest)
        paths.append(dest)
    return paths


class DemGrid:
    """A DEM window in lon/lat with bilinear sampling."""

    def __init__(self, data: np.ndarray, transform, nodata: float | None):
        self.data = data.astype("float64")
        if nodata is not None:
            self.data[self.data == nodata] = np.nan
        self.transform = transform

    @classmethod
    def for_bbox(cls, bbox: tuple[float, float, float, float], pad: float = 0.01) -> "DemGrid":
        import rasterio
        from rasterio.merge import merge

        minx, miny, maxx, maxy = bbox
        bounds = (minx - pad, miny - pad, maxx + pad, maxy + pad)
        srcs = [rasterio.open(p) for p in fetch_dem_tiles(bounds)]
        try:
            mosaic, transform = merge(srcs, bounds=bounds)
            nodata = srcs[0].nodata
        finally:
            for s in srcs:
                s.close()
        return cls(mosaic[0], transform, nodata)

    def sample_lonlat(self, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        inv = ~self.transform
        col, row = inv * (np.asarray(lon), np.asarray(lat))
        # Pixel centres sit at +0.5; shift so integer coordinates are centres.
        col = np.asarray(col) - 0.5
        row = np.asarray(row) - 0.5
        c0 = np.clip(np.floor(col).astype(int), 0, self.data.shape[1] - 2)
        r0 = np.clip(np.floor(row).astype(int), 0, self.data.shape[0] - 2)
        fc = np.clip(col - c0, 0, 1)
        fr = np.clip(row - r0, 0, 1)
        d = self.data
        top = d[r0, c0] * (1 - fc) + d[r0, c0 + 1] * fc
        bottom = d[r0 + 1, c0] * (1 - fc) + d[r0 + 1, c0 + 1] * fc
        return top * (1 - fr) + bottom * fr

    def sampler(self, to_lonlat) -> Sampler:
        """Build a projected-xy sampler, given a pyproj Transformer (projected -> lon/lat)."""

        def sample(pts: np.ndarray) -> np.ndarray:
            lon, lat = to_lonlat.transform(pts[:, 0], pts[:, 1])
            return self.sample_lonlat(lon, lat)

        return sample
