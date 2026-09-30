// backend/utils/weatherAlerts.js
//
// Turns a raw 5-day forecast (from weatherClient.js) into a short list
// of plain-language farming alerts. Deliberately simple, explainable
// rules — each alert states exactly which forecast values triggered
// it, not a black-box "risk score."

function summarizeUpcoming(slices, hoursAhead) {
  const cutoff = Date.now() + hoursAhead * 60 * 60 * 1000;
  return slices.filter((s) => new Date(s.time).getTime() <= cutoff);
}

function getCropWeatherAlerts({ district, city, slices }) {
  const alerts = [];
  const next48h = summarizeUpcoming(slices, 48);
  const next24h = summarizeUpcoming(slices, 24);

  // Heavy rain — relevant to harvest timing and drainage/waterlogging.
  const totalRain48h = next48h.reduce((sum, s) => sum + (s.rainMm || 0), 0);
  if (totalRain48h >= 40) {
    alerts.push({
      type: 'heavy_rain',
      severity: 'high',
      message: `Heavy rain expected — about ${Math.round(totalRain48h)}mm total over the next 48 hours in ${city}. ` +
        `If your crop is ready, consider harvesting before the rain if possible. Check field drainage to avoid waterlogging.`,
    });
  } else if (totalRain48h >= 15) {
    alerts.push({
      type: 'moderate_rain',
      severity: 'medium',
      message: `Moderate rain expected — about ${Math.round(totalRain48h)}mm over the next 48 hours in ${city}. ` +
        `Fine for most standing crops, but avoid spraying pesticide/fertilizer right before rain — it will wash off.`,
    });
  }

  // Heat — relevant to irrigation timing and flowering-stage crop stress.
  const maxTemp24h = Math.max(...next24h.map((s) => s.tempC ?? -Infinity));
  if (maxTemp24h >= 40) {
    alerts.push({
      type: 'heat_wave',
      severity: 'high',
      message: `Very high temperature expected — up to ${Math.round(maxTemp24h)}°C in the next 24 hours in ${city}. ` +
        `Irrigate in early morning or evening rather than midday to reduce water loss. Watch young plants for heat stress.`,
    });
  }

  // Cold / frost risk — relevant mainly in winter months for frost-sensitive crops.
  const minTemp24h = Math.min(...next24h.map((s) => s.tempC ?? Infinity));
  if (minTemp24h <= 10) {
    alerts.push({
      type: 'cold_risk',
      severity: minTemp24h <= 5 ? 'high' : 'medium',
      message: `Low temperature expected — down to ${Math.round(minTemp24h)}°C in the next 24 hours in ${city}. ` +
        `Frost-sensitive crops (vegetables, banana, papaya) may need protection overnight (light irrigation or covering).`,
    });
  }

  // High wind — relevant to spraying and tall/lodging-prone crops.
  const maxWind24h = Math.max(...next24h.map((s) => s.windSpeedMs ?? -Infinity));
  if (maxWind24h >= 10) {
    alerts.push({
      type: 'high_wind',
      severity: 'medium',
      message: `Strong wind expected — up to ${Math.round(maxWind24h)} m/s in the next 24 hours in ${city}. ` +
        `Avoid spraying (drift risk) and check support/staking for tall crops like maize, sugarcane, or banana.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: 'none',
      severity: 'low',
      message: `No significant weather risks detected for ${city} in the next 48 hours — normal farming conditions expected.`,
    });
  }

  return alerts;
}

module.exports = { getCropWeatherAlerts };