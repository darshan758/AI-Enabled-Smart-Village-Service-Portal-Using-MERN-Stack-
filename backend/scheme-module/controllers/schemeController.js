const Scheme = require('../models/Scheme');

/**
 * GET /api/schemes
 * Returns all active schemes. This is the only source the frontend
 * uses to render the scheme list — nothing is hardcoded client-side.
 */
async function listSchemes(req, res, next) {
  try {
    const schemes = await Scheme.find({ active: true }).sort({ createdAt: 1 });
    res.json({ success: true, data: schemes });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/schemes/:idOrSlug
 * Accepts either a Mongo _id or the scheme's slug.
 */
async function getScheme(req, res, next) {
  try {
    const { idOrSlug } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);

    const scheme = isObjectId
      ? await Scheme.findById(idOrSlug)
      : await Scheme.findOne({ slug: idOrSlug });

    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Scheme not found.' });
    }

    res.json({ success: true, data: scheme });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSchemes, getScheme };