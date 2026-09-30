// backend/utils/priceHistoryRecorder.js
//
// Two jobs:
//  1. recordSnapshot() — call this with whatever records a live AGMARKNET
//     fetch returned, and it upserts them into PriceHistory. Cheap and
//     safe to call on every price lookup — duplicates for the same day
//     are just updated in place, not re-inserted.
//  2. computeTrend() — looks at OUR accumulated history for one
//     commodity+district (across however many days we've actually
//     recorded) and returns a simple direction (rising/falling/stable)
//     plus a percentage change. Returns null (not a fabricated number)
//     if there isn't enough history yet to say anything meaningful.

const PriceHistory = require('../models/PriceHistory');

const MIN_DAYS_FOR_TREND = 3; // fewer than this and a "trend" would just be noise

async function recordSnapshot(records) {
  if (!records || records.length === 0) return;

  const ops = records
    .filter((r) => r.state && r.district && r.market && r.commodity && r.arrival_date)
    .map((r) => ({
      updateOne: {
        filter: {
          state: r.state,
          district: r.district,
          market: r.market,
          commodity: r.commodity,
          arrivalDate: r.arrival_date,
        },
        update: {
          $set: {
            variety: r.variety || null,
            minPrice: Number(r.min_price) || null,
            maxPrice: Number(r.max_price) || null,
            modalPrice: Number(r.modal_price) || null,
            recordedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

  if (ops.length === 0) return;

  try {
    await PriceHistory.bulkWrite(ops, { ordered: false });
  } catch (err) {
    // Never let history-recording break the actual price lookup the
    // citizen is waiting on — log and move on.
    console.error('[Agri] Failed to record price history:', err.message);
  }
}

/**
 * computeTrend({ district, commodity })
 * Returns { direction, changePercent, dayCount, dailyModalPrices } or
 * null if there isn't enough accumulated history yet.
 */
async function computeTrend({ district, commodity }) {
  const rows = await PriceHistory.find({ district, commodity, modalPrice: { $ne: null } })
    .sort({ recordedAt: 1 })
    .lean();

  // Collapse to one average modal price per calendar day (a district can
  // have several markets reporting the same commodity on the same day).
  const byDay = new Map();
  for (const r of rows) {
    const day = r.arrivalDate;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(r.modalPrice);
  }
  const dailyModalPrices = [...byDay.entries()].map(([day, prices]) => ({
    day,
    avgModalPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
  }));

  if (dailyModalPrices.length < MIN_DAYS_FOR_TREND) {
    return null; // honestly not enough data yet — no fabricated trend
  }

  const first = dailyModalPrices[0].avgModalPrice;
  const last = dailyModalPrices[dailyModalPrices.length - 1].avgModalPrice;
  const changePercent = first === 0 ? 0 : Math.round(((last - first) / first) * 1000) / 10;

  let direction = 'stable';
  if (changePercent >= 3) direction = 'rising';
  else if (changePercent <= -3) direction = 'falling';

  return {
    direction,
    changePercent,
    dayCount: dailyModalPrices.length,
    dailyModalPrices,
  };
}

module.exports = { recordSnapshot, computeTrend, MIN_DAYS_FOR_TREND };