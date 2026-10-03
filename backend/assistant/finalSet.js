// FINAL held-out queries. Written after all tuning was finished and evaluated ONCE.
module.exports = [
  ['I want to open an account on this site', ['acc-1', 'gen-3']], ['password lost, how to get back access', ['acc-2']],
  ['is there any helpline for problems with the portal', ['acc-3']], ['what is the purpose of this portal', ['gen-1']],
  ['no charges for citizens?', ['gen-2']], ['can i see schemes without signing in', ['gen-3', 'scheme-1']],
  ['how to file a complaint about drainage overflow', ['comp-1']], ['can I mark the spot on the map for my complaint', ['comp-4']],
  ['what is the process after I lodge a complaint', ['comp-3', 'new-who-fixes']], ['how soon will the officials act', ['comp-5', 'new-delay']],
  ['enter tracking number to see progress', ['comp-2', 'new-track-id']], ['which of the government schemes suits a farmer like me', ['new-schemes-rec']],
  ['papers needed to apply for kisan samman', ['new-pmkisan-docs']], ['required documents for scholarship for students', ['new-scholarship-docs', 'scheme-2']],
  ['is the health insurance scheme checked against live government data', ['new-ayushman']], ['how are the prices obtained', ['agri-1']],
  ['can i look up rates for only one district', ['agri-3']], ['heavy rain alert for farmers in my district', ['new-weather']],
  ['best crop for sandy loam in summer', ['new-crop']], ['how much potash and nitrogen for sugarcane', ['new-fertilizer']],
  ['wait for better price or sell today', ['new-sellwait']], ['which mandi pays more after transport', ['new-market']],
  ['complaint through speech in my mother tongue', ['new-voice', 'new-lang']], ['what does the blue box with AI suggestion mean', ['new-ai-suggest']],
  ['what if officials do not respond to my issue', ['new-delay']], ['how do I log in as a department staff member', ['new-roles']],
  ['are my uploaded certificates deleted', ['new-privacy']], ['ಯೋಜನೆಗೆ ನಾನು ಅರ್ಹನೇ ಎಂದು ತಿಳಿಯುವುದು ಹೇಗೆ', ['new-schemes-rec', 'scheme-1', 'scheme-4']],
  ['ಗೊಬ್ಬರದ ಪ್ರಮಾಣ ಹೇಳಿ', ['new-fertilizer']], ['ನನ್ನ ದೂರಿನ ಬಗ್ಗೆ ಯಾರೂ ಉತ್ತರಿಸಿಲ್ಲ', ['new-delay']],
  ['who is the chief minister', null], ['what is the weather like on mars', null], ['recommend a good movie', null], ['how to learn python', null],
];