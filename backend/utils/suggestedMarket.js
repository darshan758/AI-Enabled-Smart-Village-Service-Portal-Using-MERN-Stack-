// backend/utils/suggestedMarket.js
//
// Compares the same commodity's price ACROSS the markets already present
// in a fetched state-level AGMARKNET batch, and factors in an estimated
// transport cost based on distance from the farmer's own district to
// each market's district. This is a genuine, real comparison of real
// government-published prices — the part that is an ESTIMATE is the
// transport cost, which uses a flat assumed rate per km per quintal
// since we have no access to real freight pricing. That estimate is
// clearly labeled as such in the response, never presented as exact.

const { distanceBetweenDistrictsKm } = require('./districtCoordinates');

// Rough, configurable assumption: cost to move one quintal (100kg) of
// produce one kilometre by local transport. This is a placeholder
// estimate for a small-scale farmer's typical tempo/tractor-trailer
// hire — real cost varies a lot by region, road quality, and season.
const ASSUMED_TRANSPORT_COST_PER_KM_PER_QUINTAL = 2; // INR

function suggestMarkets({ records, commodity, fromDistrict, quintals = 1 }) {
  const bare = commodity.toLowerCase();
  const matching = records.filter((r) => (r.commodity || '').toLowerCase().includes(bare));

  // Group by market, average the modal price per market.
  const byMarket = new Map();
  for (const r of matching) {
    const key = `${r.market}|${r.district}`;
    if (!byMarket.has(key)) byMarket.set(key, { market: r.market, district: r.district, prices: [] });
    const modal = Number(r.modal_price);
    if (!isNaN(modal)) byMarket.get(key).prices.push(modal);
  }

  const options = [...byMarket.values()]
    .filter((m) => m.prices.length > 0)
    .map((m) => {
      const avgModalPrice = Math.round(m.prices.reduce((a, b) => a + b, 0) / m.prices.length);
      const distanceKm = distanceBetweenDistrictsKm(fromDistrict, m.district);
      const estimatedTransportCost =
        distanceKm != null ? Math.round(distanceKm * ASSUMED_TRANSPORT_COST_PER_KM_PER_QUINTAL * quintals) : null;
      const netPricePerQuintal =
        estimatedTransportCost != null ? avgModalPrice - Math.round(estimatedTransportCost / quintals) : avgModalPrice;

      return {
        market: m.market,
        district: m.district,
        avgModalPricePerQuintal: avgModalPrice,
        distanceKm,
        estimatedTransportCost,
        netPricePerQuintalAfterTransport: netPricePerQuintal,
      };
    })
    .sort((a, b) => b.netPricePerQuintalAfterTransport - a.netPricePerQuintalAfterTransport);

  return {
    commodity,
    fromDistrict,
    assumedTransportCostPerKmPerQuintal: ASSUMED_TRANSPORT_COST_PER_KM_PER_QUINTAL,
    options: options.slice(0, 8),
    disclaimer: 'Transport cost is a rough flat-rate estimate (not real freight pricing) used only to rank options — always confirm actual transport cost before deciding.',
  };
}

module.exports = { suggestMarkets, ASSUMED_TRANSPORT_COST_PER_KM_PER_QUINTAL };