const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  freeze: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  frozen: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  upgraded: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  transferred: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  under_maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  damaged: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  repaired: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  retired: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  disabled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  // FIX: was missing — payments partially refunded fell through to the default
  // (same look as "expired"/gray), giving no visual distinction from an untouched
  // payment. Now visually distinct from both "paid" (green) and "refunded" (gray).
  partially_refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const DOT_COLORS = {
  active: 'bg-green-500',
  expired: 'bg-gray-400',
  suspended: 'bg-red-500',
  freeze: 'bg-blue-500',
  cancelled: 'bg-gray-400',
  frozen: 'bg-blue-500',
  upgraded: 'bg-purple-500',
  transferred: 'bg-indigo-500',
  under_maintenance: 'bg-amber-500',
  damaged: 'bg-red-500',
  repaired: 'bg-blue-500',
  retired: 'bg-gray-400',
  disabled: 'bg-red-500',
  partially_refunded: 'bg-amber-500',
};

/** Pass `dot` to render a small status indicator dot alongside the label. */
const Badge = ({ status, dot = false }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
      STATUS_STYLES[status] || STATUS_STYLES.expired
    }`}
  >
    {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[status] || 'bg-gray-400'}`} />}
    {status?.replace('_', ' ')}
  </span>
);

export default Badge;