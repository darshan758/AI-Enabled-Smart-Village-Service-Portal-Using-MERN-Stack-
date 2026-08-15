// backend/models/Village.js

const mongoose = require('mongoose');

const villageSchema = new mongoose.Schema(
  {
    villageCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    villageName: {
      type: String,
      required: [true, 'Village name is required'],
      trim: true,
    },

    panchayat: {
      type: String,
      trim: true,
    },

    taluk: {
      type: String,
      trim: true,
      required: [true, 'Taluk is required'],
    },

    district: {
      type: String,
      trim: true,
      required: [true, 'District is required'],
    },

    state: {
      type: String,
      trim: true,
      required: [true, 'State is required'],
    },

    // Assigned Village Admin
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Auto-generate village code
villageSchema.pre('save', async function (next) {
  try {
    if (!this.villageCode) {
      const statePrefix = this.state.slice(0, 2).toUpperCase();
      const districtPrefix = this.district.slice(0, 2).toUpperCase();

      const count = await mongoose.model('Village').countDocuments();

      this.villageCode = `${statePrefix}${districtPrefix}${String(
        count + 1
      ).padStart(4, '0')}`;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Indexes
villageSchema.index({ state: 1, district: 1, taluk: 1 });
villageSchema.index({ villageName: 1 });

module.exports = mongoose.model('Village', villageSchema);