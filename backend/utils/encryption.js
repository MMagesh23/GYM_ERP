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
//
// CRITICAL DEPLOYMENT NOTE: if ENCRYPTION_KEY is left unset, the derived key
// depends on JWT_ACCESS_SECRET. If that secret differs between environments
// (e.g. a fresh value auto-generated per deploy on your host), anything
// encrypted in one environment becomes silently undecryptable in another —
// see the loud console.error below and EmailSettings.appPasswordUndecryptable
// for how this surfaces instead of failing invisibly.
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
    // FIX: previously failed completely silently, which made a stale/mismatched
    // ENCRYPTION_KEY (the #1 cause of "email works locally, not in production")
    // indistinguishable from "nothing was ever configured." Ciphertext exists
    // but couldn't be decrypted with the CURRENT key — almost always means
    // ENCRYPTION_KEY (or the JWT_ACCESS_SECRET fallback) changed since this
        // value was saved. Never throw into a request path over this, but log
    // loudly so it's diagnosable, and see EmailSettings.appPasswordUndecryptable
    // for how this is surfaced to the admin in the UI.
    console.error(
      '[encryption] Failed to decrypt a stored secret — ENCRYPTION_KEY (or the ' +
        'JWT_ACCESS_SECRET fallback it derives from) most likely changed since this ' +
        'value was encrypted. Re-enter the affected credential (e.g. the Gmail App ' +
        'Password in Settings > Email) to fix this.'
    );
    return '';
  }
};

module.exports = { encrypt, decrypt };