const multer = require('multer');
// FIX (root cause): file-type@16.x (pinned in package.json — the last
// CommonJS release of this package) exports `fromBuffer`, not
// `fileTypeFromBuffer`. The `fileTypeFromBuffer` name only exists from
// file-type@17 onward, which is ESM-only and incompatible with `require()`
// in this CommonJS backend. Destructuring the v17+ name against the v16
// module silently resolves to `undefined`, so every verification call was
// really `undefined(buffer)` → TypeError, caught below and reported as a
// generic "Could not verify the uploaded file." on EVERY upload attempt,
// valid files included. Fix: import under its real v16 export name and
// alias it locally so nothing else in this file has to change.
const { fromBuffer: fileTypeFromBuffer } = require('file-type');
const ApiError = require('../utils/ApiError');

// Memory storage: buffers are handed off to Cloudinary (photos) or ExcelJS (imports).
const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new ApiError(400, 'Only image files are allowed.'));
};

const SPREADSHEET_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

const spreadsheetFilter = (req, file, cb) => {
  const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
  if (!SPREADSHEET_EXTENSIONS.includes(ext)) {
    return cb(new ApiError(400, 'Only .csv or .xlsx files are allowed.'));
  }
  if (ext === '.xls') {
    return cb(new ApiError(400, 'Legacy .xls files are not supported. Please save the file as .xlsx or .csv and try again.'));
  }
  return cb(null, true);
};

const documentFilter = (req, file, cb) => {
  const allowed = ['application/pdf'];
  if (file.mimetype.startsWith('image/') || allowed.includes(file.mimetype)) return cb(null, true);
  cb(new ApiError(400, 'Only image or PDF files are allowed.'));
};

const uploadPhoto = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadSpreadsheet = multer({ storage, fileFilter: spreadsheetFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadDocument = multer({ storage, fileFilter: documentFilter, limits: { fileSize: 8 * 1024 * 1024 } });

// ── Temporary debug instrumentation ─────────────────────────────────────
// Metadata only — never buffer contents. Safe to leave at debug level; can
// be stripped once this is confirmed stable in production.
const DEBUG_UPLOADS = process.env.DEBUG_UPLOADS !== 'false';
const logUploadDebug = (label, req, extra = {}) => {
  if (!DEBUG_UPLOADS) return;
  if (!req.file) {
    console.debug(`[upload:${label}] no file present on request`);
    return;
  }
  console.debug(`[upload:${label}]`, {
    fieldname: req.file.fieldname,
    filename: req.file.originalname,
    clientMimeType: req.file.mimetype,
    bufferBytes: req.file.buffer ? req.file.buffer.length : 0,
    ...extra,
  });
};

// ── SVG safety net ──────────────────────────────────────────────────────
// file-type CANNOT detect SVG — it's XML text with no magic-byte signature,
// so fileTypeFromBuffer() legitimately returns undefined for a perfectly
// valid SVG. That's expected, not a rejection. Since gym logos are commonly
// vector art, and the existing imageFilter/accept="image/*" already lets
// SVGs through multer, we add a narrow, content-based fallback instead of
// either (a) permanently rejecting all SVGs, or (b) trusting the client
// mimetype blindly. This rejects the common SVG-based XSS/XXE vectors
// (inline <script>, on*= handlers, external entities, javascript: URIs).
const SVG_DANGEROUS_PATTERNS = [
  /<\s*script/i,
  /on\w+\s*=/i,
  /<!ENTITY/i,
  /<!DOCTYPE[^>]*\[/i,
  /javascript:/i,
  /<\s*foreignObject/i,
];

const validateSvgBuffer = (buffer) => {
  if (buffer.length > 2 * 1024 * 1024) {
    return { valid: false, reason: 'SVG file is larger than the 2MB limit for vector logos.' };
  }

  let text;
  try {
    text = buffer.toString('utf8');
  } catch (err) {
    return { valid: false, reason: 'Could not read the file as text.' };
  }

  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!/^(<\?xml[^>]*\?>\s*)?(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(trimmed)) {
    return { valid: false, reason: 'File does not look like a valid SVG document.' };
  }

  const dangerous = SVG_DANGEROUS_PATTERNS.find((pattern) => pattern.test(text));
  if (dangerous) {
    return { valid: false, reason: 'SVG contains scripting or external-entity content and was rejected for safety.' };
  }

  return { valid: true };
};

const verifyImageBuffer = async (req, res, next) => {
  if (!req.file) return next();
  logUploadDebug('image', req);

  if (!req.file.buffer || req.file.buffer.length === 0) {
    return next(new ApiError(400, 'The uploaded file is empty.'));
  }

  try {
    const detected = await fileTypeFromBuffer(req.file.buffer);

    if (detected && detected.mime.startsWith('image/')) {
      logUploadDebug('image', req, { detectedType: detected.mime });
      return next();
    }

    const looksLikeSvgByClient =
      req.file.mimetype === 'image/svg+xml' || /\.svg$/i.test(req.file.originalname || '');

    if (!detected && looksLikeSvgByClient) {
      const svgCheck = validateSvgBuffer(req.file.buffer);
      if (svgCheck.valid) {
        logUploadDebug('image', req, { detectedType: 'image/svg+xml (content-sniffed)' });
        return next();
      }
      return next(new ApiError(400, svgCheck.reason));
    }

    logUploadDebug('image', req, { detectedType: detected ? detected.mime : 'undetected' });
    return next(new ApiError(400, "The uploaded file's content does not match a supported image format."));
  } catch (err) {
    console.error('[upload:image] verification threw:', err.message);
    next(new ApiError(400, 'Could not verify the uploaded file.'));
  }
};

const verifyDocumentBuffer = async (req, res, next) => {
  if (!req.file) return next();
  logUploadDebug('document', req);

  if (!req.file.buffer || req.file.buffer.length === 0) {
    return next(new ApiError(400, 'The uploaded file is empty.'));
  }

  try {
    const detected = await fileTypeFromBuffer(req.file.buffer);
    const allowedMimes = ['application/pdf'];
    if (!detected || !(detected.mime.startsWith('image/') || allowedMimes.includes(detected.mime))) {
      logUploadDebug('document', req, { detectedType: detected ? detected.mime : 'undetected' });
      return next(new ApiError(400, "The uploaded file's content does not match an image or PDF format."));
    }
    logUploadDebug('document', req, { detectedType: detected.mime });
    next();
  } catch (err) {
    console.error('[upload:document] verification threw:', err.message);
    next(new ApiError(400, 'Could not verify the uploaded file.'));
  }
};

module.exports = {
  uploadPhoto,
  uploadSpreadsheet,
  uploadDocument,
  verifyImageBuffer,
  verifyDocumentBuffer,
};