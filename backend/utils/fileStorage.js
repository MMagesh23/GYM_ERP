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

const saveToLocalDisk = (file, subfolder) => {
  const dir = path.join(UPLOADS_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.originalname) || '';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return `/uploads/${subfolder}/${filename}`;
};

const uploadToCloudinary = (file, subfolder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `gym-erp/${subfolder}`, resource_type: 'auto' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(file.buffer);
  });

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

// NEW — used only for branding assets (logo/favicon), which get REPLACED
// rather than accumulated. Returns the public_id alongside the URL so the
// previous asset can be cleaned up instead of left orphaned in Cloudinary.
// Other callers (equipment/staff photos, expense bills) are untouched —
// they keep using saveBufferToUploads's plain-string return.
const saveBrandingAsset = async (file, subfolder) => {
  if (cloudinaryConfigured) {
    try {
      return await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `gym-erp/${subfolder}`, resource_type: 'image' },
          (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id }))
        );
        stream.end(file.buffer);
      });
    } catch (err) {
      console.error('Cloudinary branding upload failed, falling back to local disk:', err.message);
      return { url: saveToLocalDisk(file, subfolder), publicId: null };
    }
  }
  return { url: saveToLocalDisk(file, subfolder), publicId: null };
};

const deleteBrandingAsset = async (publicId) => {
  if (!publicId || !cloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    // Best-effort cleanup only — never block the request on this.
    console.error('Cloudinary asset cleanup failed:', err.message);
  }
};

module.exports = { saveBufferToUploads, saveBrandingAsset, deleteBrandingAsset, cloudinaryConfigured };