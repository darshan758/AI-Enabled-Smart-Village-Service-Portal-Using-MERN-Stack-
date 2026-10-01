const express = require('express');

const {
  checkDuplicateEndpoint,
  createComplaint,
  getMyComplaints,
  trackComplaint,
  getComplaint,
  getComplaintLocations,
  rateComplaint,
  confirmResolution,
  getVoiceNote,
} = require('../controllers/complaintController');

const { protect } = require('../middleware/authMiddleware');
const { complaintUpload } = require('../middleware/complaintUpload');

const router = express.Router();

// PUBLIC
router.get('/track/:trackingId', trackComplaint);

// PRIVATE
router.use(protect);

// duplicate check (GET — reads req.query params)
router.get('/check-duplicate', checkDuplicateEndpoint);

// create complaint
router.post(
  '/',
  complaintUpload, // image + optional voice note
  createComplaint
);

// my complaints
router.get('/my', getMyComplaints);

// map locations
router.get(
  '/locations',
  getComplaintLocations
);

// voice note (access-checked stream; file is not publicly served)
router.get('/:id/voice', getVoiceNote);

// single complaint
router.get('/:id', getComplaint);

// citizen rates a resolved complaint
router.put('/:id/rate', rateComplaint);

// citizen confirms resolution or reopens it
router.put('/:id/confirm', confirmResolution);

module.exports = router;