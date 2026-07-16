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
      permissions: Role.MODULES.filter((m) => m !== 'settings' && m !== 'auditLogs').map((m) => ({
        module: m,
        actions: { view: true, create: true, update: true, delete: false, export: false },
      })),
    },
  ];

  for (const r of defaultRoles) {
    await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true, new: true });
  }
  console.log('Default roles ensured.');

  // Default admin user
  const adminEmail = 'admin@gymerp.com';
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
