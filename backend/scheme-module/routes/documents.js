const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const { verifySingleDocument } = require('../controllers/documentController');

// Single-file, immediate verification (used for per-field upload feedback).
router.post('/verify', upload.single('file'), verifySingleDocument);

module.exports = router;