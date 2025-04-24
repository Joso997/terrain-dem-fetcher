// main.js
// Node.js script: fetch one Terrain-RGB tile, decode elevation, and write a GeoTIFF (single tile)
// Usage:
//   npm install get-pixels ndarray request gdal dotenv
//   Create a .env file with the following variables:
//     MAPBOX_TOKEN=your_mapbox_token
//     PIXEL_X=9032192
//     PIXEL_Y=6026752
//     TILE_SIZE=512
//     ZOOM=15
//   node main.js

require('dotenv').config();
const request = require('request').defaults({ encoding: null });
const getPixels = require('get-pixels');
const ndarray = require('ndarray');
const gdal = require('gdal');

// Read configuration from .env
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const pixelX = parseInt(process.env.PIXEL_X, 10);
const pixelY = parseInt(process.env.PIXEL_Y, 10);
const tileSize = parseInt(process.env.TILE_SIZE, 10);
const z = parseInt(process.env.ZOOM, 10);

if (!MAPBOX_TOKEN || isNaN(pixelX) || isNaN(pixelY) || isNaN(tileSize) || isNaN(z)) {
  console.error('Missing or invalid environment variables.');
  process.exit(1);
}

// Calculate tile coordinates
const x = Math.floor(pixelX / tileSize);
const y = Math.floor(pixelY / tileSize);

const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}@2x.pngraw?access_token=${MAPBOX_TOKEN}`;

console.log(`Fetching Terrain-RGB tile z=${z}, x=${x}, y=${y}...`);
request.get(url, (err, res, body) => {
  if (err || res.statusCode !== 200) {
    console.error('Error fetching tile:', err || res.statusCode);
    return;
  }

  // Decode PNG buffer directly
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
        const elev = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1);
        demArray[j * width + i] = elev;
      }
    }

    // Create GeoTIFF
    const driver = gdal.drivers.get('GTiff');
    const dataset = driver.create('terrain_dem.tif', width, height, 1, gdal.GDT_Float32);

    // Optionally set geoTransform if you know tile bounds
    // dataset.geoTransform = [xmin, xres, 0, ymax, 0, -yres];
    // dataset.srs = gdal.SpatialReference.fromEPSG(3857);

    const band = dataset.bands.get(1);
    band.pixels.write(0, 0, width, height, demArray);
    dataset.flush();
    dataset.close();

    console.log('Wrote terrain_dem.tif (Float32 GeoTIFF)');
  });
});
