// backend/models/Notification.js

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // Notification recipient
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Notification type
    type: {
      type: String,
      enum: [
        'new_complaint',
        'status_update',
        'admin_note',
        'system',
      ],
      required: true,
    },

    // Short notification title
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Main notification message
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Linked complaint (optional)
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
  'Notification',
  notificationSchema
);