const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const uploadToCloudinary = (file, subfolder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `gym-erp/${subfolder}`, resource_type: 'auto' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(file.buffer);
  });

const saveToLocalDisk = (file, subfolder) => {
  const dir = path.join(UPLOADS_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });

  const ext = path.extname(file.originalname) || '';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);

  return `/uploads/${subfolder}/${filename}`;
};

/**
 * Saves an uploaded file and returns a public URL. Uses Cloudinary automatically when
 * CLOUDINARY_* env vars are set (recommended for any deployment with an ephemeral
 * filesystem — Render, Railway, etc). Falls back to local disk for local dev.
 */
const saveBufferToUploads = async (file, subfolder) => {
  if (cloudinaryConfigured) {
    try {
      return await uploadToCloudinary(file, subfolder);
    } catch (err) {
      console.error('Cloudinary upload failed, falling back to local disk:', err.message);
      return saveToLocalDisk(file, subfolder);
    }
  }
  return saveToLocalDisk(file, subfolder);
};

module.exports = { saveBufferToUploads, cloudinaryConfigured };