import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ page, totalPages, total, limit = 20, onChange }) => {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = total ? Math.min(page * limit, total) : undefined;

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-800 sm:flex-row">
      <p className="text-xs text-gray-500 sm:text-sm">
        {total ? (
          <>
            Showing <span className="font-medium text-gray-700 dark:text-gray-300">{from}–{to}</span> of{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">{total}</span>
          </>
        ) : (
          `Page ${page} of ${totalPages}`
        )}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="btn-secondary btn-sm !px-2.5 disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="text-xs text-gray-400 sm:hidden">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="btn-secondary btn-sm !px-2.5 disabled:opacity-40"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;