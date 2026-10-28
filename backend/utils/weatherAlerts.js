// backend/utils/weatherAlerts.js
//
// Turns a raw 5-day forecast (from weatherClient.js) into a short list
// of plain-language farming alerts. Deliberately simple, explainable
// rules — each alert states exactly which forecast values triggered
// it, not a black-box "risk score."

function summarizeUpcoming(slices, hoursAhead) {
  const cutoff = Date.now() + hoursAhead * 60 * 60 * 1000;
  return slices.filter((s) => (s.ts ?? new Date(s.time + 'Z').getTime()) <= cutoff);
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

// ─────────────────────────────────────────────────────────────────────────────
// Full plain-language weather picture (not just threshold alerts):
// temperature, humidity, chance of rain, wind - now, next 24h, and per day.
// ─────────────────────────────────────────────────────────────────────────────
const round = (n) => (n === null || n === undefined || !isFinite(n) ? null : Math.round(n));
const pct = (p) => Math.round((p || 0) * 100);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const nums = (arr, k) => arr.map((x) => x[k]).filter((v) => typeof v === 'number');

function rainChanceLabel(p) {
  if (p >= 70) return 'Very likely';
  if (p >= 40) return 'Likely';
  if (p >= 20) return 'Possible';
  return 'Unlikely';
}

function mostCommon(list) {
  const counts = {};
  list.filter(Boolean).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

function describeSlices(group) {
  const temps = nums(group, 'tempC');
  const hum = nums(group, 'humidity');
  const pops = nums(group, 'pop');
  const wind = nums(group, 'windSpeedMs');
  const rain = group.reduce((sum, s) => sum + (s.rainMm || 0), 0);
  const maxPop = pops.length ? pct(Math.max(...pops)) : 0;
  return {
    tempMinC: round(Math.min(...temps)),
    tempMaxC: round(Math.max(...temps)),
    tempAvgC: round(avg(temps)),
    humidityAvg: round(avg(hum)),
    humidityMin: round(Math.min(...hum)),
    humidityMax: round(Math.max(...hum)),
    rainChancePct: maxPop,
    rainChanceLabel: rainChanceLabel(maxPop),
    rainMm: Math.round(rain * 10) / 10,
    windMaxMs: round(Math.max(...wind)),
    windMaxKmh: wind.length ? round(Math.max(...wind) * 3.6) : null,
    description: mostCommon(group.map((s) => s.description)),
  };
}

function buildWeatherSummary({ city, slices }) {
  if (!slices || !slices.length) return null;

  // "Now" = the forecast slot closest to the current time
  const now = Date.now();
  const slotTs = (s) => s.ts ?? new Date(s.time + 'Z').getTime();
  const current = slices.reduce((best, s) =>
    Math.abs(slotTs(s) - now) < Math.abs(slotTs(best) - now) ? s : best, slices[0]);

  const next24 = slices.filter((s) => slotTs(s) <= now + 24 * 3600 * 1000);
  const next48 = slices.filter((s) => slotTs(s) <= now + 48 * 3600 * 1000);

  // Group by calendar day in India time (UTC+5:30)
  const IST_MS = 5.5 * 3600 * 1000;
  const byDay = new Map();
  slices.forEach((s) => {
    const key = new Date(slotTs(s) + IST_MS).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(s);
  });
  const daily = [...byDay.entries()].map(([date, group]) => ({ date, ...describeSlices(group) }));

  return {
    city,
    now: {
      tempC: round(current.tempC),
      feelsLikeC: round(current.feelsLikeC),
      humidity: round(current.humidity),
      rainChancePct: pct(current.pop),
      rainChanceLabel: rainChanceLabel(pct(current.pop)),
      windMs: round(current.windSpeedMs),
      windKmh: current.windSpeedMs != null ? round(current.windSpeedMs * 3.6) : null,
      cloudsPct: current.cloudsPct,
      description: current.description,
    },
    next24h: describeSlices(next24.length ? next24 : [current]),
    next48h: describeSlices(next48.length ? next48 : [current]),
    daily,
  };
}

module.exports = { getCropWeatherAlerts, buildWeatherSummary };