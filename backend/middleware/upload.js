const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');
const ApiError = require('../utils/ApiError');

// Memory storage: buffers are handed off to Cloudinary (photos) or ExcelJS (imports).
// Swap to diskStorage if you'd rather keep local files under /uploads.
const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new ApiError(400, 'Only image files are allowed.'));
};

// Mimetype alone is unreliable for spreadsheets — Windows/Excel frequently sends CSV
// as 'application/vnd.ms-excel' or 'text/plain' instead of 'text/csv'. We gate on
// extension here and let the controller do the authoritative format detection.
const SPREADSHEET_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

const spreadsheetFilter = (req, file, cb) => {
  const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
  if (!SPREADSHEET_EXTENSIONS.includes(ext)) {
    return cb(new ApiError(400, 'Only .csv or .xlsx files are allowed.'));
  }
  if (ext === '.xls') {
    // exceljs only supports the zip-based OOXML .xlsx format, not legacy binary .xls
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

// FIX (P1 — upload security): multer's fileFilter only sees the client-declared
// mimetype/extension, both of which are trivially spoofed (rename a .html or
// .svg-with-script file to .jpg). These middlewares run AFTER multer has
// buffered the file and inspect the actual file bytes (magic numbers) before
// the request reaches the controller, so a mislabeled file is rejected
// regardless of what the client claimed. Chain them after the relevant
// uploadX.single(...) call in each route, e.g.:
//   router.post('/', uploadPhoto.single('photo'), verifyImageBuffer, createEquipment)

const verifyImageBuffer = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !detected.mime.startsWith('image/')) {
      return next(new ApiError(400, "The uploaded file's content does not match a supported image format."));
    }
    next();
  } catch (err) {
    next(new ApiError(400, 'Could not verify the uploaded file.'));
  }
};

const verifyDocumentBuffer = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const detected = await fileTypeFromBuffer(req.file.buffer);
    const allowedMimes = ['application/pdf'];
    if (!detected || !(detected.mime.startsWith('image/') || allowedMimes.includes(detected.mime))) {
      return next(new ApiError(400, "The uploaded file's content does not match an image or PDF format."));
    }
    next();
  } catch (err) {
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