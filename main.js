// main.js
// Node.js script: fetch one Terrain-RGB tile via lon/lat, decode elevation, and write a GeoTIFF
// Usage:
//   npm install get-pixels ndarray request gdal dotenv
//   Create a .env file with the following variables:
//     MAPBOX_TOKEN=your_mapbox_token
//     ZOOM=15
//     TILE_SIZE=512
//     LATITUDE=45.12        # top-left corner latitude of the tile
//     LONGITUDE=13.81       # top-left corner longitude of the tile
//   node main.js

require('dotenv').config();
const request = require('request').defaults({ encoding: null });
const getPixels = require('get-pixels');
const ndarray = require('ndarray');
const gdal = require('gdal');

// Read configuration from .env
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const z = parseInt(process.env.ZOOM, 10);
const tileSize = parseInt(process.env.TILE_SIZE, 10);
const latitude = parseFloat(process.env.LATITUDE);
const longitude = parseFloat(process.env.LONGITUDE);

if (!MAPBOX_TOKEN || isNaN(z) || isNaN(tileSize) || isNaN(latitude) || isNaN(longitude)) {
  console.error('Missing or invalid environment variables.');
  console.error('Ensure MAPBOX_TOKEN, ZOOM, TILE_SIZE, LATITUDE, and LONGITUDE are set.');
  process.exit(1);
}

// Web Mercator projection formulas for pixel calculations
function lonToX(lon, zoom) {
  return ((lon + 180) / 360) * 256 * Math.pow(2, zoom);
}

function latToY(lat, zoom) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return (
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
    256 *
    Math.pow(2, zoom)
  );
}

// Compute pixel coordinates (floored) from lon/lat
const pixelX = Math.floor(lonToX(longitude, z));
const pixelY = Math.floor(latToY(latitude,  z));

// Calculate tile indices
const tileX = Math.floor(pixelX / tileSize);
const tileY = Math.floor(pixelY / tileSize);

const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${tileX}/${tileY}@2x.pngraw?access_token=${MAPBOX_TOKEN}`;

console.log(`Fetching Terrain-RGB tile z=${z}, x=${tileX}, y=${tileY}...`);
request.get(url, (err, res, body) => {
  if (err || res.statusCode !== 200) {
    console.error('Error fetching tile:', err || res.statusCode);
    return;
  }

  // Decode PNG buffer
  getPixels(body, 'image/png', (err, pixels) => {
    if (err) {
      console.error('Failed to decode PNG:', err);
      return;
    }

    const [height, width, channels] = pixels.shape;
    console.log('Tile size:', width, 'x', height, 'channels:', channels);

    // Decode RGB to elevation (Float32)
    const demArray = new Float32Array(width * height);
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const R = pixels.get(j, i, 0);
        const G = pixels.get(j, i, 1);
        const B = pixels.get(j, i, 2);
        demArray[j * width + i] = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1);
      }
    }

    // Create GeoTIFF
    const driver = gdal.drivers.get('GTiff');
    const dataset = driver.create('terrain_dem.tif', width, height, 1, gdal.GDT_Float32);

    // Dynamically compute GeoTransform using Web Mercator math
    const R = 6378137;                                   // Earth's radius in meters
    const originShift = 2 * Math.PI * R / 2.0;           // Half the Earth's circumference
    const initialResolution = 2 * Math.PI * R / 256.0;  // Resolution at zoom level 0
    const resolution = initialResolution / Math.pow(2, z);

    // Convert lat/lon to Web Mercator meters
    function lonToMercX(lon) {
      return (lon * originShift) / 180.0;
    }
    function latToMercY(lat) {
      const rad = (lat * Math.PI) / 180.0;
      return (Math.log(Math.tan(Math.PI / 4 + rad / 2)) * R);
    }

    // Top-left corner in meters
    const minX = lonToMercX(longitude);
    const maxY = latToMercY(latitude);
    // Bottom-right corner
    const maxX = minX + tileSize * resolution;
    const minY = maxY - tileSize * resolution;

    dataset.geoTransform = [
      minX,           // top-left x
      resolution,     // w-e pixel resolution
      0,
      maxY,           // top-left y
      0,
      -resolution     // n-s pixel resolution (negative)
    ];
    dataset.srs = gdal.SpatialReference.fromEPSG(3857);

    // Write elevation band
    const band = dataset.bands.get(1);
    band.pixels.write(0, 0, width, height, demArray);
    dataset.flush();
    dataset.close();

    console.log('Wrote terrain_dem.tif (GeoTIFF)');
  });
});
