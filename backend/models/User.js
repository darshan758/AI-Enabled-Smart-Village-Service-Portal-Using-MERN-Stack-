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
      enum: ['user', 'admin', 'superadmin', 'worker', 'department'],
      default: 'user',
    },

    // ── Department profile fields (only relevant when role === 'department') ──
    // A Department account is created by a District Admin. It represents a
    // real department (e.g. "Electricity Department") that handles ONE
    // complaint category within ONE district. Complaints of that category
    // in that district are auto-routed to this account; the department
    // then creates its own Worker accounts and assigns jobs to them.
    departmentCategory: {
      type: String,
      default: null,
      trim: true,
    },

    // ── Worker profile fields (only relevant when role === 'worker') ───────
    // Lets a Supervisor (district Admin, or the Department that owns this
    // worker) filter "who can handle this complaint's category in this
    // district" when assigning. Mirrors the shape of
    // Mediator.categories/department, but for a real logged-in field
    // worker rather than a notify-only contact.
    workerDepartment: {
      type: String,
      default: null,
      trim: true,
    },

    // The Department account (User with role 'department') this worker
    // was created under, if any. Workers created directly by a District
    // Admin (no department layer set up yet for that category) leave
    // this null and are assignable by the admin directly.
    workerDepartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    workerCategories: {
      type: [String],
      default: [],
    },

    workerIsAvailable: {
      type: Boolean,
      default: true,
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
      } else if (this.role === 'worker') {
        this.userId = `SV${year}-WORKER-${String(count + 1).padStart(3, '0')}`;
      } else if (this.role === 'department') {
        this.userId = `SV${year}-DEPT-${String(count + 1).padStart(3, '0')}`;
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