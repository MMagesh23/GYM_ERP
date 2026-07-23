import { TrendingUp, TrendingDown } from 'lucide-react';

const TONE_STYLES = {
  default: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30',
  green: 'text-green-600 bg-green-50 dark:bg-green-900/30',
  red: 'text-red-600 bg-red-50 dark:bg-red-900/30',
  amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',
  purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30',
};

// NEW: optional trend indicator (e.g. { value: 12, direction: 'up' }) for
// cards that have a period-over-period comparison available. Entirely
// optional — omitting `trend` renders exactly as before.
const StatCard = ({ icon: Icon, label, value, tone = 'default', hint, trend, loading = false, onClick }) => {
  const Wrapper = onClick ? 'button' : 'div';
  const isEmpty = !loading && (value === 0 || value === '0' || value === '₹0');

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card-hoverable w-full p-4 text-left ${onClick ? 'cursor-pointer hover:border-brand-300 dark:hover:border-brand-800' : ''}`}
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
        <div className="mt-1.5 flex items-baseline gap-2">
          <p className={`text-2xl font-semibold tabular-nums ${isEmpty ? 'stat-value-empty' : ''}`}>{value}</p>
          {trend && (
            <span
              className={`flex items-center gap-0.5 text-xs font-medium ${
                trend.direction === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {trend.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend.value}%
            </span>
          )}
        </div>
      )}
      {hint && !loading && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </Wrapper>
  );
};

export default StatCard;