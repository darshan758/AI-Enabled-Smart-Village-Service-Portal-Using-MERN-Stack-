const Tesseract = require('tesseract.js');
const Jimp = require('jimp');

const MIN_READABLE_CHARS = parseInt(process.env.MIN_READABLE_CHARS || '25', 10);

/**
 * preprocessImage()
 * Applies grayscale + contrast + normalization + upscaling (if small)
 * to improve OCR accuracy. Returns a Buffer.
 */
async function preprocessImage(inputPath) {
  const image = await Jimp.read(inputPath);

  // Upscale small images - OCR engines do better with more pixels.
  if (image.bitmap.width < 1000) {
    const scale = 1000 / image.bitmap.width;
    image.scale(scale, Jimp.RESIZE_BICUBIC);
  }

  image
    .grayscale()
    .contrast(0.25)
    .normalize();

  return image.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * runOcr()
 * Runs Tesseract on a preprocessed image buffer.
 * Returns { text, confidence } where confidence is Tesseract's
 * mean word confidence (0-100).
 */
async function runOcr(imageBuffer, lang = 'eng') {
  const {
    data: { text, confidence },
  } = await Tesseract.recognize(imageBuffer, lang, {
    logger: () => {}, // swap for a real logger in development if needed
  });
  return { text: text || '', confidence: confidence || 0 };
}

/**
 * ocrImageFile()
 * Full pipeline for a single image file: preprocess -> OCR.
 */
async function ocrImageFile(filePath) {
  const processed = await preprocessImage(filePath);
  const { text, confidence } = await runOcr(processed);
  return {
    text: text.trim(),
    confidence,
    readable: text.trim().length >= MIN_READABLE_CHARS,
  };
}

/**
 * targetedOcr()
 * Crops a region of the image (given as fractions of width/height,
 * 0-1) and runs OCR on just that region. Useful when a full-page OCR
 * pass mixes up multiple names/fields, and we know roughly where the
 * needed field sits.
 *
 * region: { xPct, yPct, wPct, hPct } — all in [0, 1]
 * If no useful text comes back, callers should fall back to
 * whole-document OCR + regex extraction rather than trusting a
 * single fragile crop.
 */
async function targetedOcr(filePath, region) {
  const image = await Jimp.read(filePath);
  const { width, height } = image.bitmap;

  const x = Math.max(0, Math.floor(region.xPct * width));
  const y = Math.max(0, Math.floor(region.yPct * height));
  const w = Math.min(width - x, Math.floor(region.wPct * width));
  const h = Math.min(height - y, Math.floor(region.hPct * height));

  if (w <= 0 || h <= 0) {
    return { text: '', confidence: 0, readable: false };
  }

  image.crop(x, y, w, h);
  if (image.bitmap.width < 600) {
    image.scale(600 / image.bitmap.width, Jimp.RESIZE_BICUBIC);
  }
  image.grayscale().contrast(0.3).normalize();

  const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
  const { text, confidence } = await runOcr(buffer);
  return {
    text: text.trim(),
    confidence,
    readable: text.trim().length >= 3, // targeted crops are short by design
  };
}

module.exports = {
  preprocessImage,
  runOcr,
  ocrImageFile,
  targetedOcr,
  MIN_READABLE_CHARS,
};