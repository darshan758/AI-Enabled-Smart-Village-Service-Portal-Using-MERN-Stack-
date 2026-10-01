// backend/models/Complaint.js

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CATEGORIES = [
  'Street Light Damage',
  'Road Damage',
  'Water Leakage',
  'Garbage Issue',
  'Drainage Problem',
  'Electricity Problem',
  'Others',
];

const STATUS = ['Pending', 'In Progress', 'Resolved', 'Rejected'];

const PRIORITY = ['Low', 'Medium', 'High', 'Critical'];

// Field-worker lifecycle. Deliberately kept SEPARATE from STATUS above —
// STATUS is what citizens/admins already see everywhere (dashboards, SMS
// templates, filters); overloading it with 10 sub-states would break all
// of that. workerStage is an additive detail field that only the worker
// and supervisor views need to care about. When a worker's proof is
// verified, STATUS still just becomes 'Resolved' as before.
const WORKER_STAGE = [
  'NotAssigned',
  'Assigned',
  'Accepted',
  'LocationConfirmed',
  'Working',
  'ProofSubmitted',
  'Verified',
];

const complaintSchema = new mongoose.Schema(
  {
    trackingId: {
      type: String,
      unique: true,
      default: () =>
        `SV-${Date.now()
          .toString(36)
          .toUpperCase()}-${uuidv4()
          .slice(0, 4)
          .toUpperCase()}`,
    },

    // Complaint creator
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    title: {
      type: String,
      required: [true, 'Complaint title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },

    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: CATEGORIES,
    },

    priority: {
      type: String,
      enum: PRIORITY,
      default: 'Medium',
    },

    status: {
      type: String,
      enum: STATUS,
      default: 'Pending',
    },

    image: {
      type: String,
      default: null,
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    locationName: {
      type: String,
      default: null,
    },

    geoTagged: {
      type: Boolean,
      default: false,
    },

    adminNote: {
      type: String,
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    // Village association
    village: {
      type: String,
      default: null,
    },

    villageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      default: null,
    },

    // Location hierarchy
    state: {
      type: String,
      default: null,
    },

    district: {
      type: String,
      default: null,
    },

    taluk: {
      type: String,
      default: null,
    },

    // Assigned admin — now the *escalation* owner, not the default
    // handler. Most complaints resolve through assignedMediator below;
    // an admin only needs to step in if there's no matching mediator
    // or the complaint escalates (see autoEscalate.js).
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // The real-world department contact auto-routed to fix this
    // specific complaint (see utils/mediatorAssigner.js).
    assignedMediator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mediator',
      default: null,
    },

    // The logged-in Department account (User with role 'department') that
    // owns this complaint — auto-routed by category + district at
    // creation time (see utils/departmentAssigner.js). This is the
    // account that assigns a worker and verifies their proof. Separate
    // from assignedMediator above (a non-login SMS contact) and from
    // assignedAdmin (the district-wide escalation owner) — a complaint
    // can have all three set, each serving a different purpose.
    assignedDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    departmentAssignedAt: {
      type: Date,
      default: null,
    },

    // Set to true the one time a complaint's priority is bumped because
    // several similar reports clustered in the same district recently
    // (see utils/clusterPriority.js). Prevents repeated re-bumping on
    // every subsequent save.
    priorityBoostedByCluster: {
      type: Boolean,
      default: false,
    },

    // Snapshot of the mediator's contact details at assignment time,
    // so this stays accurate even if the mediator directory entry is
    // later edited or removed.
    mediatorContact: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
      department: { type: String, default: null },
    },

    // Duplicate complaint detection
    isDuplicate: {
      type: Boolean,
      default: false,
    },

    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
    },

    // Complaint status history
    statusHistory: [
      {
        status: {
          type: String,
          enum: STATUS,
        },

        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },

        note: {
          type: String,
          default: '',
        },

        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ── Proof-of-resolution photo (uploaded by admin when marking Resolved) ──
    resolutionPhoto: {
      type: String,
      default: null,
    },

    // ── Citizen satisfaction rating (only after Resolved) ──────────────────
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },

    ratingFeedback: {
      type: String,
      default: null,
      maxlength: [500, 'Feedback cannot exceed 500 characters'],
    },

    ratedAt: {
      type: Date,
      default: null,
    },

    // ── Auto-escalation tracking (prevents repeated re-escalation) ─────────
    escalated: {
      type: Boolean,
      default: false,
    },

    escalatedAt: {
      type: Date,
      default: null,
    },

    // ── Field-worker layer (Phase 1) ────────────────────────────────────────
    // Separate from assignedMediator: the Mediator is the department
    // contact who gets notified first; assignedWorker is the specific
    // logged-in field worker a Supervisor (district Admin) later assigns
    // to actually do the work and submit proof.
    assignedWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── Team assignment (multiple workers on one job) ───────────────────────
    // A complaint can now have more than one worker on it — a big pothole
    // or a downed pole often genuinely needs a crew, not one person. Each
    // team member tracks their OWN stage/location-check/proof
    // independently; the job is only "done" once every member has
    // submitted proof and the department has verified the whole team's
    // work. `assignedWorker` above is kept in sync as the first/lead
    // member for any older code path that hasn't been updated to read
    // this array — new code should read `assignedWorkers`, not it.
    assignedWorkers: [
      {
        worker: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        isLead: { type: Boolean, default: false },
        stage: {
          type: String,
          enum: ['Assigned', 'Accepted', 'LocationConfirmed', 'Working', 'ProofSubmitted', 'Verified'],
          default: 'Assigned',
        },
        assignedAt: { type: Date, default: Date.now },
        locationCheck: {
          confirmed: { type: Boolean, default: false },
          workerLatitude: { type: Number, default: null },
          workerLongitude: { type: Number, default: null },
          distanceMeters: { type: Number, default: null },
          confirmedAt: { type: Date, default: null },
        },
        proof: {
          beforePhoto: { type: String, default: null },
          afterPhoto: { type: String, default: null },
          workDescription: { type: String, default: null, maxlength: 500 },
          materialsUsed: { type: String, default: null, maxlength: 200 },
          submittedAt: { type: Date, default: null },
        },
      },
    ],

    // When the Supervisor assigned this worker — the clock SLA
    // escalation measures from, not complaint creation (a complaint
    // can sit unassigned for a while; that's the existing
    // autoEscalate.js's job to catch, not this one's).
    workerAssignedAt: {
      type: Date,
      default: null,
    },

    // Separate from the existing `escalated`/`escalatedAt` pair above,
    // which tracks priority-bump escalation for unassigned complaints.
    // This tracks worker-side SLA breaches so the two mechanisms never
    // clash or double-fire on the same complaint.
    workerEscalated: {
      type: Boolean,
      default: false,
    },

    workerEscalatedAt: {
      type: Date,
      default: null,
    },

    // Whether a "waiting for your review" reminder has already been
    // sent to the Supervisor for the CURRENT proof submission — reset
    // to false whenever a new after-photo is submitted, so a rejected
    // -then-resubmitted job can be reminded on again.
    proofReviewReminded: {
      type: Boolean,
      default: false,
    },

    workerStage: {
      type: String,
      enum: WORKER_STAGE,
      default: 'NotAssigned',
    },

    // Worker's confirmation that they physically reached the reported
    // location, compared against the complaint's own GPS if it has one.
    workerLocationCheck: {
      confirmed: { type: Boolean, default: false },
      workerLatitude: { type: Number, default: null },
      workerLongitude: { type: Number, default: null },
      distanceMeters: { type: Number, default: null },
      confirmedAt: { type: Date, default: null },
    },

    // Before/after evidence + what the worker actually did. This is
    // separate from the existing `resolutionPhoto` field (which is a
    // single admin-uploaded photo for the no-worker-assigned path) —
    // that field still works unchanged for complaints resolved without
    // going through the worker flow.
    workerProof: {
      beforePhoto: { type: String, default: null },
      afterPhoto: { type: String, default: null },
      workDescription: { type: String, default: null, maxlength: 500 },
      materialsUsed: { type: String, default: null, maxlength: 200 },
      submittedAt: { type: Date, default: null },
    },

    // Supervisor's sign-off on the worker's submitted proof.
    supervisorVerification: {
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      approved: { type: Boolean, default: null },
      note: { type: String, default: null, maxlength: 300 },
      verifiedAt: { type: Date, default: null },
    },

    // ── Citizen confirm/reopen loop (Phase 2) ───────────────────────────────
    // After a Supervisor verifies and status becomes 'Resolved', the
    // citizen gets one Yes/No prompt. "Yes" leaves status as 'Resolved'
    // (that IS the closed state for this app — no separate 'Closed'
    // value added to STATUS, same additive-field principle as before).
    // "No" flips status back to 'In Progress' and re-opens the job.
    citizenConfirmation: {
      confirmed: { type: Boolean, default: null }, // null = not yet responded
      respondedAt: { type: Date, default: null },
      note: { type: String, default: null, maxlength: 300 },
    },

    // How many times this complaint has been reopened by the citizen.
    reopenCount: {
      type: Number,
      default: 0,
    },

    // ── Optional voice note (citizen speaks instead of / as well as typing) ──
    // Stored OUTSIDE the public /uploads folder (backend/private_uploads/voice)
    // and streamed only through GET /api/complaints/:id/voice after an access
    // check. `file` is a bare file name, never a path.
    voiceNote: {
      file: { type: String, default: null },
      mimeType: { type: String, default: null },
      durationSec: { type: Number, default: null },
      sizeBytes: { type: Number, default: null },
    },

    // ── Agent-filed complaints (utils/slaAgent.js) ──────────────────────────
    // 'citizen' = filed by a person; 'agent' = filed automatically by the SLA
    // monitoring agent. Agent complaints are excluded from the live map and
    // from department performance so they never count against anyone twice.
    source: {
      type: String,
      enum: ['citizen', 'agent'],
      default: 'citizen',
    },

    // For an agent escalation: the complaint that breached its SLA.
    relatedComplaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
    },

    // Set once the agent has escalated THIS complaint (never escalated twice).
    agentEscalatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
complaintSchema.index({ user: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ villageId: 1 });
complaintSchema.index({ isDuplicate: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ assignedWorker: 1, workerStage: 1 });
complaintSchema.index({ assignedDepartment: 1, status: 1 });
complaintSchema.index({ source: 1, agentEscalatedAt: 1, status: 1 });

// Keeps the legacy single-worker fields (assignedWorker, workerStage,
// workerAssignedAt) in sync with the new assignedWorkers team array,
// so any code path that hasn't been migrated to read the array
// directly (indexes, older reports, etc.) still sees a sensible value.
// The "overall" stage is the LEAST advanced member's stage — a job
// isn't done until every team member is done, not just the first one.
const STAGE_ORDER = ['Assigned', 'Accepted', 'LocationConfirmed', 'Working', 'ProofSubmitted', 'Verified'];
complaintSchema.methods.syncWorkerRollup = function () {
  if (!this.assignedWorkers || this.assignedWorkers.length === 0) {
    this.assignedWorker = null;
    this.workerStage = 'NotAssigned';
    return;
  }
  const lead = this.assignedWorkers.find((w) => w.isLead) || this.assignedWorkers[0];
  this.assignedWorker = lead.worker;
  this.workerAssignedAt = this.assignedWorkers
    .map((w) => w.assignedAt)
    .sort((a, b) => a - b)[0];

  const minStageIndex = Math.min(
    ...this.assignedWorkers.map((w) => STAGE_ORDER.indexOf(w.stage))
  );
  this.workerStage = STAGE_ORDER[minStageIndex];
};

module.exports = mongoose.model('Complaint', complaintSchema);

module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUS = STATUS;
module.exports.PRIORITY = PRIORITY;
module.exports.WORKER_STAGE = WORKER_STAGE;