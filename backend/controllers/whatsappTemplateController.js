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
const { attachBillingSummaries } = require('./membershipController'); // REUSED — never re-derived
const { calcDaysRemaining } = require('../utils/membershipExpiry'); // REUSED — never re-derived
const { DEFAULT_TEMPLATES } = require('../utils/whatsappTemplatesDefault');
const {
  getOrSeedWhatsappTemplate,
  findUnknownPlaceholders,
  buildWhatsappPlaceholderData,
  renderTemplate,
  normalizePhoneForWhatsapp,
  PHONE_INVALID_REASONS,
} = require('../utils/whatsappService');

// @desc  List all WhatsApp templates (seeding defaults on first access)
// @route GET /api/whatsapp-templates
const listTemplates = asyncHandler(async (req, res) => {
  const templates = await Promise.all(WhatsappTemplate.TEMPLATE_TYPES.map((type) => getOrSeedWhatsappTemplate(type)));
  res.json({ success: true, data: templates, placeholders: WhatsappTemplate.SUPPORTED_PLACEHOLDERS });
});

// @desc  Get a single WhatsApp template
// @route GET /api/whatsapp-templates/:type
const getTemplate = asyncHandler(async (req, res) => {
  if (!WhatsappTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown WhatsApp template type.');
  }
  const template = await getOrSeedWhatsappTemplate(req.params.type);
  res.json({ success: true, data: template });
});

// @desc  Update a template's body/active state. Warns (does not block) on
// unknown/misspelled placeholders so an admin can fix a typo before it goes
// out to real members, without losing their draft.
// @route PUT /api/whatsapp-templates/:type
const updateTemplate = asyncHandler(async (req, res) => {
  if (!WhatsappTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown WhatsApp template type.');
  }
  const { body, isActive } = req.body;
  const template = await getOrSeedWhatsappTemplate(req.params.type);

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
    description: `Updated WhatsApp template "${template.name}"`,
  });

  res.json({ success: true, data: template, unknownPlaceholders: findUnknownPlaceholders(template.body) });
});

// @desc  Reset a template back to its default content
// @route POST /api/whatsapp-templates/:type/reset
const resetTemplate = asyncHandler(async (req, res) => {
  const defaults = DEFAULT_TEMPLATES[req.params.type];
  if (!defaults) throw new ApiError(404, 'Unknown WhatsApp template type.');

  const template = await getOrSeedWhatsappTemplate(req.params.type);
  template.body = defaults.body;
  template.isActive = true;
  template.updatedBy = req.user._id;
  await template.save();

  await logAudit(req, {
    action: 'update',
    module: 'settings',
    targetId: template._id,
    description: `Reset WhatsApp template "${template.name}" to default`,
  });

  res.json({ success: true, data: template });
});

// @desc  Render a preview with SAMPLE placeholder data — never touches a
// real member. Financial placeholders use sample values regardless of the
// caller's permission, since no real figures are involved (mirrors
// emailTemplateController.previewTemplate's same choice). Accepts an
// optional `body` override so the Settings UI can preview unsaved edits.
// @route POST /api/whatsapp-templates/:type/preview
const previewTemplate = asyncHandler(async (req, res) => {
  if (!WhatsappTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown WhatsApp template type.');
  }
  const template = await getOrSeedWhatsappTemplate(req.params.type);
  const settings = await Settings.getSingleton();

  const bodyToRender = req.body.body ?? template.body;
  const sampleData = {
    memberName: 'John Doe',
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
// member — the core of the manual-only WhatsApp workflow. Never sends
// anything; only fills in the template and normalizes the phone number for
// an optional "Open WhatsApp" deep link on the frontend.
// @route POST /api/whatsapp-templates/:type/generate
// body: { memberId, membershipId?, paymentId? }
const generateMessage = asyncHandler(async (req, res) => {
  if (!WhatsappTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown WhatsApp template type.');
  }
  const { memberId, membershipId, paymentId } = req.body;
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

  const template = await getOrSeedWhatsappTemplate(req.params.type);
  const { data, warnings } = await buildWhatsappPlaceholderData({ member, membership, payment, daysRemaining, canViewFinance });

  const message = renderTemplate(template.body, data);
  const unknownPlaceholders = findUnknownPlaceholders(template.body);
  const phoneResult = normalizePhoneForWhatsapp(member.phone, settings.whatsappDefaultCountry);

  await logAudit(req, {
    action: 'create',
    module: 'notifications',
    targetId: member._id,
    description: `Generated a WhatsApp message (${template.name}) for ${member.memberId} — not sent, manual copy/paste only`,
  });

  res.json({
    success: true,
    data: {
      message,
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

// @desc  OPTIONAL, best-effort activity log. Never records "sent" — see
// models/WhatsappLog.js. A failure here must never block the actual
// generate/copy/open action the frontend already performed.
// @route POST /api/whatsapp-logs
// body: { memberId, templateType, action: 'generated'|'copied'|'opened' }
const logActivity = asyncHandler(async (req, res) => {
  const { memberId, templateType, action } = req.body;
  if (!memberId || !templateType || !['generated', 'copied', 'opened'].includes(action)) {
    throw new ApiError(400, 'memberId, templateType, and a valid action are required.');
  }
  const log = await WhatsappLog.create({ member: memberId, templateType, action, performedBy: req.user._id });
  res.status(201).json({ success: true, data: log });
});

module.exports = { listTemplates, getTemplate, updateTemplate, resetTemplate, previewTemplate, generateMessage, logActivity };