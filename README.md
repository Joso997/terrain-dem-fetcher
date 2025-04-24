# Terrain DEM Fetcher

A simple Node.js tool that:

1. Fetches a Mapbox Terrain-RGB tile at a specified pixel location and zoom.
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
PIXEL_X=9032192
PIXEL_Y=6026752
TILE_SIZE=512
ZOOM=15
```

- **MAPBOX_TOKEN** – your Mapbox API token  
- **PIXEL_X**, **PIXEL_Y** – the pixel coordinates at zoom `ZOOM`  
- **TILE_SIZE** – usually `512` (for the `@2x` tile)  
- **ZOOM** – zoom level (e.g. `15`)

---

## 📐 Calculating Pixel Coordinates

To convert latitude/longitude to pixel coordinates at a given zoom, use the Web Mercator projection formulas from MapTiler:

```js
function lonToX(lon, z) {
  return ((lon + 180) / 360) * 256 * Math.pow(2, z);
}

function latToY(lat, z) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return (
    (0.5 -
      Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
    256 *
    Math.pow(2, z)
  );
}

const pixelX = lonToX(yourLongitude, ZOOM);
const pixelY = latToY(yourLatitude, ZOOM);
```

Then plug those values into your `.env` file.

---

## 🚀 Usage

```bash
npm start
```

What happens:

1. Computes the tile X/Y:
   ```js
   const x = Math.floor(PIXEL_X / TILE_SIZE);
   const y = Math.floor(PIXEL_Y / TILE_SIZE);
   ```
2. Fetches:
   ```
   https://api.mapbox.com/v4/mapbox.terrain-rgb/${ZOOM}/${x}/${y}@2x.pngraw?access_token=…
   ```
3. Decodes elevation and writes `terrain_dem.tif`.

---

## 🔍 References

- Mapbox Terrain-RGB spec: https://docs.mapbox.com/help/troubleshooting/access-elevation-data/
- Web Mercator projection (MapTiler): https://docs.maptiler.com/google-maps-coordinates-tile-bounds-projection/

