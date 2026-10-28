// backend/utils/harvestAdvice.js
//
// A heuristic, not a forecast. Built purely on top of the price trend
// computed from OUR OWN accumulated history (see priceHistoryRecorder.js)
// — there is no actual price prediction model here. It just turns
// "prices have been rising/falling/stable over the days we've observed"
// into a plain-language suggestion, clearly labeled as a heuristic so
// it is never mistaken for a guarantee.

function getHarvestAdvice(trend) {
  if (!trend || trend.insufficient) {
    const have = trend?.dayCount || 0;
    const needed = trend?.needed || 3;
    return {
      available: false,
      dayCount: have,
      needed,
      message: have === 0
        ? `No price history recorded yet for this crop in this district. We need at least ${needed} days of prices - check back in a few days.`
        : `We have ${have} day${have === 1 ? '' : 's'} of prices for this crop so far; we need at least ${needed} days to suggest anything. Check back in ${needed - have} more day${needed - have === 1 ? '' : 's'}.`,
    };
  }

  const { direction, changePercent, dayCount } = trend;
  let message;
  let suggestion;

  if (direction === 'rising') {
    suggestion = 'Consider waiting a few more days if your crop can be stored safely.';
    message = `Prices have risen about ${changePercent}% over the last ${dayCount} days we've observed. ${suggestion}`;
  } else if (direction === 'falling') {
    suggestion = 'If your crop is ready and storage is a concern, selling soon may be better than waiting.';
    message = `Prices have fallen about ${Math.abs(changePercent)}% over the last ${dayCount} days we've observed. ${suggestion}`;
  } else {
    suggestion = 'No strong reason to wait or rush based on recent prices — sell whenever it suits your storage and cash-flow needs.';
    message = `Prices have stayed roughly stable (${changePercent >= 0 ? '+' : ''}${changePercent}%) over the last ${dayCount} days we've observed. ${suggestion}`;
  }

  return {
    available: true,
    direction,
    changePercent,
    dayCount,
    suggestion,
    message,
    disclaimer: 'This is a simple heuristic based on recently observed prices, not a price forecast or a guarantee. Weather, festivals, and transport disruptions can change prices quickly in ways this cannot predict.',
  };
}

module.exports = { getHarvestAdvice };