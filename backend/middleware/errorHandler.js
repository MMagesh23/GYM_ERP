const multer = require('multer');
const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: ${field}`;
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field: ${err.path}`;
  }

  // FIX: multer's own upload errors (oversized file, wrong field, etc.)
  // previously fell through to the generic 500 branch below, since
  // MulterError has neither .statusCode nor a recognized .name/.code here.
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'The uploaded file is too large.'
        : err.message || 'File upload failed.';
  }

  statusCode = statusCode || 500;
  message = message || 'Internal Server Error';

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || undefined,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };