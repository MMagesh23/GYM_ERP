const Maintenance = require('../models/Maintenance');
const Equipment = require('../models/Equipment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');

const DAY_MS = 24 * 60 * 60 * 1000;

// @desc  Log/schedule a maintenance or repair record for a piece of equipment
// @route POST /api/equipment/:id/maintenance
// body: { type, description, serviceDate, nextServiceDate?, cost?, vendor?, status? }
const createMaintenance = asyncHandler(async (req, res) => {
  const equipment = await Equipment.findById(req.params.id);
  if (!equipment) throw new ApiError(404, 'Equipment not found.');

  const record = await Maintenance.create({
    ...req.body,
    equipment: equipment._id,
    createdBy: req.user._id,
  });

  // A repair or active service marks the equipment as under maintenance until completed
  if (record.status !== 'completed' && (record.type === 'repair' || record.type === 'scheduled_service')) {
    equipment.status = 'under_maintenance';
    await equipment.save();
  }

  await logAudit(req, {
    action: 'update',
    module: 'equipment',
    targetId: equipment._id,
    description: `Logged ${record.type} for equipment ${equipment.equipmentId}`,
  });

  res.status(201).json({ success: true, data: record });
});

// @desc  Maintenance history for a specific piece of equipment
// @route GET /api/equipment/:id/maintenance
const listForEquipment = asyncHandler(async (req, res) => {
  const records = await Maintenance.find({ equipment: req.params.id }).sort({ serviceDate: -1 });
  res.json({ success: true, data: records });
});

// @desc  Update a maintenance record (e.g. mark completed, log final cost)
// @route PUT /api/maintenance/:id
const updateMaintenance = asyncHandler(async (req, res) => {
  const record = await Maintenance.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Maintenance record not found.');

  Object.assign(record, req.body);
  await record.save();

  // If this was the equipment's active service and it's now completed, restore it to active
  if (record.status === 'completed') {
    const equipment = await Equipment.findById(record.equipment);
    if (equipment && equipment.status === 'under_maintenance') {
      equipment.status = record.type === 'repair' ? 'repaired' : 'active';
      await equipment.save();
    }
  }

  await logAudit(req, {
    action: 'update',
    module: 'equipment',
    targetId: record.equipment,
    description: `Updated maintenance record (${record.type}) - status: ${record.status}`,
  });

  res.json({ success: true, data: record });
});

// @desc  Delete a maintenance record
// @route DELETE /api/maintenance/:id
const deleteMaintenance = asyncHandler(async (req, res) => {
  const record = await Maintenance.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Maintenance record not found.');

  await record.deleteOne();

  await logAudit(req, { action: 'delete', module: 'equipment', targetId: record.equipment, description: 'Deleted maintenance record' });

  res.json({ success: true, message: 'Maintenance record deleted.' });
});

// @desc  Upcoming service due within N days (for alerts/dashboard)
// @route GET /api/maintenance/due?days=7
const dueSoon = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 7;
  const now = new Date();
  const until = new Date(now.getTime() + days * DAY_MS);

  const records = await Maintenance.find({
    nextServiceDate: { $gte: now, $lte: until },
    status: { $ne: 'cancelled' },
  })
    .populate('equipment', 'equipmentId name category location')
    .sort({ nextServiceDate: 1 });

  res.json({ success: true, data: records });
});

module.exports = { createMaintenance, listForEquipment, updateMaintenance, deleteMaintenance, dueSoon };
