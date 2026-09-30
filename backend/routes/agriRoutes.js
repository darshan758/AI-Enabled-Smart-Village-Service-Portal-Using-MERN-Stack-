// backend/routes/agriRoutes.js

const express = require('express');
const {
  getMandiPrices,
  getPriceTrend,
  getHarvestAdviceHandler,
  getSuggestedMarket,
  getCropRecommendationHandler,
  getFertilizerRecommendationHandler,
  getWeatherAlerts,
} = require('../controllers/agriController');

const router = express.Router();

// Public — no auth required, matching the scheme eligibility checker's design
router.get('/prices', getMandiPrices);
router.get('/price-trend', getPriceTrend);
router.get('/harvest-advice', getHarvestAdviceHandler);
router.get('/suggested-market', getSuggestedMarket);
router.get('/crop-recommendation', getCropRecommendationHandler);
router.post('/fertilizer-recommendation', getFertilizerRecommendationHandler);
router.get('/weather-alerts', getWeatherAlerts);

module.exports = router;