# Terrain DEM Fetcher

A simple Node.js tool that:

1. Fetches a Mapbox Terrain-RGB tile at a specified lon/lat corner and zoom.
2. Decodes the RGB values to true elevation.
3. Outputs a Float32 GeoTIFF (`terrain_dem.tif`).

---

## ⚙️ Installation

1. Clone or download this repo.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure [GDAL](https://gdal.org) is installed on your system.

---

## 🔧 Configuration

Create a `.env` file in the project root with:

```dotenv
MAPBOX_TOKEN=your_mapbox_access_token
ZOOM=15
TILE_SIZE=512
LATITUDE=45.12       # top-left corner latitude of the desired tile
LONGITUDE=13.81      # top-left corner longitude of the desired tile
```

- **MAPBOX_TOKEN** – your Mapbox API token.
- **ZOOM** – zoom level (e.g. `15`).
- **TILE_SIZE** – pixel dimension of the tile (usually `512` for `@2x`).
- **LATITUDE**, **LONGITUDE** – the WGS84 coordinates of the tile’s top-left corner.

---

## 🚀 Usage

```bash
node main.js
```

What happens:

1. Converts `LATITUDE`/`LONGITUDE` → Web Mercator meters → pixel X/Y → tile X/Y (using the built-in formulas).
2. Fetches the Terrain-RGB PNG:
   ```
   https://api.mapbox.com/v4/mapbox.terrain-rgb/${ZOOM}/${tileX}/${tileY}@2x.pngraw?access_token=…
   ```
3. Decodes RGB into elevation (Float32).
4. Dynamically computes the GeoTransform based on your lon/lat, zoom, and tile size.
5. Writes out `terrain_dem.tif` as a fully-georeferenced GeoTIFF.

---

## 📐 Projection & GeoTransform Logic

The script uses these core calculations:

```js
// Web Mercator resolutions:
const R = 6378137;
const originShift = 2 * Math.PI * R / 2;
const initialRes = 2 * Math.PI * R / 256;
const resolution = initialRes / Math.pow(2, ZOOM);

// lon/lat → meters:
function lonToMercX(lon) {
  return (lon * originShift) / 180;
}
function latToMercY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI/180)/2)) * R;
}

// top-left in meters:
const minX = lonToMercX(LONGITUDE);
const maxY = latToMercY(LATITUDE);

// bottom-right:
const maxX = minX + TILE_SIZE * resolution;
const minY = maxY - TILE_SIZE * resolution;

// GeoTransform:
dataset.geoTransform = [minX, resolution, 0, maxY, 0, -resolution];
```

---

## 🔍 References

- Mapbox Terrain-RGB spec: https://docs.mapbox.com/help/troubleshooting/access-elevation-data/
- Web Mercator projection details: https://docs.maptiler.com/google-maps-coordinates-tile-bounds-projection/

