// Normalizes a stored phone number into WhatsApp's wa.me link format
// (countrycode + number, digits only, no leading +) purely for LINK
// GENERATION — the stored Member.phone value itself is NEVER modified,
// anywhere in this file or its callers.
//
// Supports common Indian input shapes out of the box (a bare 10-digit
// local number, with/without a leading 91 or +91, with spaces/hyphens/
// brackets) and falls back to Settings.whatsappDefaultCountry's dialing
// code for any other bare local-looking number. This is intentionally NOT
// a full libphonenumber-style validator (no new dependency) — it's a
// conservative sanity check, not a guarantee the number is reachable.

const DEFAULT_COUNTRY_DIAL_CODES = {
  IN: '91',
  US: '1',
  GB: '44',
  AE: '971',
};

const stripDisplayChars = (raw) => String(raw || '').replace(/[\s\-()]/g, '');

/**
 * @param {string} rawPhone - as stored on the Member document, untouched
 * @param {string} [defaultCountry] - Settings.whatsappDefaultCountry, e.g. 'IN'
 * @returns {{ valid: boolean, normalized: string|null, reason: string|null }}
 */
const normalizePhoneForWhatsapp = (rawPhone, defaultCountry = 'IN') => {
  if (!rawPhone || !String(rawPhone).trim()) {
    return { valid: false, normalized: null, reason: 'missing' };
  }

  let digits = stripDisplayChars(rawPhone).replace(/^\+/, '');

  if (!/^\d+$/.test(digits)) {
    return { valid: false, normalized: null, reason: 'invalid_characters' };
  }

  const dialCode = DEFAULT_COUNTRY_DIAL_CODES[defaultCountry] || DEFAULT_COUNTRY_DIAL_CODES.IN;

  if (digits.length === 10) {
    // Bare local number (the common case: "9876543210") — prefix the
    // gym's configured default country code.
    digits = `${dialCode}${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // Local number with a leading trunk '0' (e.g. "09876543210")
    digits = `${dialCode}${digits.slice(1)}`;
  }
  // Otherwise: assume it already carries a country code (e.g. "919876543210"
  // from "+91 9876543210" / "91 9876543210") and use it as-is.

  if (digits.length < 8 || digits.length > 15) {
    return { valid: false, normalized: null, reason: 'invalid_length' };
  }

  // India-specific sanity check: a 91-prefixed number should resolve to a
  // 10-digit mobile number starting 6-9. Other country codes are only
  // length-checked above — this app doesn't claim to validate every
  // country's numbering plan.
  if (dialCode === '91' && digits.startsWith('91') && digits.length === 12) {
    if (!/^91[6-9]\d{9}$/.test(digits)) {
      return { valid: false, normalized: null, reason: 'invalid_indian_mobile' };
    }
  }

  return { valid: true, normalized: digits, reason: null };
};

const PHONE_INVALID_REASONS = {
  missing: 'No phone number is on file for this member.',
  invalid_characters: 'The phone number contains characters that cannot be used to open WhatsApp.',
  invalid_length: 'The phone number is not a valid length for a WhatsApp contact.',
  invalid_indian_mobile: 'The phone number does not look like a valid Indian mobile number.',
};

module.exports = { normalizePhoneForWhatsapp, PHONE_INVALID_REASONS };