const AuditLog = require('../models/AuditLog');

/**
 * Fire-and-forget audit log writer.
 * @param {import('express').Request} req
 * @param {{action: string, module?: string, targetId?: string, description?: string}} entry
 */
const logAudit = async (req, entry) => {
  try {
    await AuditLog.create({
      user: req.user?._id,
      action: entry.action,
      module: entry.module || '',
      targetId: entry.targetId,
      description: entry.description || '',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
    });
  } catch (err) {
    // Never let audit logging break the main request flow
    console.error('Audit log write failed:', err.message);
  }
};

module.exports = logAudit;
