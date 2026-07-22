const mongoose = require('mongoose');

// Modules covered by the ERP - used to build the permission matrix
const MODULES = [
  'dashboard',
  'members',
  'memberships',
  'payments',
  'expenses',
  'equipment',
  'staff',
  'notifications',
  'reports',
  'settings',
  'auditLogs',
  'finance', // NEW: finance dashboard + daily cash closing
];

const permissionSchema = new mongoose.Schema(
  {
    module: { type: String, enum: MODULES, required: true },
    actions: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      export: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    isSystemRole: { type: Boolean, default: false }, // true for Admin/Receptionist defaults
    permissions: [permissionSchema],
  },
  { timestamps: true }
);

roleSchema.statics.MODULES = MODULES;

module.exports = mongoose.model('Role', roleSchema);