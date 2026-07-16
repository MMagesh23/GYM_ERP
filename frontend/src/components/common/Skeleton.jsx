export const SkeletonBlock = ({ className = '' }) => (
  <div className={`skeleton rounded-md ${className}`} />
);

export const SkeletonTable = ({ rows = 6, cols = 5 }) => (
  <div className="divide-y divide-gray-100 dark:divide-gray-800">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-4 px-4 py-3.5">
        {Array.from({ length: cols }).map((__, c) => (
          <SkeletonBlock key={c} className={`h-4 ${c === 0 ? 'w-24' : 'flex-1'}`} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonCard = ({ className = '' }) => (
  <div className={`rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${className}`}>
    <SkeletonBlock className="mb-3 h-3 w-24" />
    <SkeletonBlock className="h-7 w-16" />
  </div>
);