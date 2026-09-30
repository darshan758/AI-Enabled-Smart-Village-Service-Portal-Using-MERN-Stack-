/**
 * workerRoutes.js — Smart Village
 *
 * Mounted at /api/worker. Every route requires a logged-in user with
 * role === 'worker' — reuses the same JWT auth (`protect`) and the
 * existing generic `authorize()` middleware, no separate auth system.
 */

const express = require('express');
const {
  getMyAssignments,
  getAssignment,
  acceptAssignment,
  confirmLocation,
  startWork,
  uploadBeforePhoto,
  uploadAfterPhotoAndSubmit,
} = require('../controllers/workerController');

const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect, authorize('worker'));

router.get('/complaints', getMyAssignments);
router.get('/complaints/:id', getAssignment);
router.post('/complaints/:id/accept', acceptAssignment);
router.post('/complaints/:id/confirm-location', confirmLocation);
router.post('/complaints/:id/start', startWork);
router.post('/complaints/:id/before-photo', upload.single('photo'), uploadBeforePhoto);
router.post('/complaints/:id/after-photo', upload.single('photo'), uploadAfterPhotoAndSubmit);

module.exports = router;