const express = require('express');
const router = express.Router();
const { listSchemes, getScheme } = require('../controllers/schemeController');
const { recommend } = require('../services/recommendController');

router.get('/', listSchemes);
router.post('/recommend', recommend);
router.get('/:idOrSlug', getScheme);

module.exports = router;