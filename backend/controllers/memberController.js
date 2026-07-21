const ExcelJS = require('exceljs');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { generateMemberId } = require('../utils/idGenerator');
const { summarizeMembershipBilling } = require('../utils/billing');

// Attaches a `billing` summary (invoiced/collected/outstanding/status) onto each
// member's currentMembership so list/profile views can show "this member owes
// money" without a separate trip to the Payments screen. A membership can go
// weeks with zero linked Payment records (assigning/renewing one never creates
// a payment on its own) — without this, those cases silently look fully paid.
const attachCurrentMembershipBilling = async (members) => {
  const membershipIds = members.map((m) => m.currentMembership?._id).filter(Boolean);
  if (membershipIds.length === 0) return members;

  const payments = await Payment.find({ membership: { $in: membershipIds } })
    .select('membership finalAmount amountPaid status refund.refundedAmount')
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
// @route GET /api/members?page=1&limit=20&q=&status=&gender=
const listMembers = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { q, status, gender, joinedFrom, joinedTo } = req.query;

  const filter = { isDeleted: false };
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
  const member = await Member.findOne({ _id: req.params.id, isDeleted: false }).populate({
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

  const member = await Member.create({
    ...req.body,
    memberId,
    createdBy: req.user._id,
  });

  await logAudit(req, {
    action: 'create',
    module: 'members',
    targetId: member._id,
    description: `Created member ${member.memberId} (${member.firstName} ${member.lastName || ''})`,
  });

  res.status(201).json({ success: true, data: member });
});

// @desc  Update member details
// @route PUT /api/members/:id
const updateMember = asyncHandler(async (req, res) => {
  const member = await Member.findOne({ _id: req.params.id, isDeleted: false });
  if (!member) throw new ApiError(404, 'Member not found.');

  // memberId is immutable once generated
  const { memberId, ...updates } = req.body;
  Object.assign(member, updates);
  await member.save();

  await logAudit(req, { action: 'update', module: 'members', targetId: member._id, description: `Updated member ${member.memberId}` });

  res.json({ success: true, data: member });
});

// @desc  Soft-delete a member
// @route DELETE /api/members/:id
const deleteMember = asyncHandler(async (req, res) => {
  const member = await Member.findOne({ _id: req.params.id, isDeleted: false });
  if (!member) throw new ApiError(404, 'Member not found.');

  member.isDeleted = true;
  await member.save();

  await logAudit(req, { action: 'delete', module: 'members', targetId: member._id, description: `Deleted member ${member.memberId}` });

  res.json({ success: true, message: 'Member deleted.' });
});

// @desc  Change member status (suspend / freeze / reactivate / cancel)
// @route PATCH /api/members/:id/status
const changeStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const allowed = ['active', 'expired', 'suspended', 'freeze', 'cancelled'];
  if (!allowed.includes(status)) throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);

  const member = await Member.findOne({ _id: req.params.id, isDeleted: false });
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
  const filter = { isDeleted: false };
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