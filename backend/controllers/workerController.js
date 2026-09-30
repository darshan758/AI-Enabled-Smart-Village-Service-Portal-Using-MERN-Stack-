/**
 * workerController.js — Smart Village
 *
 * Everything a logged-in field worker (User.role === 'worker') can do.
 * A worker only ever sees complaints where THEY are one of the
 * `assignedWorkers` team members — enforced in every function below, not
 * just at the route level. This is also what keeps the citizen's mobile
 * number private: it's only returned inside these worker-scoped queries,
 * to workers actually on the job.
 *
 * A complaint can have MULTIPLE workers on it now (a bigger job may
 * need a crew). Each team member tracks their own stage/location-check/
 * proof independently in `complaint.assignedWorkers[]`. To avoid
 * rewriting the whole worker-facing frontend, every response below is
 * "shaped" so the top-level `workerStage` / `workerProof` /
 * `workerLocationCheck` fields reflect the CALLING worker's own entry —
 * exactly like before, when there was only ever one worker. A new
 * `teammates` array is added so a worker can see who else is on the job
 * with them.
 */

const Complaint = require('../models/Complaint');

// Haversine distance in metres — used only to give the worker a sanity
// check ("you're 12m from the reported spot"), not to block them; a
// citizen's GPS pin is often approximate, so this is informational.
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Shared ownership check — every action below needs this. Returns both
// the full complaint AND this specific worker's own team-member entry
// (a real Mongoose subdocument — mutate it, then complaint.save()).
async function findOwnComplaintAndEntry(req, res) {
  const complaint = await Complaint.findOne({
    _id: req.params.id,
    'assignedWorkers.worker': req.user.id,
  })
    .populate('user', 'name mobile')
    .populate('assignedWorkers.worker', 'name teamSize');

  if (!complaint) {
    res.status(404).json({
      success: false,
      message: 'Complaint not found or not assigned to you',
    });
    return {};
  }

  const entry = complaint.assignedWorkers.find(
    (w) => String(w.worker?._id || w.worker) === String(req.user.id)
  );
  if (!entry) {
    res.status(404).json({
      success: false,
      message: 'Complaint not found or not assigned to you',
    });
    return {};
  }

  return { complaint, entry };
}

// Turns a complaint + "my entry" into the response shape the frontend
// already expects — workerStage/workerProof/workerLocationCheck at the
// top level, reflecting THIS worker's own progress, plus a teammates
// list for jobs with more than one person on them.
function shapeForWorker(complaint, entry) {
  const obj = complaint.toObject();
  const teammates = complaint.assignedWorkers
    .filter((w) => String(w.worker?._id || w.worker) !== String(entry.worker?._id || entry.worker))
    .map((w) => ({ name: w.worker?.name || 'Teammate', stage: w.stage, teamSize: w.worker?.teamSize || 1 }));

  return {
    ...obj,
    workerStage: entry.stage,
    workerProof: entry.proof,
    workerLocationCheck: entry.locationCheck,
    teammates,
    isLead: entry.isLead,
    teamSize: entry.worker?.teamSize || 1,
  };
}

// ── @desc    List complaints assigned to me ─────────────────────────────────
// ── @route   GET /api/worker/complaints ─────────────────────────────────────
const getMyAssignments = async (req, res, next) => {
  try {
    const { stage } = req.query;

    const complaints = await Complaint.find({ 'assignedWorkers.worker': req.user.id })
      .sort({ priority: -1, createdAt: 1 })
      .populate('user', 'name mobile')
      .populate('assignedWorkers.worker', 'name teamSize')
      .select(
        'trackingId title category description image latitude longitude ' +
          'locationName village taluk district priority status ' +
          'assignedWorkers user createdAt'
      );

    let shaped = complaints.map((c) => {
      const entry = c.assignedWorkers.find((w) => String(w.worker?._id || w.worker) === String(req.user.id));
      return shapeForWorker(c, entry);
    });

    if (stage) shaped = shaped.filter((c) => c.workerStage === stage);

    res.json({ success: true, count: shaped.length, complaints: shaped });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Single assigned complaint (full detail incl. citizen contact) ──
// ── @route   GET /api/worker/complaints/:id ─────────────────────────────────
const getAssignment = async (req, res, next) => {
  try {
    const { complaint, entry } = await findOwnComplaintAndEntry(req, res);
    if (!complaint) return;
    res.json({ success: true, complaint: shapeForWorker(complaint, entry) });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Accept an assigned job ──────────────────────────────────────────
// ── @route   POST /api/worker/complaints/:id/accept ─────────────────────────
const acceptAssignment = async (req, res, next) => {
  try {
    const { complaint, entry } = await findOwnComplaintAndEntry(req, res);
    if (!complaint) return;

    if (entry.stage !== 'Assigned') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept from stage "${entry.stage}"`,
      });
    }

    entry.stage = 'Accepted';
    complaint.syncWorkerRollup();
    await complaint.save();
    res.json({ success: true, message: 'Job accepted', workerStage: entry.stage });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Confirm worker has reached the reported location ──────────────
// ── @route   POST /api/worker/complaints/:id/confirm-location ──────────────
const confirmLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    const { complaint, entry } = await findOwnComplaintAndEntry(req, res);
    if (!complaint) return;

    if (entry.stage !== 'Accepted') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm location from stage "${entry.stage}"`,
      });
    }

    let distance = null;
    if (
      latitude != null &&
      longitude != null &&
      complaint.latitude != null &&
      complaint.longitude != null
    ) {
      distance = Math.round(
        distanceMeters(latitude, longitude, complaint.latitude, complaint.longitude)
      );
    }

    entry.locationCheck = {
      confirmed: true,
      workerLatitude: latitude ?? null,
      workerLongitude: longitude ?? null,
      distanceMeters: distance,
      confirmedAt: new Date(),
    };
    entry.stage = 'LocationConfirmed';
    complaint.syncWorkerRollup();
    await complaint.save();

    res.json({
      success: true,
      message: 'Location confirmed',
      distanceMeters: distance,
      workerStage: entry.stage,
    });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Start work ──────────────────────────────────────────────────────
// ── @route   POST /api/worker/complaints/:id/start ──────────────────────────
const startWork = async (req, res, next) => {
  try {
    const { complaint, entry } = await findOwnComplaintAndEntry(req, res);
    if (!complaint) return;

    if (!['Accepted', 'LocationConfirmed'].includes(entry.stage)) {
      return res.status(400).json({
        success: false,
        message: `Cannot start work from stage "${entry.stage}"`,
      });
    }

    entry.stage = 'Working';
    // Keep the citizen-facing status in sync — same value it already
    // used before the worker layer existed, so nothing downstream
    // (dashboards, SMS templates) needs to change.
    if (complaint.status === 'Pending') complaint.status = 'In Progress';
    complaint.syncWorkerRollup();
    await complaint.save();

    res.json({ success: true, message: 'Work started', workerStage: entry.stage });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Upload the "before" photo ──────────────────────────────────────
// ── @route   POST /api/worker/complaints/:id/before-photo ──────────────────
const uploadBeforePhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo uploaded' });
    }
    const { complaint, entry } = await findOwnComplaintAndEntry(req, res);
    if (!complaint) return;

    entry.proof.beforePhoto = `/uploads/${req.file.filename}`;
    await complaint.save();

    res.json({
      success: true,
      message: 'Before photo uploaded',
      beforePhoto: entry.proof.beforePhoto,
    });
  } catch (error) {
    next(error);
  }
};

// ── @desc    Upload "after" photo + submit for supervisor review ───────────
// ── @route   POST /api/worker/complaints/:id/after-photo ───────────────────
// Submitting only marks THIS worker done — the whole job only becomes
// review-ready for the department once every team member has done the
// same (see departmentController.verifyWork).
const uploadAfterPhotoAndSubmit = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo uploaded' });
    }
    const { workDescription, materialsUsed } = req.body;
    const { complaint, entry } = await findOwnComplaintAndEntry(req, res);
    if (!complaint) return;

    if (!entry.proof.beforePhoto) {
      return res.status(400).json({
        success: false,
        message: 'Upload a before photo first',
      });
    }

    entry.proof.afterPhoto = `/uploads/${req.file.filename}`;
    entry.proof.workDescription = workDescription || null;
    entry.proof.materialsUsed = materialsUsed || null;
    entry.proof.submittedAt = new Date();
    entry.stage = 'ProofSubmitted';
    complaint.proofReviewReminded = false;
    complaint.syncWorkerRollup();
    await complaint.save();

    const stillWaitingOn = complaint.assignedWorkers.filter((w) => w.stage !== 'ProofSubmitted');

    res.json({
      success: true,
      message:
        stillWaitingOn.length === 0
          ? 'Completion submitted for supervisor verification'
          : `Your part is submitted. Still waiting on ${stillWaitingOn.length} teammate(s) before the department can review.`,
      workerStage: entry.stage,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyAssignments,
  getAssignment,
  acceptAssignment,
  confirmLocation,
  startWork,
  uploadBeforePhoto,
  uploadAfterPhotoAndSubmit,
};