/**
 * seed.js — Smart Village
 *
 * Creates the initial Super Admin account. Districts are a fixed list
 * (backend/utils/districts.js) — no seeding needed for them.
 *
 * Usage:
 *   cd backend
 *   node seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const User     = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🔗 Connected to MongoDB');

  // ── Super Admin ───────────────────────────────────────────────────────────
  const superEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@smartvillage.com';
  const superPass  = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

  const exists = await User.findOne({ email: superEmail });
  if (!exists) {
    await User.create({
      name:     'Super Admin',
      email:    superEmail,
      password: superPass,
      role:     'superadmin',
      mobile:   '9000000000',
    });
    console.log(`✅ Super Admin created: ${superEmail} / ${superPass}`);
  } else {
    console.log(`⏩ Super Admin already exists: ${superEmail}`);
  }

  await mongoose.disconnect();
  console.log('\n🌾 Seed complete!');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});