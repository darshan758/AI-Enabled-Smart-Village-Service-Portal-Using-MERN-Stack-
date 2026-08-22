const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const { VERIFIER_REGISTRY } = require('../services/documentVerification/registry');
const { checkEligibility } = require('../controllers/eligibilityController');

// One multer field per known document type key. A scheme's
// requiredDocuments[].type must be one of these keys (validated at
// seed time / by the registry) so uploads route to the right field.
const uploadFields = Object.keys(VERIFIER_REGISTRY).map((type) => ({ name: type, maxCount: 1 }));

router.post('/check', upload.fields(uploadFields), checkEligibility);

module.exports = router;