import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cashClosingApi } from '../../services/financeApi';
import PageHeader from '../../components/common/PageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import { SkeletonCard, SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency, formatDate } from '../../utils/memberHelpers';

const CashClosingPage = () => {
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [historyLoading, setHistoryLoading] = useState(true);

  const [actualCash, setActualCash] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const { data } = await cashClosingApi.preview();
      setPreview(data.data);
      if (data.data.status === 'closed') setActualCash(String(data.data.actualClosingCash));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load cash preview');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const { data } = await cashClosingApi.list({ page, limit: 15 });
      setHistory(data.data);
      setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load closing history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
    loadHistory(1);
  }, [loadPreview, loadHistory]);

  const variance = actualCash !== '' && preview ? Number(actualCash) - preview.expectedClosingCash : 0;
  const isClosed = preview?.status === 'closed';

  const handleCloseClick = () => {
    if (actualCash === '' || Number(actualCash) < 0) {
      toast.error('Enter the actual counted cash amount');
      return;
    }
    if (Math.round(variance * 100) !== 0 && !varianceReason.trim()) {
      toast.error('A reason is required when actual cash differs from expected');
      return;
    }
    setConfirmOpen(true);
  };

  const confirmClose = async () => {
    setSubmitting(true);
    try {
      await cashClosingApi.close({ actualClosingCash: Number(actualCash), varianceReason, notes });
      toast.success('Cash drawer closed for today');
      setConfirmOpen(false);
      loadPreview();
      loadHistory(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not close cash drawer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Daily Cash Closing" subtitle="Reconcile the till against what the system expects to be in the drawer." />

      {previewLoading || !preview ? (
        <SkeletonCard className="mb-6 h-56" />
      ) : (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-card dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Lock size={15} /> Today — {formatDate(preview.date)}
            </h3>
            {isClosed ? (
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <CheckCircle2 size={12} /> Closed
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Open
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400">Opening Cash</p>
              <p className="text-lg font-semibold">{formatCurrency(preview.openingCash)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">+ Cash Collected</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatCurrency(preview.cashCollections)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">− Cash Expenses</p>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">{formatCurrency(preview.cashExpenses)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">= Expected Closing</p>
              <p className="text-lg font-semibold text-brand-600 dark:text-brand-400">{formatCurrency(preview.expectedClosingCash)}</p>
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Actual counted cash *</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={isClosed}
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:disabled:bg-gray-800/50"
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Variance</p>
                <p
                  className={`text-lg font-semibold ${
                    variance === 0 ? 'text-gray-500' : variance > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {variance > 0 ? '+' : ''}
                  {formatCurrency(variance)}
                </p>
              </div>
            </div>

            {!isClosed && Math.round(variance * 100) !== 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="mb-1.5">There's a cash discrepancy — a reason is required to close today with this variance.</p>
                  <input
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    placeholder="e.g. Change fund shortage, till miscounted at open"
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs dark:border-amber-800 dark:bg-gray-800"
                  />
                </div>
              </div>
            )}

            {!isClosed && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                />
              </div>
            )}

            {!isClosed && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleCloseClick}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Lock size={14} /> Close today's drawer
                </button>
              </div>
            )}
            {isClosed && preview.varianceReason && (
              <p className="mt-3 text-xs text-gray-500">Variance reason on record: "{preview.varianceReason}"</p>
            )}
          </div>
        </div>
      )}

      <h3 className="mb-3 text-sm font-semibold">Closing History</h3>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
        {historyLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : history.length === 0 ? (
          <EmptyState icon={Lock} title="No closings recorded yet" description="Close today's drawer to start building history." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Opening</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Actual</th>
                <th className="px-4 py-3">Variance</th>
                <th className="px-4 py-3">Closed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map((h) => (
                <tr key={h._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium">{formatDate(h.date)}</td>
                  <td className="px-4 py-3">{formatCurrency(h.openingCash)}</td>
                  <td className="px-4 py-3">{formatCurrency(h.expectedClosingCash)}</td>
                  <td className="px-4 py-3">{formatCurrency(h.actualClosingCash)}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      h.variance === 0 ? 'text-gray-400' : h.variance > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {h.variance > 0 ? '+' : ''}
                    {formatCurrency(h.variance)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{h.closedBy?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!historyLoading && history.length > 0 && (
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={loadHistory} />
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Close today's cash drawer"
        message={`This locks today's cash record permanently — it can't be re-closed. ${
          Math.round(variance * 100) !== 0
            ? `A variance of ${formatCurrency(variance)} will be recorded with your note.`
            : 'Expected and actual cash match exactly.'
        }`}
        confirmLabel={submitting ? 'Closing...' : 'Confirm & close'}
        onConfirm={confirmClose}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default CashClosingPage;