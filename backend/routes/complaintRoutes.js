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
} = require('../controllers/complaintController');

const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

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
  upload.single('image'),
  createComplaint
);

// my complaints
router.get('/my', getMyComplaints);

// map locations
router.get(
  '/locations',
  getComplaintLocations
);

// single complaint
router.get('/:id', getComplaint);

// citizen rates a resolved complaint
router.put('/:id/rate', rateComplaint);

// citizen confirms resolution or reopens it
router.put('/:id/confirm', confirmResolution);

module.exports = router;