const exifr = require('exifr');
const path = require('path');

/**
 * Extract GPS coordinates from image EXIF metadata.
 * Returns { latitude, longitude } or null if no geotag found.
 */
const extractGeoTag = async (filePath) => {
  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);

    const gps = await exifr.gps(absolutePath);

    if (gps && gps.latitude != null && gps.longitude != null) {
      return {
        latitude: parseFloat(gps.latitude.toFixed(6)),
        longitude: parseFloat(gps.longitude.toFixed(6)),
      };
    }

    // Try full EXIF parse as fallback
    const exif = await exifr.parse(absolutePath, { gps: true });
    if (exif && exif.latitude != null && exif.longitude != null) {
      return {
        latitude: parseFloat(exif.latitude.toFixed(6)),
        longitude: parseFloat(exif.longitude.toFixed(6)),
      };
    }

    return null;
  } catch (error) {
    console.warn('GeoTag extraction warning:', error.message);
    return null;
  }
};

/**
 * Extract all useful EXIF metadata for display.
 */
const extractFullExif = async (filePath) => {
  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
    const exif = await exifr.parse(absolutePath, {
      gps: true,
      tiff: true,
      exif: true,
    });
    return exif || null;
  } catch {
    return null;
  }
};

module.exports = { extractGeoTag, extractFullExif };
