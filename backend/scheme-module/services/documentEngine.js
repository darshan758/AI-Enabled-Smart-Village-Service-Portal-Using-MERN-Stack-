const path = require('path');
const { extractTextFromPdf } = require('./pdfService');
const { ocrImageFile, ocrImageFileSparse, MIN_READABLE_CHARS } = require('./ocrService');
const { normalizeDocumentName } = require('../utils/normalize');
const { extractKannadaApplicantName } = require('../utils/kannada');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

/**
 * getRawTextFromFile()
 * Dispatches to the PDF pipeline or the image OCR pipeline based on
 * file extension. This is the single entry point every document
 * verifier should call — no verifier should hand-roll its own
 * OCR/PDF handling.
 */
async function getRawTextFromFile(filePath, { forceOcr = false, sparse = false } = {}) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const { text, readable, source } = await extractTextFromPdf(filePath, { forceOcr, sparse });
    return { text, readable, source };
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    const { text, readable } = sparse ? await ocrImageFileSparse(filePath) : await ocrImageFile(filePath);
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
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * matchesKeyword()
 * Latin keywords match on WORD boundaries (so "vid" no longer matches
 * "provided", "ror" no longer matches "error"). Keywords containing
 * non-ASCII characters (Kannada) use plain substring search, since \b-style
 * boundaries are meaningless there. A RegExp entry is tested as-is.
 */
function matchesKeyword(text, kw) {
  if (kw instanceof RegExp) return kw.test(text || '');
  const lower = (text || '').toLowerCase();
  const k = String(kw).toLowerCase().trim();
  if (!k) return false;
  if (/[^\x00-\x7F]/.test(k)) return lower.includes(k);
  return new RegExp('(?<![a-z0-9])' + escapeRegExp(k) + '(?![a-z0-9])').test(lower);
}

function checkDocumentType(text, indicatorGroups, minGroupsMatched = 1) {
  let groupsMatched = 0;
  const matchedKeywords = [];

  for (const group of indicatorGroups) {
    const hit = group.find((kw) => matchesKeyword(text, kw));
    if (hit) {
      groupsMatched += 1;
      matchedKeywords.push(String(hit));
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
function extractDocumentName(text, labels = ['name'], excludeLabels = [], opts = {}) {
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const isExcluded = (line) => excludeLabels.some((ex) => line.toLowerCase().includes(ex.toLowerCase()));
  // Lines about a relative (father/mother/husband, S/O D/O W/O) must never
  // be taken as the applicant's own name in strategies 1 and 2.
  const isRelativeLine = (line) =>
    /\b(father|mother|husband|guardian|spouse)\b/i.test(line) || /^(s|d|w|c)\s*\/\s*o\b/i.test(line);

  // Strategy 1: "Label: Value" or "Label - Value" on the same line.
  for (const line of lines) {
    if (isExcluded(line) || isRelativeLine(line)) continue;
    for (const label of labels) {
      // allows "Name: X", "Name of the Applicant: X", "Name of Applicant - X"
      const re = new RegExp(`\\b${label}\\b(?:\\s+of\\s+(?:the\\s+)?(?:applicant|beneficiary|holder))?\\s*[:\\-]\\s*([a-zA-Z.\\s]{2,60})`, 'i');
      const match = line.match(re);
      if (match && match[1]) {
        const candidate = cleanNameCandidate(match[1]);
        if (candidate) return candidate;
      }
    }
  }

  // Strategy 2: label on its own line, value on the following line.
  for (let i = 0; i < lines.length - 1; i++) {
    if (isExcluded(lines[i]) || isExcluded(lines[i + 1]) || isRelativeLine(lines[i + 1])) continue;
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

  // Strategy 4 (Aadhaar-style): the card prints the name on its own,
  // unlabeled, directly above the DOB / gender line.
  if (opts.unlabeledAboveDob) {
    const dobIdx = lines.findIndex((l) => /\b(dob|date of birth|year of birth|yob)\b|^(male|female|transgender)\b/i.test(l));
    for (let i = dobIdx - 1; i >= 0 && i >= dobIdx - 3; i--) {
      if (isRelativeLine(lines[i]) || /india|government|aadhaar|aadhar|uidai|authority|\d/i.test(lines[i])) continue;
      const candidate = cleanNameCandidate(lines[i]);
      if (candidate && candidate.split(' ').length <= 5) return candidate;
    }
  }

  return null;
}

/**
 * extractNameFromRelationLine()
 * For layouts where OCR returns one text blob per line (sparse mode), a
 * person's name sits directly above the "S/O: father" (or D/O, W/O, C/O)
 * line, or directly above the "DOB" line. Latin-script names are preferred;
 * a Kannada-only name is returned if that's all there is (the name matcher
 * transliterates it).
 */
function extractNameFromRelationLine(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const isRelation = (l) => /^(s|d|w|c)\s*\/\s*o\b/i.test(l);
  const isDob = (l) => /\b(dob|date of birth|year of birth)\b/i.test(l);
  const isLatinName = (l) => /^[A-Za-z][A-Za-z.\s]{2,45}$/.test(l) && l.split(/\s+/).length <= 5 &&
    !/(government|india|authority|address|male|female|aadhaar|aadhar|enrolment|information|unique|identification|identity|verify|update|download|keep|entities|help|number)/i.test(l);
  const isKannadaName = (l) => /^[\u0C80-\u0CFF\u200c\u200d.\s]{3,50}$/.test(l) && l.split(/\s+/).length <= 5;
  const norm = (l) => l.toLowerCase().replace(/[.\s]+/g, ' ').trim();

  // Anchor lines: the person's name is printed within a few lines of "S/O: ..." or "DOB".
  const anchors = lines.map((l, i) => (isRelation(l) || isDob(l) ? i : -1)).filter((i) => i >= 0);
  const nearAnchor = (i, d) => anchors.some((a) => Math.abs(a - i) <= d);

  // Score every Latin candidate near an anchor. The real name (a) is printed more than
  // once on an Aadhaar, (b) sits next to its Kannada twin, (c) hugs the S/O or DOB line.
  // OCR garbage fragments have none of these.
  const stats = new Map();
  lines.forEach((l, i) => {
    if (!isLatinName(l) || !nearAnchor(i, 5)) return;
    const key = norm(l);
    const st = stats.get(key) || { text: l.replace(/\s+/g, ' ').trim(), count: 0, score: 0, first: i };
    st.count += 1;
    st.score += 2;
    if ((lines[i - 1] && isKannadaName(lines[i - 1])) || (lines[i + 1] && isKannadaName(lines[i + 1]))) st.score += 3;
    if (nearAnchor(i, 1)) st.score += 1;
    if (l.split(/\s+/).length >= 2) st.score += 1;
    stats.set(key, st);
  });
  // Only trustworthy candidates compete (repeated, or strongly positioned) — a single
  // stray OCR fragment with a decent score must not shadow the real name.
  const best = [...stats.values()]
    .filter((c) => c.count >= 2 || c.score >= 6)
    .sort((x, y) => y.score - x.score || x.first - y.first)[0];
  if (best) return best.text;

  // Kannada-only fallback (the matcher transliterates it).
  for (const a of anchors) {
    for (let back = 1; back <= 3 && a - back >= 0; back++) {
      if (isKannadaName(lines[a - back])) return lines[a - back].replace(/\s+/g, ' ').trim();
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

const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
const DATE_RE = '(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\.?,?\\s+\\d{4})';

function parseIndianDate(str) {
  if (!str) return null;
  let m = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]); if (y < 100) y += 2000;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = str.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(Number(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1]));
  }
  return null;
}

/**
 * checkCertificateValidity()
 * 1) explicit "valid up to / till / until <date>" in the text -> expired if past
 * 2) otherwise "date of issue / issued on / dated <date>" older than maxAgeDays -> expired
 * 3) no date found -> status 'unknown' (caller decides; never silently 'valid')
 */
// Validity period printed on the certificate itself (authoritative), e.g.
// "valid for five years" / "ಈ ದೃಢೀಕರಣ ಪತ್ರವು ಐದು ವರ್ಷದ ಅವಧಿಗೆ ಚಾಲ್ತಿಯಲ್ಲಿರುತ್ತದೆ".
function statedValidityDays(text) {
  const t = text || '';
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, 'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5, 'ಹತ್ತು': 10 };
  let m = t.match(/valid(?:ity)?\s+(?:for|period(?:\s+of)?)?\s*(\d+|one|two|three|four|five|ten)\s*\(?\d*\)?\s*years?/i);
  if (m) return (Number(m[1]) || words[m[1].toLowerCase()]) * 365;
  m = t.match(/(ಒಂದು|ಎರಡು|ಮೂರು|ನಾಲ್ಕು|ಐದು|ಹತ್ತು)\s*ವರ್ಷ/);
  if (m) return words[m[1]] * 365;
  return null;
}

// SCHEME_FAKE_NOW (e.g. 2032-01-01) is a TEST-ONLY hook to pretend it is another day.
function currentDate() {
  return process.env.SCHEME_FAKE_NOW ? new Date(process.env.SCHEME_FAKE_NOW) : new Date();
}

// OCR often reads a zero as the letter O inside dates ("10/09/2O26").
function normalizeOcrDigits(text) {
  return (text || '')
    .replace(/(?<=\d)[Oo](?=[\d\/\-.]|\b)/g, '0')
    .replace(/(?<=[\/\-.])[Oo](?=\d)/g, '0');
}

function checkCertificateValidity(text, maxAgeDays = Number(process.env.INCOME_CERT_VALIDITY_DAYS || 365), now = currentDate()) {
  const t = normalizeOcrDigits(text);
  maxAgeDays = statedValidityDays(t) || maxAgeDays;

  // 1) an explicit "valid up to <date>" wins
  const validTo = t.match(new RegExp('valid\\s*(?:up\\s*)?(?:to|till|until|upto|through)\\s*[:\\-]?\\s*' + DATE_RE, 'i'));
  if (validTo) {
    const d = parseIndianDate(validTo[1]);
    if (d) {
      return d < now
        ? { status: 'expired', expiresOn: d, reason: 'its printed validity end date has passed' }
        : { status: 'valid', expiresOn: d };
    }
  }

  // 2) otherwise issue date + validity period. A certificate often quotes older
  // dates too (e.g. the govt order it relies on), so the issue date is the
  // MOST RECENT labeled date, not the first.
  const issuedRe = new RegExp('(?:date\\s+of\\s+issue|issued\\s+on|issue\\s+date|dated?|ದಿನಾಂಕ)\\s*[:\\-ಃ]\\s*' + DATE_RE, 'gi');
  const issuedDates = [...t.matchAll(issuedRe)]
    .map((m) => parseIndianDate(m[1]))
    .filter((d) => d && d <= new Date(now.getTime() + 86400000));
  if (issuedDates.length > 0) {
    const issued = new Date(Math.max(...issuedDates.map((x) => x.getTime())));
    const expiresOn = new Date(issued.getTime() + maxAgeDays * 86400000);
    const years = Math.round((maxAgeDays / 365) * 10) / 10;
    return now > expiresOn
      ? { status: 'expired', issued, expiresOn, reason: `it is valid for ${years} year(s) from the issue date` }
      : { status: 'valid', issued, expiresOn };
  }
  return { status: 'unknown' };
}

// Only documents that are dated certificates get an expiry check: ration cards,
// SECC extracts, Aadhaar, caste certificates etc. do not expire this way.
function looksLikeDatedCertificate(text) {
  return (
    /income\s+certificate/i.test(text || '') ||
    /ಆದಾಯ[\s\S]{0,30}ಪ್ರಮಾಣ/.test(text || '') ||
    /nadakacheri/i.test(text || '') ||
    /\bRD\d{10,}\b/.test(text || '')
  );
}

const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

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
  const analyse = (text) => {
    const typeCheck = checkDocumentType(text, spec.indicatorGroups, spec.minGroupsMatched || 1);
    // Kannada certificates: applicant name sits before "ಬಿನ್" (son of).
    const wantsName = Array.isArray(spec.nameLabels) && spec.nameLabels.length > 0;
    let extractedName = wantsName ? extractKannadaApplicantName(text) : null;
    if (!extractedName && wantsName) {
      extractedName = extractDocumentName(text, spec.nameLabels, spec.nameExcludeLabels || [], {
        unlabeledAboveDob: Boolean(spec.nameUnlabeledAboveDob),
      });
    }
    return { typeCheck, extractedName };
  };

  // spec.validityCheck: 'always' (e.g. income certificate) or true (only when the
  // document looks like a dated certificate, e.g. Ayushman's family document).
  const validityOf = (t) =>
    spec.validityCheck && (spec.validityCheck === 'always' || looksLikeDatedCertificate(t))
      ? checkCertificateValidity(t)
      : null;
  const isUnknown = (v) => Boolean(v) && v.status === 'unknown';

  let { text, readable, source } = await getRawTextFromFile(filePath);
  let analysis = readable ? analyse(text) : null;

  // Many Indian govt PDFs (esp. Kannada ones) have a text layer in a legacy
  // font encoding that comes out as symbol garbage. If the direct text does
  // not identify the document (or yields no name), re-read the PDF with OCR.
  const hasNameLabels = Array.isArray(spec.nameLabels) && spec.nameLabels.length > 0;
  const needsOcrRetry =
    source === 'pdf-text' &&
    (!analysis || !analysis.typeCheck.detected || (hasNameLabels && !analysis.extractedName) || isUnknown(validityOf(text)));
  if (needsOcrRetry) {
    const ocr = await getRawTextFromFile(filePath, { forceOcr: true });
    if (ocr.readable) {
      const ocrAnalysis = analyse(ocr.text);
      const better =
        !analysis ||
        (ocrAnalysis.typeCheck.detected && !analysis.typeCheck.detected) ||
        (ocrAnalysis.typeCheck.detected === analysis.typeCheck.detected && ocrAnalysis.extractedName && !analysis.extractedName) ||
        (ocrAnalysis.typeCheck.detected === analysis.typeCheck.detected && isUnknown(validityOf(text)) && !isUnknown(validityOf(ocr.text)));
      if (better) {
        text = ocr.text;
        source = 'ocr';
        readable = true;
        analysis = ocrAnalysis;
      }
    }
  }

  // Fallback for multi-column layouts (e.g. Aadhaar letter): re-read in sparse
  // mode and take the name from the line above "S/O:" / "DOB".
  // For OCR-read documents the first-pass name can be wrong (interleaved columns), so when a
  // spec opts in, the clean line-by-line name takes priority over the first-pass guess.
  if (analysis && analysis.typeCheck.detected && hasNameLabels && spec.nameSparseFallback && source === 'ocr') {
    try {
      const sparse = await getRawTextFromFile(filePath, { sparse: true });
      const sparseName = sparse.readable ? extractNameFromRelationLine(sparse.text) : null;
      if (sparseName) analysis = { ...analysis, extractedName: sparseName };
      // otherwise keep whatever the first pass found (may be null)
    } catch (e) {
      console.error('[documentEngine] sparse-OCR name fallback failed:', e.message);
    }
  }

  if (!readable || !analysis || text.replace(/\s/g, '').length < MIN_READABLE_CHARS) {
    return {
      verified: false,
      message: 'The document does not contain enough readable text for automated verification.',
      rawText: text,
      source,
    };
  }

  if (!analysis.typeCheck.detected) {
    if (process.env.SCHEME_DEBUG !== 'false') {
      console.log(`[DocVerify] ${path.basename(filePath)} verified=false (wrong type) source=${source} groups=${analysis.typeCheck.groupsMatched}`);
    }
    return {
      verified: false,
      message: spec.wrongTypeMessage || 'The uploaded document does not appear to be the required document type.',
      rawText: text,
      source,
    };
  }

  const extractedName = analysis.extractedName;

  // ── Validity / expiry gate ────────────────────────────────────────────
  const validity = validityOf(text);
  if (validity && validity.status === 'expired') {
    const when = validity.issued
      ? `issued ${fmtDate(validity.issued)}, valid until ${fmtDate(validity.expiresOn)}`
      : `validity ended ${fmtDate(validity.expiresOn)}`;
    if (process.env.SCHEME_DEBUG !== 'false') console.log(`[DocVerify] ${path.basename(filePath)} verified=false EXPIRED (${when})`);
    return {
      verified: false,
      message: `This certificate has expired (${when}; ${validity.reason}). Please upload a current certificate.`,
      rawText: text,
      source,
      extractedName,
    };
  }
  if (validity && validity.status === 'unknown') {
    if (process.env.SCHEME_DEBUG !== 'false') console.log(`[DocVerify] ${path.basename(filePath)} verified=false (issue date unreadable)`);
    return {
      verified: false,
      message:
        'The issue date on this certificate could not be read, so its validity could not be checked. Please upload a clearer copy (PDF or a sharp photo).',
      rawText: text,
      source,
      extractedName,
    };
  }
  const validityNote =
    validity && validity.status === 'valid'
      ? ` Certificate ${validity.issued ? 'issued ' + fmtDate(validity.issued) + ', ' : ''}valid until ${fmtDate(validity.expiresOn)}.`
      : '';

  let extraFields = {};
  if (typeof spec.extraExtract === 'function') {
    extraFields = (await spec.extraExtract(text, filePath)) || {};
  }

  if (process.env.SCHEME_DEBUG !== 'false') {
    console.log(`[DocVerify] ${path.basename(filePath)} verified=true source=${source} matched=[${analysis.typeCheck.matchedKeywords.join(', ')}] name=${JSON.stringify(extractedName)}${validity ? ' validity=' + validity.status + (validity.issued ? ' issued=' + fmtDate(validity.issued) : '') + ' until=' + fmtDate(validity.expiresOn) : ''}`);
  }

  return {
    verified: true,
    message: 'Document type detected and readable.' + validityNote,
    rawText: text,
    source,
    extractedName,
    normalizedName: extractedName ? normalizeDocumentName(extractedName) : null,
    extraFields: validity
      ? { ...extraFields, validity: { status: validity.status, issued: validity.issued || null, expiresOn: validity.expiresOn || null } }
      : extraFields,
  };
}

module.exports = {
  getRawTextFromFile,
  matchesKeyword,
  checkDocumentType,
  extractDocumentName,
  extractNameFromRelationLine,
  checkCertificateValidity,
  looksLikeDatedCertificate,
  parseIndianDate,
  verifyRequiredDocument,
};