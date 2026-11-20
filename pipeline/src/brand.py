"""Brand assets: EastPeaks wordmark, symbol and favicons (DESIGN.md, brand board).

The wordmark is set in Playfair Display (the self-hosted display face) and
converted to outlines, so the SVGs render the same everywhere without fonts.
The "a" in "Peaks" is replaced by the peak: a gold triangle with an ivory snow cap.

Writes to public/: logo.svg (gold, dark backgrounds), logo-reversed.svg (ivory letters, over
photos), logo-light.svg (midnight letters, ivory backgrounds), symbol.svg, favicon.svg,
favicon-16.png, favicon-32.png, apple-touch-icon.png (180), icon-512.png,
site.webmanifest.
"""

from __future__ import annotations

import json
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw

from .config import ROOT, log, setup_logging

PUBLIC = ROOT / "public"
FONT = ROOT / "node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2"

GOLD = "#C6A667"
GOLD_LIGHT = "#DCC390"
GOLD_DARK = "#A88A52"
IVORY = "#F4EFE6"
MIDNIGHT = "#0B1320"

WEIGHT = 420  # Playfair wght axis: 400-900; the board shows a light, high-contrast cut
TRACKING = 4  # font units added between letters
PEAK_GAP = 22  # extra side bearing around the peak, font units


def peak_shapes(left: float, baseline: float, width: float, height: float) -> tuple[list, list]:
    """Mountain triangle and its snow cap, as point lists in SVG coordinates (y down)."""
    apex = (left + width / 2, baseline - height)
    triangle = [apex, (left + width, baseline), (left, baseline)]
    # Snow cap: the top ~34 % of the triangle with a two-tooth lower edge.
    t = 0.34
    yc = baseline - height * (1 - t)
    half = width / 2 * t
    cx = apex[0]
    cap = [
        apex,
        (cx + half, yc),
        (cx + half * 0.45, yc - height * 0.035),
        (cx + half * 0.05, yc + height * 0.055),
        (cx - half * 0.4, yc - height * 0.02),
        (cx - half, yc),
    ]
    return triangle, cap


def poly(points: list, fill: str, stroke: str | None = None, stroke_width: float = 0) -> str:
    d = " ".join(f"{'M' if i == 0 else 'L'}{x:.2f} {y:.2f}" for i, (x, y) in enumerate(points)) + " Z"
    s = f' stroke="{stroke}" stroke-width="{stroke_width:.1f}" stroke-linejoin="round"' if stroke else ""
    return f'<path d="{d}" fill="{fill}"{s}/>'


def wordmark(font: TTFont) -> tuple[list[str], float, float, dict]:
    """Glyph paths for 'EastPe' + peak + 'ks'; returns (paths, width, height, peak geometry)."""
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    os2 = font["OS/2"]
    cap_h = os2.sCapHeight
    descent = 0  # no descenders in "EastPeaks"
    top_pad = 40
    baseline = cap_h + top_pad

    paths: list[str] = []
    x = 0.0
    peak = {}
    for ch in "EastPe|ks":
        if ch == "|":
            x += PEAK_GAP
            width = cap_h * 0.86
            peak = {"left": x, "baseline": baseline, "width": width, "height": cap_h * 1.02}
            x += width + PEAK_GAP + TRACKING
            continue
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, baseline)))
        paths.append(pen.getCommands())
        x += hmtx[name][0] + TRACKING
    return paths, x - TRACKING, baseline + descent + 10, peak


def logo_svg(paths: list[str], width: float, height: float, peak: dict, *, variant: str) -> str:
    """variant: gold (dark backgrounds), reversed (ivory letters), light (midnight letters on ivory)."""
    reversed_ = variant != "gold"
    letters = {"gold": "url(#gold)", "reversed": IVORY, "light": MIDNIGHT}[variant]
    tri, cap = peak_shapes(peak["left"], peak["baseline"], peak["width"], peak["height"])
    defs = (
        ""
        if reversed_
        else f'<defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{GOLD_LIGHT}"/><stop offset=".55" stop-color="{GOLD}"/>'
        f'<stop offset="1" stop-color="{GOLD_DARK}"/></linearGradient></defs>'
    )
    peak_fill = GOLD if reversed_ else "url(#gold)"
    # On ivory the snow cap would vanish into the background: give it a gold-dark hairline.
    cap_svg = poly(cap, IVORY, GOLD_DARK, 9) if variant == "light" else poly(cap, IVORY)
    body = "".join(f'<path d="{d}"/>' for d in paths)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" role="img" aria-label="EastPeaks">'
        f"{defs}<g fill=\"{letters}\">{body}</g>{poly(tri, peak_fill)}{cap_svg}</svg>\n"
    )


def symbol_svg(size: int = 512, *, tile: bool = True) -> str:
    w = size * 0.56
    h = w * 0.86
    left = (size - w) / 2
    baseline = size / 2 + h / 2 + size * 0.01
    tri, cap = peak_shapes(left, baseline, w, h)
    bg = f'<rect width="{size}" height="{size}" rx="{size * 0.22:.0f}" fill="{MIDNIGHT}"/>' if tile else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="EastPeaks">'
        f"{bg}{poly(tri, GOLD)}{poly(cap, IVORY)}</svg>\n"
    )


def symbol_png(size: int, path: Path, *, radius: float = 0.22) -> None:
    """Rasterise the symbol with 8x supersampling (no SVG renderer needed)."""
    s = size * 8
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * radius), fill=MIDNIGHT)
    w = s * 0.56
    h = w * 0.86
    left = (s - w) / 2
    baseline = s / 2 + h / 2 + s * 0.01
    tri, cap = peak_shapes(left, baseline, w, h)
    d.polygon(tri, fill=GOLD)
    d.polygon(cap, fill=IVORY)
    img.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)


def main() -> None:
    setup_logging()
    font = instancer.instantiateVariableFont(TTFont(FONT), {"wght": WEIGHT})
    paths, width, height, peak = wordmark(font)

    for variant, name in (("gold", "logo.svg"), ("reversed", "logo-reversed.svg"), ("light", "logo-light.svg")):
        (PUBLIC / name).write_text(logo_svg(paths, width, height, peak, variant=variant), encoding="utf-8", newline="\n")
    (PUBLIC / "symbol.svg").write_text(symbol_svg(), encoding="utf-8", newline="\n")
    (PUBLIC / "favicon.svg").write_text(symbol_svg(), encoding="utf-8", newline="\n")
    for size, name in ((16, "favicon-16.png"), (32, "favicon-32.png"), (180, "apple-touch-icon.png"), (512, "icon-512.png")):
        # iOS rounds the corners itself, so the touch icon is a full square.
        symbol_png(size, PUBLIC / name, radius=0 if size == 180 else 0.22)
    manifest = {
        "name": "EastPeaks",
        "short_name": "EastPeaks",
        "icons": [{"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"}],
        "theme_color": MIDNIGHT,
        "background_color": "#0A0A0A",
        "display": "browser",
    }
    (PUBLIC / "site.webmanifest").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    log.info("Brand assets written to public/ (logo %0.f x %0.f units)", width, height)


if __name__ == "__main__":
    main()
