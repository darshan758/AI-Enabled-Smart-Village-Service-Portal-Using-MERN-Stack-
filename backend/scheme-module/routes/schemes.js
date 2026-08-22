const express = require('express');
const router = express.Router();
const { listSchemes, getScheme } = require('../controllers/schemeController');

router.get('/', listSchemes);
router.get('/:idOrSlug', getScheme);

module.exports = router;