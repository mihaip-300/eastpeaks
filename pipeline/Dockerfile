# Pipeline image: Python 3.12 + GDAL (via rasterio wheels) + tippecanoe.
# Build and run through compose.yaml: `npm run pipeline -- make all`.

FROM python:3.12-slim-bookworm AS tippecanoe
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential git ca-certificates libsqlite3-dev zlib1g-dev \
 && rm -rf /var/lib/apt/lists/*
ARG TIPPECANOE_VERSION=2.79.0
RUN git clone --depth 1 --branch "${TIPPECANOE_VERSION}" https://github.com/felt/tippecanoe.git /src/tippecanoe \
 && make -C /src/tippecanoe -j"$(nproc)" \
 && make -C /src/tippecanoe install

FROM python:3.12-slim-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends make libsqlite3-0 zlib1g libexpat1 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=tippecanoe /usr/local/bin/tippecanoe /usr/local/bin/tile-join /usr/local/bin/tippecanoe-decode /usr/local/bin/
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MPLBACKEND=Agg
WORKDIR /work/pipeline
