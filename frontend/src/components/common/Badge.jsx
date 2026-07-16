const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  freeze: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  frozen: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  under_maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  damaged: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  repaired: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  retired: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  disabled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const Badge = ({ status }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || STATUS_STYLES.expired}`}>
    {status?.replace('_', ' ')}
  </span>
);

export default Badge;
