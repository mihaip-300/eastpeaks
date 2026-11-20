"""out/tiles/*.geojson -> out/pistes-YYYYMMDD.pmtiles with tippecanoe (HANDOFF 5.2 step 5).

The date in the file name is the OSM data date, so the name only changes when the
data does; the new name then goes into PUBLIC_PMTILES_URL.
"""

from __future__ import annotations

import subprocess

from .config import OUT, TILES_SRC, log, read_json, setup_logging

LAYERS = ("areas", "runs", "lifts", "lift_stations")


def main() -> None:
    setup_logging()
    stamp = read_json(TILES_SRC / "version.json")["osm_data_timestamp"][:10].replace("-", "")
    target = OUT / f"pistes-{stamp}.pmtiles"
    cmd = [
        "tippecanoe",
        "-o", str(target),
        "--force",
        "--quiet",
        "-Z9", "-z15",
        "--no-feature-limit",
        "--no-tile-size-limit",
        "--name", "eastpeaks pistes",
        "--attribution", "© OpenStreetMap contributors, OpenSkiMap.org",
    ]
    for layer in LAYERS:
        cmd += ["-L", f"{layer}:{TILES_SRC / f'{layer}.geojson'}"]
    log.info("Running tippecanoe -> %s", target.name)
    subprocess.run(cmd, check=True)
    (OUT / "latest_pmtiles.txt").write_text(target.name + "\n", encoding="utf-8", newline="\n")
    log.info("%s: %.2f MB", target.name, target.stat().st_size / 1e6)


if __name__ == "__main__":
    main()
