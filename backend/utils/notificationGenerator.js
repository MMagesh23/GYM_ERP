const Member = require('../models/Member');
const Membership = require('../models/Membership');
const Payment = require('../models/Payment');
const Maintenance = require('../models/Maintenance');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');

const DAY_MS = 24 * 60 * 60 * 1000;

const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
};

// Avoids re-creating the same notification if it was already generated today
const alreadyNotifiedToday = async (type, recipientMember) => {
  const { start } = todayRange();
  const existing = await Notification.findOne({ type, recipientMember, createdAt: { $gte: start } });
  return Boolean(existing);
};

const generateMembershipExpiryReminders = async (daysAhead = 3) => {
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * DAY_MS);
  const expiring = await Membership.find({ status: 'active', endDate: { $gte: now, $lte: until } })
    .populate('member', 'firstName lastName')
    .populate('plan', 'name');

  let created = 0;
  for (const m of expiring) {
    if (!m.member) continue;
    if (await alreadyNotifiedToday('membership_expiry', m.member._id)) continue;
    await Notification.create({
      type: 'membership_expiry',
      recipientMember: m.member._id,
      title: 'Membership expiring soon',
      message: `${m.member.firstName}'s ${m.plan?.name || 'membership'} expires on ${m.endDate.toDateString()}.`,
      channels: { system: true, email: true, sms: false, whatsapp: false },
    });
    created += 1;
  }
  return created;
};

const generatePaymentDueReminders = async () => {
  const pending = await Payment.find({ status: 'pending' }).populate('member', 'firstName lastName');

  let created = 0;
  for (const p of pending) {
    if (!p.member) continue;
    if (await alreadyNotifiedToday('payment_due', p.member._id)) continue;
    await Notification.create({
      type: 'payment_due',
      recipientMember: p.member._id,
      title: 'Payment due',
      message: `${p.member.firstName} has a pending payment of ${p.finalAmount} (Invoice ${p.invoiceNumber}).`,
      channels: { system: true, email: true, sms: false, whatsapp: false },
    });
    created += 1;
  }
  return created;
};

const generateBirthdayWishes = async () => {
  const now = new Date();
  const members = await Member.find({ isDeleted: false, dob: { $ne: null } });

  let created = 0;
  for (const m of members) {
    if (!m.dob) continue;
    const dob = new Date(m.dob);
    if (dob.getMonth() !== now.getMonth() || dob.getDate() !== now.getDate()) continue;
    if (await alreadyNotifiedToday('birthday', m._id)) continue;

    await Notification.create({
      type: 'birthday',
      recipientMember: m._id,
      title: 'Happy Birthday!',
      message: `Wish ${m.firstName} a happy birthday today!`,
      channels: { system: true, email: false, sms: false, whatsapp: true },
    });
    created += 1;
  }
  return created;
};

const generateEquipmentServiceDue = async (daysAhead = 3) => {
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * DAY_MS);
  const due = await Maintenance.find({ nextServiceDate: { $gte: now, $lte: until }, status: { $ne: 'cancelled' } }).populate(
    'equipment',
    'equipmentId name'
  );

  let created = 0;
  for (const record of due) {
    if (!record.equipment) continue;
    const { start } = todayRange();
    const existing = await Notification.findOne({
      type: 'equipment_service_due',
      message: { $regex: record.equipment.equipmentId },
      createdAt: { $gte: start },
    });
    if (existing) continue;

    await Notification.create({
      type: 'equipment_service_due',
      title: 'Equipment service due',
      message: `${record.equipment.name} (${record.equipment.equipmentId}) is due for service on ${record.nextServiceDate.toDateString()}.`,
      channels: { system: true, email: false, sms: false, whatsapp: false },
    });
    created += 1;
  }
  return created;
};

const generateLowRevenueAlert = async () => {
  const { start, end } = todayRange();
  const thirtyDaysAgo = new Date(start.getTime() - 30 * DAY_MS);

  const [todayAgg, avgAgg] = await Promise.all([
    Payment.aggregate([{ $match: { paymentDate: { $gte: start, $lt: end }, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$finalAmount' } } }]),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: thirtyDaysAgo, $lt: start }, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]),
  ]);

  const todayTotal = todayAgg[0]?.total || 0;
  const avgDaily = (avgAgg[0]?.total || 0) / 30;

  if (avgDaily > 0 && todayTotal < avgDaily * 0.5) {
    const existing = await Notification.findOne({ type: 'low_revenue_alert', createdAt: { $gte: start } });
    if (!existing) {
      await Notification.create({
        type: 'low_revenue_alert',
        title: 'Low revenue alert',
        message: `Today's collection (${todayTotal.toFixed(2)}) is well below the recent daily average (${avgDaily.toFixed(2)}).`,
        channels: { system: true, email: true, sms: false, whatsapp: false },
      });
      return 1;
    }
  }
  return 0;
};

const generateDailyCollectionSummary = async () => {
  const { start, end } = todayRange();
  const existing = await Notification.findOne({ type: 'daily_collection_summary', createdAt: { $gte: start } });
  if (existing) return 0;

  const agg = await Payment.aggregate([
    { $match: { paymentDate: { $gte: start, $lt: end }, status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$finalAmount' }, count: { $sum: 1 } } },
  ]);

  const settings = await Settings.getSingleton();
  await Notification.create({
    type: 'daily_collection_summary',
    title: 'Daily collection summary',
    message: `${agg[0]?.count || 0} payment(s) collected today totaling ${settings.currencySymbol}${(agg[0]?.total || 0).toFixed(2)}.`,
    channels: { system: true, email: false, sms: false, whatsapp: false },
  });
  return 1;
};

// Runs every check and returns a summary of how many notifications were created
const runDailyGeneration = async () => {
  const [expiry, paymentDue, birthdays, service, lowRevenue, dailySummary] = await Promise.all([
    generateMembershipExpiryReminders(),
    generatePaymentDueReminders(),
    generateBirthdayWishes(),
    generateEquipmentServiceDue(),
    generateLowRevenueAlert(),
    generateDailyCollectionSummary(),
  ]);

  return {
    membershipExpiry: expiry,
    paymentDue,
    birthdays,
    equipmentServiceDue: service,
    lowRevenueAlert: lowRevenue,
    dailyCollectionSummary: dailySummary,
    total: expiry + paymentDue + birthdays + service + lowRevenue + dailySummary,
  };
};

module.exports = { runDailyGeneration };
