// backend/utils/cropRecommendation.js
//
// Deliberately rule-based, not ML — a lookup table of well-established
// agronomy guidance (season + soil type -> suitable crops), same spirit
// as the scheme eligibility engine. This is general agronomic knowledge,
// not personalized to a specific field's exact conditions — always
// presented as a starting suggestion, not a directive.

const SEASONS = ['Kharif', 'Rabi', 'Zaid'];
const SOIL_TYPES = ['Red Soil', 'Black Soil (Regur)', 'Laterite Soil', 'Alluvial Soil', 'Sandy Loam'];

// [season][soilType] -> array of commonly suitable crops in Karnataka.
const CROP_TABLE = {
  'Kharif': {
    'Red Soil': ['Ragi (Finger Millet)', 'Groundnut', 'Maize', 'Pigeon Pea (Tur)'],
    'Black Soil (Regur)': ['Cotton', 'Soybean', 'Maize', 'Pigeon Pea (Tur)'],
    'Laterite Soil': ['Paddy (Rice)', 'Ragi (Finger Millet)', 'Cashew'],
    'Alluvial Soil': ['Paddy (Rice)', 'Maize', 'Sugarcane'],
    'Sandy Loam': ['Groundnut', 'Maize', 'Pulses'],
  },
  'Rabi': {
    'Red Soil': ['Jowar (Sorghum)', 'Bengal Gram (Chana)', 'Sunflower'],
    'Black Soil (Regur)': ['Jowar (Sorghum)', 'Wheat', 'Bengal Gram (Chana)', 'Safflower'],
    'Laterite Soil': ['Bengal Gram (Chana)', 'Horse Gram'],
    'Alluvial Soil': ['Wheat', 'Mustard', 'Bengal Gram (Chana)'],
    'Sandy Loam': ['Bengal Gram (Chana)', 'Sunflower'],
  },
  'Zaid': {
    'Red Soil': ['Groundnut', 'Sesame', 'Fodder crops'],
    'Black Soil (Regur)': ['Sunflower', 'Fodder crops'],
    'Laterite Soil': ['Vegetables (with irrigation)'],
    'Alluvial Soil': ['Watermelon', 'Cucumber', 'Vegetables'],
    'Sandy Loam': ['Watermelon', 'Groundnut'],
  },
};

function getCropRecommendation({ season, soilType }) {
  if (!SEASONS.includes(season)) {
    return { success: false, message: `season must be one of: ${SEASONS.join(', ')}` };
  }
  if (!SOIL_TYPES.includes(soilType)) {
    return { success: false, message: `soilType must be one of: ${SOIL_TYPES.join(', ')}` };
  }

  const crops = CROP_TABLE[season][soilType] || [];
  return {
    success: true,
    season,
    soilType,
    recommendedCrops: crops,
    note: 'General agronomic guidance for this season and soil type — not a substitute for local agricultural extension advice, which also accounts for water availability, past crop rotation, and market access.',
  };
}

module.exports = { SEASONS, SOIL_TYPES, getCropRecommendation };