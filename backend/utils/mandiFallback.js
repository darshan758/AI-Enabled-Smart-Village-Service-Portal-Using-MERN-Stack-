// backend/utils/mandiFallback.js
//
// Safety net for the mandi-price feature when data.gov.in cannot be reached
// (blocked network, outage, rate limit, missing key). Order used by
// agmarknetClient.fetchMandiPrices:
//   1. live API  ->  2. last in-memory copy  ->  3. last copy saved in MongoDB
//   ->  4. built-in SAMPLE prices (demo only).
// Everything returned from 2-4 is labelled with source + notice so the UI
// never presents it as live data. Switch off with MANDI_FALLBACK=off in .env.

const mongoose = require('mongoose');
const MandiCache = require('../models/MandiCache');
const KARNATAKA_DISTRICTS = require('./districts');

const MAX_DOC_BYTES = 12 * 1024 * 1024; // stay well under Mongo's 16 MB limit

// ── Persisted copy of the last good live fetch ───────────────────────────────
async function savePersisted(key, { records, total, fetchedAt }) {
  try {
    if (mongoose.connection.readyState !== 1) return;
    if (!records || !records.length) return;
    if (JSON.stringify(records).length > MAX_DOC_BYTES) return;
    await MandiCache.findOneAndUpdate(
      { key },
      { key, records, total, fetchedAt: new Date(fetchedAt || Date.now()) },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('[Agri] Could not save price cache:', err.message);
  }
}

async function loadPersisted(key) {
  try {
    if (mongoose.connection.readyState !== 1) return null; // avoid buffering hang
    const doc = await MandiCache.findOne({ key }).lean();
    if (!doc || !doc.records || !doc.records.length) return null;
    return { records: doc.records, total: doc.total || doc.records.length, fetchedAt: doc.fetchedAt };
  } catch (err) {
    console.error('[Agri] Could not read price cache:', err.message);
    return null;
  }
}

// ── Built-in sample prices (illustrative, NOT real market rates) ─────────────
// [commodity label as shown in the UI dropdown, typical modal price Rs/quintal]
const SAMPLE_COMMODITIES = [
  ['Rice', 3200], ['Wheat', 2600], ['Maize', 2150], ['Ragi (Finger Millet)', 3600],
  ['Jowar (Sorghum)', 3300], ['Tur (Arhar Dal)', 7500], ['Bengal Gram (Gram)', 5800],
  ['Green Gram (Moong)', 7800], ['Groundnut', 6000], ['Soyabean', 4600],
  ['Sunflower', 6200], ['Cotton', 7000], ['Onion', 1800], ['Potato', 2400],
  ['Tomato', 2200], ['Brinjal', 2000], ['Chilli', 9500], ['Turmeric', 13000],
  ['Coconut', 3000], ['Arecanut', 48000], ['Banana', 2800], ['Mango', 5500],
];

// Deterministic 0..1 value so each district gets stable but different prices
// (the "best market" feature needs prices to differ between markets).
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

function buildSampleRecords(state = 'Karnataka') {
  const records = [];
  for (const district of KARNATAKA_DISTRICTS) {
    for (const [commodity, base] of SAMPLE_COMMODITIES) {
      const factor = 0.88 + hash01(`${district}|${commodity}`) * 0.24; // 0.88 - 1.12
      const modal = Math.round((base * factor) / 10) * 10;
      records.push({
        state,
        district,
        market: `${district} APMC`,
        commodity,
        variety: 'Sample',
        grade: 'FAQ',
        arrival_date: 'Sample data',
        min_price: String(Math.round(modal * 0.92 / 10) * 10),
        max_price: String(Math.round(modal * 1.08 / 10) * 10),
        modal_price: String(modal),
        is_sample: true,
      });
    }
  }
  return records;
}

function getSample(state) {
  const records = buildSampleRecords(state || 'Karnataka');
  return { records, total: records.length };
}

module.exports = { savePersisted, loadPersisted, getSample };