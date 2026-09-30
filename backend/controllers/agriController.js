// backend/controllers/agriController.js

const { fetchMandiPrices } = require('../utils/agmarknetClient');
const { getDistrictVariants } = require('../utils/districtSynonyms');
const { recordSnapshot, computeTrend } = require('../utils/priceHistoryRecorder');
const { getHarvestAdvice } = require('../utils/harvestAdvice');
const { suggestMarkets } = require('../utils/suggestedMarket');
const { SEASONS, SOIL_TYPES, getCropRecommendation } = require('../utils/cropRecommendation');
const { LEVELS, CROP_BASE_DOSE_KG_PER_ACRE, getFertilizerRecommendation } = require('../utils/fertilizerRecommendation');
const { fetchForecast } = require('../utils/weatherClient');
const { getCropWeatherAlerts } = require('../utils/weatherAlerts');

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

    // Accumulate history for trend/harvest-advice — fire-and-forget,
    // never blocks or fails the actual price response the citizen is
    // waiting on.
    recordSnapshot(allRecords).catch(() => {});

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

// ── @desc    Price trend for a commodity in a district ──────────────────────
// ── @route   GET /api/agri/price-trend?district=&commodity= ─────────────────
// Public. Built from OUR OWN accumulated history (see priceHistoryRecorder.js)
// since the government API itself has no historical archive — returns
// available:false honestly if not enough days have been recorded yet,
// rather than fabricating a trend from one data point.
exports.getPriceTrend = async (req, res) => {
  try {
    const { district, commodity } = req.query;
    if (!district || !commodity) {
      return res.status(400).json({ success: false, message: 'district and commodity are required' });
    }
    const trend = await computeTrend({ district, commodity: bareCommodityName(commodity) });
    res.json({ success: true, district, commodity, trend: trend || { available: false } });
  } catch (err) {
    console.error('[Agri] price-trend error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to compute price trend' });
  }
};

// ── @desc    Harvest-selling suggestion for a commodity in a district ──────
// ── @route   GET /api/agri/harvest-advice?district=&commodity= ─────────────
// Public. A heuristic layered on top of getPriceTrend — see
// utils/harvestAdvice.js for exactly what it does and does not claim.
exports.getHarvestAdviceHandler = async (req, res) => {
  try {
    const { district, commodity } = req.query;
    if (!district || !commodity) {
      return res.status(400).json({ success: false, message: 'district and commodity are required' });
    }
    const trend = await computeTrend({ district, commodity: bareCommodityName(commodity) });
    const advice = getHarvestAdvice(trend);
    res.json({ success: true, district, commodity, ...advice });
  } catch (err) {
    console.error('[Agri] harvest-advice error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to generate harvest advice' });
  }
};

// ── @desc    Compare the same commodity's price across nearby markets ──────
// ── @route   GET /api/agri/suggested-market?state=&commodity=&fromDistrict=&quintals= ──
// Public. Real government prices, compared across markets already in
// the current state-level batch, ranked with an ESTIMATED transport
// cost — see utils/suggestedMarket.js for the honesty caveat on that part.
exports.getSuggestedMarket = async (req, res) => {
  try {
    const { state, commodity, fromDistrict, quintals } = req.query;
    if (!commodity || !fromDistrict) {
      return res.status(400).json({ success: false, message: 'commodity and fromDistrict are required' });
    }

    const { records } = await fetchMandiPrices({ state: state || 'Karnataka', limit: 500 });
    const result = suggestMarkets({
      records,
      commodity: bareCommodityName(commodity),
      fromDistrict,
      quintals: Number(quintals) || 1,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Agri] suggested-market error:', err.message);
    const status = err.code === 'NOT_CONFIGURED' ? 500 : 503;
    res.status(status).json({ success: false, message: err.message || 'Failed to suggest markets' });
  }
};

// ── @desc    Crop recommendation by season + soil type ─────────────────────
// ── @route   GET /api/agri/crop-recommendation?season=&soilType= ───────────
// Public. Rule-based — see utils/cropRecommendation.js.
exports.getCropRecommendationHandler = (req, res) => {
  const { season, soilType } = req.query;
  if (!season || !soilType) {
    return res.status(400).json({
      success: false,
      message: `season and soilType are required. season options: ${SEASONS.join(', ')}. soilType options: ${SOIL_TYPES.join(', ')}`,
    });
  }
  const result = getCropRecommendation({ season, soilType });
  res.status(result.success ? 200 : 400).json(result);
};

// ── @desc    Fertilizer (NPK) recommendation for a crop ─────────────────────
// ── @route   POST /api/agri/fertilizer-recommendation ───────────────────────
// Public. Rule-based — see utils/fertilizerRecommendation.js.
exports.getFertilizerRecommendationHandler = (req, res) => {
  const { crop, nitrogenLevel, phosphorusLevel, potassiumLevel } = req.body;
  if (!crop || !nitrogenLevel || !phosphorusLevel || !potassiumLevel) {
    return res.status(400).json({
      success: false,
      message: `crop, nitrogenLevel, phosphorusLevel, potassiumLevel are all required. Level options: ${LEVELS.join(', ')}. Crop options: ${Object.keys(CROP_BASE_DOSE_KG_PER_ACRE).join(', ')}`,
    });
  }
  const result = getFertilizerRecommendation({ crop, nitrogenLevel, phosphorusLevel, potassiumLevel });
  res.status(result.success ? 200 : 400).json(result);
};

// ── @desc    Weather-based crop alerts for a district ───────────────────────
// ── @route   GET /api/agri/weather-alerts?district= ─────────────────────────
// Public. Real forecast data from OpenWeatherMap, turned into plain-
// language farming alerts by simple, explainable threshold rules — see
// utils/weatherAlerts.js for exactly what triggers each one.
exports.getWeatherAlerts = async (req, res) => {
  try {
    const { district } = req.query;
    if (!district) {
      return res.status(400).json({ success: false, message: 'district is required' });
    }

    const forecast = await fetchForecast(district);
    const alerts = getCropWeatherAlerts(forecast);

    res.json({
      success: true,
      district,
      city: forecast.city,
      stale: forecast.stale || false,
      alerts,
    });
  } catch (err) {
    console.error('[Agri] weather-alerts error:', err.message);
    if (err.code === 'UNKNOWN_DISTRICT') {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err.code === 'NOT_CONFIGURED') {
      return res.status(503).json({ success: false, message: err.message });
    }
    res.status(503).json({ success: false, message: err.message || 'Failed to fetch weather alerts' });
  }
};