const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { runDailyGeneration } = require('../utils/notificationGenerator');

// @desc  List notifications with filters + pagination
// @route GET /api/notifications?page=&limit=&type=&status=
const listNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { type, status } = req.query;

  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate('recipientMember', 'memberId firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ status: { $ne: 'read' } }),
  ]);

  res.json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc  Mark a notification as read
// @route PATCH /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(req.params.id, { status: 'read', readAt: new Date() }, { new: true });
  res.json({ success: true, data: notification });
});

// @desc  Mark all notifications as read
// @route PATCH /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ status: { $ne: 'read' } }, { status: 'read', readAt: new Date() });
  res.json({ success: true, message: 'All notifications marked as read.' });
});

// @desc  Manually trigger the daily notification generation checks (also runs on a cron schedule)
// @route POST /api/notifications/generate
const generateNow = asyncHandler(async (req, res) => {
  const result = await runDailyGeneration();

  await logAudit(req, {
    action: 'create',
    module: 'notifications',
    description: `Manually triggered notification generation: ${result.total} created`,
  });

  res.json({ success: true, data: result });
});

module.exports = { listNotifications, markRead, markAllRead, generateNow };
