// One-time backfill: Role.MODULES gained 'finance' after roles may already
// have been created. can('finance', ...) fails CLOSED for any role with no
// entry for that module (by design — see middleware/rbac.js), which is the
// safe default, but it silently means every pre-existing custom role loses
// access to the Finance dashboard until an admin notices and fixes it by
// hand. This grants a conservative view-only default to any non-system role
// missing the entry, so existing gyms don't lose visibility on upgrade.
// Does NOT grant `update` (cash-drawer closing) — that stays admin-only
// unless a gym owner deliberately opts a role into it afterward.
//
// Usage: npm run migrate:finance-permission   (from backend/)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Role = require('../models/Role');

const run = async () => {
  await connectDB();

  const roles = await Role.find({ isSystemRole: false });
  let updated = 0;

  for (const role of roles) {
    const hasFinance = role.permissions.some((p) => p.module === 'finance');
    if (hasFinance) continue;

    role.permissions.push({
      module: 'finance',
      actions: { view: true, create: false, update: false, delete: false, export: false },
    });
    await role.save();
    updated += 1;
    console.log(`  granted view-only finance access to role "${role.name}"`);
  }

  console.log(`Migration complete. ${updated} role(s) updated, ${roles.length - updated} already had a finance entry.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});