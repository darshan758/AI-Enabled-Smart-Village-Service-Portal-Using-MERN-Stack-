/**
 * mediatorRoutes.js — Smart Village
 *
 * Mounted at /api/admin/mediators — reuses the same auth stack as the
 * rest of adminRoutes.js (protect + adminOnly + districtScoped), so a
 * district admin only manages mediators within their own district and
 * a superadmin manages all of them.
 */

const express = require('express');
const {
  getMediators,
  createMediator,
  updateMediator,
  deleteMediator,
} = require('../controllers/mediatorController');

const { protect, adminOnly, districtScoped } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, adminOnly, districtScoped);

router.get('/', getMediators);
router.post('/', createMediator);
router.put('/:id', updateMediator);
router.delete('/:id', deleteMediator);

module.exports = router;