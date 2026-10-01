const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const User = require('../models/User');

const { extractGeoTag } = require('../utils/exifExtractor');
const sendSMS = require('../utils/smsService');
const checkDuplicate = require('../utils/duplicateDetector');
const detectPriority = require('../utils/autoPriority');
const assignMediator = require('../scheme-module/utils/mediatorAssigner');
const Mediator = require('../models/Mediator');
const assignDepartment = require('../utils/departmentAssigner');
const applyClusterBoost = require('../utils/clusterPriority');

const { getIO } = require('../socket/socketHandler');
const { emitComplaintEvent } = require('../utils/liveEvents');
const { voiceDir, MAX_VOICE_BYTES, MAX_VOICE_SECONDS } = require('../middleware/complaintUpload');
const path = require('path');
const fs = require('fs');

const removeFile = (f) => { if (f && f.path) fs.unlink(f.path, () => {}); };


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

  let voiceFile = null;
  let created = false;

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

    // Files arrive as req.files.{image,voice} (see middleware/complaintUpload.js)
    const imageFile = req.files && req.files.image ? req.files.image[0] : null;
    voiceFile = req.files && req.files.voice ? req.files.voice[0] : null;

    // Optional voice note — validate before doing any other work.
    let voiceNote = undefined;
    if (voiceFile) {
      if (voiceFile.size > MAX_VOICE_BYTES) {
        removeFile(voiceFile);
        removeFile(imageFile);
        return res.status(400).json({
          success: false,
          message: `Voice note is too large (max ${MAX_VOICE_BYTES >= 1048576 ? (MAX_VOICE_BYTES / 1048576).toFixed(1).replace(/\.0$/, '') + ' MB' : Math.round(MAX_VOICE_BYTES / 1024) + ' KB'}).`,
        });
      }
      const dur = Math.min(Math.max(Number(req.body.voiceDuration) || 0, 0), MAX_VOICE_SECONDS);
      voiceNote = {
        file: path.basename(voiceFile.path),
        mimeType: String(voiceFile.mimetype).split(';')[0],
        durationSec: dur || null,
        sizeBytes: voiceFile.size,
      };
    }

    // Image Upload + EXIF Location
    if (imageFile) {

      image = `/uploads/${imageFile.filename}`;

      const geoData = await extractGeoTag(imageFile.path);

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
      'name email mobile district taluk'
    );

    // Auto Priority (keyword/category based)
    const basePriority =
      !priority || priority === 'Auto'
        ? detectPriority({
            title,
            description,
            category,
          })
        : priority;

    // Cluster boost — several similar reports already open in this
    // district recently push the priority up one level, on top of
    // whatever the keyword-based score already gave it.
    const clusterResult = await applyClusterBoost({
      priority: basePriority,
      category,
      district: userDoc?.district,
    });
    const finalPriority = clusterResult.priority;

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

    // Auto-route to the real-world mediator (department contact) who
    // handles this category in this district/taluk — e.g. the BESCOM
    // electrical contact for an "Electricity Problem" in Devanahalli
    // taluk. Falls through to assignedAdmin above if none is set up
    // yet for this category/district combination.
    const mediator = await assignMediator({
      category,
      district: userDoc?.district,
      taluk: userDoc?.taluk,
    });

    const mediatorContact = mediator
      ? {
          name: mediator.name,
          phone: mediator.phone,
          department: mediator.department,
        }
      : { name: null, phone: null, department: null };

    // Auto-route to the logged-in Department account (District Admin ->
    // Department -> Worker chain). Independent of the mediator SMS
    // contact above — falls through to assignedAdmin if no department
    // account has been set up yet for this category in this district.
    const department = await assignDepartment({
      category,
      district: userDoc?.district,
    });

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

      assignedMediator: mediator ? mediator._id : null,
      mediatorContact,

      assignedDepartment: department ? department._id : null,
      departmentAssignedAt: department ? new Date() : null,

      priorityBoostedByCluster: clusterResult.boosted,

      isDuplicate: duplicateResult.isDuplicate || false,

      duplicateOf:
        duplicateResult.duplicateOf || null,


      voiceNote,

      status: 'Pending',

      statusHistory: [
        {
          status: 'Pending',
          changedBy: req.user.id,
          note: clusterResult.boosted
            ? `Complaint submitted. Priority raised to ${finalPriority} — ${clusterResult.clusterCount} similar ${category} reports already open in ${userDoc?.district || 'this district'}.`
            : 'Complaint submitted',
        },
      ],
    });

    created = true;

    // Increment user complaint count
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { totalComplaints: 1 },
    });

    // Track mediator workload (used to pick the least-busy mediator
    // next time two of them cover the same category/jurisdiction).
    if (mediator) {
      await Mediator.findByIdAndUpdate(mediator._id, {
        $inc: { activeAssignments: 1 },
      });
    }

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

    // SMS the mediator directly — this is the actual routing: the
    // department contact gets the tracking ID, category, the
    // citizen's own phone number (so they can call back for details,
    // same as the college ERP electrical-department example), and a
    // link to the photo if one was uploaded.
    if (mediator?.phone) {
      const imageUrl = image
        ? `${process.env.APP_BASE_URL || ''}${image}`
        : null;

      const mediatorMessage = `
New ${category} complaint (${complaint.trackingId}) in ${userDoc?.village || userDoc?.district || 'your area'}.

Citizen: ${userDoc?.name || 'N/A'}
Phone: ${userDoc?.mobile || 'N/A'}
Details: ${title}
${imageUrl ? `Photo: ${imageUrl}` : ''}

Please contact the citizen directly to resolve.
- Smart Village
      `;

      await sendSMS(mediator.phone, mediatorMessage).catch(console.error);
    }

    // Notify admins — only the district admin(s) for this complaint's own
    // district, plus superadmins (who oversee all districts). Previously
    // this notified every admin statewide regardless of district, which
    // defeated the point of district-scoped administration.
    const admins = await User.find({
      $or: [
        { role: 'admin', district: complaint.district },
        { role: 'superadmin' },
      ],
    }).select('_id');

    const notifications = admins.map((admin) => ({
      recipient: admin._id,
      type: 'new_complaint',
      title: 'New Complaint Submitted',
      message: `New complaint submitted: "${title}"`,
      complaint: complaint._id,
      isRead: false,
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    // Notify the owning Department account, same as admins above.
    if (department) {
      await Notification.create({
        recipient: department._id,
        type: 'new_complaint',
        title: 'New Complaint Assigned to Your Department',
        message: `New ${category} complaint: "${title}"`,
        complaint: complaint._id,
      });
    }

    // Socket.IO — live map. Sent ONLY to the rooms allowed to see this complaint
    // (district admins, superadmins, the assigned department) and carries just the
    // map fields. (This used to io.emit() the whole complaint, including the
    // citizen's name/email, to every connected socket.)
    emitComplaintEvent('new_complaint', complaint);

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      complaint,
      geoTagExtracted: geoTagged,
      autoPriority: finalPriority,
      priorityBoostedByCluster: clusterResult.boosted,
      mediatorAssigned: mediator
        ? { department: mediator.department, name: mediator.name }
        : null,
      departmentAssigned: department
        ? { id: department._id, category: department.departmentCategory }
        : null,
      duplicateWarning:
        duplicateResult.isDuplicate
          ? 'Similar complaint already exists'
          : null,
    });

  } catch (err) {

    console.error('Create complaint error:', err);

    // Don't leave an orphaned private voice file behind if the complaint was never saved.
    if (!created) removeFile(voiceFile);

    res.status(500).json({
      success: false,
      message: 'Failed to create complaint',
      error: err.message,
    });
  }
};

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
    ).populate(
      'assignedWorkers.worker',
      'name'
    ).populate(
      'assignedDepartment',
      'name departmentCategory'
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

// ── @desc    Citizen confirms a resolution, or reopens it ───────────────────
// ── @route   PUT /api/complaints/:id/confirm ────────────────────────────────
// Separate from rating — this is a binary "was it actually fixed?" that
// can send the complaint back into the workflow. Only allowed once per
// resolution (citizenConfirmation.confirmed must still be null); a fresh
// resolution after rework resets it in adminController.verifyWork.
exports.confirmResolution = async (req, res) => {
  try {
    const { confirmed, note } = req.body;

    if (typeof confirmed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '"confirmed" (true/false) is required',
      });
    }

    const complaint = await Complaint.findById(req.params.id)
      .populate('assignedWorkers.worker', 'mobile name')
      .populate('assignedMediator', 'phone name');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (complaint.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to your own complaints',
      });
    }

    if (complaint.status !== 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'This complaint is not marked resolved yet',
      });
    }

    if (complaint.citizenConfirmation?.confirmed !== null) {
      return res.status(400).json({
        success: false,
        message: 'You already responded to this resolution',
      });
    }

    complaint.citizenConfirmation = {
      confirmed,
      respondedAt: new Date(),
      note: note || null,
    };

    if (confirmed) {
      // Stays 'Resolved' — that IS the closed state here, no separate
      // status value added.
      complaint.statusHistory.push({
        status: 'Resolved',
        changedBy: req.user.id,
        note: 'Citizen confirmed the issue was resolved',
      });
    } else {
      complaint.status = 'In Progress';
      complaint.resolvedAt = null;
      complaint.reopenCount = (complaint.reopenCount || 0) + 1;

      // Send it back to whoever needs to redo it. If workers were
      // assigned, put the whole team back to 'Working' so their
      // dashboards show the before/after upload step again.
      if (complaint.assignedWorkers?.length > 0) {
        complaint.assignedWorkers.forEach((w) => { w.stage = 'Working'; });
        complaint.syncWorkerRollup();
      }

      complaint.statusHistory.push({
        status: 'In Progress',
        changedBy: req.user.id,
        note: note ? `Reopened by citizen: ${note}` : 'Reopened by citizen — issue not resolved',
      });

      const reopenMsg =
        `SmartVillage: Complaint ${complaint.trackingId} was REOPENED by the citizen — the issue is not fixed.` +
        (note ? ` Reason: ${note}` : '');

      if (complaint.assignedWorkers?.length > 0) {
        for (const w of complaint.assignedWorkers) {
          if (w.worker?.mobile) await sendSMS(w.worker.mobile, reopenMsg).catch(console.error);
        }
      } else if (complaint.assignedMediator?.phone) {
        await sendSMS(complaint.assignedMediator.phone, reopenMsg).catch(console.error);
      }
    }

    await complaint.save();

    res.json({
      success: true,
      message: confirmed ? 'Thanks for confirming!' : 'Complaint reopened',
      complaint,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit response' });
  }
};


// ======================================================
// @desc    Stream a complaint's voice note
// @route   GET /api/complaints/:id/voice
// @access  Private — the citizen who filed it, the district admin (or any
//          superadmin / district-less admin), or the assigned department.
// The file lives outside the public /uploads folder, so this is the only way
// to reach it.
// ======================================================
exports.getVoiceNote = async (req, res) => {
  try {
    const c = await Complaint.findById(req.params.id).select(
      'user district assignedDepartment voiceNote'
    );
    if (!c || !c.voiceNote || !c.voiceNote.file) {
      return res.status(404).json({ success: false, message: 'No voice note on this complaint.' });
    }

    const u = req.user;
    const allowed =
      String(c.user) === String(u._id) ||
      u.role === 'superadmin' ||
      (u.role === 'admin' && (!u.district || u.district === c.district)) ||
      (u.role === 'department' && c.assignedDepartment && String(c.assignedDepartment) === String(u._id));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Stored value is a bare file name; basename() guards against any tampering.
    const filePath = path.join(voiceDir, path.basename(c.voiceNote.file));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Voice file is no longer available.' });
    }
    res.setHeader('Content-Type', c.voiceNote.mimeType || 'audio/webm');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  } catch (err) {
    console.error('Voice note error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load voice note.' });
  }
};