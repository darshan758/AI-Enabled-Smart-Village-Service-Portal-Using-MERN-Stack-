// backend/models/Mediator.js
//
// A Mediator is the real-world person/department contact who actually
// resolves a complaint on the ground — e.g. the BESCOM electrical
// lineman for a taluk, the water board contact, the PWD road-repair
// contact. This is deliberately NOT another "admin" user account:
// mediators don't log into the portal. Admin adds them once (name +
// phone + which categories + which district/taluk they cover), and
// the system contacts them directly by SMS when a matching complaint
// comes in — same as the college ERP example: the fan complaint just
// goes straight to the electrical department's phone.
//
// Keep this in sync with Complaint.CATEGORIES (backend/models/Complaint.js)
// and KARNATAKA_DISTRICTS (backend/utils/districts.js).

const mongoose = require('mongoose');
const { CATEGORIES } = require('./Complaint');

const mediatorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Mediator name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },

    // Real contact number the citizen's issue actually gets called/SMS'd to.
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit mobile number'],
    },

    // Which department they represent, e.g. "BESCOM Electrical", "PWD Roads".
    // Free text on purpose — different districts name these differently.
    department: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: [80, 'Department name cannot exceed 80 characters'],
    },

    // Which complaint categories this mediator handles. A mediator can
    // cover more than one category (e.g. a single PWD contact might take
    // both "Road Damage" and "Drainage Problem" in a small taluk).
    categories: {
      type: [String],
      enum: CATEGORIES,
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Select at least one category this mediator handles',
      },
    },

    // Jurisdiction — required district, optional taluk for finer scoping.
    // Leave taluk blank if this mediator covers the whole district.
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
    },

    taluk: {
      type: String,
      default: null,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // How many complaints this mediator is currently assigned (not yet
    // Resolved/Rejected). Used to pick the least-busy mediator when more
    // than one covers the same category + jurisdiction.
    activeAssignments: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

mediatorSchema.index({ categories: 1, district: 1, taluk: 1, isActive: 1 });

module.exports = mongoose.model('Mediator', mediatorSchema);