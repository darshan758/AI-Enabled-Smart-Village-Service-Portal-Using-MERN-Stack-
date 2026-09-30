// utils/kannadaKeywords.js
//
// Very small, deliberately simple keyword -> category mapper for Kannada
// speech input. This is NOT a trained NLP model — it's a plain substring
// match against a short list of common words villagers are likely to
// actually say for each issue type. It only ever SUGGESTS a category
// (the citizen can always change it); it never auto-submits anything.
//
// Extend these lists over time as real transcripts come in — they are
// intentionally easy to edit without touching any other logic.

const CATEGORY_KEYWORDS = {
  'Road Damage': ['ಗುಂಡಿ', 'ರಸ್ತೆ', 'ಗುಂಡಿಗಳು', 'road', 'pothole'],
  'Street Light Damage': ['ದೀಪ', 'ಲೈಟ್', 'ಬೀದಿ ದೀಪ', 'light', 'streetlight'],
  'Water Leakage': ['ನೀರು', 'ಲೀಕ್', 'ಪೈಪ್', 'water', 'leak'],
  'Garbage Issue': ['ಕಸ', 'ತ್ಯಾಜ್ಯ', 'garbage', 'waste'],
  'Drainage Problem': ['ನಾಲೆ', 'ಡ್ರೈನೇಜ್', 'ಚರಂಡಿ', 'drain', 'drainage'],
  'Electricity Problem': ['ವಿದ್ಯುತ್', 'ಕರೆಂಟ್', 'ಶಾರ್ಟ್', 'electricity', 'current'],
};

/**
 * Suggest a category from a transcript. Returns the category name, or
 * null if nothing matched — callers should treat null as "no
 * suggestion, leave it to the citizen."
 */
export function suggestCategoryFromText(transcript) {
  if (!transcript) return null;
  const lower = transcript.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  return null;
}

export default CATEGORY_KEYWORDS;