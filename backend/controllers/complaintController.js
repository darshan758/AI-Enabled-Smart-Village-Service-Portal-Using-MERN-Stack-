const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const User = require('../models/User');

const { extractGeoTag } = require('../utils/exifExtractor');
const sendSMS = require('../utils/smsService');
const checkDuplicate = require('../utils/duplicateDetector');
const detectPriority = require('../utils/autoPriority');

const { getIO } = require('../socket/socketHandler');


// ======================================================
// @desc    Check Duplicate Complaint
// @route   GET /api/complaints/check-duplicate
// @access  Private
// ======================================================

exports.checkDuplicateEndpoint = async (req, res) => {

  try {

    const {
      title,
      category,
      latitude,
      longitude,
      district,
    } = req.query;

    const result = await checkDuplicate({
      title,
      category,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      district,
    });

    res.json({
      success: true,
      ...result,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Duplicate check failed',
    });
  }
};


// ======================================================
// @desc    Create Complaint
// @route   POST /api/complaints
// @access  Private
// ======================================================

exports.createComplaint = async (req, res) => {

  try {

    const {
      title,
      description,
      category,
      priority,
      latitude,
      longitude,
      locationName,
    } = req.body;

    let image = null;
    let lat = latitude ? parseFloat(latitude) : null;
    let lng = longitude ? parseFloat(longitude) : null;
    let geoTagged = false;

    // Image Upload + EXIF Location
    if (req.file) {

      image = `/uploads/${req.file.filename}`;

      const geoData = await extractGeoTag(req.file.path);

      if (geoData) {
        lat = geoData.latitude;
        lng = geoData.longitude;
        geoTagged = true;
      }
    }

    // Browser location
    if (!geoTagged && lat !== null && lng !== null) {
      geoTagged = true;
    }

    // Current user
    const userDoc = await User.findById(req.user.id).select(
      'name email mobile district'
    );

    // Auto Priority
    const finalPriority =
      !priority || priority === 'Auto'
        ? detectPriority({
            title,
            description,
            category,
          })
        : priority;

    // Duplicate Detection (scoped to same district)
    const duplicateResult = await checkDuplicate({
      title,
      category,
      latitude: lat,
      longitude: lng,
      district: userDoc?.district,
    });

    // Assign to the admin covering the user's district
    let assignedAdmin = null;

    if (userDoc?.district) {
      const districtAdmin = await User.findOne({
        role: 'admin',
        district: userDoc.district,
      }).select('_id');

      if (districtAdmin) {
        assignedAdmin = districtAdmin._id;
      }
    }

    // Create Complaint
    const complaint = await Complaint.create({

      user: req.user.id,

      title,
      description,
      category,

      priority: finalPriority,

      image,

      latitude: lat,
      longitude: lng,

      locationName: locationName || null,

      geoTagged,

      district: userDoc?.district || null,

      assignedAdmin,

      isDuplicate: duplicateResult.isDuplicate || false,

      duplicateOf:
        duplicateResult.duplicateOf || null,


      status: 'Pending',

      statusHistory: [
        {
          status: 'Pending',
          changedBy: req.user.id,
          note: 'Complaint submitted',
        },
      ],
    });

    // Increment user complaint count
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { totalComplaints: 1 },
    });

    await complaint.populate(
      'user',
      'name email village'
    );

    // SMS to user
    if (userDoc?.mobile) {

      const smsMessage = `
Dear ${userDoc.name},

Your complaint has been registered successfully.

Tracking ID:
${complaint.trackingId}

- Smart Village
      `;

      await sendSMS(
        userDoc.mobile,
        smsMessage
      ).catch(console.error);
    }

    // Notify admins
    const admins = await User.find({

      role: {
        $in: ['admin', 'superadmin'],
      },

    }).select('_id');

    const notifications = admins.map((admin) => ({
      recipient: admin._id,
      type: 'new_complaint',
      title: 'New Complaint Submitted',
      message: `New complaint submitted: "${title}"`,
      isRead: false,
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    // Socket.IO
    const io = getIO();

    io.emit('new_complaint', {
      message: `New complaint: ${title}`,
      complaint,
    });

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      complaint,
      geoTagExtracted: geoTagged,
      autoPriority: finalPriority,
      duplicateWarning:
        duplicateResult.isDuplicate
          ? 'Similar complaint already exists'
          : null,
    });

  } catch (err) {

    console.error('Create complaint error:', err);

    res.status(500).json({
      success: false,
      message: 'Failed to create complaint',
      error: err.message,
    });
  }
};


// ======================================================
// @desc    Update Complaint Status
// @route   PUT /api/complaints/:id/status
// @access  Admin / SuperAdmin
// ======================================================

exports.updateComplaintStatus = async (req, res) => {

  try {

    const { id } = req.params;
    const { status, remark } = req.body;

    const validStatuses = [
      'Pending',
      'In Progress',
      'Resolved',
    ];

    if (!validStatuses.includes(status)) {

      return res.status(400).json({
        message: 'Invalid status',
      });
    }

    const updateData = {
      status,
      remark: remark || '',
    };

    if (status === 'Resolved') {
      updateData.resolvedAt = new Date();
    }

    const complaint = await Complaint.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate(
      'user',
      'name mobile email'
    );

    if (!complaint) {

      return res.status(404).json({
        message: 'Complaint not found',
      });
    }

    // Add Status History
    complaint.statusHistory.push({
      status,
      changedBy: req.user.id,
      note: remark || '',
    });

    await complaint.save();

    // SMS Notification
    if (complaint.user?.mobile) {

      const msg =
        status === 'Resolved'
          ? `Your complaint "${complaint.title}" has been resolved successfully.`
          : `Your complaint "${complaint.title}" is now "${status}".`;

      await sendSMS(
        complaint.user.mobile,
        msg
      ).catch(console.error);
    }

    // In-App Notification
    await Notification.create({
      recipient: complaint.user._id,
      type: 'status_update',
      title: 'Complaint Status Updated',
      message: `Complaint "${complaint.title}" status updated to ${status}`,
      complaint: complaint._id,
      isRead: false,
    });

    // Real-time Socket Event
    const io = getIO();

    io.to(`user_${complaint.user._id}`).emit(
      'notification',
      {
        message: `Complaint "${complaint.title}" is now ${status}`,
      }
    );

    res.json({
      success: true,
      complaint,
    });

  } catch (err) {

    console.error('Status update error:', err);

    res.status(500).json({
      message: 'Failed to update status',
      error: err.message,
    });
  }
};


// ======================================================
// @desc    Get My Complaints
// @route   GET /api/complaints/my
// @access  Private
// ======================================================

exports.getMyComplaints = async (req, res) => {

  try {

    const { status, category, search } = req.query;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 9;

    const query = { user: req.user.id };

    if (status) query.status = status;
    if (category) query.category = category;

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: regex },
        { trackingId: regex },
        { description: regex },
      ];
    }

    const total = await Complaint.countDocuments(query);

    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Overall stats for this user, independent of the current filters —
    // used to populate the dashboard stat cards so they don't change
    // just because the person searched or filtered the list.
    const statusAgg = await Complaint.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats = { total: 0, Pending: 0, 'In Progress': 0, Resolved: 0 };
    statusAgg.forEach((s) => {
      stats[s._id] = s.count;
      stats.total += s.count;
    });

    res.json({
      success: true,
      complaints,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
    });
  }
};


// ======================================================
// @desc    Track Complaint
// @route   GET /api/complaints/track/:trackingId
// @access  Public
// ======================================================

exports.trackComplaint = async (req, res) => {

  try {

    const complaint = await Complaint.findOne({
      trackingId: req.params.trackingId,
    })
      .populate('user', 'name village')
      .populate(
        'statusHistory.changedBy',
        'name'
      );

    if (!complaint) {

      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    res.json({
      success: true,
      complaint,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Tracking failed',
    });
  }
};


// ======================================================
// @desc    Get Single Complaint
// @route   GET /api/complaints/:id
// @access  Private
// ======================================================

exports.getComplaint = async (req, res) => {

  try {

    const complaint = await Complaint.findById(
      req.params.id
    ).populate(
      'user',
      'name email village'
    );

    if (!complaint) {

      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    const isOwner =
      complaint.user._id.toString() === req.user.id;

    const isAdmin =
      ['admin', 'superadmin'].includes(
        req.user.role
      );

    if (!isOwner && !isAdmin) {

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      complaint,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint',
    });
  }
};


// ======================================================
// @desc    Complaint Locations
// @route   GET /api/complaints/locations
// @access  Private
// ======================================================

exports.getComplaintLocations = async (req, res) => {

  try {

    const complaints = await Complaint.find({
      user: req.user.id,
      latitude: { $ne: null },
      longitude: { $ne: null },
    })
      .select(
        'title category status latitude longitude locationName trackingId createdAt village district'
      )
      .populate('user', 'name village district')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      complaints,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch map data',
    });
  }
};

// ── @desc    Citizen rates a resolved complaint ──────────────────────────────
// ── @route   PUT /api/complaints/:id/rate ───────────────────────────────────
// New, standalone endpoint — does not touch any existing complaint flow.
exports.rateComplaint = async (req, res) => {
  try {
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (complaint.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only rate your own complaints' });
    }

    if (complaint.status !== 'Resolved') {
      return res.status(400).json({ success: false, message: 'You can only rate a resolved complaint' });
    }

    complaint.rating = rating;
    complaint.ratingFeedback = feedback || null;
    complaint.ratedAt = new Date();
    await complaint.save();

    res.json({
      success: true,
      message: 'Thanks for your feedback!',
      rating: complaint.rating,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit rating' });
  }
};