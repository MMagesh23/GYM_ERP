import { useEffect, useState, useCallback } from 'react';
import { Plus, Download, FileText, Undo2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { paymentApi } from '../../services/paymentApi';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import RecordPaymentModal from './RecordPaymentModal';
import RefundModal from './RefundModal';
import PageHeader from '../../components/common/PageHeader';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

// FIX: added 'partially_refunded' so it's filterable and matches the status the
// backend can now actually set (see Payment model + paymentController.refundPayment).
const STATUS_OPTIONS = ['paid', 'pending', 'partial', 'refunded', 'partially_refunded', 'failed'];
const METHOD_OPTIONS = ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'];

const PaymentsPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [loading, setLoading] = useState(true);

  const [recordOpen, setRecordOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);

  const fetchPayments = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const { data } = await paymentApi.list({ page, limit: 20, status: status || undefined, method: method || undefined });
        setPayments(data.data);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load payments');
      } finally {
        setLoading(false);
      }
    },
    [status, method]
  );

  useEffect(() => {
    fetchPayments(1);
  }, [fetchPayments]);

  const hasFilters = Boolean(status || method);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Payments"
        subtitle={!loading ? `${pagination.total} payment${pagination.total === 1 ? '' : 's'} total` : undefined}
        actions={
          <>
            <button
              onClick={() => paymentApi.export({ status: status || undefined, method: method || undefined })}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <Download size={16} /> Export
            </button>
            <button
              onClick={() => setRecordOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              <Plus size={16} /> Record Payment
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All methods</option>
          {METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m.replace('_', ' ').toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={hasFilters ? 'No payments match your filters' : 'No payments recorded yet'}
            description={hasFilters ? 'Try a different filter combination.' : 'Record your first payment to see it here.'}
            action={
              !hasFilters && (
                <button
                  onClick={() => setRecordOpen(true)}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Record Payment
                </button>
              )
            }
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payments.map((p) => (
                <tr key={p._id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium">{p.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    {p.member ? `${p.member.memberId} - ${p.member.firstName} ${p.member.lastName || ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    ₹{p.finalAmount}
                    {p.refund?.refundedAmount > 0 && (
                      <span className="ml-1 text-xs text-gray-400">(₹{p.refund.refundedAmount} refunded)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{p.paymentMethod.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Badge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        title="Download invoice"
                        onClick={() => paymentApi.downloadInvoice(p._id, p.invoiceNumber)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <FileText size={16} />
                      </button>
                      {/* FIX: previously only excluded 'refunded'. A 'partially_refunded'
                          payment still has a remaining refundable balance and must stay
                          refundable too — this condition already covers it correctly since
                          partially_refunded !== refunded, but is now explicit/intentional
                          rather than incidental now that the status exists. */}
                      {user?.role === 'admin' && p.status !== 'refunded' && (
                        <button
                          title="Refund"
                          onClick={() => setRefundTarget(p)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Undo2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && payments.length > 0 && (
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={fetchPayments} />
        )}
      </div>

      <RecordPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} onSaved={() => fetchPayments(1)} />

      <RefundModal
        open={Boolean(refundTarget)}
        payment={refundTarget}
        onClose={() => setRefundTarget(null)}
        onSaved={() => fetchPayments(pagination.page)}
      />
    </div>
  );
};

export default PaymentsPage;