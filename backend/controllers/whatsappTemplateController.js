const WhatsappTemplate = require('../models/WhatsappTemplate');
const WhatsappLog = require('../models/WhatsappLog');
const Member = require('../models/Member');
const Membership = require('../models/Membership');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { hasPermission } = require('../middleware/rbac');
const { attachBillingSummaries } = require('./membershipController');
const { calcDaysRemaining } = require('../utils/membershipExpiry');
const { DEFAULT_TEMPLATES, TAMIL_TEMPLATES } = require('../utils/whatsappTemplatesDefault');
const {
  getOrSeedWhatsappTemplate,
  findUnknownPlaceholders,
  buildWhatsappPlaceholderData,
  renderTemplate,
  normalizePhoneForWhatsapp,
  PHONE_INVALID_REASONS,
} = require('../utils/whatsappService');

const DEFAULTS_BY_LANGUAGE = { en: DEFAULT_TEMPLATES, ta: TAMIL_TEMPLATES };

// Resolves & validates the `language` query/body param, defaulting to 'en'
// so every call site that predates multi-language support keeps working
// with no change in behavior.
const resolveLanguage = (raw) => {
  const language = raw || 'en';
  if (!WhatsappTemplate.SUPPORTED_LANGUAGES.includes(language)) {
    throw new ApiError(400, `Unsupported language "${language}". Supported: ${WhatsappTemplate.SUPPORTED_LANGUAGES.join(', ')}.`);
  }
  return language;
};

// @desc  List all WhatsApp templates for a language (seeding defaults on first access)
// @route GET /api/whatsapp-templates?language=en|ta
const listTemplates = asyncHandler(async (req, res) => {
  const language = resolveLanguage(req.query.language);
  const templates = await Promise.all(WhatsappTemplate.TEMPLATE_TYPES.map((type) => getOrSeedWhatsappTemplate(type, language)));
  res.json({
    success: true,
    data: templates,
    placeholders: WhatsappTemplate.SUPPORTED_PLACEHOLDERS,
    languages: WhatsappTemplate.SUPPORTED_LANGUAGES,
    languageLabels: WhatsappTemplate.LANGUAGE_LABELS,
  });
});

// @desc  Get a single WhatsApp template
// @route GET /api/whatsapp-templates/:type?language=en|ta
const getTemplate = asyncHandler(async (req, res) => {
  if (!WhatsappTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown WhatsApp template type.');
  }
  const language = resolveLanguage(req.query.language);
  const template = await getOrSeedWhatsappTemplate(req.params.type, language);
  res.json({ success: true, data: template });
});

// @desc  Update a template's body/active state for a given language.
// @route PUT /api/whatsapp-templates/:type?language=en|ta
const updateTemplate = asyncHandler(async (req, res) => {
  if (!WhatsappTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown WhatsApp template type.');
  }
  const language = resolveLanguage(req.query.language || req.body.language);
  const { body, isActive } = req.body;
  const template = await getOrSeedWhatsappTemplate(req.params.type, language);

  if (body !== undefined) {
    if (!body.trim()) throw new ApiError(400, 'Message body cannot be empty.');
    template.body = body;
  }
  if (isActive !== undefined) template.isActive = Boolean(isActive);
  template.updatedBy = req.user._id;
  await template.save();

  await logAudit(req, {
    action: 'update',
    module: 'settings',
    targetId: template._id,
    description: `Updated WhatsApp template "${template.name}" (${WhatsappTemplate.LANGUAGE_LABELS[language]})`,
  });

  res.json({ success: true, data: template, unknownPlaceholders: findUnknownPlaceholders(template.body) });
});

// @desc  Reset a template back to its default content for a given language
// @route POST /api/whatsapp-templates/:type/reset?language=en|ta
const resetTemplate = asyncHandler(async (req, res) => {
  const language = resolveLanguage(req.query.language || req.body.language);
  const defaults = DEFAULTS_BY_LANGUAGE[language]?.[req.params.type];
  if (!defaults) throw new ApiError(404, 'Unknown WhatsApp template type.');

  const template = await getOrSeedWhatsappTemplate(req.params.type, language);
  template.body = defaults.body;
  template.isActive = true;
  template.updatedBy = req.user._id;
  await template.save();

  await logAudit(req, {
    action: 'update',
    module: 'settings',
    targetId: template._id,
    description: `Reset WhatsApp template "${template.name}" (${WhatsappTemplate.LANGUAGE_LABELS[language]}) to default`,
  });

  res.json({ success: true, data: template });
});

// @desc  Render a preview with SAMPLE placeholder data for a given language.
// @route POST /api/whatsapp-templates/:type/preview?language=en|ta
const previewTemplate = asyncHandler(async (req, res) => {
  if (!WhatsappTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown WhatsApp template type.');
  }
  const language = resolveLanguage(req.query.language || req.body.language);
  const template = await getOrSeedWhatsappTemplate(req.params.type, language);
  const settings = await Settings.getSingleton();

  const bodyToRender = req.body.body ?? template.body;
  const sampleData = {
    memberName: language === 'ta' ? 'ராஜ் குமார்' : 'John Doe',
    membershipPlan: 'Gold Plan',
    startDate: new Date().toLocaleDateString('en-IN'),
    expiryDate: new Date().toLocaleDateString('en-IN'),
    daysRemaining: '5',
    amount: `${settings.currencySymbol}1500.00`,
    dueAmount: `${settings.currencySymbol}500.00`,
    gymName: settings.gymName,
    gymPhone: settings.contactNumber,
    gymAddress: settings.address,
  };

  const message = renderTemplate(bodyToRender, sampleData);
  res.json({ success: true, data: { message, unknownPlaceholders: findUnknownPlaceholders(bodyToRender) } });
});

// @desc  Generate a personalized, ready-to-copy WhatsApp message for a real
// member, in the requested language.
// @route POST /api/whatsapp-templates/:type/generate
// body: { memberId, membershipId?, paymentId?, language? }
const generateMessage = asyncHandler(async (req, res) => {
  if (!WhatsappTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown WhatsApp template type.');
  }
  const { memberId, membershipId, paymentId } = req.body;
  const language = resolveLanguage(req.body.language);
  if (!memberId) throw new ApiError(400, 'memberId is required.');

  const member = await Member.findById(memberId);
  if (!member) throw new ApiError(404, 'Member not found.');

  const settings = await Settings.getSingleton();
  const canViewFinance = await hasPermission(req.user, 'finance', 'view');

  let membership = null;
  let daysRemaining;
  const resolvedMembershipId = membershipId || member.currentMembership;
  if (resolvedMembershipId) {
    membership = await Membership.findById(resolvedMembershipId).populate('plan');
    if (membership) {
      daysRemaining = calcDaysRemaining(membership.endDate, settings.timeZone);
      if (canViewFinance) {
        const [withBilling] = await attachBillingSummaries([membership]);
        membership = withBilling;
      }
    }
  }

  let payment = null;
  if (paymentId) payment = await Payment.findById(paymentId);

  const template = await getOrSeedWhatsappTemplate(req.params.type, language);
  const { data, warnings } = await buildWhatsappPlaceholderData({ member, membership, payment, daysRemaining, canViewFinance });

  const message = renderTemplate(template.body, data);
  const unknownPlaceholders = findUnknownPlaceholders(template.body);
  const phoneResult = normalizePhoneForWhatsapp(member.phone, settings.whatsappDefaultCountry);

  await logAudit(req, {
    action: 'create',
    module: 'notifications',
    targetId: member._id,
    description: `Generated a WhatsApp message (${template.name}, ${WhatsappTemplate.LANGUAGE_LABELS[language]}) for ${member.memberId} — not sent, manual copy/paste only`,
  });

  res.json({
    success: true,
    data: {
      message,
      language,
      member: { _id: member._id, memberId: member.memberId, name: data.memberName, phone: member.phone },
      phone: {
        raw: member.phone,
        normalized: phoneResult.normalized,
        valid: phoneResult.valid,
        reason: phoneResult.reason,
        reasonMessage: phoneResult.reason ? PHONE_INVALID_REASONS[phoneResult.reason] : null,
      },
      warnings,
      unknownPlaceholders,
    },
  });
});

// @desc  OPTIONAL, best-effort activity log. Never records "sent".
// @route POST /api/whatsapp-logs
const logActivity = asyncHandler(async (req, res) => {
  const { memberId, templateType, action } = req.body;
  if (!memberId || !templateType || !['generated', 'copied', 'opened'].includes(action)) {
    throw new ApiError(400, 'memberId, templateType, and a valid action are required.');
  }
  const log = await WhatsappLog.create({ member: memberId, templateType, action, performedBy: req.user._id });
  res.status(201).json({ success: true, data: log });
});

module.exports = { listTemplates, getTemplate, updateTemplate, resetTemplate, previewTemplate, generateMessage, logActivity };