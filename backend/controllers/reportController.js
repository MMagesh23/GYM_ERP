const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Member = require('../models/Member');
const Membership = require('../models/Membership');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Equipment = require('../models/Equipment');
const Staff = require('../models/Staff');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');

// Writes a workbook to the response as .xlsx or .csv depending on the `format` query param
const sendWorkbook = async (res, workbook, filenameBase, format) => {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    await workbook.csv.write(res);
  } else {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    await workbook.xlsx.write(res);
  }
  res.end();
};

const buildSheet = (workbook, name, columns, rows) => {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  rows.forEach((r) => sheet.addRow(r));
  sheet.getRow(1).font = { bold: true };
  return sheet;
};

// @desc  Member Report
// @route GET /api/reports/members?format=xlsx|csv
const memberReport = asyncHandler(async (req, res) => {
  const members = await Member.find({ isDeleted: false }).sort({ createdAt: -1 });
  const workbook = new ExcelJS.Workbook();
  buildSheet(
    workbook,
    'Members',
    [
      { header: 'Member ID', key: 'memberId', width: 14 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Joined', key: 'joined', width: 14 },
    ],
    members.map((m) => ({
      memberId: m.memberId,
      name: `${m.firstName} ${m.lastName || ''}`.trim(),
      gender: m.gender,
      phone: m.phone,
      email: m.email,
      status: m.status,
      joined: m.joiningDate?.toISOString().slice(0, 10),
    }))
  );
  await sendWorkbook(res, workbook, 'member-report', req.query.format);
});

// @desc  Membership Report
// @route GET /api/reports/memberships?format=xlsx|csv
const membershipReport = asyncHandler(async (req, res) => {
  const memberships = await Membership.find().populate('member', 'memberId firstName lastName').populate('plan', 'name').sort({ createdAt: -1 });
  const workbook = new ExcelJS.Workbook();
  buildSheet(
    workbook,
    'Memberships',
    [
      { header: 'Member', key: 'member', width: 24 },
      { header: 'Plan', key: 'plan', width: 18 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Start', key: 'start', width: 14 },
      { header: 'End', key: 'end', width: 14 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ],
    memberships.map((m) => ({
      member: m.member ? `${m.member.memberId} - ${m.member.firstName} ${m.member.lastName || ''}` : '',
      plan: m.plan?.name || '',
      type: m.type,
      start: m.startDate?.toISOString().slice(0, 10),
      end: m.endDate?.toISOString().slice(0, 10),
      amount: m.finalAmount,
      status: m.status,
    }))
  );
  await sendWorkbook(res, workbook, 'membership-report', req.query.format);
});

// @desc  Payment Report
// @route GET /api/reports/payments?format=xlsx|csv
const paymentReport = asyncHandler(async (req, res) => {
  const payments = await Payment.find().populate('member', 'memberId firstName lastName').sort({ paymentDate: -1 });
  const workbook = new ExcelJS.Workbook();
  buildSheet(
    workbook,
    'Payments',
    [
      { header: 'Invoice #', key: 'invoiceNumber', width: 16 },
      { header: 'Member', key: 'member', width: 24 },
      { header: 'Amount', key: 'finalAmount', width: 12 },
      { header: 'Method', key: 'paymentMethod', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Date', key: 'date', width: 14 },
    ],
    payments.map((p) => ({
      invoiceNumber: p.invoiceNumber,
      member: p.member ? `${p.member.memberId} - ${p.member.firstName} ${p.member.lastName || ''}` : '',
      finalAmount: p.finalAmount,
      paymentMethod: p.paymentMethod,
      status: p.status,
      date: p.paymentDate?.toISOString().slice(0, 10),
    }))
  );
  await sendWorkbook(res, workbook, 'payment-report', req.query.format);
});

// @desc  Expense Report
// @route GET /api/reports/expenses?format=xlsx|csv
const expenseReport = asyncHandler(async (req, res) => {
  const expenses = await Expense.find().sort({ expenseDate: -1 });
  const workbook = new ExcelJS.Workbook();
  buildSheet(
    workbook,
    'Expenses',
    [
      { header: 'Title', key: 'title', width: 24 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Date', key: 'date', width: 14 },
    ],
    expenses.map((e) => ({
      title: e.title,
      category: e.category,
      amount: e.amount,
      vendor: e.vendor,
      date: e.expenseDate?.toISOString().slice(0, 10),
    }))
  );
  await sendWorkbook(res, workbook, 'expense-report', req.query.format);
});

// Shared monthly profit calculation, reused by both the Excel and PDF profit reports
const computeMonthlyProfit = async (year) => {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [revenueAgg, expenseAgg] = await Promise.all([
    Payment.aggregate([
      { $match: { paymentDate: { $gte: start, $lt: end }, status: { $in: ['paid', 'partial'] } } },
      { $group: { _id: { $month: '$paymentDate' }, total: { $sum: '$finalAmount' } } },
    ]),
    Expense.aggregate([
      { $match: { expenseDate: { $gte: start, $lt: end } } },
      { $group: { _id: { $month: '$expenseDate' }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return MONTHS.map((label, idx) => {
    const revenue = revenueAgg.find((r) => r._id === idx + 1)?.total || 0;
    const expense = expenseAgg.find((e) => e._id === idx + 1)?.total || 0;
    return { month: label, revenue, expense, profit: revenue - expense };
  });
};

// @desc  Profit Report (Excel/CSV)
// @route GET /api/reports/profit?format=xlsx|csv&year=2026
const profitReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const rows = await computeMonthlyProfit(year);

  const workbook = new ExcelJS.Workbook();
  buildSheet(
    workbook,
    'Profit',
    [
      { header: 'Month', key: 'month', width: 10 },
      { header: 'Revenue', key: 'revenue', width: 14 },
      { header: 'Expenses', key: 'expense', width: 14 },
      { header: 'Profit', key: 'profit', width: 14 },
    ],
    rows
  );
  await sendWorkbook(res, workbook, `profit-report-${year}`, req.query.format);
});

// @desc  Profit Report (PDF summary)
// @route GET /api/reports/profit/pdf?year=2026
const profitReportPdf = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const rows = await computeMonthlyProfit(year);
  const settings = await Settings.getSingleton();
  const currency = settings.currencySymbol || '₹';

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="profit-report-${year}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text(`${settings.gymName} — Profit Report ${year}`);
  doc.moveDown(1);

  const col = { month: 50, revenue: 200, expense: 320, profit: 440 };
  let y = doc.y;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Month', col.month, y);
  doc.text('Revenue', col.revenue, y);
  doc.text('Expenses', col.expense, y);
  doc.text('Profit', col.profit, y);
  y += 18;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
  y += 8;

  doc.font('Helvetica').fontSize(10);
  rows.forEach((r) => {
    doc.text(r.month, col.month, y);
    doc.text(`${currency}${r.revenue.toFixed(2)}`, col.revenue, y);
    doc.text(`${currency}${r.expense.toFixed(2)}`, col.expense, y);
    doc.fillColor(r.profit >= 0 ? '#166534' : '#b91c1c').text(`${currency}${r.profit.toFixed(2)}`, col.profit, y);
    doc.fillColor('#000');
    y += 18;
  });

  y += 8;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
  y += 10;
  doc.font('Helvetica-Bold');
  doc.text('Total', col.month, y);
  doc.text(`${currency}${totalRevenue.toFixed(2)}`, col.revenue, y);
  doc.text(`${currency}${totalExpense.toFixed(2)}`, col.expense, y);
  doc.text(`${currency}${(totalRevenue - totalExpense).toFixed(2)}`, col.profit, y);

  doc.end();
});

// @desc  Equipment Report
// @route GET /api/reports/equipment?format=xlsx|csv
const equipmentReport = asyncHandler(async (req, res) => {
  const items = await Equipment.find().sort({ createdAt: -1 });
  const workbook = new ExcelJS.Workbook();
  buildSheet(
    workbook,
    'Equipment',
    [
      { header: 'Equipment ID', key: 'equipmentId', width: 14 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Purchase Cost', key: 'purchaseCost', width: 14 },
      { header: 'Location', key: 'location', width: 16 },
    ],
    items.map((i) => ({
      equipmentId: i.equipmentId,
      name: i.name,
      category: i.category,
      status: i.status,
      purchaseCost: i.purchaseCost,
      location: i.location,
    }))
  );
  await sendWorkbook(res, workbook, 'equipment-report', req.query.format);
});

// @desc  Staff Report
// @route GET /api/reports/staff?format=xlsx|csv
const staffReport = asyncHandler(async (req, res) => {
  const staff = await Staff.find().sort({ createdAt: -1 });
  const workbook = new ExcelJS.Workbook();
  buildSheet(
    workbook,
    'Staff',
    [
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Designation', key: 'designation', width: 18 },
      { header: 'Mobile', key: 'mobile', width: 16 },
      { header: 'Salary', key: 'salary', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Joined', key: 'joined', width: 14 },
    ],
    staff.map((s) => ({
      employeeId: s.employeeId,
      name: s.name,
      designation: s.designation,
      mobile: s.mobile,
      salary: s.salary,
      status: s.status,
      joined: s.joiningDate?.toISOString().slice(0, 10),
    }))
  );
  await sendWorkbook(res, workbook, 'staff-report', req.query.format);
});

module.exports = {
  memberReport,
  membershipReport,
  paymentReport,
  expenseReport,
  profitReport,
  profitReportPdf,
  equipmentReport,
  staffReport,
};
