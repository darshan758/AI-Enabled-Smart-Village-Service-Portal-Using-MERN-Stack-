// backend/utils/fertilizerRecommendation.js
//
// Rule-based NPK fertilizer guidance. A farmer (or extension worker on
// their behalf) enters N/P/K soil test levels as Low/Medium/High for a
// given crop, and gets a standard corrective recommendation. This
// mirrors real soil-health-card advisory logic used in India, kept
// deliberately simple and table-driven rather than a black-box model —
// every recommendation traces back to a readable rule.

const LEVELS = ['Low', 'Medium', 'High'];

// Baseline full-dose fertilizer recommendation per crop (kg/acre), which
// gets scaled down as the soil's existing NPK level rises — a Low
// reading needs the full dose, Medium needs about half, High needs a
// maintenance dose only.
const CROP_BASE_DOSE_KG_PER_ACRE = {
  'Paddy (Rice)':          { N: 48, P: 24, K: 24 },
  'Ragi (Finger Millet)':  { N: 32, P: 16, K: 16 },
  'Maize':                 { N: 60, P: 30, K: 20 },
  'Cotton':                { N: 40, P: 20, K: 20 },
  'Sugarcane':             { N: 100, P: 40, K: 40 },
  'Groundnut':             { N: 10, P: 20, K: 20 },
  'Wheat':                 { N: 48, P: 24, K: 16 },
  'Bengal Gram (Chana)':   { N: 8, P: 20, K: 8 },
  'Sunflower':             { N: 24, P: 24, K: 16 },
  'Vegetables':            { N: 40, P: 20, K: 20 },
};

const LEVEL_MULTIPLIER = { Low: 1.0, Medium: 0.5, High: 0.15 };

function getFertilizerRecommendation({ crop, nitrogenLevel, phosphorusLevel, potassiumLevel }) {
  if (!CROP_BASE_DOSE_KG_PER_ACRE[crop]) {
    return {
      success: false,
      message: `No fertilizer guidance configured for "${crop}" yet. Available crops: ${Object.keys(CROP_BASE_DOSE_KG_PER_ACRE).join(', ')}`,
    };
  }
  // Safety: never guess a dose without real soil-test data.
  const levelsIn = [nitrogenLevel, phosphorusLevel, potassiumLevel];
  if (levelsIn.some((v) => v === 'Unknown' || v === undefined || v === null || v === '')) {
    return {
      success: false,
      needsSoilTest: true,
      message: 'Fertilizer dose cannot be suggested without soil test values. Get a free Soil Health Card from your nearest Krishi Vigyan Kendra / Raitha Samparka Kendra, then enter the N, P, K levels.',
    };
  }
  for (const [label, val] of [['nitrogenLevel', nitrogenLevel], ['phosphorusLevel', phosphorusLevel], ['potassiumLevel', potassiumLevel]]) {
    if (!LEVELS.includes(val)) {
      return { success: false, message: `${label} must be one of: ${LEVELS.join(', ')}` };
    }
  }

  const base = CROP_BASE_DOSE_KG_PER_ACRE[crop];
  const recommended = {
    N: Math.round(base.N * LEVEL_MULTIPLIER[nitrogenLevel]),
    P: Math.round(base.P * LEVEL_MULTIPLIER[phosphorusLevel]),
    K: Math.round(base.K * LEVEL_MULTIPLIER[potassiumLevel]),
  };

  // "Show your working": exact formula for every nutrient so the farmer
  // (or extension officer) can verify the number.
  const breakdown = ['N', 'P', 'K'].map((nut) => {
    const level = { N: nitrogenLevel, P: phosphorusLevel, K: potassiumLevel }[nut];
    return {
      nutrient: nut,
      soilLevel: level,
      cropFullDoseKgPerAcre: base[nut],
      multiplier: LEVEL_MULTIPLIER[level],
      resultKgPerAcre: recommended[nut],
      formula: `${base[nut]} kg x ${LEVEL_MULTIPLIER[level]} (${level} soil level) = ${recommended[nut]} kg`,
    };
  });

  const advice = [];
  if (nitrogenLevel === 'Low') advice.push('Nitrogen is low — apply in 2–3 split doses through the growing season rather than all at once, to reduce leaching loss.');
  if (phosphorusLevel === 'Low') advice.push('Phosphorus is low — apply as a single basal dose at sowing/transplanting, since phosphorus moves very little in soil once applied.');
  if (potassiumLevel === 'Low') advice.push('Potassium is low — split into 2 doses if the crop duration is long (e.g. sugarcane, cotton).');
  if (nitrogenLevel === 'High' && phosphorusLevel === 'High' && potassiumLevel === 'High') {
    advice.push('All three levels are already high — consider skipping fertilizer this season and getting a fresh soil test before the next one, to avoid over-application.');
  }

  return {
    success: true,
    crop,
    inputLevels: { nitrogenLevel, phosphorusLevel, potassiumLevel },
    recommendedDoseKgPerAcre: recommended,
    breakdown,
    advice,
    note: 'Standard corrective guidance based on soil test levels — a certified soil health card or local Krishi Vigyan Kendra recommendation should be preferred when available.',
  };
}

module.exports = { LEVELS, CROP_BASE_DOSE_KG_PER_ACRE, getFertilizerRecommendation };