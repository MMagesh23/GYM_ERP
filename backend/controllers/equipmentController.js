const ExcelJS = require('exceljs');
const Equipment = require('../models/Equipment');
const Maintenance = require('../models/Maintenance');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { generateEntityId } = require('../utils/idGenerator');
const { saveBufferToUploads } = require('../utils/fileStorage');

const DAY_MS = 24 * 60 * 60 * 1000;

// @desc  List equipment with search/filter/pagination
// @route GET /api/equipment?page=&limit=&status=&category=&q=
const listEquipment = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { status, category, q } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { serialNumber: { $regex: q, $options: 'i' } },
      { equipmentId: { $regex: q, $options: 'i' } },
      { brand: { $regex: q, $options: 'i' } },
    ];
  }

  const [equipment, total] = await Promise.all([
    Equipment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Equipment.countDocuments(filter),
  ]);

  res.json({ success: true, data: equipment, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

const getEquipment = asyncHandler(async (req, res) => {
  const item = await Equipment.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Equipment not found.');
  const maintenanceHistory = await Maintenance.find({ equipment: item._id }).sort({ serviceDate: -1 });
  res.json({ success: true, data: { ...item.toObject(), maintenanceHistory } });
});

// @desc  Create equipment (auto-generates equipmentId), optional photo upload
// @route POST /api/equipment
const createEquipment = asyncHandler(async (req, res) => {
  const equipmentId = await generateEntityId('equipmentId', 'EQP', 3);
  const payload = { ...req.body, equipmentId, createdBy: req.user._id };
  if (req.file) payload.photo = saveBufferToUploads(req.file, 'equipment');

  const item = await Equipment.create(payload);

  await logAudit(req, { action: 'create', module: 'equipment', targetId: item._id, description: `Added equipment ${item.equipmentId} (${item.name})` });

  res.status(201).json({ success: true, data: item });
});

// @desc  Update equipment
// @route PUT /api/equipment/:id
const updateEquipment = asyncHandler(async (req, res) => {
  const item = await Equipment.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Equipment not found.');

  const { equipmentId, ...updates } = req.body;
  Object.assign(item, updates);
  if (req.file) item.photo = saveBufferToUploads(req.file, 'equipment');
  await item.save();

  await logAudit(req, { action: 'update', module: 'equipment', targetId: item._id, description: `Updated equipment ${item.equipmentId}` });

  res.json({ success: true, data: item });
});

// @desc  Delete equipment
// @route DELETE /api/equipment/:id
const deleteEquipment = asyncHandler(async (req, res) => {
  const item = await Equipment.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Equipment not found.');

  await item.deleteOne();
  await Maintenance.deleteMany({ equipment: item._id });

  await logAudit(req, { action: 'delete', module: 'equipment', targetId: item._id, description: `Deleted equipment ${item.equipmentId}` });

  res.json({ success: true, message: 'Equipment deleted.' });
});

// @desc  Change equipment status (active / under_maintenance / damaged / repaired / retired)
// @route PATCH /api/equipment/:id/status
const changeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['active', 'under_maintenance', 'damaged', 'repaired', 'retired'];
  if (!allowed.includes(status)) throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);

  const item = await Equipment.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Equipment not found.');

  const previous = item.status;
  item.status = status;
  await item.save();

  await logAudit(req, {
    action: 'update',
    module: 'equipment',
    targetId: item._id,
    description: `Equipment ${item.equipmentId} status changed: ${previous} -> ${status}`,
  });

  res.json({ success: true, data: item });
});

// @desc  Equipment whose warranty expires within N days
// @route GET /api/equipment/warranty-alerts?days=30
const warrantyAlerts = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 30;
  const now = new Date();
  const until = new Date(now.getTime() + days * DAY_MS);

  const items = await Equipment.find({
    warrantyEnd: { $gte: now, $lte: until },
    status: { $ne: 'retired' },
  }).sort({ warrantyEnd: 1 });

  res.json({ success: true, data: items });
});

// @desc  Export equipment to Excel
// @route GET /api/equipment/export
const exportEquipment = asyncHandler(async (req, res) => {
  const items = await Equipment.find().sort({ createdAt: -1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Equipment');
  sheet.columns = [
    { header: 'Equipment ID', key: 'equipmentId', width: 14 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Brand', key: 'brand', width: 16 },
    { header: 'Serial Number', key: 'serialNumber', width: 18 },
    { header: 'Quantity', key: 'quantity', width: 10 },
    { header: 'Purchase Cost', key: 'purchaseCost', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Location', key: 'location', width: 16 },
  ];
  items.forEach((i) => sheet.addRow(i.toObject()));
  sheet.getRow(1).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="equipment-export.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  listEquipment,
  getEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  changeStatus,
  warrantyAlerts,
  exportEquipment,
};
