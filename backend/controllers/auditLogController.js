const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');

// @desc  List audit logs with filters + pagination
// @route GET /api/audit-logs?page=&limit=&user=&action=&module=&from=&to=
const listAuditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const { user, action, module: moduleName, from, to } = req.query;

  const filter = {};
  if (user) filter.user = user;
  if (action) filter.action = action;
  if (moduleName) filter.module = moduleName;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ success: true, data: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

module.exports = { listAuditLogs };
