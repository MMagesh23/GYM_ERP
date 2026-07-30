const Member = require('../models/Member');
const Membership = require('../models/Membership');
const Payment = require('../models/Payment');
const Maintenance = require('../models/Maintenance');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const { sendTemplatedEmailAsync } = require('./emailService');

const DAY_MS = 24 * 60 * 60 * 1000;

// Requirement: automatic expiry-reminder emails at these exact day offsets
// before a membership's endDate (30, 15, 7, 3, and 1 day before expiry).
const EXPIRY_REMINDER_DAYS = [30, 15, 7, 3, 1];

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
      channels: { system: true, email: false, sms: false, whatsapp: false },
    });
    created += 1;
  }
  return created;
};

// @desc  Emails members whose membership expires in exactly N days, for each
// N in EXPIRY_REMINDER_DAYS (30/15/7/3/1). Runs once a day from the cron job
// in server.js - "exactly N days" (rather than "within N days") means each
// member gets at most one reminder email per tier, not a growing pile of
// duplicate reminders as expiry approaches.
const generateMembershipExpiryReminderEmails = async () => {
  let sent = 0;

  for (const daysBefore of EXPIRY_REMINDER_DAYS) {
    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + daysBefore);
    const rangeEnd = new Date(target.getTime() + DAY_MS);

    const expiring = await Membership.find({
      status: 'active',
      endDate: { $gte: target, $lt: rangeEnd },
    })
      .populate('member', 'firstName lastName email')
      .populate('plan', 'name');

    for (const m of expiring) {
      if (!m.member?.email) continue;
      sendTemplatedEmailAsync({
        to: m.member.email,
        templateType: 'membership_renewal_reminder',
        data: {
          memberName: `${m.member.firstName} ${m.member.lastName || ''}`.trim(),
          membershipPlan: m.plan?.name || '',
          expiryDate: m.endDate,
        },
        relatedMember: m.member._id,
        relatedMembership: m._id,
        sentBy: null,
      });
      sent += 1;
    }
  }

  return sent;
};

// @desc  Emails members whose membership expired exactly yesterday (i.e. the
// first daily run after expiry) using the Membership Expiry Notice template.
// Runs once per membership since the window is exactly one day wide.
const generateMembershipExpiredEmails = async () => {
  const { start, end } = (() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    s.setDate(s.getDate() - 1);
    return { start: s, end: new Date(s.getTime() + DAY_MS) };
  })();

  const expired = await Membership.find({
    status: { $in: ['expired', 'active'] }, // status flip to 'expired' may lag a day behind endDate depending on when it's touched
    endDate: { $gte: start, $lt: end },
  })
    .populate('member', 'firstName lastName email')
    .populate('plan', 'name');

  let sent = 0;
  for (const m of expired) {
    if (!m.member?.email) continue;
    sendTemplatedEmailAsync({
      to: m.member.email,
      templateType: 'membership_expiry_notice',
      data: {
        memberName: `${m.member.firstName} ${m.member.lastName || ''}`.trim(),
        membershipPlan: m.plan?.name || '',
        expiryDate: m.endDate,
      },
      relatedMember: m.member._id,
      relatedMembership: m._id,
      sentBy: null,
    });
    sent += 1;
  }
  return sent;
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
      channels: { system: true, email: false, sms: false, whatsapp: false },
    });
    created += 1;
  }
  return created;
};

// @desc  Daily payment-pending reminder emails (separate from the one-time
// reminder sent by paymentController when a pending payment is first
// recorded) - keeps nudging until the due is actually collected.
const generatePaymentDueReminderEmails = async () => {
  const pending = await Payment.find({ status: 'pending' })
    .populate('member', 'firstName lastName email')
    .populate({ path: 'membership', populate: { path: 'plan', select: 'name' } });

  let sent = 0;
  for (const p of pending) {
    if (!p.member?.email) continue;
    if (await alreadyNotifiedToday('payment_due', p.member._id)) continue; // reuse the same daily-dedupe as the system notification above
    sendTemplatedEmailAsync({
      to: p.member.email,
      templateType: 'payment_reminder',
      data: {
        memberName: `${p.member.firstName} ${p.member.lastName || ''}`.trim(),
        membershipPlan: p.membership?.plan?.name || '',
        amount: p.finalAmount,
      },
      relatedMember: p.member._id,
      relatedMembership: p.membership?._id,
      relatedPayment: p._id,
      sentBy: null,
    });
    sent += 1;
  }
  return sent;
};

const generateBirthdayWishes = async () => {
  const now = new Date();
  // NOTE: members are hard-deleted now — no isDeleted flag to filter on.
  const members = await Member.find({ dob: { $ne: null } });

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
      channels: { system: true, email: false, sms: false, whatsapp: false },
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
        channels: { system: true, email: false, sms: false, whatsapp: false },
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
  const [
    expiry,
    paymentDue,
    birthdays,
    service,
    lowRevenue,
    dailySummary,
    expiryEmails,
    expiredEmails,
    paymentDueEmails,
  ] = await Promise.all([
    generateMembershipExpiryReminders(),
    generatePaymentDueReminders(),
    generateBirthdayWishes(),
    generateEquipmentServiceDue(),
    generateLowRevenueAlert(),
    generateDailyCollectionSummary(),
    generateMembershipExpiryReminderEmails(),
    generateMembershipExpiredEmails(),
    generatePaymentDueReminderEmails(),
  ]);

  return {
    membershipExpiry: expiry,
    paymentDue,
    birthdays,
    equipmentServiceDue: service,
    lowRevenueAlert: lowRevenue,
    dailyCollectionSummary: dailySummary,
    membershipExpiryReminderEmails: expiryEmails,
    membershipExpiredEmails: expiredEmails,
    paymentDueReminderEmails: paymentDueEmails,
    total: expiry + paymentDue + birthdays + service + lowRevenue + dailySummary,
  };
};

module.exports = {
  runDailyGeneration,
  generateMembershipExpiryReminderEmails,
  generateMembershipExpiredEmails,
  generatePaymentDueReminderEmails,
};