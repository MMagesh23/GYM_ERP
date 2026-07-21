const TONE_STYLES = {
  default: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30',
  green: 'text-green-600 bg-green-50 dark:bg-green-900/30',
  red: 'text-red-600 bg-red-50 dark:bg-red-900/30',
  amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',
  purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30',
};

const StatCard = ({ icon: Icon, label, value, tone = 'default', hint, loading = false, onClick }) => {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-card transition hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900 ${
        onClick ? 'cursor-pointer hover:border-brand-300 dark:hover:border-brand-800' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        {Icon && (
          <span className={`rounded-lg p-1.5 ${TONE_STYLES[tone] || TONE_STYLES.default}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      {loading ? (
        <div className="skeleton mt-2.5 h-7 w-16 rounded-md" />
      ) : (
        <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      )}
      {hint && !loading && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </Wrapper>
  );
};

export default StatCard;