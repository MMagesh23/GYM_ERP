import { TrendingUp, TrendingDown } from 'lucide-react';

const TONE_STYLES = {
  default: 'text-brand-600 bg-white/40 dark:bg-white/5',
  green: 'text-green-600 bg-white/40 dark:bg-white/5',
  red: 'text-red-600 bg-white/40 dark:bg-white/5',
  amber: 'text-amber-600 bg-white/40 dark:bg-white/5',
  purple: 'text-purple-600 bg-white/40 dark:bg-white/5',
};

const StatCard = ({ icon: Icon, label, value, tone = 'default', hint, trend, loading = false, onClick }) => {
  const Wrapper = onClick ? 'button' : 'div';
  const isEmpty = !loading && (value === 0 || value === '0' || value === '₹0');

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`glass-panel w-full p-4 text-left transition hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : ''}`}
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
