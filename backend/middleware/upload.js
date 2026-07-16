const multer = require('multer');
const ApiError = require('../utils/ApiError');

// Memory storage: buffers are handed off to Cloudinary (photos) or ExcelJS (imports).
// Swap to diskStorage if you'd rather keep local files under /uploads.
const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new ApiError(400, 'Only image files are allowed.'));
};

const spreadsheetFilter = (req, file, cb) => {
  const allowed = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new ApiError(400, 'Only CSV or Excel (.xlsx) files are allowed.'));
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
