const mongoose = require('mongoose');

/**
 * Stores one eligibility-check attempt: the form data submitted,
 * the documents verified, and the final structured result.
 * This is what test cases / demos can point to as an audit trail.
 */
const documentResultSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    label: { type: String, required: true },
    originalFilename: { type: String },
    verified: { type: Boolean, required: true },
    extractedName: { type: String, default: null },
    extractedFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    message: { type: String, default: '' },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    scheme: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme', required: true },
    schemeSlug: { type: String, required: true },

    formData: { type: mongoose.Schema.Types.Mixed, required: true },

    documentResults: { type: [documentResultSchema], default: [] },

    eligible: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['ELIGIBLE', 'NOT_ELIGIBLE', 'VERIFICATION_FAILED'],
      required: true,
    },
    reasons: { type: [String], default: [] },
    failedCriteria: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Application', applicationSchema);