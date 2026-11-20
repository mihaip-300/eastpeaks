"""Cinematic hero images rendered from the Copernicus DEM (DESIGN.md, "Imagery").

Until real photographs exist, each resort's hero is its own terrain: an oblique
blue-hour view of the mountains around it, in the brand palette (navy shadows,
ivory snow, a low warm light catching the ridges in gold).

Writes public/heroes/{slug}-{width}.{avif,webp} (2400 / 1600 / 960 px wide, 16:9)
and data/generated/heroes.json (sizes + a tiny blur-up placeholder).
"""

from __future__ import annotations

import base64
import io
import math
from dataclasses import dataclass

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LightSource, LinearSegmentedColormap
from PIL import Image, ImageFilter

from .config import GENERATED, ROOT, WORK, load_resorts, log, read_json, setup_logging, write_json
from .slope import DemGrid

OUT_DIR = ROOT / "public" / "heroes"
WIDTHS = (2400, 1600, 960)
RENDER_W, RENDER_H = 2400, 1350


@dataclass(frozen=True)
class View:
    """Camera per resort: terrain window around the resort and where we look from."""

    pad_lon: float  # degrees added west/east of the resort bbox
    pad_lat_near: float  # degrees on the camera side (north)
    pad_lat_far: float  # degrees behind the resort (south: the higher peaks)
    azim: float  # matplotlib azimuth: 90 = camera in the north looking south
    elev: float  # camera elevation angle, degrees
    zoom: float  # >1 crops in on the terrain
    snowline: float  # metres where the colour ramp turns to snow


VIEWS = {
    "poiana-brasov": View(pad_lon=0.16, pad_lat_near=0.05, pad_lat_far=0.13, azim=100, elev=11, zoom=2.35, snowline=1450),
    "bansko": View(pad_lon=0.16, pad_lat_near=0.04, pad_lat_far=0.16, azim=95, elev=12, zoom=2.3, snowline=1900),
}
DEFAULT_VIEW = View(0.16, 0.05, 0.13, 90, 12, 2.3, 1600)
SUPERSAMPLE = 2.4  # render large: the terrain is cropped out of the frame and scaled to full width
PEAK_LINE = 0.30  # highest ridge sits this far down the frame; sky above
SIDE_TRIM = 0.05  # trim the 3D box's vertical sides off the terrain crop

# Navy shadows -> slate -> cold snow -> ivory highlights.
TERRAIN = LinearSegmentedColormap.from_list(
    "eastpeaks",
    [(0.0, "#05080f"), (0.35, "#0b1320"), (0.6, "#2a3445"), (0.78, "#7d8796"), (0.9, "#d9dde3"), (1.0, "#f4efe6")],
)


def smooth(z: np.ndarray, passes: int = 1) -> np.ndarray:
    """3x3 box blur, repeated (approximates a small Gaussian), edges padded."""
    for _ in range(passes):
        p = np.pad(z, 1, mode="edge")
        z = sum(p[1 + dy : p.shape[0] - 1 + dy, 1 + dx : p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9.0
    return z


def sky(w: int, h: int) -> Image.Image:
    """Vertical blue-hour gradient: near-black top, midnight, a faint warm horizon."""
    y = np.linspace(0, 1, h)[:, None]
    stops = [(0.0, (8, 9, 12)), (0.45, (11, 19, 32)), (0.72, (24, 33, 50)), (0.86, (58, 54, 60)), (1.0, (88, 72, 62))]
    rgb = np.zeros((h, 1, 3))
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        m = (y >= p0) & (y <= p1)
        t = np.where(m, (y - p0) / (p1 - p0), 0)
        for k in range(3):
            rgb[..., k] += np.where(m, c0[k] + (c1[k] - c0[k]) * t, 0)
    return Image.fromarray(np.repeat(rgb, w, axis=1).astype(np.uint8), "RGB")


def render(slug: str, bbox: list[float]) -> Image.Image:
    v = VIEWS.get(slug, DEFAULT_VIEW)
    minx, miny, maxx, maxy = bbox
    window = (minx - v.pad_lon, miny - v.pad_lat_far, maxx + v.pad_lon, maxy + v.pad_lat_near)
    dem = DemGrid.for_bbox(window, pad=0.0)
    z = np.nan_to_num(dem.data, nan=float(np.nanmin(dem.data)))

    # Light smoothing hides the 30 m grid; ~1100 cells across stays sharp once cropped.
    z = smooth(z, passes=2)
    step = max(1, int(round(z.shape[1] / 1100)))
    z = z[::step, ::step]
    rows, cols = z.shape
    lat0 = (window[1] + window[3]) / 2
    xs = np.linspace(0, (window[2] - window[0]) * 111_320 * math.cos(math.radians(lat0)), cols)
    ys = np.linspace((window[3] - window[1]) * 110_540, 0, rows)  # row 0 is north
    X, Y = np.meshgrid(xs, ys)

    # Colour by elevation (snow above the snowline), shaded by a low warm western light.
    lo, hi = float(z.min()), float(z.max())
    t = np.clip((z - lo) / max(1.0, v.snowline - lo) * 0.78, 0, 0.78)
    t = np.where(z > v.snowline, 0.78 + np.clip((z - v.snowline) / max(1.0, hi - v.snowline), 0, 1) * 0.22, t)
    base = TERRAIN(t)
    ls = LightSource(azdeg=255, altdeg=22)
    shade = ls.hillshade(z, vert_exag=1.6, dx=float(xs[1] - xs[0]), dy=float(ys[0] - ys[1]))
    rgb = base[..., :3] * (0.25 + 0.95 * shade[..., None])
    # Gold rim where the low sun hits steep west-facing slopes.
    rim = np.clip((shade - 0.72) / 0.28, 0, 1)[..., None] ** 2
    gold = np.array([0.776, 0.651, 0.404])
    rgb = rgb * (1 - 0.55 * rim) + gold * 0.55 * rim
    colors = np.clip(np.dstack([rgb, np.ones((rows, cols))]), 0, 1)

    rw, rh = int(RENDER_W * SUPERSAMPLE), int(RENDER_H * SUPERSAMPLE)
    fig = plt.figure(figsize=(rw / 100, rh / 100), dpi=100)
    fig.patch.set_alpha(0)
    ax = fig.add_axes((0, 0, 1, 1), projection="3d")
    ax.set_axis_off()
    ax.patch.set_alpha(0)
    ax.set_proj_type("persp", focal_length=0.42)
    ax.plot_surface(X, Y, z, facecolors=colors, rstride=1, cstride=1, linewidth=0, antialiased=False, shade=False)
    # zoom > 1 pushes the box edges outside the frame, so only terrain and sky show.
    ax.set_box_aspect((xs[-1], ys[0], (hi - lo) * 1.7), zoom=v.zoom)
    ax.view_init(elev=v.elev, azim=v.azim)
    ax.set_zlim(lo, hi)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, transparent=True)
    plt.close(fig)
    raw = Image.open(io.BytesIO(buf.getvalue())).convert("RGBA")
    # Crop to the terrain, trim the box sides, then fill the frame width with it.
    left, top, right, bottom = raw.getbbox()
    trim = int((right - left) * SIDE_TRIM)
    raw = raw.crop((left + trim, top, right - trim, bottom))
    scale = RENDER_W / raw.width
    raw = raw.resize((RENDER_W, round(raw.height * scale)), Image.Resampling.LANCZOS)
    terrain = Image.new("RGBA", (RENDER_W, RENDER_H), (0, 0, 0, 0))
    terrain.alpha_composite(raw.crop((0, 0, RENDER_W, min(raw.height, RENDER_H - int(RENDER_H * PEAK_LINE)))), (0, int(RENDER_H * PEAK_LINE)))

    canvas = sky(RENDER_W, RENDER_H).convert("RGBA")
    # Soft atmospheric glow behind the ridgeline.
    glow = terrain.split()[3].filter(ImageFilter.GaussianBlur(60))
    haze = Image.new("RGBA", canvas.size, (120, 104, 86, 0))
    haze.putalpha(glow.point(lambda a: int(a * 0.22)))
    canvas = Image.alpha_composite(canvas, haze)
    canvas = Image.alpha_composite(canvas, terrain)

    # Vignette + darker bottom third so white headlines always read.
    w, h = canvas.size
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h * 0.45) / (h / 2)) ** 2)
    dark = np.clip((r - 0.7) * 0.55, 0, 0.55) + np.clip((yy / h - 0.55) / 0.45, 0, 1) ** 1.6 * 0.6
    shade_layer = Image.fromarray((np.clip(dark, 0, 0.85) * 255).astype(np.uint8), "L")
    black = Image.new("RGBA", canvas.size, (10, 10, 10, 255))
    black.putalpha(shade_layer)
    canvas = Image.alpha_composite(canvas, black)
    # A whisper of grain keeps large gradients from banding.
    noise = (np.random.default_rng(7).normal(0, 3.2, (h, w, 1)) * np.ones((1, 1, 3))).astype(np.int16)
    arr = np.clip(np.asarray(canvas.convert("RGB")).astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def lqip(img: Image.Image) -> str:
    small = img.resize((32, 18), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    small.save(out, format="WEBP", quality=50)
    return "data:image/webp;base64," + base64.b64encode(out.getvalue()).decode()


def main() -> None:
    setup_logging()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for resort in load_resorts():
        path = WORK / f"{resort.slug}.json"
        if not path.exists():
            log.warning("%s: no processed data, run `make process` first", resort.slug)
            continue
        img = render(resort.slug, read_json(path)["bbox"])
        for w in WIDTHS:
            h = round(w * RENDER_H / RENDER_W)
            sized = img if w == RENDER_W else img.resize((w, h), Image.Resampling.LANCZOS)
            sized.save(OUT_DIR / f"{resort.slug}-{w}.avif", format="AVIF", quality=58, speed=4)
            sized.save(OUT_DIR / f"{resort.slug}-{w}.webp", format="WEBP", quality=80, method=6)
        manifest[resort.slug] = {
            "widths": list(WIDTHS),
            "width": RENDER_W,
            "height": RENDER_H,
            "lqip": lqip(img),
            "credit": "Relief randat din Copernicus DEM GLO-30",
        }
        sizes = {w: (OUT_DIR / f"{resort.slug}-{w}.avif").stat().st_size // 1024 for w in WIDTHS}
        log.info("%s: hero rendered, AVIF KB by width %s", resort.slug, sizes)
    write_json(GENERATED / "heroes.json", manifest)


if __name__ == "__main__":
    main()
