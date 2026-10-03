// MORE schemes for the Scheme Checker / Recommendation page (7 new ones).
// Run:  node scheme-module/seed/seedMoreSchemes.js      (from the backend folder)
// Safe to re-run: upserts by slug, never deletes or edits other schemes.
//
// IMPORTANT (say this in the viva/report): the rules below are SIMPLIFIED
// versions of the official guidelines, configured for this prototype. They use
// only the checks the portal can really perform (age, gender, occupation, land,
// income ceiling, documents). Always confirm on the official portal.
//
// Uses ONLY document types that already have a verifier in
// services/documentVerification/registry.js, so no other code changes.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Scheme = require('../models/Scheme');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_village';

const aadhaar = { type: 'aadhaar', label: 'Aadhaar Card', requiresNameMatch: true };
const bank = { type: 'bank_account', label: 'Bank Account Details', requiresNameMatch: true };
const land = { type: 'land_ownership', label: 'Land Ownership Record', requiresNameMatch: true };
const income = { type: 'income_certificate', label: 'Income Certificate', requiresNameMatch: true };

const open = { casteEligibility: ['All'], genderEligibility: ['All'], occupationEligibility: ['All'], educationEligibility: ['All'] };

const schemes = [
  {
    name: 'Kisan Credit Card (KCC)',
    slug: 'kisan-credit-card',
    description: 'Short-term farm credit at low interest for cultivation and allied needs.',
    category: 'Agriculture', state: 'All India',
    minAge: 18, maxAge: 75, maxIncome: null,
    ...open, occupationEligibility: ['Farmer'],
    landRequired: true, minAcademicPercentage: null,
    requiredDocuments: [aadhaar, land, bank],
    nameMatchGroup: ['aadhaar', 'land_ownership', 'bank_account'],
    benefits: 'Revolving crop loan with subsidised interest through your bank, plus accident insurance cover.',
    applicationLink: 'https://pmkisan.gov.in/', active: true,
    assumptionsNote: 'Only age window (18-75), farmer occupation and land ownership are modelled. Credit limit and bank-specific rules are not.',
  },
  {
    name: 'Pradhan Mantri Fasal Bima Yojana (Crop Insurance)',
    slug: 'pm-fasal-bima-yojana',
    description: 'Crop insurance that protects farmers against loss from drought, flood, pests and unseasonal rain.',
    category: 'Agriculture', state: 'All India',
    minAge: 18, maxAge: 100, maxIncome: null,
    ...open, occupationEligibility: ['Farmer'],
    landRequired: true, minAcademicPercentage: null,
    requiredDocuments: [aadhaar, land, bank],
    nameMatchGroup: ['aadhaar', 'land_ownership', 'bank_account'],
    benefits: 'Insurance payout for notified crops at a low farmer-paid premium (about 1.5-2% for food crops).',
    applicationLink: 'https://pmfby.gov.in/', active: true,
    assumptionsNote: 'Tenant/sharecropper cases and notified-crop checks are not modelled; land ownership is required here for simplicity.',
  },
  {
    name: 'Pradhan Mantri Ujjwala Yojana',
    slug: 'pm-ujjwala-yojana',
    description: 'Free LPG connection for women from low-income households.',
    category: 'Women & Welfare', state: 'All India',
    minAge: 18, maxAge: 100, maxIncome: 100000,
    ...open, genderEligibility: ['Female'],
    landRequired: false, minAcademicPercentage: null,
    requiredDocuments: [aadhaar, income, bank],
    nameMatchGroup: ['aadhaar', 'income_certificate', 'bank_account'],
    benefits: 'Free LPG connection with first refill support for eligible women.',
    applicationLink: 'https://www.pmuy.gov.in/', active: true,
    assumptionsNote: 'Official eligibility uses BPL / SECC listing. Here a simplified annual income ceiling of Rs 1,00,000 is configured instead.',
  },
  {
    name: 'Pradhan Mantri Awas Yojana - Gramin (Rural Housing)',
    slug: 'pmay-gramin',
    description: 'Financial help to build a pucca house for low-income rural families without adequate housing.',
    category: 'Housing', state: 'All India',
    minAge: 18, maxAge: 100, maxIncome: 300000,
    ...open,
    landRequired: false, minAcademicPercentage: null,
    requiredDocuments: [aadhaar, income, bank],
    nameMatchGroup: ['aadhaar', 'income_certificate', 'bank_account'],
    benefits: 'Assistance of about Rs 1.2 lakh (plains) towards constructing a pucca house, paid into the bank account.',
    applicationLink: 'https://pmayg.nic.in/', active: true,
    assumptionsNote: 'Official selection is by SECC / Awaas+ survey. Here only a simplified income ceiling of Rs 3,00,000 is checked; "no pucca house" is not verified.',
  },
  {
    name: 'Gruha Lakshmi (Karnataka)',
    slug: 'gruha-lakshmi-karnataka',
    description: 'Monthly financial assistance for the woman head of a family in Karnataka.',
    category: 'Women & Welfare', state: 'Karnataka',
    minAge: 18, maxAge: 100, maxIncome: null,
    ...open, genderEligibility: ['Female'],
    landRequired: false, minAcademicPercentage: null,
    requiredDocuments: [aadhaar, bank],
    nameMatchGroup: ['aadhaar', 'bank_account'],
    benefits: 'Rs 2,000 per month transferred to the woman head of the family (as announced by the Karnataka Government).',
    applicationLink: 'https://sevasindhu.karnataka.gov.in/', active: true,
    assumptionsNote: 'Only gender and age are modelled. Ration card, income-tax / GST payer exclusions and "head of family" are not checked.',
  },
  {
    name: 'Indira Gandhi National Old Age Pension Scheme',
    slug: 'ignoaps-old-age-pension',
    description: 'Monthly pension for senior citizens from low-income households.',
    category: 'Social Security', state: 'All India',
    minAge: 60, maxAge: 120, maxIncome: 100000,
    ...open,
    landRequired: false, minAcademicPercentage: null,
    requiredDocuments: [aadhaar, income, bank],
    nameMatchGroup: ['aadhaar', 'income_certificate', 'bank_account'],
    benefits: 'Monthly pension from the Centre (Rs 200-500) plus a state top-up, paid into the bank account.',
    applicationLink: 'https://nsap.nic.in/', active: true,
    assumptionsNote: 'Official rule is BPL household and age 60+. A simplified income ceiling of Rs 1,00,000 is used here. Pension amounts differ by state.',
  },
  {
    name: 'Pradhan Mantri Mudra Yojana',
    slug: 'pm-mudra-yojana',
    description: 'Collateral-free micro loans for small businesses and self-employed people.',
    category: 'Business & Livelihood', state: 'All India',
    minAge: 18, maxAge: 65, maxIncome: null,
    ...open, occupationEligibility: ['Self-Employed', 'Unemployed'],
    landRequired: false, minAcademicPercentage: null,
    requiredDocuments: [aadhaar, bank],
    nameMatchGroup: ['aadhaar', 'bank_account'],
    benefits: 'Loans up to Rs 10 lakh in Shishu, Kishor and Tarun categories without collateral.',
    applicationLink: 'https://www.mudra.org.in/', active: true,
    assumptionsNote: 'Business plan, loan category and bank credit checks are not modelled. "Unemployed" is allowed to cover people starting a new business.',
  },
];

module.exports = { schemes };

if (require.main === module) {
  (async () => {
    await mongoose.connect(MONGODB_URI);
    for (const s of schemes) {
      const r = await Scheme.findOneAndUpdate({ slug: s.slug }, { $set: s }, { upsert: true, new: true, setDefaultsOnInsert: true });
      console.log('Upserted:', r.name);
    }
    console.log(`Done. ${schemes.length} schemes added/updated.`);
    await mongoose.disconnect();
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}