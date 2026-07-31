jest.mock('../models/Settings', () => ({
  getSingleton: jest.fn().mockResolvedValue({
    gymName: 'Test Gym',
    contactNumber: '022-12345678',
    address: '123 Main St',
    currencySymbol: '₹',
    whatsappDefaultCountry: 'IN',
  }),
}));

jest.mock('../models/WhatsappTemplate', () => ({
  SUPPORTED_PLACEHOLDERS: [
    'memberName', 'membershipPlan', 'startDate', 'expiryDate', 'daysRemaining',
    'amount', 'dueAmount', 'gymName', 'gymPhone', 'gymAddress',
  ],
  findOne: jest.fn(),
  create: jest.fn(),
}));

const { findUnknownPlaceholders, buildWhatsappPlaceholderData } = require('../utils/whatsappService');
const { normalizePhoneForWhatsapp } = require('../utils/phoneNormalizer');
const { renderTemplate } = require('../utils/emailService');

describe('whatsappService.findUnknownPlaceholders', () => {
  it('flags a misspelled placeholder', () => {
    expect(findUnknownPlaceholders('Hi {{memberNmae}}, welcome to {{gymName}}')).toEqual(['memberNmae']);
  });

  it('returns an empty array when every placeholder is supported', () => {
    expect(findUnknownPlaceholders('Hi {{memberName}} from {{gymName}}')).toEqual([]);
  });

  it('returns an empty array for a body with no placeholders at all', () => {
    expect(findUnknownPlaceholders('Just plain text, no tokens here.')).toEqual([]);
  });
});

describe('whatsappService.buildWhatsappPlaceholderData', () => {
  const member = { firstName: 'Jane', lastName: 'Doe' };
  const membership = {
    plan: { name: 'Gold' },
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-02-01'),
    billing: { collected: 1000, outstanding: 500 },
  };

  it('includes financial placeholders ONLY when canViewFinance is true', async () => {
    const withFinance = await buildWhatsappPlaceholderData({ member, membership, daysRemaining: 5, canViewFinance: true });
    expect(withFinance.data.amount).toBe('₹1000.00');
    expect(withFinance.data.dueAmount).toBe('₹500.00');

    const withoutFinance = await buildWhatsappPlaceholderData({ member, membership, daysRemaining: 5, canViewFinance: false });
    expect(withoutFinance.data.amount).toBeUndefined();
    expect(withoutFinance.data.dueAmount).toBeUndefined();
    expect(withoutFinance.warnings.some((w) => w.includes('finance permission'))).toBe(true);
  });

  it('warns instead of throwing when membership context is missing', async () => {
    const { data, warnings } = await buildWhatsappPlaceholderData({ member, canViewFinance: false });
    expect(data.membershipPlan).toBeUndefined();
    expect(warnings.some((w) => w.includes('membershipPlan'))).toBe(true);
  });

  it('warns instead of throwing when member context is missing', async () => {
    const { data, warnings } = await buildWhatsappPlaceholderData({ canViewFinance: false });
    expect(data.memberName).toBeUndefined();
    expect(warnings.some((w) => w.includes('memberName'))).toBe(true);
  });

  it('always includes gym info sourced from Settings', async () => {
    const { data } = await buildWhatsappPlaceholderData({ member, canViewFinance: false });
    expect(data.gymName).toBe('Test Gym');
    expect(data.gymPhone).toBe('022-12345678');
    expect(data.gymAddress).toBe('123 Main St');
  });
});

describe('phoneNormalizer.normalizePhoneForWhatsapp', () => {
  it('flags a missing phone number', () => {
    expect(normalizePhoneForWhatsapp('', 'IN')).toEqual({ valid: false, normalized: null, reason: 'missing' });
  });

  it('normalizes a bare 10-digit Indian mobile number', () => {
    expect(normalizePhoneForWhatsapp('9876543210', 'IN')).toEqual({ valid: true, normalized: '919876543210', reason: null });
  });

  it('normalizes "+91 9876543210" (with plus and spaces)', () => {
    const result = normalizePhoneForWhatsapp('+91 9876543210', 'IN');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('919876543210');
  });

  it('normalizes "91 9876543210" (no plus)', () => {
    const result = normalizePhoneForWhatsapp('91 9876543210', 'IN');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('919876543210');
  });

  it('strips hyphens and brackets before normalizing', () => {
    const result = normalizePhoneForWhatsapp('(987) 654-3210', 'IN');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('919876543210');
  });

  it('rejects a number containing letters', () => {
    const result = normalizePhoneForWhatsapp('98765abcde', 'IN');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_characters');
  });

  it('rejects a 10-digit Indian number not starting with 6-9', () => {
    const result = normalizePhoneForWhatsapp('1234567890', 'IN');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_indian_mobile');
  });

  it('never mutates the input string (no DB write, no in-place edit)', () => {
    const original = '+91 98765 43210';
    normalizePhoneForWhatsapp(original, 'IN');
    expect(original).toBe('+91 98765 43210');
  });
});

describe('renderTemplate (reused from emailService, not duplicated)', () => {
  it('preserves line breaks, emojis, and Unicode characters', () => {
    const body = 'Hi {{memberName}} 👋\nWelcome to {{gymName}} 💪\nनमस्ते!';
    const rendered = renderTemplate(body, { memberName: 'Priya', gymName: 'FitZone' });
    expect(rendered).toBe('Hi Priya 👋\nWelcome to FitZone 💪\nनमस्ते!');
  });

  it('leaves an unmatched placeholder as literal text rather than blanking it', () => {
    const rendered = renderTemplate('Due: {{dueAmount}}', { memberName: 'Priya' });
    expect(rendered).toBe('Due: {{dueAmount}}');
  });
});