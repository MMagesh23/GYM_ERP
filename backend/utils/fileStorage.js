const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

/**
 * Saves a multer memory-storage file buffer to disk under uploads/<subfolder>/
 * and returns a public URL path like "/uploads/bills/<filename>".
 * Swap this out for a Cloudinary upload call if CLOUDINARY_* env vars are set.
 */
const saveBufferToUploads = (file, subfolder) => {
  const dir = path.join(UPLOADS_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });

  const ext = path.extname(file.originalname) || '';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);

  return `/uploads/${subfolder}/${filename}`;
};

module.exports = { saveBufferToUploads };
