const AuditLog = require('../models/AuditLog');

/**
 * Fire-and-forget audit log writer.
 * @param {import('express').Request} req
 * @param {{action: string, module?: string, targetId?: string, description?: string}} entry
 */
const logAudit = async (req, entry) => {
  try {
    const DAY_MS = 24 * 60 * 60 * 1000;
    let ttlDays = 90; // Normal activity logs

    if (['login', 'logout'].includes(entry.action)) {
      ttlDays = 30;
    } else if (['payment', 'refund'].includes(entry.action) || entry.module === 'payments') {
      ttlDays = 365;
    } else if (req.user?.role === 'admin' || entry.module === 'auth') {
      ttlDays = 180;
    }

    const expiresAt = new Date(Date.now() + ttlDays * DAY_MS);

    await AuditLog.create({
      user: req.user?._id,
      action: entry.action,
      module: entry.module || '',
      targetId: entry.targetId,
      description: entry.description || '',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
      expiresAt,
    });
  } catch (err) {
    // Never let audit logging break the main request flow
    console.error('Audit log write failed:', err.message);
  }
};

module.exports = logAudit;
