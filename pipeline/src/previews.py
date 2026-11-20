"""Static map preview per resort: public/maps/{slug}.webp, 800x500 (HANDOFF 5.2 step 6).

Hillshade from the DEM, runs in piste colours, lifts in black. Shown on the page
until the interactive map is opened.
"""

from __future__ import annotations

import io
import math

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LightSource
from PIL import Image

from .config import LIFT_COLOR, MAPS, PISTE_COLORS, WORK, load_resorts, log, read_json, setup_logging
from .slope import DemGrid

WIDTH, HEIGHT, DPI = 800, 500, 100
# Draw order: easy runs first, so steeper (darker) runs stay visible on top.
ORDER = ("unknown", "novice", "easy", "intermediate", "freeride", "advanced", "expert")


def framed_bbox(bbox: list[float], pad_frac: float = 0.08) -> tuple[float, float, float, float]:
    """Pad the bbox and stretch it to the 8:5 output ratio (in ground distance)."""
    minx, miny, maxx, maxy = bbox
    kx = math.cos(math.radians((miny + maxy) / 2))  # degrees of lon are shorter
    w, h = (maxx - minx) * kx, maxy - miny
    w, h = w * (1 + 2 * pad_frac), h * (1 + 2 * pad_frac)
    target = WIDTH / HEIGHT
    if w / h < target:
        w = h * target
    else:
        h = w / target
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    return (cx - w / kx / 2, cy - h / 2, cx + w / kx / 2, cy + h / 2)


def render(work: dict) -> bytes:
    minx, miny, maxx, maxy = framed_bbox(work["bbox"])
    dem = DemGrid.for_bbox((minx, miny, maxx, maxy), pad=0.0)
    z = np.nan_to_num(dem.data, nan=float(np.nanmin(dem.data)))
    lat_mid = (miny + maxy) / 2
    dx = abs(dem.transform.a) * 111_320 * math.cos(math.radians(lat_mid))
    dy = abs(dem.transform.e) * 110_540
    shade = LightSource(azdeg=315, altdeg=40).hillshade(z, vert_exag=1.5, dx=dx, dy=dy)

    fig = plt.figure(figsize=(WIDTH / DPI, HEIGHT / DPI), dpi=DPI)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_axis_off()
    left, top = dem.transform.c, dem.transform.f
    right = left + dem.transform.a * z.shape[1]
    bottom = top + dem.transform.e * z.shape[0]
    ax.imshow(shade, cmap="gray", vmin=0, vmax=1, extent=(left, right, bottom, top), alpha=0.55, interpolation="bilinear")
    ax.set_facecolor("#ffffff")

    runs = sorted(work["runs"], key=lambda f: ORDER.index(f["properties"]["difficulty"]))
    for f in runs:
        p = f["properties"]
        xy = np.asarray(f["geometry"]["coordinates"])
        width = 2.6 if p["difficulty"] == "expert" else 2.0
        style = (0, (2, 1.5)) if p["difficulty"] == "freeride" else "solid"
        ax.plot(xy[:, 0], xy[:, 1], color=PISTE_COLORS[p["difficulty"]], lw=width, ls=style, solid_capstyle="round")
    for f in work["lifts"]:
        xy = np.asarray(f["geometry"]["coordinates"])
        ax.plot(xy[:, 0], xy[:, 1], color=LIFT_COLOR, lw=1.0)
        ax.plot(xy[[0, -1], 0], xy[[0, -1], 1], "o", color=LIFT_COLOR, ms=2.5)

    ax.set_xlim(minx, maxx)
    ax.set_ylim(miny, maxy)
    ax.set_aspect(1 / math.cos(math.radians(lat_mid)))
    ax.text(
        0.995, 0.01, "© OpenStreetMap contributors · Copernicus DEM",
        transform=ax.transAxes, ha="right", va="bottom", fontsize=7, color="#333333",
        bbox={"facecolor": "white", "alpha": 0.7, "edgecolor": "none", "pad": 1.5},
    )

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=DPI)
    plt.close(fig)
    img = Image.open(io.BytesIO(buf.getvalue())).convert("RGB")
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=80, method=6)
    return out.getvalue()


def main() -> None:
    setup_logging()
    MAPS.mkdir(parents=True, exist_ok=True)
    for resort in load_resorts():
        path = WORK / f"{resort.slug}.json"
        if not path.exists():
            log.warning("%s: no processed data, run `make process` first", resort.slug)
            continue
        data = render(read_json(path))
        (MAPS / f"{resort.slug}.webp").write_bytes(data)
        log.info("%s: preview %d KB", resort.slug, len(data) // 1024)


if __name__ == "__main__":
    main()
