require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Role = require('../models/Role');
const Settings = require('../models/Settings');

const run = async () => {
  await connectDB();

  // Default settings
  await Settings.getSingleton();
  console.log('Settings singleton ensured.');

  // Default system roles (for reference; actual gating also works via user.role enum)
  const defaultRoles = [
    { name: 'Admin', description: 'Full system access', isSystemRole: true, permissions: [] },
    {
      name: 'Receptionist',
      description: 'Limited operational access',
      isSystemRole: true,
      permissions: [
        // Standard modules: view/create/update, no delete/export
        ...Role.MODULES.filter((m) => !['settings', 'auditLogs', 'finance', 'whatsapp'].includes(m)).map((m) => ({
          module: m,
          actions: { view: true, create: true, update: true, delete: false, export: false },
        })),
        // FIX: finance is sensitive (cash closing is an irreversible, financially
        // binding action) — receptionist can VIEW the finance dashboard and cash
        // closing history but cannot close the drawer or edit financial records.
        // Only admin (bypasses can() checks) or a custom role explicitly granted
        // finance.update can close a day.
        { module: 'finance', actions: { view: true, create: false, update: false, delete: false, export: false } },
        // NEW — Receptionists can generate/copy/open WhatsApp messages by
        // default (same everyday-operational spirit as members/payments),
        // but cannot create/edit/reset templates — that stays admin-only
        // unless a gym owner deliberately grants whatsapp.update to a
        // custom role, same pattern as finance.update above.
        { module: 'whatsapp', actions: { view: true, create: false, update: false, delete: false, export: false } },
      ],
    },
  ];

  for (const r of defaultRoles) {
    await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true, new: true });
  }
  console.log('Default roles ensured.');

  // Default admin user
  const adminEmail = 'admin@samfitness.com';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = new User({ name: 'Super Admin', email: adminEmail, role: 'admin' });
    await admin.setPassword('Admin@12345');
    await admin.save();
    console.log(`Default admin created -> email: ${adminEmail} / password: Admin@12345`);
  } else {
    console.log('Default admin already exists.');
  }

  console.log('Seeding complete.');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});