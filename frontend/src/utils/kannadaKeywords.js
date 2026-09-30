const CATEGORY_KEYWORDS = {
  'Road Damage': ['ಗುಂಡಿ', 'ರಸ್ತೆ', 'ಗುಂಡಿಗಳು', 'road', 'pothole'],
  'Street Light Damage': ['ದೀಪ', 'ಲೈಟ್', 'ಬೀದಿ ದೀಪ', 'light', 'streetlight'],
  'Water Leakage': ['ನೀರು', 'ಲೀಕ್', 'ಪೈಪ್', 'water', 'leak'],
  'Garbage Issue': ['ಕಸ', 'ತ್ಯಾಜ್ಯ', 'garbage', 'waste'],
  'Drainage Problem': ['ನಾಲೆ', 'ಡ್ರೈನೇಜ್', 'ಚರಂಡಿ', 'drain', 'drainage'],
  'Electricity Problem': ['ವಿದ್ಯುತ್', 'ಕರೆಂಟ್', 'ಶಾರ್ಟ್', 'electricity', 'current'],
};

export function suggestCategoryFromText(transcript) {
  if (!transcript) return null;

  const lower = transcript.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
      return category;
    }
  }

  return null;
}

export default CATEGORY_KEYWORDS;
