// backend/models/MandiCache.js
//
// Last successful mandi-price fetch, saved so the portal can still show
// (clearly labelled) prices when data.gov.in is unreachable. One document
// per state key. Used ONLY by utils/mandiFallback.js - never mixed into
// PriceHistory, so trend/harvest-advice data stays real.

const mongoose = require('mongoose');

const mandiCacheSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true },
  total:     { type: Number, default: 0 },
  records:   { type: [mongoose.Schema.Types.Mixed], default: [] },
  fetchedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MandiCache', mandiCacheSchema);