const crypto = require('crypto');

// AES-256-GCM symmetric encryption for secrets we must store (not just hash) —
// used for the Gmail App Password so it can be decrypted at send-time to build
// the SMTP transporter, unlike a password hash which is one-way by design.
//
// Key source: ENCRYPTION_KEY env var, 32 bytes, hex or base64 encoded. Falls
// back to deriving a key from JWT_ACCESS_SECRET (already required at boot) so
// this doesn't add a new hard requirement to server.js's REQUIRED_ENV check —
// but a dedicated ENCRYPTION_KEY is strongly recommended in production since
// rotating JWT_ACCESS_SECRET would otherwise also break decryption of stored
// credentials.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM

const getKey = () => {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    // Accept hex (64 chars) or base64
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
    // Fall through to derive if the provided value isn't a valid 32-byte key
  }
  // Derive a stable 32-byte key from JWT_ACCESS_SECRET as a fallback so the
  // app still boots and works in dev without an extra env var configured.
  const secret = process.env.JWT_ACCESS_SECRET || 'insecure-fallback-key-do-not-use-in-production';
  return crypto.createHash('sha256').update(secret).digest();
};

// Returns a single string "iv:authTag:ciphertext" (all hex) so it stores
// cleanly in one Mongoose String field.
const encrypt = (plainText) => {
  if (plainText === undefined || plainText === null || plainText === '') return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (payload) => {
  if (!payload) return '';
  const parts = payload.split(':');
  if (parts.length !== 3) return ''; // not a value we encrypted (e.g. legacy/plaintext) — treat as empty
  const [ivHex, authTagHex, dataHex] = parts;
  try {
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    // Wrong key (e.g. ENCRYPTION_KEY rotated) or corrupted value — never throw
    // into a request path over this; callers treat '' as "not configured".
    return '';
  }
};

module.exports = { encrypt, decrypt };
