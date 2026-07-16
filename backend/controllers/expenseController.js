const ExcelJS = require('exceljs');
const Expense = require('../models/Expense');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { saveBufferToUploads } = require('../utils/fileStorage');

// @desc  List expenses with filters and pagination
// @route GET /api/expenses?page=&limit=&category=&from=&to=
const listExpenses = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { category, from, to } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (from || to) {
    filter.expenseDate = {};
    if (from) filter.expenseDate.$gte = new Date(from);
    if (to) filter.expenseDate.$lte = new Date(to);
  }

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .sort({ expenseDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Expense.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: expenses,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

const getExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw new ApiError(404, 'Expense not found.');
  res.json({ success: true, data: expense });
});

// @desc  Create an expense, optionally with an uploaded bill/receipt
// @route POST /api/expenses  (multipart/form-data if a bill is attached)
const createExpense = asyncHandler(async (req, res) => {
  const payload = { ...req.body, createdBy: req.user._id };
  if (req.file) payload.billUrl = saveBufferToUploads(req.file, 'bills');

  const expense = await Expense.create(payload);

  await logAudit(req, {
    action: 'expense',
    module: 'expenses',
    targetId: expense._id,
    description: `Added expense "${expense.title}" (${expense.category}) - ${expense.amount}`,
  });

  res.status(201).json({ success: true, data: expense });
});

// @desc  Update an expense
// @route PUT /api/expenses/:id
const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw new ApiError(404, 'Expense not found.');

  Object.assign(expense, req.body);
  if (req.file) expense.billUrl = saveBufferToUploads(req.file, 'bills');
  await expense.save();

  await logAudit(req, { action: 'update', module: 'expenses', targetId: expense._id, description: `Updated expense "${expense.title}"` });

  res.json({ success: true, data: expense });
});

// @desc  Delete an expense
// @route DELETE /api/expenses/:id
const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw new ApiError(404, 'Expense not found.');

  await expense.deleteOne();

  await logAudit(req, { action: 'delete', module: 'expenses', targetId: expense._id, description: `Deleted expense "${expense.title}"` });

  res.json({ success: true, message: 'Expense deleted.' });
});

// @desc  Category breakdown + monthly totals for charts
// @route GET /api/expenses/analytics?year=2026
const analytics = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [byCategory, byMonth] = await Promise.all([
    Expense.aggregate([
      { $match: { expenseDate: { $gte: start, $lt: end } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]),
    Expense.aggregate([
      { $match: { expenseDate: { $gte: start, $lt: end } } },
      { $group: { _id: { $month: '$expenseDate' }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      byCategory: byCategory.map((c) => ({ category: c._id, total: c.total })),
      byMonth: byMonth.map((m) => ({ month: m._id, total: m.total })),
      year,
    },
  });
});

// @desc  Export expenses to Excel
// @route GET /api/expenses/export
const exportExpenses = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const filter = category ? { category } : {};
  const expenses = await Expense.find(filter).sort({ expenseDate: -1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Expenses');
  sheet.columns = [
    { header: 'Title', key: 'title', width: 24 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    { header: 'Vendor', key: 'vendor', width: 20 },
    { header: 'Date', key: 'expenseDate', width: 14 },
  ];
  expenses.forEach((e) => {
    sheet.addRow({
      title: e.title,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      vendor: e.vendor,
      expenseDate: e.expenseDate.toISOString().slice(0, 10),
    });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="expenses-export.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = { listExpenses, getExpense, createExpense, updateExpense, deleteExpense, analytics, exportExpenses };
