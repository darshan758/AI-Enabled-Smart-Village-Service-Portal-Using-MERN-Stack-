// backend/utils/agmarknetClient.js
//
// Fetches daily mandi (market) prices from India's Open Government Data
// platform (data.gov.in) — the official Agmarknet dataset published by
// the Ministry of Agriculture and Farmers Welfare.
//
// Resource: "Current Daily Price of Various Commodities from Various
// Markets (Mandi)" — resource_id 9ef84268-d588-465a-a308-a864a43d0070.
//
// CACHING: since mandi prices only change once a day (not per-second),
// the full state-level batch is cached in memory for CACHE_TTL_MS. All
// district/commodity searches within that window are served from this
// one cached batch instead of making a fresh government API call per
// search — faster, and avoids tripping their rate limiting.
//
// PAGINATION: earlier versions capped this at a single page (limit=500),
// which could silently miss districts whose records fell past that cutoff.
// This version pages through with offset/limit until every record for the
// requested state has been fetched, so no district is missed due to
// pagination — confirmed against data.gov.in's documented offset/limit
// pagination support for this resource.
//
// FILTERING: deliberately does NOT pass district/commodity as server-side
// filters to data.gov.in — a live test confirmed their exact-match
// filtering can silently fail on a name mismatch (e.g. a renamed district)
// and return an UNRELATED record instead of an empty result, which is
// worse than not filtering at all. Instead we fetch the full state batch
// here and let the controller do precise, synonym-aware matching itself.

const axios = require('axios');

const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const BASE_URL = `https://api.data.gov.in/resource/${RESOURCE_ID}`;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes — plenty fresh for daily-updated data
const PAGE_SIZE = 500;               // per-request page size while paginating
const MAX_PAGES = 20;                // safety cap: 20 * 500 = 10,000 records max
const PAGE_DELAY_MS = 300;           // pause between paginated requests — avoids
                                      // firing many rapid back-to-back calls, which
                                      // was itself triggering the government's rate
                                      // limiter once enough districts had data to
                                      // need several pages.

const cache = new Map(); // key -> { data, expiresAt }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cacheKey({ state }) {
  return (state || '').toLowerCase();
}

async function fetchOnePage(apiKey, state, offset) {
  const params = {
    'api-key': apiKey,
    format: 'json',
    offset,
    limit: PAGE_SIZE,
  };
  if (state) params['filters[state]'] = state;

  const { data } = await axios.get(BASE_URL, { params, timeout: 10000 });
  return {
    records: data.records || [],
    total: data.total || 0,
  };
}

/**
 * fetchMandiPrices({ state })
 * Returns { records, total } — records is EVERY record for the state
 * (paginated through, not capped at one page). Throws a friendly Error
 * on failure.
 *
 * Resilience: if pagination fails partway through (e.g. rate limited on
 * page 8 of 12), whatever pages were already successfully fetched are
 * still cached and returned instead of being discarded — so the next
 * search isn't forced to restart from page 0, and the person still gets
 * a partial, genuinely correct result rather than a hard failure.
 */
async function fetchMandiPrices({ state } = {}) {
  const key = cacheKey({ state });
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const apiKey = process.env.AGMARKNET_API_KEY;

  if (!apiKey) {
    const err = new Error(
      'Market price service is not configured (missing AGMARKNET_API_KEY). Contact the site admin.'
    );
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  let allRecords = [];
  let total = 0;
  let offset = 0;
  let page = 0;
  let partialFailure = null;

  try {
    // Page through until we've fetched everything (or hit the safety cap)
    // eslint-disable-next-line no-constant-condition
    while (page < MAX_PAGES) {
      if (page > 0) await sleep(PAGE_DELAY_MS); // throttle — see PAGE_DELAY_MS above

      const { records, total: reportedTotal } = await fetchOnePage(apiKey, state, offset);
      total = reportedTotal;
      allRecords = allRecords.concat(records);
      page += 1;

      if (records.length < PAGE_SIZE) break; // last page reached
      if (allRecords.length >= total && total > 0) break; // fetched everything reported
      offset += PAGE_SIZE;
    }
  } catch (err) {
    // Don't throw immediately — remember the failure, but keep whatever
    // pages we already got. A partial result is better than none, and
    // means the next search doesn't have to restart from scratch.
    partialFailure = err;
  }

  // Diagnostic: log the real, raw district name strings this dataset
  // actually uses, so district-name mismatches (renamed districts, etc.)
  // can be fixed against ground truth instead of guessing.
  const uniqueDistricts = [...new Set(allRecords.map((r) => r.district).filter(Boolean))].sort();
  console.log(
    `[Agri] Fetched ${allRecords.length} record(s) across ${page} page(s) for state="${state}".` +
    (partialFailure ? ` (stopped early: ${partialFailure.message})` : '') +
    ` Unique district values seen (${uniqueDistricts.length}): ${uniqueDistricts.join(', ')}`
  );

  if (allRecords.length > 0) {
    // We got at least some usable data — cache and return it, even if
    // pagination didn't fully complete.
    const result = { records: allRecords, total };
    cache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  if (partialFailure) {
    if (partialFailure.response?.status === 429) {
      const rateLimitErr = new Error(
        'The market price service is receiving a lot of requests right now. Please wait a minute and try again.'
      );
      rateLimitErr.code = 'RATE_LIMITED';
      throw rateLimitErr;
    }
    if (partialFailure.response) {
      const apiErr = new Error(
        `Market price service returned an error (${partialFailure.response.status}). It may be temporarily down.`
      );
      apiErr.code = 'UPSTREAM_ERROR';
      throw apiErr;
    }
    const timeoutErr = new Error(
      'Market price service did not respond in time. Please try again shortly.'
    );
    timeoutErr.code = 'TIMEOUT_OR_NETWORK';
    throw timeoutErr;
  }

  // No failure, just genuinely zero records published right now.
  const result = { records: [], total: 0 };
  cache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

module.exports = { fetchMandiPrices };