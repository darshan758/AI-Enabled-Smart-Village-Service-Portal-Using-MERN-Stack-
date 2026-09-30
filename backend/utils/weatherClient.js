// backend/utils/weatherClient.js
//
// Thin wrapper around OpenWeatherMap's free-tier "5 day / 3 hour
// forecast" endpoint, keyed off the same district-headquarters
// coordinates already used for market-distance estimates
// (districtCoordinates.js) — so no new geocoding step is needed.
//
// Cached per district for 30 minutes: weather genuinely changes during
// a day, but a farmer checking twice in the same half hour doesn't need
// two upstream calls, and it keeps us comfortably inside the free-tier
// rate limit (60 calls/minute) even under load.

const axios = require('axios');
const { DISTRICT_COORDINATES } = require('./districtCoordinates');

const BASE_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map(); // district -> { fetchedAt, data }

async function fetchForecast(district) {
  const coords = DISTRICT_COORDINATES[district];
  if (!coords) {
    const err = new Error(`No coordinates configured for district "${district}"`);
    err.code = 'UNKNOWN_DISTRICT';
    throw err;
  }

  const cached = cache.get(district);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    const err = new Error('Weather feature is not configured on this server yet (missing OPENWEATHER_API_KEY).');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  try {
    const { data } = await axios.get(BASE_URL, {
      params: { lat: coords.lat, lon: coords.lng, appid: apiKey, units: 'metric' },
      timeout: 8000,
    });

    // Keep only what the advisory logic actually needs — the raw
    // response has ~40 timestamped entries (3-hour steps, 5 days).
    const slices = (data.list || []).map((entry) => ({
      time: entry.dt_txt,
      tempC: entry.main?.temp,
      humidity: entry.main?.humidity,
      rainMm: entry.rain?.['3h'] || 0,
      windSpeedMs: entry.wind?.speed,
      condition: entry.weather?.[0]?.main || null,
      description: entry.weather?.[0]?.description || null,
    }));

    const result = { district, city: data.city?.name || district, slices };
    cache.set(district, { fetchedAt: Date.now(), data: result });
    return result;
  } catch (err) {
    // Serve stale cache rather than fail outright, same resilience
    // pattern as the mandi price client — a farmer checking during a
    // brief outage still gets something useful, clearly labeled stale.
    if (cached) {
      return { ...cached.data, stale: true };
    }
    if (err.code === 'NOT_CONFIGURED' || err.code === 'UNKNOWN_DISTRICT') throw err;
    const wrapped = new Error('Could not reach the weather service right now.');
    wrapped.code = 'UPSTREAM_FAILED';
    throw wrapped;
  }
}

module.exports = { fetchForecast };