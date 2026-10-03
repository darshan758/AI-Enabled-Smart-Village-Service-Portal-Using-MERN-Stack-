const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const { rateLimit } = require('../../middleware/rateLimit');
const { verifySingleDocument } = require('../controllers/documentController');

// Single-file, immediate verification (used for per-field upload feedback).
// OCR is CPU-heavy and this route is public: cap requests per IP (before multer, so rejected calls store no file).
const ocrLimit = rateLimit({ max: Number(process.env.OCR_RATE_PER_MIN) || 12, windowMs: 60 * 1000 });
router.post('/verify', ocrLimit, upload.single('file'), verifySingleDocument);

module.exports = router;