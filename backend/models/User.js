// backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      sparse: true,
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },

    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit mobile number'],
    },

    // Location hierarchy
    state: {
      type: String,
      trim: true,
    },

    district: {
      type: String,
      trim: true,
    },

    taluk: {
      type: String,
      trim: true,
    },

    village: {
      type: String,
      trim: true,
    },

    villageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      default: null,
    },

    panchayat: {
      type: String,
      trim: true,
    },

    wardNumber: {
      type: String,
      trim: true,
    },

    // Roles
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user',
    },

    // Village-scoped admin
    adminVillage: {
      type: String,
      default: null,
    },

    adminVillageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      default: null,
    },

    avatar: {
      type: String,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    totalComplaints: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Auto-generate userId + hash password
userSchema.pre('save', async function (next) {
  try {
    // Generate userId
    if (!this.userId) {
      const year = new Date().getFullYear();

      const count = await mongoose
        .model('User')
        .countDocuments({ role: this.role });

      if (this.role === 'superadmin') {
        this.userId = `SV${year}-SUPER-${String(count + 1).padStart(3, '0')}`;
      } else if (this.role === 'admin') {
        this.userId = `SV${year}-ADMIN-${String(count + 1).padStart(3, '0')}`;
      } else {
        this.userId = `SV${year}-USER-${1000 + count + 1}`;
      }
    }

    // Hash password only if modified
    if (!this.isModified('password')) {
      return next();
    }

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);