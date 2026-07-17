const TONE_STYLES = {
  ok: 'bg-green-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  expired: 'bg-gray-400',
  none: 'bg-gray-300',
  brand: 'bg-brand-600',
};

/**
 * A minimal horizontal progress bar. `percent` is clamped to [0, 100].
 * `tone` picks the fill color; pass `label` to render a small caption row above it.
 */
const ProgressBar = ({ percent = 0, tone = 'brand', label, trailing, className = '' }) => {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={className}>
      {(label || trailing) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-gray-500">{label}</span>
          <span className="font-medium text-gray-600 dark:text-gray-300">{trailing}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${TONE_STYLES[tone] || TONE_STYLES.brand}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
