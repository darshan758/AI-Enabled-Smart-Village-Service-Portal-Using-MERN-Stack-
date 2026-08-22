const mongoose = require('mongoose');

/**
 * RequiredDocument sub-schema.
 *
 * `type` is a stable machine key (e.g. "aadhaar", "caste_certificate")
 * used by the verification engine to pick the right verifier.
 * `label` is the human-readable name shown in the UI.
 */
const requiredDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. 'aadhaar', 'land_ownership'
    label: { type: String, required: true }, // e.g. 'Aadhaar Card'
    // Whether this document's extracted name must match the applicant's
    // Aadhaar name during cross-document validation.
    requiresNameMatch: { type: Boolean, default: true },
  },
  { _id: false }
);

const schemeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true }, // used in URLs / API calls
    description: { type: String, required: true },
    category: { type: String, required: true },
    state: { type: String, default: 'All India' },

    // --- Eligibility configuration (source of truth) ---
    minAge: { type: Number, default: null },
    maxAge: { type: Number, default: null },
    maxIncome: { type: Number, default: null }, // null = no income restriction configured

    casteEligibility: { type: [String], default: ['All'] }, // ['All'] means no restriction
    genderEligibility: { type: [String], default: ['All'] },
    occupationEligibility: { type: [String], default: ['All'] },
    educationEligibility: { type: [String], default: ['All'] },

    landRequired: { type: Boolean, default: false },
    minAcademicPercentage: { type: Number, default: null }, // null = not required

    requiredDocuments: { type: [requiredDocumentSchema], default: [] },

    // Which document types must have mutually-matching names.
    // If empty, defaults to "all requiresNameMatch documents must match each other".
    nameMatchGroup: { type: [String], default: [] },

    benefits: { type: String, default: '' },
    applicationLink: { type: String, default: '' },
    active: { type: Boolean, default: true },

    // Free-text notes documenting any assumption made because the
    // official rule wasn't specified/configured (see README "Assumptions").
    assumptionsNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Scheme', schemeSchema);