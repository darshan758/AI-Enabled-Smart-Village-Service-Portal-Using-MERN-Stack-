// backend/routes/agriRoutes.js

const express = require('express');
const { getMandiPrices } = require('../controllers/agriController');

const router = express.Router();

// Public — no auth required, matching the scheme eligibility checker's design
router.get('/prices', getMandiPrices);

module.exports = router;