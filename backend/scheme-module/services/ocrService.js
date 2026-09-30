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
  } else if (image.bitmap.width > 1800) {
    // Downscale large phone-camera photos (often 3000-4000px wide).
    // Tesseract's recognition time grows with pixel count, so an
    // un-downscaled 4000px photo can take 10s+ on its own — feeding
    // it more pixels than OCR needs just makes every check slower
    // without improving accuracy. 1800px is comfortably enough
    // resolution for document text.
    const scale = 1800 / image.bitmap.width;
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
// English + Kannada by default: Karnataka govt certificates (Nadakacheri
// income/caste, etc.) are printed in Kannada. tesseract.js downloads
// kan.traineddata automatically the first time (needs internet once).
// For offline/locked-down servers, put eng.traineddata + kan.traineddata in a
// folder and set TESSDATA_LANG_PATH to it.
const DEFAULT_OCR_LANGS = process.env.OCR_LANGS || 'eng+kan';
const OCR_WORKERS = Math.max(1, parseInt(process.env.OCR_WORKERS || '2', 10));

function workerOptions() {
  const options = { logger: () => {} };
  if (process.env.TESSDATA_LANG_PATH) {
    options.langPath = process.env.TESSDATA_LANG_PATH;
    options.gzip = false;
  }
  return options;
}

// A small pool of long-lived OCR workers. Creating a worker (loading the
// WASM engine + English/Kannada language data) costs several seconds, so
// doing it on every call made each eligibility check slow enough to hit the
// frontend timeout. Workers are created once (in the background as soon as
// the server starts) and reused; two documents can be read in parallel.
let schedulerPromise = null;
function getScheduler() {
  if (!schedulerPromise) {
    schedulerPromise = (async () => {
      const scheduler = Tesseract.createScheduler();
      for (let i = 0; i < OCR_WORKERS; i += 1) {
        // Sequential on purpose: the first worker downloads/caches the
        // language data, later workers reuse it.
        // eslint-disable-next-line no-await-in-loop
        const worker = await Tesseract.createWorker(DEFAULT_OCR_LANGS, 1, workerOptions());
        scheduler.addWorker(worker);
      }
      return scheduler;
    })().catch((err) => {
      schedulerPromise = null; // allow a retry on the next request
      throw err;
    });
  }
  return schedulerPromise;
}

/** Call once at startup so the first user request doesn't pay the load cost. */
function warmUpOcr() {
  return getScheduler().then(() => console.log('[OCR] workers ready (' + DEFAULT_OCR_LANGS + ')'));
}

async function runOcr(imageBuffer, lang = DEFAULT_OCR_LANGS) {
  let result;
  if (lang === DEFAULT_OCR_LANGS) {
    const scheduler = await getScheduler();
    result = await scheduler.addJob('recognize', imageBuffer);
  } else {
    result = await Tesseract.recognize(imageBuffer, lang, workerOptions());
  }
  const { data: { text, confidence } } = result;
  return { text: text || '', confidence: confidence || 0 };
}

// ── Sparse-text OCR (page segmentation mode 11) ─────────────────────────
// Multi-column documents (e.g. the 3-panel Aadhaar letter with Kannada + English
// side by side) get their columns interleaved by normal OCR, garbling small
// text such as the name. Sparse mode + a big upscale reads each text blob on
// its own line. Only used as a fallback, so it is created lazily.
let sparseWorkerPromise = null;
let sparseChain = Promise.resolve();
function getSparseWorker() {
  if (!sparseWorkerPromise) {
    sparseWorkerPromise = (async () => {
      const worker = await Tesseract.createWorker(DEFAULT_OCR_LANGS, 1, workerOptions());
      await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT });
      return worker;
    })().catch((err) => { sparseWorkerPromise = null; throw err; });
  }
  return sparseWorkerPromise;
}

async function ocrImageFileSparse(filePath) {
  const image = await Jimp.read(filePath);
  if (image.bitmap.width < 2400) image.scale(2400 / image.bitmap.width, Jimp.RESIZE_BICUBIC);
  image.grayscale();
  const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

  // one job at a time on the single sparse worker
  const job = sparseChain.then(async () => {
    const worker = await getSparseWorker();
    return worker.recognize(buffer);
  });
  sparseChain = job.catch(() => {});
  const { data: { text, confidence } } = await job;
  return { text: (text || '').trim(), confidence: confidence || 0, readable: (text || '').trim().length >= MIN_READABLE_CHARS };
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

// Start loading OCR workers in the background as soon as this module loads
// (i.e. when the server boots). Failures are logged, not fatal.
if (process.env.OCR_WARMUP !== 'false') {
  warmUpOcr().catch((e) => console.error('[OCR] warm-up failed:', e.message));
}

module.exports = {
  warmUpOcr,
  ocrImageFileSparse,
  preprocessImage,
  runOcr,
  ocrImageFile,
  targetedOcr,
  MIN_READABLE_CHARS,
};