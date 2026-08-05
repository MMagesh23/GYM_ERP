const ExcelJS = require('exceljs');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const Membership = require('../models/Membership');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { generateMemberId } = require('../utils/idGenerator');
const { summarizeMembershipBilling } = require('../utils/billing');
const { sendTemplatedEmailAsync } = require('../utils/emailService');
const { getExpiryWindow } = require('../utils/membershipExpiry');
const { saveMemberPhoto, deleteBrandingAsset } = require('../utils/fileStorage');

// Attaches a `billing` summary (invoiced/collected/outstanding/status) onto each
// member's currentMembership so list/profile views can show "this member owes
// money" without a separate trip to the Payments screen. A membership can go
// weeks with zero linked Payment records (assigning/renewing one never creates
// a payment on its own) — without this, those cases silently look fully paid.
const attachCurrentMembershipBilling = async (members) => {
  const membershipIds = members.map((m) => m.currentMembership?._id).filter(Boolean);
  if (membershipIds.length === 0) return members;

  const payments = await Payment.find({ membership: { $in: membershipIds } })
    .select('membership finalAmount amountPaid discount status refund.refundedAmount')
    .lean();
  const byMembership = payments.reduce((acc, p) => {
    const key = String(p.membership);
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {});

  return members.map((m) => {
    const plain = m.toObject();
    if (plain.currentMembership) {
      plain.currentMembership.billing = summarizeMembershipBilling(
        plain.currentMembership.finalAmount,
        byMembership[String(plain.currentMembership._id)] || []
      );
    }
    return plain;
  });
};

// @desc  List members with pagination, search, and filters
// @route GET /api/members?page=1&limit=20&q=&status=&gender=&expiringDays=
const listMembers = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { q, status, gender, joinedFrom, joinedTo, expiringDays } = req.query;

  // NOTE: members are hard-deleted (see deleteMember below), so there is no
  // `isDeleted` flag to filter on anymore — a member that exists in the
  // collection is, by definition, not deleted.
  const filter = {};
  if (status) filter.status = status;
  if (gender) filter.gender = gender;
  if (joinedFrom || joinedTo) {
    filter.joiningDate = {};
    if (joinedFrom) filter.joiningDate.$gte = new Date(joinedFrom);
    if (joinedTo) filter.joiningDate.$lte = new Date(joinedTo);
  }
  if (q) {
    filter.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { memberId: { $regex: q, $options: 'i' } },
    ];
  }

  // NEW — "expiring within N days" filter, used by the Dashboard's
  // "Memberships Expiring in 7 Days" → View All action. Resolves matching
  // Membership records via the same shared, timezone-aware window used
  // everywhere else (see utils/membershipExpiry.js), then narrows the member
  // filter to just those members, rather than re-deriving the expiry math.
  if (expiringDays) {
    const days = Math.min(Math.max(Number(expiringDays) || 7, 1), 30);
    const settings = await Settings.getSingleton();
    const { todayStart, windowEnd } = getExpiryWindow(settings.timeZone, days);
    const expiringMemberIds = await Membership.find({
      status: 'active',
      endDate: { $gte: todayStart, $lt: windowEnd },
    }).distinct('member');
    filter._id = { $in: expiringMemberIds };
  }

  const [members, total] = await Promise.all([
    Member.find(filter)
      .populate({ path: 'currentMembership', populate: { path: 'plan', select: 'name durationType' } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Member.countDocuments(filter),
  ]);

  const membersWithBilling = await attachCurrentMembershipBilling(members);

  res.json({
    success: true,
    data: membersWithBilling,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc  Get a single member's full profile
// @route GET /api/members/:id
const getMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id).populate({
    path: 'currentMembership',
    populate: { path: 'plan' },
  });
  if (!member) throw new ApiError(404, 'Member not found.');
  const [withBilling] = await attachCurrentMembershipBilling([member]);
  res.json({ success: true, data: withBilling });
});

// @desc  Create a new member (auto-generates memberId)
// @route POST /api/members
const createMember = asyncHandler(async (req, res) => {
  const memberId = await generateMemberId();
  const { photo, photoPublicId, ...body } = req.body;

  const payload = { ...body, memberId, createdBy: req.user._id };
  if (req.file) {
    const { url, publicId } = await saveMemberPhoto(req.file);
    payload.photo = url;
    payload.photoPublicId = publicId || '';
  }

  const member = await Member.create(payload);

  await logAudit(req, {
    action: 'create',
    module: 'members',
    targetId: member._id,
    description: `Created member ${member.memberId} (${member.firstName} ${member.lastName || ''})`,
  });

  // Automatic trigger: Welcome Email. Fire-and-forget (see emailService) so a
  // slow/unavailable SMTP server never delays or fails member creation itself.
  if (member.email) {
    sendTemplatedEmailAsync({
      to: member.email,
      templateType: 'welcome',
      data: { memberName: `${member.firstName} ${member.lastName || ''}`.trim() },
      relatedMember: member._id,
      sentBy: req.user._id,
    });
  }

  res.status(201).json({ success: true, data: member });
});

// @desc  Update member details
// @route PUT /api/members/:id
const updateMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw new ApiError(404, 'Member not found.');

  const { memberId, photo, photoPublicId, removePhoto, ...updates } = req.body;
  Object.assign(member, updates);

  if (req.file) {
    const previousPublicId = member.photoPublicId;
    const { url, publicId } = await saveMemberPhoto(req.file);
    member.photo = url;
    member.photoPublicId = publicId || '';
    await member.save();
    await deleteBrandingAsset(previousPublicId);
  } else if (removePhoto === 'true' || removePhoto === true) {
    const previousPublicId = member.photoPublicId;
    member.photo = '';
    member.photoPublicId = '';
    await member.save();
    await deleteBrandingAsset(previousPublicId);
  } else {
    await member.save();
  }

  await logAudit(req, { action: 'update', module: 'members', targetId: member._id, description: `Updated member ${member.memberId}` });

  res.json({ success: true, data: member });
});

// @desc  Permanently delete a member (hard delete — replaces the old soft-delete).
//
// FIX (finance-correctness): a member that only had `isDeleted: true` set
// still existed in the collection, and — worse — their Membership records
// stuck around too. Since outstandingMemberships/pendingPayments/dashboard
// counts all read live off Membership (not Member.isDeleted), a "deleted"
// member with an active/frozen membership kept counting toward active-member
// totals, expiring-soon lists, and outstanding-dues figures forever.
//
// This now:
//   1. Cascade-deletes the member's Membership record(s) — a membership
//      pointing at nobody is meaningless and was exactly what was polluting
//      those live figures.
//   2. Preserves Payment records (financial history / revenue & profit are
//      computed straight off Payment + Expense — see utils/financeCalculations.js
//      — and must never move just because a member profile was removed).
//      Snapshots the member's identity onto each payment first, since
//      `populate('member')` will return null once the member is gone.
//   3. Removes pending in-app Notifications addressed to this member (nothing
//      useful comes from notifying about a member who no longer exists).
//   4. Hard-deletes the Member document itself.
//
// @route DELETE /api/members/:id
const deleteMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw new ApiError(404, 'Member not found.');

  const fullName = `${member.firstName} ${member.lastName || ''}`.trim();

  const [{ deletedCount: membershipsRemoved }] = await Promise.all([
    Membership.deleteMany({ member: member._id }),
    Payment.updateMany(
      { member: member._id },
      { $set: { memberSnapshot: { memberId: member.memberId, name: fullName } } }
    ),
    Notification.deleteMany({ recipientMember: member._id }),
  ]);

  const paymentsRetained = await Payment.countDocuments({ 'memberSnapshot.memberId': member.memberId });
  const previousPhotoPublicId = member.photoPublicId;

  await member.deleteOne();
  await deleteBrandingAsset(previousPhotoPublicId);

  await logAudit(req, {
    action: 'delete',
    module: 'members',
    targetId: member._id,
    description:
      `Permanently deleted member ${member.memberId} (${fullName}) — ` +
      `${membershipsRemoved} membership record(s) removed, ${paymentsRetained} payment record(s) retained for financial history.`,
  });

  res.json({ success: true, message: 'Member deleted permanently.' });
});

// @desc  Change member status (suspend / freeze / reactivate / cancel)
// @route PATCH /api/members/:id/status
const changeStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const allowed = ['active', 'expired', 'suspended', 'freeze', 'cancelled'];
  if (!allowed.includes(status)) throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);

  const member = await Member.findById(req.params.id);
  if (!member) throw new ApiError(404, 'Member not found.');

  const previousStatus = member.status;
  member.status = status;
  if (reason) member.notes = `${member.notes ? member.notes + '\n' : ''}[${new Date().toISOString()}] Status ${previousStatus} -> ${status}: ${reason}`;
  await member.save();

  await logAudit(req, {
    action: 'update',
    module: 'members',
    targetId: member._id,
    description: `Member ${member.memberId} status changed: ${previousStatus} -> ${status}`,
  });

  res.json({ success: true, data: member });
});

// @desc  Export members to Excel (respects the same filters as listMembers)
// @route GET /api/members/export
const exportMembers = asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
  }

  const members = await Member.find(filter).sort({ createdAt: -1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Members');
  sheet.columns = [
    { header: 'Member ID', key: 'memberId', width: 14 },
    { header: 'First Name', key: 'firstName', width: 18 },
    { header: 'Last Name', key: 'lastName', width: 18 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Email', key: 'email', width: 24 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Joining Date', key: 'joiningDate', width: 14 },
  ];
  members.forEach((m) => {
    sheet.addRow({
      memberId: m.memberId,
      firstName: m.firstName,
      lastName: m.lastName,
      gender: m.gender,
      phone: m.phone,
      email: m.email,
      status: m.status,
      joiningDate: m.joiningDate ? m.joiningDate.toISOString().slice(0, 10) : '',
    });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="members-export.xlsx"');

  await workbook.xlsx.write(res);
  res.end();

  await logAudit(req, { action: 'update', module: 'members', description: `Exported ${members.length} members` });
});

// @desc  Bulk import members from an uploaded Excel/CSV file
// @route POST /api/members/import  (multipart/form-data, field name "file")
const importMembers = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded.');

  const filename = req.file.originalname || '';
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  // Decide format by file extension, not mimetype — browsers and Excel are
  // inconsistent about the mimetype they send for .csv (e.g. Windows often sends
  // 'application/vnd.ms-excel' for CSV), which previously caused CSV files to be
  // fed into the xlsx zip parser and crash with a cryptic "central directory" error.
  const isCsv = ext === '.csv';

  const workbook = new ExcelJS.Workbook();
  try {
    if (isCsv) {
      await workbook.csv.read(require('stream').Readable.from(req.file.buffer));
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }
  } catch (err) {
    throw new ApiError(
      400,
      'Could not read this file. Make sure it is a valid, uncorrupted .xlsx or .csv file (legacy .xls is not supported — re-save as .xlsx or .csv).'
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new ApiError(400, 'The file appears to be empty or missing a header row.');
  }

  const results = { created: 0, failed: [] };

  // Expect header row: firstName, lastName, gender, phone, email, joiningDate
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    const [_, firstName, lastName, gender, phone, email] = row.values;
    if (!firstName || !phone || !gender) {
      results.failed.push({ row: row.number, reason: 'Missing required field (firstName, gender, or phone)' });
      continue;
    }
    try {
      const memberId = await generateMemberId();
      await Member.create({
        memberId,
        firstName: String(firstName).trim(),
        lastName: lastName ? String(lastName).trim() : '',
        gender: String(gender).toLowerCase().trim(),
        phone: String(phone).trim(),
        email: email ? String(email).trim() : '',
        createdBy: req.user._id,
      });
      results.created += 1;
    } catch (err) {
      results.failed.push({ row: row.number, reason: err.message });
    }
  }

  await logAudit(req, {
    action: 'create',
    module: 'members',
    description: `Bulk imported members: ${results.created} created, ${results.failed.length} failed`,
  });

  res.json({ success: true, data: results });
});

module.exports = {
  listMembers,
  getMember,
  createMember,
  updateMember,
  deleteMember,
  changeStatus,
  exportMembers,
  importMembers,
};