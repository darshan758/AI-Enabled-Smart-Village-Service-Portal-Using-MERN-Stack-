const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES || String(8 * 1024 * 1024), 10);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Safe, collision-free filename — never trust the client-provided name.
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '';
    cb(null, `${uuidv4()}${safeExt}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error('UNSUPPORTED_FILE_TYPE'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

/**
 * cleanupUploadedFiles()
 * Deletes temp files after a request finishes (success or failure) so
 * we don't accumulate applicant documents on disk indefinitely.
 * Call explicitly from controllers once verification is complete.
 */
function cleanupUploadedFiles(files) {
  const list = Array.isArray(files) ? files : Object.values(files || {}).flat();
  for (const file of list) {
    if (file && file.path) {
      fs.unlink(file.path, () => {}); // best-effort cleanup
    }
  }
}

module.exports = { upload, cleanupUploadedFiles, UPLOAD_DIR, MAX_UPLOAD_BYTES };