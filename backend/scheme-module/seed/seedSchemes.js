require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Scheme = require('../models/Scheme');

// Uses the SAME database as the rest of the merged app (MONGO_URI, matching
// backend/.env) — schemes are just new collections in that one database,
// not a separate database anymore.
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_village';

const schemes = [
  {
    name: 'PM-KISAN',
    slug: 'pm-kisan',
    description: 'Income support scheme for eligible landholding farmer families.',
    category: 'Agriculture',
    state: 'All India',
    minAge: 18,
    maxAge: 100,
    maxIncome: null, // Not configured -> no income restriction applied. See rule in spec section 5.
    casteEligibility: ['All'],
    genderEligibility: ['All'],
    occupationEligibility: ['Farmer'],
    educationEligibility: ['All'],
    landRequired: true,
    minAcademicPercentage: null,
    requiredDocuments: [
      { type: 'aadhaar', label: 'Aadhaar Card', requiresNameMatch: true },
      { type: 'land_ownership', label: 'Land Ownership Record', requiresNameMatch: true },
      { type: 'bank_account', label: 'Bank Account Details', requiresNameMatch: true },
    ],
    nameMatchGroup: ['aadhaar', 'land_ownership', 'bank_account'],
    benefits: '₹6,000 per year in three equal installments, transferred directly to bank accounts.',
    applicationLink: 'https://pmkisan.gov.in/',
    active: true,
    assumptionsNote:
      'No income cap is officially part of PM-KISAN eligibility for this project, so maxIncome is left unconfigured (null) rather than inventing a threshold.',
  },
  {
    name: 'Post-Matric Scholarship for SC Students',
    slug: 'post-matric-scholarship-sc',
    description: 'Educational financial assistance for eligible SC students.',
    category: 'Education',
    state: 'All India',
    minAge: 16,
    maxAge: 40,
    maxIncome: 250000,
    casteEligibility: ['SC'],
    genderEligibility: ['All'],
    occupationEligibility: ['Student'],
    educationEligibility: ['Class 11', 'Class 12', 'Diploma', 'Undergraduate', 'Postgraduate'],
    landRequired: false,
    minAcademicPercentage: null,
    requiredDocuments: [
      { type: 'aadhaar', label: 'Aadhaar Card', requiresNameMatch: true },
      { type: 'caste_certificate', label: 'Caste Certificate', requiresNameMatch: true },
      { type: 'income_certificate', label: 'Income Certificate', requiresNameMatch: true },
      { type: 'education_certificate', label: 'Education Certificate', requiresNameMatch: true },
      { type: 'bank_account', label: 'Bank Account Details', requiresNameMatch: true },
    ],
    nameMatchGroup: ['aadhaar', 'caste_certificate', 'income_certificate', 'education_certificate', 'bank_account'],
    benefits: 'Tuition fee reimbursement and maintenance allowance for eligible SC students.',
    applicationLink: 'https://scholarships.gov.in/',
    active: true,
    assumptionsNote:
      'maxIncome (₹2,50,000) and the allowed education levels are configured per this project\'s scope; adjust in the database if your institution needs different figures.',
  },
  {
    name: 'Ayushman Bharat PM-JAY',
    slug: 'ayushman-bharat-pmjay',
    description:
      'Health insurance scheme providing coverage for secondary and tertiary care hospitalization for eligible families.',
    category: 'Healthcare',
    state: 'All India',
    minAge: 0,
    maxAge: 120,
    maxIncome: null, // See assumptionsNote below.
    casteEligibility: ['All'],
    genderEligibility: ['All'],
    occupationEligibility: ['All'],
    educationEligibility: ['All'],
    landRequired: false,
    minAcademicPercentage: null,
    requiredDocuments: [
      { type: 'aadhaar', label: 'Aadhaar Card', requiresNameMatch: true },
      {
        type: 'family_eligibility_document',
        label: 'Family/Income Eligibility Document (Ration Card / SECC Extract / Income Certificate)',
        requiresNameMatch: true,
      },
    ],
    nameMatchGroup: ['aadhaar', 'family_eligibility_document'],
    benefits: 'Cashless health cover up to ₹5 lakh per family per year for eligible beneficiaries.',
    applicationLink: 'https://pmjay.gov.in/',
    active: true,
    assumptionsNote:
      'Real PM-JAY eligibility is based on SECC-2011 deprivation/occupational criteria, which this project cannot query live. ' +
      'Rather than inventing an official income threshold, eligibility here is configurable: maxIncome is left unset (no income ' +
      'cap enforced) and a generic "family eligibility document" (ration card / SECC extract / income certificate) is required ' +
      'and verified. Institutions using this project for a real deployment should replace this with an actual SECC/BIS lookup.',
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB:', MONGODB_URI);

  for (const schemeData of schemes) {
    // eslint-disable-next-line no-await-in-loop
    const result = await Scheme.findOneAndUpdate(
      { slug: schemeData.slug },
      { $set: schemeData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Upserted scheme: ${result.name} (${result.slug})`);
  }

  console.log('Seeding complete.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});