// backend/middleware/complaintUpload.js
//
// Multipart handling for POST /api/complaints:
//   image  — optional photo, stored in /uploads (public, same as before)
//   voice  — optional voice note, stored in backend/private_uploads/voice, which
//            is NOT served statically. It is only reachable through
//            GET /api/complaints/:id/voice after an access check.
//
// The voice file's extension comes from its (allow-listed) MIME type, never from
// the client-supplied file name.

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const imageDir = path.join(__dirname, '..', 'uploads');
const voiceDir = path.join(__dirname, '..', 'private_uploads', 'voice');
[imageDir, voiceDir].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const VOICE_EXT = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
};
const IMAGE_RE = /jpeg|jpg|png|gif|webp/;

// MediaRecorder reports e.g. "audio/webm;codecs=opus" — compare the base type only.
const baseMime = (m) => String(m || '').split(';')[0].trim().toLowerCase();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, file.fieldname === 'voice' ? voiceDir : imageDir),
  filename: (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    if (file.fieldname === 'voice') return cb(null, `voice-${suffix}${VOICE_EXT[baseMime(file.mimetype)]}`);
    cb(null, `complaint-${suffix}${path.extname(file.originalname)}`);
  },
});

// Rejections are the client's fault -> HTTP 400 (the app's error handler uses err.statusCode).
const badUpload = (msg) => Object.assign(new Error(msg), { statusCode: 400 });

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'voice') {
    if (VOICE_EXT[baseMime(file.mimetype)]) return cb(null, true);
    return cb(badUpload('Voice note must be an audio recording (webm, ogg, m4a, mp3 or wav).'), false);
  }
  if (file.fieldname === 'image') {
    const extOk = IMAGE_RE.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = IMAGE_RE.test(file.mimetype.replace('image/', ''));
    if (extOk && mimeOk) return cb(null, true);
    return cb(badUpload('Only image files (JPEG, PNG, GIF, WebP) are allowed!'), false);
  }
  return cb(badUpload(`Unexpected file field "${file.fieldname}".`), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 2 }, // 10 MB per file (voice is capped lower in the controller)
  fileFilter,
});

const complaintUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'voice', maxCount: 1 },
]);

const MAX_VOICE_BYTES = Number(process.env.VOICE_MAX_BYTES) || 5 * 1024 * 1024; // 5 MB
const MAX_VOICE_SECONDS = Number(process.env.VOICE_MAX_SECONDS) || 120; // 2 minutes

module.exports = { complaintUpload, voiceDir, MAX_VOICE_BYTES, MAX_VOICE_SECONDS };