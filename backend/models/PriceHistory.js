// backend/models/PriceHistory.js
//
// The AGMARKNET government API only ever returns TODAY's prices — it's
// a live snapshot, not a historical archive. So "price trend" and
// "harvest-selling advice" can't be computed from a single API call;
// they need OUR OWN accumulated history.
//
// This collection is filled incrementally, once per (state, district,
// market, commodity, date) combination, every time someone actually
// looks up prices for that combination (see agriController.getMandiPrices
// and utils/priceHistoryRecorder.js). There is no separate cron job —
// it piggybacks on real usage. This means trend data is genuinely thin
// at first and gets more useful the longer the portal is used; there is
// no way around that cold-start, since the underlying data source
// itself has no historical archive to seed from.

const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  state:     { type: String, required: true },
  district:  { type: String, required: true },
  market:    { type: String, required: true },
  commodity: { type: String, required: true },
  variety:   { type: String, default: null },
  minPrice:  { type: Number, default: null },
  maxPrice:  { type: Number, default: null },
  modalPrice: { type: Number, default: null },
  arrivalDate: { type: String, required: true }, // as reported by the source, e.g. "16/09/2026"
  recordedAt: { type: Date, default: Date.now }, // when WE saw/stored it
});

// One row per market+commodity+day — repeated lookups the same day
// update the existing row (upsert) instead of duplicating it.
priceHistorySchema.index(
  { state: 1, district: 1, market: 1, commodity: 1, arrivalDate: 1 },
  { unique: true }
);

module.exports = mongoose.model('PriceHistory', priceHistorySchema);