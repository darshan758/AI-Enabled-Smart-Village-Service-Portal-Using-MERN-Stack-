/**
 * adminRoutes.js — Smart Village
 *
 * All admin routes require JWT + (admin or superadmin) role +
 * districtScoped (restricts a district admin's queries to their own district).
 */

const express = require('express');
const {
  getDashboardStats,
  getAllComplaints,
  updateComplaintStatus,
  assignComplaint,
  deleteComplaint,
  getAllUsers,
  toggleUserStatus,
  deleteUser,
  uploadResolutionPhoto,
  exportComplaintsCSV,
} = require('../controllers/adminController');
const { protect, adminOnly, districtScoped } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect, adminOnly, districtScoped);

router.get('/stats',                         getDashboardStats);
router.get('/complaints',                    getAllComplaints);
router.get('/complaints/export',             exportComplaintsCSV);
router.put('/complaints/:id/status',         updateComplaintStatus);
router.put('/complaints/:id/assign',         assignComplaint);
router.post('/complaints/:id/resolution-photo', upload.single('photo'), uploadResolutionPhoto);
router.delete('/complaints/:id',             deleteComplaint);
router.get('/users',                         getAllUsers);
router.put('/users/:id/toggle',              toggleUserStatus);
router.delete('/users/:id',                  deleteUser);

module.exports = router;