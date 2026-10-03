// Test queries for the retriever. expected = list of acceptable FAQ ids, or null = out of scope.
module.exports = [
  ['how do i register', ['acc-1']], ['I want to create a new account', ['acc-1', 'gen-3']], ['sign up kaise kare', ['acc-1']],
  ['forgot password', ['acc-2']], ['cannot remember my password', ['acc-2']], ['pasword reset', ['acc-2']],
  ['who to contact for help', ['acc-3']], ['customer care number', ['acc-3']],
  ['what is this website', ['gen-1']], ['is it free', ['gen-2']], ['do i have to pay anything', ['gen-2']],
  ['do I need login to check schemes', ['gen-3']], ['which languages are supported', ['gen-4', 'new-lang']],
  ['how to complain about a broken road', ['comp-1']], ['report garbage problem in my street', ['comp-1']],
  ['how to raise an issue', ['comp-1']], ['can I upload picture with my complaint', ['comp-4']],
  ['how long will it take to fix', ['comp-5']], ['what happens after I submit', ['comp-3', 'new-who-fixes']],
  ['check complaint status', ['comp-2', 'new-track-id']], ['where is my complaint', ['comp-2', 'new-track-id']],
  ['which scheme am i eligible for', ['new-schemes-rec', 'scheme-1']], ['suggest schemes for me', ['new-schemes-rec']],
  ['documents for pm kisan', ['new-pmkisan-docs']], ['what papers are required for scholarship', ['new-scholarship-docs', 'scheme-2']],
  ['which documents do I need to upload', ['scheme-2']], ['how does ocr verify my certificate', ['scheme-3']],
  ['does eligible mean approved', ['scheme-4']], ['ayushman bharat health card eligibility', ['new-ayushman']],
  ['where do mandi prices come from', ['agri-1']], ['how often prices update', ['agri-2']], ['price of crop in my district', ['agri-3']],
  ['will it rain this week for my farm', ['new-weather']], ['weather alert for farmers', ['new-weather']],
  ['which crop to grow in red soil', ['new-crop']], ['how much urea should I use', ['new-fertilizer']], ['npk dose for paddy', ['new-fertilizer']],
  ['should I sell tomatoes now or wait', ['new-sellwait']], ['best market to sell ragi', ['new-market']],
  ['can I speak my complaint in kannada', ['new-voice']], ['record voice message for complaint', ['new-voice']],
  ['what is ai suggestion', ['new-ai-suggest']], ['how will I know work is really completed', ['new-who-fixes']],
  ['complaint not solved for many days', ['new-delay']], ['I am a worker how to login', ['new-roles']],
  ['is my aadhaar safe', ['new-privacy']], ['will I get sms', ['new-sms']],
  // Kannada script
  ['ನನಗೆ ಯಾವ ಯೋಜನೆ ಸೂಕ್ತ', ['new-schemes-rec']], ['ಪಿಎಂ ಕಿಸಾನ್ ದಾಖಲೆಗಳು', ['new-pmkisan-docs']],
  ['ಮಳೆ ಮುನ್ಸೂಚನೆ ಹೇಗೆ ನೋಡುವುದು', ['new-weather']], ['ಯಾವ ಬೆಳೆ ಬೆಳೆಯಬೇಕು', ['new-crop']], ['ಗೊಬ್ಬರ ಎಷ್ಟು ಹಾಕಬೇಕು', ['new-fertilizer']],
  ['ಕನ್ನಡದಲ್ಲಿ ದೂರು ನೀಡಬಹುದೇ', ['new-voice']], ['ದೂರು ತಡವಾದರೆ ಏನು ಮಾಡಬೇಕು', ['new-delay']], ['ನನ್ನ ಮಾಹಿತಿ ಸುರಕ್ಷಿತವೇ', ['new-privacy']],
  // romanized
  ['yava yojane nanage sigutte', ['new-schemes-rec']], ['gobbara eshtu haakabeku', ['new-fertilizer']], ['kannadadalli doora kodabahude', ['new-voice']],
  // out of scope
  ['who won the cricket match yesterday', null], ['tell me a joke', null], ['what is the capital of france', null], ['book a train ticket', null],
];