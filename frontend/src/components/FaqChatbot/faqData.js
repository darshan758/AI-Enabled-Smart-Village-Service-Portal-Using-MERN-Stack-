// src/components/FaqChatbot/faqData.js
//
// Static FAQ knowledge base for the Hub-page chatbot widget.
// Pure data — no API calls, no backend dependency. Add new Q&A pairs here
// any time; nothing else needs to change.
//
// Each entry:
//   id        - unique key
//   category  - groups questions into chip sections in the UI
//   question  - shown to the user
//   answer    - shown to the user (can include \n for line breaks)
//   keywords  - extra words (beyond the question text itself) that should
//               also match this entry during free-text search

export const FAQ_CATEGORIES = [
  { id: 'general', label: 'General', emoji: '🌾' },
  { id: 'complaints', label: 'Civic Issues', emoji: '⚠️' },
  { id: 'schemes', label: 'Scheme Checker', emoji: '📋' },
  { id: 'agri', label: 'Market Prices', emoji: '📈' },
  { id: 'account', label: 'Account & Login', emoji: '🔐' },
];

export const FAQ_DATA = [
  // ---------- General ----------
  {
    id: 'gen-1',
    category: 'general',
    question: 'What is Smart Village Portal?',
    answer:
      'Smart Village Portal is a single platform bringing together three village services: reporting civic issues (like broken roads or streetlights), checking which government schemes you qualify for, and checking live agricultural market prices.',
    keywords: ['about', 'what is this', 'portal', 'platform'],
  },
  {
    id: 'gen-2',
    category: 'general',
    question: 'Is this portal free to use?',
    answer: 'Yes, Smart Village Portal is completely free for all citizens to use.',
    keywords: ['cost', 'price', 'free', 'charge'],
  },
  {
    id: 'gen-3',
    category: 'general',
    question: 'Do I need to create an account to use the portal?',
    answer:
      'You need an account to report civic issues and track them. The Scheme Checker and Market Price Checker can generally be browsed without logging in, but reporting a complaint requires signing in first.',
    keywords: ['signup', 'register', 'login required'],
  },
  {
    id: 'gen-4',
    category: 'general',
    question: 'Which languages does the portal support?',
    answer:
      'The portal interface is currently in English. Support for regional languages is planned for a future update.',
    keywords: ['language', 'kannada', 'hindi'],
  },

  // ---------- Civic Issues / Complaints ----------
  {
    id: 'comp-1',
    category: 'complaints',
    question: 'How do I report a civic issue?',
    answer:
      'Log in, open "Crowdsource Civic Issue Detection", and fill in the complaint form — add a title, description, category, a photo if you have one, and your location. Submit, and you\'ll get a tracking ID.',
    keywords: ['report', 'complaint', 'submit', 'file a complaint', 'road', 'streetlight', 'garbage', 'water leak'],
  },
  {
    id: 'comp-2',
    category: 'complaints',
    question: 'How do I track the status of my complaint?',
    answer:
      'Go to your dashboard after logging in and open "Track Complaints" — you\'ll see the current status (Pending, In Progress, or Resolved) along with any remarks from the admin handling it.',
    keywords: ['status', 'track', 'progress', 'follow up'],
  },
  {
    id: 'comp-3',
    category: 'complaints',
    question: 'What happens after I submit a complaint?',
    answer:
      'Your complaint is sent to the relevant district admin, who reviews it, updates its status as work progresses, and marks it Resolved once fixed. You\'ll be notified as the status changes.',
    keywords: ['after submit', 'what next', 'notification'],
  },
  {
    id: 'comp-4',
    category: 'complaints',
    question: 'Can I attach a photo or location to my complaint?',
    answer:
      'Yes — the complaint form lets you attach a photo and mark the exact location on the map, which helps the admin team respond faster.',
    keywords: ['photo', 'image', 'location', 'map', 'gps'],
  },
  {
    id: 'comp-5',
    category: 'complaints',
    question: 'How long does it take to resolve a complaint?',
    answer:
      'Resolution time depends on the type and priority of the issue and the local admin\'s workload. Higher-priority issues (e.g. safety hazards) are generally escalated and addressed faster.',
    keywords: ['time', 'how long', 'duration', 'escalate', 'priority'],
  },

  // ---------- Scheme Checker ----------
  {
    id: 'scheme-1',
    category: 'schemes',
    question: 'What is the Government Scheme Eligibility Checker?',
    answer:
      'It\'s a tool that tells you which government welfare schemes you likely qualify for, based on details like your income, category, occupation, and location — and lists the documents you\'d need to apply.',
    keywords: ['scheme', 'eligibility', 'welfare', 'benefits'],
  },
  {
    id: 'scheme-2',
    category: 'schemes',
    question: 'What documents do I need for scheme verification?',
    answer:
      'Commonly requested documents include your Aadhaar card, income certificate, caste certificate (if applicable), bank passbook, and education certificates — the exact list depends on the specific scheme.',
    keywords: ['documents', 'aadhaar', 'income certificate', 'caste certificate', 'bank passbook'],
  },
  {
    id: 'scheme-3',
    category: 'schemes',
    question: 'How does document verification work?',
    answer:
      'You upload a photo or scan of your document, and the system automatically reads and checks it against what the scheme requires — for example matching the name and details before confirming eligibility.',
    keywords: ['verify', 'ocr', 'upload document', 'scan'],
  },
  {
    id: 'scheme-4',
    category: 'schemes',
    question: 'Is my checked eligibility a guarantee of approval?',
    answer:
      'No — the checker gives you a strong indication of likely eligibility based on the details you provide, but final approval always rests with the concerned government department.',
    keywords: ['guarantee', 'approval', 'final decision'],
  },

  // ---------- Agri Market Prices ----------
  {
    id: 'agri-1',
    category: 'agri',
    question: 'Where do the market prices come from?',
    answer:
      'Prices are sourced directly from Agmarknet, the Government of India\'s official agricultural marketing information system, covering mandis across Karnataka.',
    keywords: ['agmarknet', 'source', 'mandi', 'government data'],
  },
  {
    id: 'agri-2',
    category: 'agri',
    question: 'How often are the crop prices updated?',
    answer:
      'Prices reflect the latest data available from Agmarknet, which is typically updated daily as mandis report their trading figures.',
    keywords: ['update', 'daily', 'live', 'fresh'],
  },
  {
    id: 'agri-3',
    category: 'agri',
    question: 'Can I check prices for a specific district or crop?',
    answer:
      'Yes — the Market Price Checker lets you filter by district and by crop to see the current mandi rates that matter to you.',
    keywords: ['filter', 'district', 'crop', 'search price'],
  },

  // ---------- Account & Login ----------
  {
    id: 'acc-1',
    category: 'account',
    question: 'How do I register for an account?',
    answer:
      'Click "Login" from the home page, then choose "Register" and fill in your name, mobile number, and district details to create your account.',
    keywords: ['register', 'signup', 'create account', 'new user'],
  },
  {
    id: 'acc-2',
    category: 'account',
    question: 'I forgot my password. What do I do?',
    answer:
      'Use the "Forgot Password" link on the login page to reset it. If you still have trouble, contact your local village/district admin for help.',
    keywords: ['forgot password', 'reset', 'cant login'],
  },
  {
    id: 'acc-3',
    category: 'account',
    question: 'Who can I contact for help with the portal?',
    answer:
      'Reach out to your district administration office, or use the support contact listed in the portal footer, for help with account or portal issues.',
    keywords: ['support', 'contact', 'help', 'admin'],
  },
];