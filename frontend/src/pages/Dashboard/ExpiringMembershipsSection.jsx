import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarClock, Phone, ChevronRight } from 'lucide-react';
import { dashboardApi } from '../../services/dashboardApi';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonBlock } from '../../components/common/Skeleton';
import { formatCurrency, formatDate, expiryBadge } from '../../utils/memberHelpers';

const DASHBOARD_PREVIEW_LIMIT = 5;

/**
 * Dashboard section listing active memberships expiring within the next 7
 * days. Backend does all the timezone-aware date math (see
 * backend/utils/membershipExpiry.js) — this component only renders what it's
 * given and never re-derives expiry/days-remaining itself.
 */
const ExpiringMembershipsSection = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await dashboardApi.expiringMemberships({
        days: 7,
        limit: DASHBOARD_PREVIEW_LIMIT,
        page: 1,
      });
      setRows(data.data);
      setTotal(data.pagination?.total ?? data.data.length);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load expiring memberships');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
          <CalendarClock size={15} /> Memberships Expiring in 7 Days
        </h3>
        {!loading && !error && total > 0 && (
          <button
            onClick={() => navigate('/members?expiring=7')}
            className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-brand-600 hover:underline"
          >
            View All <ChevronRight size={13} />
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load expiring memberships"
          description={error}
          action={
            <button
              onClick={load}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              Retry
            </button>
          }
        />
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState icon={CalendarClock} title="No memberships are expiring in the next 7 days." />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const badge = expiryBadge(row.daysRemaining);
            return (
              <button
                key={row.membershipId}
                onClick={() => navigate(`/members/${row.memberId}`)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5 text-left transition hover:border-brand-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {row.memberName}
                    </p>
                    <Badge status={badge.status} label={badge.label} />
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 truncate text-xs text-gray-400">
                    <span className="truncate">{row.planName}</span>
                    <span>· expires {formatDate(row.endDate)}</span>
                    {row.memberPhone && (
                      <span className="inline-flex items-center gap-0.5">
                        <Phone size={10} /> {row.memberPhone}
                      </span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {row.outstanding !== undefined && row.outstanding > 0 && (
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(row.outstanding)} due
                    </p>
                  )}
                  <ChevronRight size={16} className="ml-auto mt-1 text-gray-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExpiringMembershipsSection;