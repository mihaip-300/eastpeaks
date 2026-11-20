# Runs inside the pipeline container (see compose.yaml):
#   npm run pipeline -- make all
PY := python -m

.PHONY: all download process tiles previews qa test

all: download process tiles previews qa

download:   ## OpenSkiMap GeoJSON (max once a day) + subset for resorts.yaml
	$(PY) src.download

process:    ## clean, slope, export -> data/generated/, out/tiles/
	$(PY) src.process

tiles:      ## out/tiles/*.geojson -> out/pistes-YYYYMMDD.pmtiles
	$(PY) src.tiles

previews:   ## public/maps/{slug}.webp
	$(PY) src.previews

qa:         ## out/qa_report.md
	$(PY) src.qa

test:
	pytest -q
