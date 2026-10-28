// backend/utils/priceHistoryJob.js
//
// Price history used to be recorded ONLY when someone happened to search
// prices, so "Should I sell now or wait?" stayed empty on quiet days. This
// job fetches the Karnataka prices itself every few hours and records them,
// so history builds up on its own (3 days of data are needed for advice).
// Only REAL live data is recorded - never cached or sample prices.

const mongoose = require('mongoose');
const { fetchMandiPrices } = require('./agmarknetClient');
const { recordSnapshot } = require('./priceHistoryRecorder');

const EVERY_MS = 4 * 60 * 60 * 1000; // every 4 hours (prices appear gradually through the day)
let started = false;

async function runOnce() {
  try {
    if (mongoose.connection.readyState !== 1) return; // DB not ready yet
    const { records, source } = await fetchMandiPrices({ state: 'Karnataka', limit: 500 });
    if (source === 'live' && records.length) {
      await recordSnapshot(records);
      console.log(`[Agri] Daily recorder saved ${records.length} live price record(s) to history.`);
    }
  } catch (err) {
    console.warn('[Agri] Daily recorder skipped:', err.message);
  }
}

function startDailyPriceRecorder() {
  if (started || String(process.env.PRICE_RECORDER || 'on').toLowerCase() === 'off') return;
  started = true;
  setTimeout(runOnce, 30 * 1000);            // first run shortly after the server starts
  setInterval(runOnce, EVERY_MS).unref();
}

module.exports = { startDailyPriceRecorder, runOnce };