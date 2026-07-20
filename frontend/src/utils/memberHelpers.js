// Shared helpers for the Members & Memberships UI.
// Pure functions only — safe to import from any component.

export const getInitials = (firstName = '', lastName = '') => {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  return initials || '?';
};

// Deterministic pastel palette so the same member always gets the same avatar color,
// without needing to store a color on the record.
const AVATAR_PALETTE = [
  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300' },
  { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300' },
];

export const getAvatarPalette = (seed = '') => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

// Whole-day difference between today and a target date (negative = already past).
export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const target = new Date(dateStr).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

// Maps "days remaining" to a semantic urgency tone used for chips/progress bars.
export const membershipUrgency = (days) => {
  if (days === null || days === undefined) return 'none';
  if (days < 0) return 'expired';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'ok';
};

export const URGENCY_STYLES = {
  ok: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  none: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export const expiryLabel = (days) => {
  if (days === null || days === undefined) return 'No active plan';
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
};

export const formatCurrency = (n, symbol = '₹') =>
  `${symbol}${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const formatDate = (dateStr, options = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  dateStr ? new Date(dateStr).toLocaleDateString('en-IN', options) : '—';

// Mirrors backend membershipController.calcFinalAmount so the UI can preview pricing
// before submitting. Keep in sync with backend/utils/billing.js#calcFinalAmount.
export const estimateFinalAmount = (plan, { isNew = false, extraDiscount = 0 } = {}) => {
  if (!plan) return 0;
  let amount = plan.price;
  if (isNew) amount += plan.joiningFee || 0;

  const discount = plan.discountType === 'percentage' ? (amount * (plan.discount || 0)) / 100 : plan.discount || 0;
  amount -= discount + extraDiscount;

  const taxAmount = (amount * (plan.tax || 0)) / 100;
  amount += taxAmount;

  return Math.max(Math.round(amount * 100) / 100, 0);
};

/**
 * Mirrors backend/utils/billing.js#calcPlanChangeAmount so the plan-change UI can
 * show the real price *before* submitting, instead of the flat new-plan price.
 *
 * FIX: previously the UI (and the backend, before that bug was fixed) implied the
 * member would simply keep their remaining days on the new plan for its full
 * price — actually the backend charges a full new-plan period, credited by the
 * unused value of the old one. This estimate must match that exactly or staff
 * will see one number here and a different one on the resulting invoice.
 *
 * @param {{startDate: string|Date, endDate: string|Date, finalAmount: number}} currentMembership
 * @param {object} newPlan - plan object with price/joiningFee/discount/discountType/tax
 */
export const estimatePlanChangeAmount = (currentMembership, newPlan) => {
  if (!currentMembership || !newPlan) return null;

  const now = Date.now();
  const endMs = new Date(currentMembership.endDate).getTime();
  const startMs = new Date(currentMembership.startDate).getTime();

  const remainingMs = Math.max(endMs - now, 0);
  const remainingDays = Math.ceil(remainingMs / 86400000);

  const actualPeriodDays = Math.max(Math.round((endMs - startMs) / 86400000), 1);
  const oldPlanDailyRate = currentMembership.finalAmount / actualPeriodDays;
  const unusedCredit = Math.round(oldPlanDailyRate * remainingDays * 100) / 100;

  const newPlanCost = estimateFinalAmount(newPlan, { isNew: false });
  const amountDue = Math.max(Math.round((newPlanCost - unusedCredit) * 100) / 100, 0);

  return { remainingDays, unusedCredit, newPlanCost, amountDue };
};