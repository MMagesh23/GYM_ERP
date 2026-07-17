const multer = require('multer');
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

module.exports = { uploadPhoto, uploadSpreadsheet, uploadDocument };