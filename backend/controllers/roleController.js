const Role = require('../models/Role');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');

// @desc  List of modules + actions available for building a permission matrix in the UI
// @route GET /api/roles/modules
const listModules = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      modules: Role.MODULES,
      actions: ['view', 'create', 'update', 'delete', 'export'],
    },
  });
});

// @desc  List all custom roles
// @route GET /api/roles
const listRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find().sort({ isSystemRole: -1, name: 1 });
  res.json({ success: true, data: roles });
});

const getRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found.');
  res.json({ success: true, data: role });
});

// @desc  Create a custom role with a permission matrix
// @route POST /api/roles
// body: { name, description?, permissions: [{ module, actions: { view, create, update, delete, export } }] }
const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name) throw new ApiError(400, 'Role name is required.');

  const existing = await Role.findOne({ name });
  if (existing) throw new ApiError(409, 'A role with this name already exists.');

  const role = await Role.create({ name, description, permissions: permissions || [], isSystemRole: false });

  await logAudit(req, { action: 'create', module: 'settings', targetId: role._id, description: `Created role "${role.name}"` });

  res.status(201).json({ success: true, data: role });
});

// @desc  Update a role's permission matrix
// @route PUT /api/roles/:id
const updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found.');
  if (role.isSystemRole) throw new ApiError(400, 'System roles (Admin/Receptionist) cannot be edited. Create a custom role instead.');

  const { name, description, permissions } = req.body;
  if (name) role.name = name;
  if (description !== undefined) role.description = description;
  if (permissions) role.permissions = permissions;
  await role.save();

  await logAudit(req, { action: 'update', module: 'settings', targetId: role._id, description: `Updated role "${role.name}"` });

  res.json({ success: true, data: role });
});

// @desc  Delete a custom role
// @route DELETE /api/roles/:id
const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found.');
  if (role.isSystemRole) throw new ApiError(400, 'System roles cannot be deleted.');

  const User = require('../models/User');
  const inUse = await User.countDocuments({ roleRef: role._id });
  if (inUse > 0) throw new ApiError(400, `${inUse} user(s) are still assigned this role. Reassign them first.`);

  await role.deleteOne();

  await logAudit(req, { action: 'delete', module: 'settings', description: `Deleted role "${role.name}"` });

  res.json({ success: true, message: 'Role deleted.' });
});

module.exports = { listModules, listRoles, getRole, createRole, updateRole, deleteRole };