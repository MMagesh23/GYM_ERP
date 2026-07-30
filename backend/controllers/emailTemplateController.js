const EmailTemplate = require('../models/EmailTemplate');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { getOrSeedTemplate, renderTemplate, buildPlaceholderData } = require('../utils/emailService');
const { DEFAULT_TEMPLATES } = require('../utils/emailTemplatesDefault');

// @desc  List all email templates (seeding any that don't exist yet with defaults,
//        so the UI always shows all 8 types even before first customization)
// @route GET /api/email-templates
const listTemplates = asyncHandler(async (req, res) => {
  const templates = await Promise.all(EmailTemplate.TEMPLATE_TYPES.map((type) => getOrSeedTemplate(type)));
  res.json({ success: true, data: templates, placeholders: EmailTemplate.SUPPORTED_PLACEHOLDERS });
});

// @desc  Get a single template by type
// @route GET /api/email-templates/:type
const getTemplate = asyncHandler(async (req, res) => {
  if (!EmailTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown email template type.');
  }
  const template = await getOrSeedTemplate(req.params.type);
  res.json({ success: true, data: template });
});

// @desc  Update a template's subject/body/active state
// @route PUT /api/email-templates/:type
// body: { subject?, body?, isActive? }
const updateTemplate = asyncHandler(async (req, res) => {
  if (!EmailTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown email template type.');
  }
  const { subject, body, isActive } = req.body;
  const template = await getOrSeedTemplate(req.params.type);

  if (subject !== undefined) {
    if (!subject.trim()) throw new ApiError(400, 'Subject cannot be empty.');
    template.subject = subject;
  }
  if (body !== undefined) {
    if (!body.trim()) throw new ApiError(400, 'Body cannot be empty.');
    template.body = body;
  }
  if (isActive !== undefined) template.isActive = Boolean(isActive);
  template.updatedBy = req.user._id;

  await template.save();

  await logAudit(req, { action: 'update', module: 'settings', targetId: template._id, description: `Updated email template "${template.name}"` });

  res.json({ success: true, data: template });
});

// @desc  Reset a template back to its default subject/body
// @route POST /api/email-templates/:type/reset
const resetTemplate = asyncHandler(async (req, res) => {
  const defaults = DEFAULT_TEMPLATES[req.params.type];
  if (!defaults) throw new ApiError(404, 'Unknown email template type.');

  const template = await getOrSeedTemplate(req.params.type);
  template.subject = defaults.subject;
  template.body = defaults.body;
  template.isActive = true;
  template.updatedBy = req.user._id;
  await template.save();

  await logAudit(req, { action: 'update', module: 'settings', targetId: template._id, description: `Reset email template "${template.name}" to default` });

  res.json({ success: true, data: template });
});

// @desc  Render a live preview of a template with sample placeholder data
// @route POST /api/email-templates/:type/preview
// body: optional overrides for the sample placeholder values
const previewTemplate = asyncHandler(async (req, res) => {
  if (!EmailTemplate.TEMPLATE_TYPES.includes(req.params.type)) {
    throw new ApiError(404, 'Unknown email template type.');
  }
  const template = await getOrSeedTemplate(req.params.type);

  const sampleData = await buildPlaceholderData({
    memberName: 'John Doe',
    membershipPlan: 'Gold Plan',
    expiryDate: new Date(),
    amount: 1500,
    resetLink: 'https://example.com/reset-password?token=sample',
    ...req.body,
  });

  res.json({
    success: true,
    data: {
      subject: renderTemplate(template.subject, sampleData),
      body: renderTemplate(template.body, sampleData),
    },
  });
});

module.exports = { listTemplates, getTemplate, updateTemplate, resetTemplate, previewTemplate };
