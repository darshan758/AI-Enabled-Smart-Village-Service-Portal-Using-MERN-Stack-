const express = require("express");

const {
  getAnalytics,
  listDistricts,
  listAdmins,
  createAdmin,
  deleteAdmin,
} = require("../controllers/superAdminController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Only superadmin
const superAdminOnly = (req, res, next) => {
  if (req.user && req.user.role === "superadmin") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Super admin access required",
  });
};

router.use(protect, superAdminOnly);

// Analytics
router.get("/analytics", getAnalytics);

// Districts (fixed list, for dropdowns)
router.get("/districts", listDistricts);

// Admins
router.get("/admins", listAdmins);
router.post("/admins", createAdmin);
router.delete("/admins/:id", deleteAdmin);

module.exports = router;