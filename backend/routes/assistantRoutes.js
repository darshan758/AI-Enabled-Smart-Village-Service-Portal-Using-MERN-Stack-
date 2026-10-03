const express = require('express');
const { ask, rateLimit } = require('../assistant/assistantController');
const router = express.Router();
// Public: the chatbot is on the Hub page where visitors are not logged in.
router.post('/ask', rateLimit, ask);
module.exports = router;