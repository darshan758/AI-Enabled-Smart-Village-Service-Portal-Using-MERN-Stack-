const fs = require('fs');
const pdfParse = require('pdf-parse');
const getPdf = async () => {
  const { pdf } = await import('pdf-to-img');
  return pdf;
};
const { ocrImageFile, MIN_READABLE_CHARS } = require('./ocrService');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

/**
 * extractTextFromPdf()
 *
 * STEP 1: try normal PDF text extraction (works for digitally-generated
 *         PDFs, e.g. exported certificates).
 * STEP 2: if that yields enough readable text, use it directly.
 * STEP 3: otherwise, the PDF is probably a scanned image — rasterize
 *         each page to an image.
 * STEP 4: run OCR on the generated page images.
 * STEP 5/6: combine the OCR text across pages.
 *
 * Returns { text, source: 'pdf-text' | 'ocr', readable, pageCount }
 */
async function extractTextFromPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  let directText = '';
  let pageCount = 1;

  try {
    const parsed = await pdfParse(dataBuffer);
    directText = (parsed.text || '').trim();
    pageCount = parsed.numpages || 1;
  } catch (err) {
    // Corrupt/unreadable as text — fall through to OCR path.
    directText = '';
  }

  if (directText.length >= MIN_READABLE_CHARS) {
    return { text: directText, source: 'pdf-text', readable: true, pageCount };
  }

  // Fall back to rasterizing pages and running OCR.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scheme-pdf-'));
  const ocrTexts = [];
  let confidences = [];

  try {
const pdf = await getPdf();
const document = await pdf(filePath, { scale: 2.0 });
    let pageIndex = 0;
    for await (const pageImage of document) {
      pageIndex += 1;
      const imgPath = path.join(tmpDir, `${uuidv4()}.png`);
      fs.writeFileSync(imgPath, pageImage);

      const { text, confidence } = await ocrImageFile(imgPath);
      ocrTexts.push(text);
      confidences.push(confidence);

      // Cap at first 5 pages — supporting documents for this project
      // are single/few-page certificates, not long reports.
      if (pageIndex >= 5) break;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const combined = ocrTexts.join('\n').trim();
  return {
    text: combined,
    source: 'ocr',
    readable: combined.length >= MIN_READABLE_CHARS,
    pageCount,
  };
}

module.exports = { extractTextFromPdf };