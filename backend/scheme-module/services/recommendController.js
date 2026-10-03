const Scheme = require('../models/Scheme');
const { recommendSchemes } = require('../services/recommendationEngine');

/**
 * POST /api/schemes/recommend   (public, read-only)
 * Body: { age, gender, occupation, caste, education, landOwnership,
 *         academicPercentage, annualIncome }  — every field optional.
 * Nothing is stored; the profile is used only to rank the schemes.
 */
async function recommend(req, res, next) {
  try {
    const b = req.body || {};
    const profile = {
      age: b.age, gender: b.gender, occupation: b.occupation, caste: b.caste,
      education: b.education, landOwnership: b.landOwnership,
      academicPercentage: b.academicPercentage, annualIncome: b.annualIncome,
    };
    const schemes = await Scheme.find({ active: true }).lean();
    const results = recommendSchemes(schemes, profile);
    res.json({
      success: true,
      count: results.length,
      method: 'Rule-based expert system over each scheme\'s configured eligibility criteria',
      note: 'This is a pre-check from self-entered details. Final eligibility is decided only after document verification.',
      results,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { recommend };