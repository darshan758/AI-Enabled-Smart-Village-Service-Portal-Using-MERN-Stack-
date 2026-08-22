const Scheme = require('../models/Scheme');
const { getVerifierForType } = require('../services/documentVerification/registry');
const { cleanupUploadedFiles } = require('../middleware/upload');

/**
 * POST /api/documents/verify
 * multipart/form-data: { file, documentType, schemeId }
 *
 * Verifies a single uploaded document against the verifier registered
 * for `documentType`. Used by the frontend to give immediate
 * per-upload feedback before the full eligibility check runs.
 */
async function verifySingleDocument(req, res, next) {
  try {
    const { documentType, schemeId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file was uploaded.' });
    }

    if (!documentType) {
      cleanupUploadedFiles([file]);
      return res.status(400).json({ success: false, message: 'documentType is required.' });
    }

    if (schemeId) {
      const scheme = await Scheme.findById(schemeId).catch(() => null);
      if (scheme) {
        const configured = (scheme.requiredDocuments || []).some((d) => d.type === documentType);
        if (!configured) {
          cleanupUploadedFiles([file]);
          return res.status(400).json({
            success: false,
            message: `${documentType} is not a required document for this scheme.`,
          });
        }
      }
    }

    const verifier = getVerifierForType(documentType);
    if (!verifier) {
      cleanupUploadedFiles([file]);
      return res.status(400).json({ success: false, message: `Unsupported document type: ${documentType}` });
    }

    const result = await verifier(file.path);
    cleanupUploadedFiles([file]);

    res.json({
      success: true,
      data: {
        documentType,
        verified: result.verified,
        message: result.message,
        extractedName: result.extractedName || null,
        extraFields: result.extraFields || {},
      },
    });
  } catch (err) {
    if (req.file) cleanupUploadedFiles([req.file]);
    next(err);
  }
}

module.exports = { verifySingleDocument };