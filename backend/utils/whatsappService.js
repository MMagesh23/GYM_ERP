const WhatsappTemplate = require('../models/WhatsappTemplate');
const Settings = require('../models/Settings');
const { renderTemplate } = require('./emailService'); // REUSED — never re-implemented
const { DEFAULT_TEMPLATES } = require('./whatsappTemplatesDefault');
const { normalizePhoneForWhatsapp, PHONE_INVALID_REASONS } = require('./phoneNormalizer');

// Lazily seeds a template with its default content the first time it's
// requested — identical rationale to emailService.getOrSeedTemplate.
const getOrSeedWhatsappTemplate = async (type) => {
  let template = await WhatsappTemplate.findOne({ type });
  if (!template) {
    const defaults = DEFAULT_TEMPLATES[type];
    if (!defaults) throw new Error(`No default content defined for WhatsApp template type "${type}".`);
    template = await WhatsappTemplate.create({ type, ...defaults });
  }
  return template;
};

// Finds every {{token}} in a template body and reports which ones aren't in
// the supported list — catches typos like {{memberNmae}} at save/preview
// time instead of silently leaving literal "{{memberNmae}}" text in every
// message generated from it.
const findUnknownPlaceholders = (body) => {
  const found = new Set();
  const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  let match;
  while ((match = regex.exec(body || '')) !== null) {
    found.add(match[1]);
  }
  return [...found].filter((token) => !WhatsappTemplate.SUPPORTED_PLACEHOLDERS.includes(token));
};

/**
 * Builds the placeholder data set for a real member/membership/payment, and
 * a parallel `warnings` list explaining any placeholder that couldn't be
 * filled — either because the source data doesn't carry it, or (for
 * amount/dueAmount) because the caller lacks finance permission.
 *
 * FIX (financial-data exposure): financial figures are simply never added
 * to the returned data object when `canViewFinance` is false — renderTemplate()
 * (reused from utils/emailService.js) leaves any placeholder it can't
 * resolve as literal `{{token}}` text rather than substituting a value, so
 * a restricted user's generated message can never carry a real amount, even
 * indirectly.
 */
const buildWhatsappPlaceholderData = async ({ member, membership, payment, daysRemaining, canViewFinance } = {}) => {
  const settings = await Settings.getSingleton();
  const warnings = [];

  const data = {
    gymName: settings.gymName || 'Your Gym',
    gymPhone: settings.contactNumber || '',
    gymAddress: settings.address || '',
  };

  if (member) {
    data.memberName = `${member.firstName} ${member.lastName || ''}`.trim();
  } else {
    warnings.push('{{memberName}} has no value — no member was provided.');
  }

  if (membership) {
    data.membershipPlan = membership.plan?.name || membership.planName || '';
    data.startDate = membership.startDate ? new Date(membership.startDate).toLocaleDateString('en-IN') : '';
    data.expiryDate = membership.endDate ? new Date(membership.endDate).toLocaleDateString('en-IN') : '';
    if (daysRemaining !== undefined && daysRemaining !== null) {
      data.daysRemaining = String(daysRemaining);
    } else {
      warnings.push('{{daysRemaining}} has no value — no expiry context was available.');
    }
  } else {
    warnings.push('{{membershipPlan}}, {{startDate}}, and {{expiryDate}} have no value — no membership was provided.');
  }

  if (canViewFinance) {
    if (payment) {
      const collected = payment.amountPaid ?? payment.finalAmount;
      data.amount = `${settings.currencySymbol}${Number(collected || 0).toFixed(2)}`;
    } else if (membership?.billing?.collected !== undefined) {
      data.amount = `${settings.currencySymbol}${Number(membership.billing.collected).toFixed(2)}`;
    } else {
      warnings.push('{{amount}} has no value — no payment context was available.');
    }

    const outstanding = membership?.billing?.outstanding;
    if (outstanding !== undefined && outstanding !== null) {
      data.dueAmount = `${settings.currencySymbol}${Number(outstanding).toFixed(2)}`;
    } else {
      warnings.push('{{dueAmount}} has no value — no outstanding-balance context was available.');
    }
  } else {
    warnings.push('{{amount}} and {{dueAmount}} are not available — you do not have finance permission.');
  }

  return { data, warnings };
};

module.exports = {
  getOrSeedWhatsappTemplate,
  findUnknownPlaceholders,
  buildWhatsappPlaceholderData,
  renderTemplate, // re-exported so controllers only need to import from this one module
  normalizePhoneForWhatsapp,
  PHONE_INVALID_REASONS,
};