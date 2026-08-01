const EmailLog = require('../models/EmailLog');
const Member = require('../models/Member');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { sendTemplatedEmail } = require('../utils/emailService');

// @desc  List email history with filters + pagination
// @route GET /api/email-logs?page=&limit=&status=&templateType=&q=
const listEmailLogs = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { status, templateType, q } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (templateType) filter.templateType = templateType;
  if (q) filter.$or = [{ recipient: { $regex: q, $options: 'i' } }, { subject: { $regex: q, $options: 'i' } }];

  const [logs, total, sentCount, failedCount] = await Promise.all([
    EmailLog.find(filter)
      .populate('sentBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    EmailLog.countDocuments(filter),
    EmailLog.countDocuments({ ...filter, status: 'sent' }),
    EmailLog.countDocuments({ ...filter, status: 'failed' }),
  ]);

  res.json({
    success: true,
    data: logs,
    summary: { sent: sentCount, failed: failedCount },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc  Send an announcement email to one or more members (or an arbitrary list of addresses)
// @route POST /api/email-logs/announcement
// body: { memberIds?: string[], emails?: string[], subject?, message? }
// If subject/message are provided they render into the announcement template's
// placeholders (as the free-text portion); otherwise the template's own default
// wording is used as-is for every recipient.
//
// FIX: members are now hard-deleted (see memberController.deleteMember) — there
// is no `isDeleted` field on the Member schema anymore. The previous query
// filtered on `isDeleted: false`, which is a strict equality match against a
// field that no longer exists on ANY document, so it never matched anything
// and this endpoint silently sent to zero of the selected members every time.
const sendAnnouncement = asyncHandler(async (req, res) => {
  const { memberIds = [], emails = [], subject, message } = req.body;

  const members = memberIds.length ? await Member.find({ _id: { $in: memberIds } }) : [];
  const memberRecipients = members
    .filter((m) => m.email)
    .map((m) => ({ email: m.email, memberName: `${m.firstName} ${m.lastName || ''}`.trim(), member: m._id }));

  const adhocRecipients = emails.filter(Boolean).map((email) => ({ email, memberName: '', member: null }));

  const recipients = [...memberRecipients, ...adhocRecipients];
  if (recipients.length === 0) throw new ApiError(400, 'No valid recipient email addresses found.');

  let sent = 0;
  let failed = 0;

  // Sequential (not parallel) sending: Gmail's SMTP relay enforces per-second/
  // per-day sending limits, so a burst of concurrent sendMail calls for a
  // large announcement risks tripping Gmail's rate limiting mid-batch.
  for (const recipient of recipients) {
    const result = await sendTemplatedEmail({
      to: recipient.email,
      templateType: 'announcement',
      data: {
        memberName: recipient.memberName,
        ...(subject ? { announcementSubject: subject } : {}),
        ...(message ? { announcementMessage: message } : {}),
      },
      relatedMember: recipient.member,
      sentBy: req.user._id,
    });
    if (result.success) sent += 1;
    else failed += 1;
  }

  await logAudit(req, {
    action: 'create',
    module: 'settings',
    description: `Sent announcement email to ${recipients.length} recipient(s): ${sent} sent, ${failed} failed`,
  });

  res.json({ success: true, data: { total: recipients.length, sent, failed } });
});

module.exports = { listEmailLogs, sendAnnouncement };