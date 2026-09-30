// backend/utils/workerEscalate.js
//
// SLA escalation for the WORKER layer — deliberately a separate module
// from autoEscalate.js, which only escalates complaints still stuck in
// "Pending" with no one assigned at all. This one covers two different
// failure modes that only exist once a worker is in the picture:
//
//   1. A worker was assigned but the job is stalling in their hands
//      (not accepted / not finished) longer than their priority's SLA.
//   2. A worker submitted proof, but the Supervisor hasn't reviewed it
//      in a reasonable time.
//
// Same safety principle as autoEscalate.js: this is a standalone
// background job, every error is caught and logged, and it never
// throws up to crash the server.

const Complaint    = require('../models/Complaint');
const User         = require('../models/User');
const Notification = require('../models/Notification');
const sendSMS       = require('./smsService');

const PRIORITY_LADDER = ['Low', 'Medium', 'High', 'Critical'];

const nextPriority = (current) => {
  const idx = PRIORITY_LADDER.indexOf(current);
  if (idx === -1 || idx === PRIORITY_LADDER.length - 1) return current;
  return PRIORITY_LADDER[idx + 1];
};

// How long a worker gets to finish a job before it's considered SLA-
// breached, per priority. Deliberately generous defaults for a student
// deployment — override via env vars if a real SLA policy is decided.
const WORKER_SLA_HOURS = {
  Critical: parseInt(process.env.SLA_HOURS_CRITICAL, 10) || 6,
  High:     parseInt(process.env.SLA_HOURS_HIGH, 10) || 24,
  Medium:   parseInt(process.env.SLA_HOURS_MEDIUM, 10) || 72,
  Low:      parseInt(process.env.SLA_HOURS_LOW, 10) || 168, // 1 week
};

// Stages where the worker still "owns" the job — before proof exists.
const WORKER_OWNED_STAGES = ['Assigned', 'Accepted', 'LocationConfirmed', 'Working'];

// How long a Supervisor gets to review submitted proof before a reminder.
const REVIEW_REMINDER_HOURS = parseInt(process.env.REVIEW_REMINDER_HOURS, 10) || 24;

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);

async function notifyDistrictAdmins(district, title, message, complaintId) {
  const admins = await User.find({ role: 'admin', district }).select('_id mobile');
  await Promise.all(
    admins.map((a) =>
      Notification.create({ recipient: a._id, type: 'system', title, message, complaint: complaintId })
    )
  );
  return admins;
}

async function runWorkerEscalation() {
  try {
    // ── 1. Worker-side SLA breaches ─────────────────────────────────────
    const stuck = await Complaint.find({
      assignedWorker: { $ne: null },
      workerStage: { $in: WORKER_OWNED_STAGES },
      workerEscalated: false,
      workerAssignedAt: { $ne: null },
    }).populate('assignedWorker', 'name mobile');

    let breachCount = 0;
    for (const complaint of stuck) {
      const slaHours = WORKER_SLA_HOURS[complaint.priority] || WORKER_SLA_HOURS.Medium;
      if (complaint.workerAssignedAt > hoursAgo(slaHours)) continue; // still within SLA

      const oldPriority = complaint.priority;
      complaint.priority = nextPriority(complaint.priority);
      complaint.workerEscalated = true;
      complaint.workerEscalatedAt = new Date();
      await complaint.save();
      breachCount++;

      const message =
        `Complaint ${complaint.trackingId} ("${complaint.title}") has been with ` +
        `${complaint.assignedWorker?.name || 'a worker'} for over ${slaHours}h without ` +
        `completion (stage: ${complaint.workerStage}). Priority auto-escalated from ` +
        `${oldPriority} to ${complaint.priority}. Consider reassigning.`;

      if (complaint.district) {
        await notifyDistrictAdmins(
          complaint.district,
          '⏫ Worker SLA Breached',
          message,
          complaint._id
        );
      }

      // Nudge the worker too — they may have just forgotten about it.
      if (complaint.assignedWorker?.mobile) {
        await sendSMS(
          complaint.assignedWorker.mobile,
          `SmartVillage: Reminder — complaint ${complaint.trackingId} assigned to you is overdue. Please update its status.`
        ).catch(console.error);
      }
    }

    // ── 2. Stalled Supervisor reviews ───────────────────────────────────
    const awaitingReview = await Complaint.find({
      workerStage: 'ProofSubmitted',
      proofReviewReminded: false,
      'workerProof.submittedAt': { $lte: hoursAgo(REVIEW_REMINDER_HOURS) },
    });

    let reviewReminderCount = 0;
    for (const complaint of awaitingReview) {
      complaint.proofReviewReminded = true;
      await complaint.save();
      reviewReminderCount++;

      if (complaint.district) {
        await notifyDistrictAdmins(
          complaint.district,
          '⏳ Worker Proof Awaiting Review',
          `Complaint ${complaint.trackingId} ("${complaint.title}") has had worker proof ` +
            `submitted for over ${REVIEW_REMINDER_HOURS}h without verification.`,
          complaint._id
        );
      }
    }

    if (breachCount || reviewReminderCount) {
      console.log(
        `[WorkerEscalate] ${breachCount} worker SLA breach(es), ${reviewReminderCount} review reminder(s) sent.`
      );
    }
  } catch (err) {
    // Never let this crash the server — just log and move on.
    console.error('[WorkerEscalate] Error:', err.message);
  }
}

module.exports = runWorkerEscalation;