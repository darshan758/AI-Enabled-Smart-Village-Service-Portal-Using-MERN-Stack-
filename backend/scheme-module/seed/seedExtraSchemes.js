// OPTIONAL extra schemes so the recommendation page shows more variety.
// Run:  node scheme-module/seed/seedExtraSchemes.js
// Safe to re-run (upserts by slug) and never touches the 3 original schemes.
// Rules below follow the commonly published guidelines but ARE SIMPLIFIED:
// verify against the official portals before any real-world use.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Scheme = require('../models/Scheme');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_village';

const aadhaar = { type: 'aadhaar', label: 'Aadhaar Card', requiresNameMatch: true };
const bank = { type: 'bank_account', label: 'Bank Account Details', requiresNameMatch: true };

const schemes = [
  {
    name: 'Post-Matric Scholarship for ST Students',
    slug: 'post-matric-scholarship-st',
    description: 'Financial assistance for Scheduled Tribe students pursuing post-matric education.',
    category: 'Education', state: 'All India',
    minAge: 16, maxAge: 40, maxIncome: 250000,
    casteEligibility: ['ST'], genderEligibility: ['All'], occupationEligibility: ['Student'],
    educationEligibility: ['Class 11', 'Class 12', 'Diploma', 'Undergraduate', 'Postgraduate'],
    landRequired: false, minAcademicPercentage: null,
    requiredDocuments: [
      aadhaar,
      { type: 'caste_certificate', label: 'Caste Certificate', requiresNameMatch: true },
      { type: 'income_certificate', label: 'Income Certificate', requiresNameMatch: true },
      { type: 'education_certificate', label: 'Education Certificate', requiresNameMatch: true },
      bank,
    ],
    nameMatchGroup: ['aadhaar', 'caste_certificate', 'income_certificate', 'education_certificate', 'bank_account'],
    benefits: 'Course fee reimbursement and maintenance allowance as per the scholarship guidelines.',
    applicationLink: 'https://scholarships.gov.in/', active: true,
    assumptionsNote: 'Income ceiling and age window are configured for this project, mirroring the SC scholarship rule; confirm on the official portal.',
  },
  {
    name: 'Atal Pension Yojana',
    slug: 'atal-pension-yojana',
    description: 'Voluntary pension scheme for unorganised-sector workers with a bank account.',
    category: 'Social Security', state: 'All India',
    minAge: 18, maxAge: 40, maxIncome: null,
    casteEligibility: ['All'], genderEligibility: ['All'], occupationEligibility: ['All'], educationEligibility: ['All'],
    landRequired: false, minAcademicPercentage: null,
    requiredDocuments: [aadhaar, bank],
    nameMatchGroup: ['aadhaar', 'bank_account'],
    benefits: 'Guaranteed monthly pension from age 60 based on the chosen contribution.',
    applicationLink: 'https://www.npscra.nsdl.co.in/scheme-details.php', active: true,
    assumptionsNote: 'Only the age window (18-40) and a bank account are modelled; income-tax-payer exclusion is not checked.',
  },
  {
    name: 'Pradhan Mantri Suraksha Bima Yojana',
    slug: 'pm-suraksha-bima-yojana',
    description: 'Low-cost accidental death and disability insurance linked to a bank account.',
    category: 'Insurance', state: 'All India',
    minAge: 18, maxAge: 70, maxIncome: null,
    casteEligibility: ['All'], genderEligibility: ['All'], occupationEligibility: ['All'], educationEligibility: ['All'],
    landRequired: false, minAcademicPercentage: null,
    requiredDocuments: [aadhaar, bank],
    nameMatchGroup: ['aadhaar', 'bank_account'],
    benefits: 'Accident insurance cover for a small annual premium auto-debited from the bank account.',
    applicationLink: 'https://www.jansuraksha.gov.in/', active: true,
    assumptionsNote: 'Only the age window (18-70) and a bank account are modelled.',
  },
];

(async () => {
  await mongoose.connect(MONGODB_URI);
  for (const s of schemes) {
    const r = await Scheme.findOneAndUpdate({ slug: s.slug }, { $set: s }, { upsert: true, new: true, setDefaultsOnInsert: true });
    console.log('Upserted:', r.name);
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });