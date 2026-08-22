const path = require('path');
const { extractTextFromPdf } = require('./pdfService');
const { ocrImageFile, MIN_READABLE_CHARS } = require('./ocrService');
const { normalizeDocumentName } = require('../utils/normalize');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

/**
 * getRawTextFromFile()
 * Dispatches to the PDF pipeline or the image OCR pipeline based on
 * file extension. This is the single entry point every document
 * verifier should call — no verifier should hand-roll its own
 * OCR/PDF handling.
 */
async function getRawTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const { text, readable, source } = await extractTextFromPdf(filePath);
    return { text, readable, source };
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    const { text, readable } = await ocrImageFile(filePath);
    return { text, readable, source: 'ocr' };
  }

  return { text: '', readable: false, source: 'unsupported' };
}

/**
 * checkDocumentType()
 *
 * Given raw OCR/extracted text and a list of indicator keyword sets,
 * decides whether the document plausibly IS the expected document
 * type. `indicatorGroups` is an array of arrays: the text must match
 * at least one keyword from at least `minGroupsMatched` distinct
 * groups. This avoids false positives from a single stray keyword
 * while tolerating OCR spelling variance (each group lists synonyms/
 * misspellings for the same concept).
 */
function checkDocumentType(text, indicatorGroups, minGroupsMatched = 1) {
  const lower = (text || '').toLowerCase();
  let groupsMatched = 0;
  const matchedKeywords = [];

  for (const group of indicatorGroups) {
    const hit = group.find((kw) => lower.includes(kw.toLowerCase()));
    if (hit) {
      groupsMatched += 1;
      matchedKeywords.push(hit);
    }
  }

  return {
    detected: groupsMatched >= minGroupsMatched,
    groupsMatched,
    matchedKeywords,
  };
}

/**
 * extractDocumentName()
 *
 * Generic "find a person's name near a label" extractor. Many Indian
 * govt documents render as "Name: X" / "Name X" / just a bare line
 * before/after a known label. This tries several strategies in order
 * and returns the first confident hit.
 *
 * `labels` - e.g. ['name', 'applicant name', 'account holder name']
 * `excludeLabels` - lines containing these should NOT be treated as
 *   the target name, even if they're near a name-like label
 *   (e.g. father's name, officer name).
 */
function extractDocumentName(text, labels = ['name'], excludeLabels = []) {
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const isExcluded = (line) => excludeLabels.some((ex) => line.toLowerCase().includes(ex.toLowerCase()));

  // Strategy 1: "Label: Value" or "Label - Value" on the same line.
  for (const line of lines) {
    if (isExcluded(line)) continue;
    for (const label of labels) {
      const re = new RegExp(`\\b${label}\\b\\s*[:\\-]\\s*([a-zA-Z.\\s]{2,60})`, 'i');
      const match = line.match(re);
      if (match && match[1]) {
        const candidate = cleanNameCandidate(match[1]);
        if (candidate) return candidate;
      }
    }
  }

  // Strategy 2: label on its own line, value on the following line.
  for (let i = 0; i < lines.length - 1; i++) {
    if (isExcluded(lines[i]) || isExcluded(lines[i + 1])) continue;
    const line = lines[i].toLowerCase();
    if (labels.some((label) => line === label.toLowerCase() || line.startsWith(label.toLowerCase()))) {
      const candidate = cleanNameCandidate(lines[i + 1]);
      if (candidate) return candidate;
    }
  }

  // Strategy 3: S/O, D/O, W/O pattern — "NAME S/O FATHER" gives us
  // the applicant's own name as the text preceding S/O|D/O|W/O.
  for (const line of lines) {
    if (isExcluded(line)) continue;
    const soMatch = line.match(/^([a-zA-Z.\s]{2,60}?)\s+(?:s\/o|d\/o|w\/o)\b/i);
    if (soMatch && soMatch[1]) {
      const candidate = cleanNameCandidate(soMatch[1]);
      if (candidate) return candidate;
    }
  }

  return null;
}

function cleanNameCandidate(raw) {
  if (!raw) return null;
  let s = raw.replace(/[^a-zA-Z.\s]/g, ' ').replace(/\s+/g, ' ').trim();
  // Reject candidates that are too short or look like a label leaked through.
  if (s.length < 3) return null;
  const lowerBlacklist = ['name', 'certificate', 'government', 'india', 'department'];
  if (lowerBlacklist.includes(s.toLowerCase())) return null;
  return s;
}

/**
 * verifyRequiredDocument()
 *
 * The top-level function controllers call for each uploaded file.
 * `spec` describes what "valid" means for this document type:
 * {
 *   indicatorGroups: [[...]],
 *   minGroupsMatched: number,
 *   nameLabels: [...],
 *   nameExcludeLabels: [...],
 *   extraExtract: async (text, filePath) => ({ ...fields }) // optional
 * }
 *
 * Returns a structured result — never throws for "bad document",
 * only for genuine I/O errors.
 */
async function verifyRequiredDocument(filePath, spec) {
  const { text, readable, source } = await getRawTextFromFile(filePath);

  if (!readable || text.replace(/\s/g, '').length < MIN_READABLE_CHARS) {
    return {
      verified: false,
      message: 'The document does not contain enough readable text for automated verification.',
      rawText: text,
      source,
    };
  }

  const typeCheck = checkDocumentType(text, spec.indicatorGroups, spec.minGroupsMatched || 1);
  if (!typeCheck.detected) {
    return {
      verified: false,
      message: spec.wrongTypeMessage || 'The uploaded document does not appear to be the required document type.',
      rawText: text,
      source,
    };
  }

  const extractedName = spec.nameLabels
    ? extractDocumentName(text, spec.nameLabels, spec.nameExcludeLabels || [])
    : null;

  let extraFields = {};
  if (typeof spec.extraExtract === 'function') {
    extraFields = (await spec.extraExtract(text, filePath)) || {};
  }

  return {
    verified: true,
    message: 'Document type detected and readable.',
    rawText: text,
    source,
    extractedName,
    normalizedName: extractedName ? normalizeDocumentName(extractedName) : null,
    extraFields,
  };
}

module.exports = {
  getRawTextFromFile,
  checkDocumentType,
  extractDocumentName,
  verifyRequiredDocument,
};