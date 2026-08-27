// backend/controllers/agriController.js

const { fetchMandiPrices } = require('../utils/agmarknetClient');
const { getDistrictVariants } = require('../utils/districtSynonyms');

// Strip parenthetical UI-friendly labels (e.g. "Ragi (Finger Millet)" -> "Ragi")
// before matching against the government dataset's raw commodity names.
function bareCommodityName(commodity) {
  if (!commodity) return '';
  return commodity.replace(/\s*\(.*?\)\s*/g, '').trim();
}

// ── @desc    Get mandi (market) prices for a state/district/commodity ───────
// ── @route   GET /api/agri/prices?state=&district=&commodity= ───────────────
// Public — no login required, same as the scheme checker.
//
// We fetch a broad state-level batch from the government API (cached,
// state-only filter — the one filter field that's reliably exact-match
// across the dataset), then do our own flexible matching here for
// district/commodity, since the government API's own filtering breaks
// silently on old-vs-renamed district names and friendly commodity labels.
exports.getMandiPrices = async (req, res) => {
  try {
    const { state, district, commodity } = req.query;

    const { records: allRecords, total } = await fetchMandiPrices({
      state: state || 'Karnataka',
      limit: 500,
    });

    let records = allRecords;

    if (district) {
      const variants = getDistrictVariants(district).map((v) => v.toLowerCase());
      records = records.filter((r) =>
        variants.some((v) => (r.district || '').toLowerCase().includes(v.toLowerCase()))
      );
    }

    if (commodity) {
      const bare = bareCommodityName(commodity).toLowerCase();
      records = records.filter((r) =>
        (r.commodity || '').toLowerCase().includes(bare)
      );
    }

    res.json({
      success: true,
      total,
      count: records.length,
      records,
    });
  } catch (err) {
    console.error('[Agri]', err.message);

    // Distinguish "not configured" (admin setup issue) from "upstream down"
    // (temporary, not our fault) so the frontend can show the right message.
    const status = err.code === 'NOT_CONFIGURED' ? 500 : 503;

    res.status(status).json({
      success: false,
      message: err.message || 'Failed to fetch market prices.',
    });
  }
};