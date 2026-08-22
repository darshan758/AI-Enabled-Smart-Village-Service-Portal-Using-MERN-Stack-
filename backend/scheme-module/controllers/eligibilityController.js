const Scheme = require('../models/Scheme');
const Application = require('../models/Application');
const { getVerifierForType } = require('../services/documentVerification/registry');
const { evaluateEligibility } = require('../services/eligibilityEngine');
const { cleanupUploadedFiles } = require('../middleware/upload');

/**
 * POST /api/eligibility/check
 * multipart/form-data:
 *   schemeId: string
 *   formData: JSON string of the applicant's form answers
 *   files keyed by document `type` (e.g. field name "aadhaar",
 *   "land_ownership", etc. — matched against scheme.requiredDocuments[].type)
 *
 * This is the single end-to-end endpoint that:
 *  1. Loads the scheme configuration (source of truth).
 *  2. Verifies every uploaded document with the right verifier.
 *  3. Runs the eligibility engine against form + document results.
 *  4. Persists an Application record (audit trail).
 *  5. Returns the structured verdict.
 */
async function checkEligibility(req, res, next) {
  const allFiles = req.files ? Object.values(req.files).flat() : [];

  try {
    const { schemeId } = req.body;
    let formData = {};
    try {
      formData = req.body.formData ? JSON.parse(req.body.formData) : {};
    } catch (e) {
      cleanupUploadedFiles(allFiles);
      return res.status(400).json({ success: false, message: 'formData must be valid JSON.' });
    }

    if (!schemeId) {
      cleanupUploadedFiles(allFiles);
      return res.status(400).json({ success: false, message: 'schemeId is required.' });
    }

    const scheme = await Scheme.findById(schemeId).catch(() => null);
    if (!scheme || !scheme.active) {
      cleanupUploadedFiles(allFiles);
      return res.status(404).json({ success: false, message: 'Scheme not found.' });
    }

    const requiredDocs = scheme.requiredDocuments || [];
    const documentResultsByType = {};
    const documentResultsForResponse = [];

    // Verify each required document that was actually uploaded.
    // Files arrive keyed by document type (see routes/eligibility.js
    // multer field config), e.g. req.files.aadhaar[0].
    for (const reqDoc of requiredDocs) {
      const fileArr = req.files ? req.files[reqDoc.type] : null;
      const file = fileArr && fileArr[0];

      if (!file) {
        documentResultsForResponse.push({
          type: reqDoc.type,
          label: reqDoc.label,
          verified: false,
          message: `Please upload ${reqDoc.label}.`,
        });
        continue;
      }

      const verifier = getVerifierForType(reqDoc.type);
      if (!verifier) {
        documentResultsForResponse.push({
          type: reqDoc.type,
          label: reqDoc.label,
          verified: false,
          message: `No verifier is configured for document type "${reqDoc.type}".`,
        });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const result = await verifier(file.path);

      documentResultsByType[reqDoc.type] = result;
      documentResultsForResponse.push({
        type: reqDoc.type,
        label: reqDoc.label,
        originalFilename: file.originalname,
        verified: result.verified,
        message: result.message,
        extractedName: result.extractedName || null,
        extraFields: result.extraFields || {},
      });
    }

    const verdict = evaluateEligibility(scheme, formData, documentResultsByType);

    // Persist an audit record. Best-effort — a DB write failure here
    // shouldn't prevent the applicant from seeing their result.
    try {
      await Application.create({
        scheme: scheme._id,
        schemeSlug: scheme.slug,
        formData,
        documentResults: documentResultsForResponse,
        eligible: verdict.eligible,
        status: verdict.status,
        reasons: verdict.reasons,
        failedCriteria: verdict.failedCriteria,
      });
    } catch (persistErr) {
      console.error('[Application persist failed]', persistErr);
    }

    cleanupUploadedFiles(allFiles);

    res.json({
      success: true,
      data: {
        scheme: { id: scheme._id, name: scheme.name, slug: scheme.slug },
        eligible: verdict.eligible,
        status: verdict.status,
        reasons: verdict.reasons,
        failedCriteria: verdict.failedCriteria,
        documentResults: documentResultsForResponse,
      },
    });
  } catch (err) {
    cleanupUploadedFiles(allFiles);
    next(err);
  }
}

module.exports = { checkEligibility };