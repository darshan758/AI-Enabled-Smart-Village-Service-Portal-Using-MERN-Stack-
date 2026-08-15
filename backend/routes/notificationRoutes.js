const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

// Get user notifications
router.get('/', protect, async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20);
  res.json(notifications);
});

// Mark ALL as read  — must be defined BEFORE /:id/read to avoid Express
// treating the literal string "mark-all-read" as an :id parameter
router.patch('/mark-all-read', protect, async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id }, { isRead: true });
  res.json({ success: true });
});

// Mark single notification as read
router.patch('/:id/read', protect, async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ success: true });
});

module.exports = router;
