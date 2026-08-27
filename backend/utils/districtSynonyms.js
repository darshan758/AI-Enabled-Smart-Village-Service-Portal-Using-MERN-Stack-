// backend/utils/districtSynonyms.js
//
// Karnataka officially renamed several cities/districts in 2014, but many
// government datasets (including parts of the Agmarknet mandi price data)
// still use the pre-2014 names. This maps each current official name to
// every name/spelling variant we should also match against, so a search
// for "Bengaluru Urban" also matches records stored as "Bangalore", etc.
//
// CONFIRMED FROM LIVE DATA (25 Aug 2026): the Agmarknet dataset's own
// "district" field does not perfectly mirror Karnataka's 31 official
// revenue districts — it also contains values like "Bengaluru" (no
// qualifier) and "Bengaluru South", neither of which is an official
// district name. This reflects agricultural-market-committee (APMC)
// zone boundaries, which don't always align 1:1 with revenue district
// boundaries, especially around large cities. A plain spelling variant
// ("Davangere" vs official "Davanagere") was also confirmed live.

const DISTRICT_SYNONYMS = {
  // NOTE: deliberately does NOT include a bare "Bangalore" (no Urban/Rural
  // qualifier) — that string is ambiguous, since old undivided "Bangalore"
  // district (pre-2007) also covered what is now the separate Ramanagara
  // district. A loose match on bare "Bangalore" was confirmed to wrongly
  // pull in Ramanagara market records under a "Bengaluru Urban" search.
  'Bengaluru Urban':   ['Bengaluru Urban', 'Bangalore Urban', 'Bengaluru', 'Bengaluru South'],
  'Bengaluru Rural':   ['Bengaluru Rural', 'Bangalore Rural'],
  'Mysuru':            ['Mysuru', 'Mysore'],
  'Belagavi':          ['Belagavi', 'Belgaum'],
  'Ballari':           ['Ballari', 'Bellary'],
  'Kalaburagi':        ['Kalaburagi', 'Gulbarga'],
  'Vijayapura':        ['Vijayapura', 'Bijapur'],
  'Chikkamagaluru':    ['Chikkamagaluru', 'Chikmagalur'],
  'Shivamogga':        ['Shivamogga', 'Shimoga'],
  'Tumakuru':          ['Tumakuru', 'Tumkur'],
  'Chamarajanagar':    ['Chamarajanagar', 'Chamarajnagar'],
  'Davanagere':        ['Davanagere', 'Davangere'], // confirmed spelling variant in live data
  'Vijayanagara':      ['Vijayanagara', 'Vijayanagar'], // carved out of Ballari in 2021 — NOT merged back into Ballari matching, to avoid the same ambiguity class of bug
};

/**
 * Returns every name variant to check for a given "official" district name.
 * Falls back to just the input itself if no known synonym exists.
 */
function getDistrictVariants(district) {
  if (!district) return [];
  return DISTRICT_SYNONYMS[district] || [district];
}

module.exports = { DISTRICT_SYNONYMS, getDistrictVariants };