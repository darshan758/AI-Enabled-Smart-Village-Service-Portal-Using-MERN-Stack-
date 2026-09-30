/**
 * departmentRoutes.js — Smart Village
 *
 * Mounted at /api/department. Every route requires a logged-in user with
 * role === 'department' — reuses the same JWT auth (`protect`) and the
 * existing generic `authorize()` middleware, no separate auth system.
 */

const express = require('express');
const {
  getDashboardStats,
  getComplaints,
  createWorker,
  getWorkers,
  toggleWorker,
  assignWorker,
  removeWorkerFromComplaint,
  verifyWork,
} = require('../controllers/departmentController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, authorize('department'));

router.get('/stats', getDashboardStats);
router.get('/complaints', getComplaints);
router.post('/complaints/:id/assign-worker', assignWorker);
router.delete('/complaints/:id/workers/:workerId', removeWorkerFromComplaint);
router.post('/complaints/:id/verify-work', verifyWork);
router.get('/workers', getWorkers);
router.post('/workers', createWorker);
router.put('/workers/:id/toggle', toggleWorker);

module.exports = router;