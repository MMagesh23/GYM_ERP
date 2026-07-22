import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, FileText, Undo2, CreditCard, AlertCircle, ReceiptText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { paymentApi } from '../../services/paymentApi';
import { membershipApi } from '../../services/membershipApi';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import Pagination from '../../components/common/Pagination';
import RecordPaymentModal from './RecordPaymentModal';
import RefundModal from './RefundModal';
import PageHeader from '../../components/common/PageHeader';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency, billingStatusMeta } from '../../utils/memberHelpers';

const STATUS_OPTIONS = ['paid', 'pending', 'partial', 'refunded', 'partially_refunded', 'failed'];
const DEFAULT_PAYMENT_METHODS = ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'];
const SORT_OPTIONS = [
  { value: '', label: 'Newest first' },
  { value: 'paymentDate:asc', label: 'Oldest first' },
  { value: 'finalAmount:desc', label: 'Amount (high–low)' },
  { value: 'finalAmount:asc', label: 'Amount (low–high)' },
  { value: 'status:asc', label: 'Status' },
];

const PaymentsPage = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const METHOD_OPTIONS = settings?.paymentMethods?.length ? settings.paymentMethods : DEFAULT_PAYMENT_METHODS;
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'dues' ? 'dues' : 'payments');

  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);

  // Every live membership that still owes money — a membership never bills
  // itself, so this is the one screen that answers "who owes what" without
  // hunting through the member list one profile at a time.
  const [dues, setDues] = useState([]);
  const [duesLoading, setDuesLoading] = useState(true);
  const [collectPaymentFor, setCollectPaymentFor] = useState(null);

  const [recordOpen, setRecordOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);

  const [sortBy, sortDir] = sort ? sort.split(':') : [undefined, undefined];

  const switchTab = (next) => {
    setTab(next);
    setSearchParams(next === 'dues' ? { tab: 'dues' } : {}, { replace: true });
  };

  const fetchDues = useCallback(async () => {
    setDuesLoading(true);
    try {
      const { data } = await membershipApi.outstanding();
      setDues(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load outstanding dues');
    } finally {
      setDuesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDues();
  }, [fetchDues]);

  const fetchPayments = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const { data } = await paymentApi.list({
          page,
          limit: 20,
          status: status || undefined,
          method: method || undefined,
          sortBy,
          sortDir,
        });
        setPayments(data.data);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load payments');
      } finally {
        setLoading(false);
      }
    },
    [status, method, sortBy, sortDir]
  );

  useEffect(() => {
    fetchPayments(1);
  }, [fetchPayments]);

  const clearFilters = () => {
    setStatus('');
    setMethod('');
    setSort('');
  };

  const hasFilters = Boolean(status || method || sort);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Payments"
        subtitle={!loading ? `${pagination.total} payment${pagination.total === 1 ? '' : 's'} total` : undefined}
        actions={
          <>
            <button
              onClick={() => paymentApi.export({ status: status || undefined, method: method || undefined, sortBy, sortDir })}
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

      <div className="mb-5 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => switchTab('payments')}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === 'payments' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          All Payments
        </button>
        <button
          onClick={() => switchTab('dues')}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === 'dues' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <AlertCircle size={14} />
          Outstanding Dues
          {!duesLoading && dues.length > 0 && (
            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {dues.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'payments' && (
      <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-brand-600">
            Clear filters
          </button>
        )}
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
              hasFilters ? (
                <button onClick={clearFilters} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                  Clear filters
                </button>
              ) : (
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
              {payments.map((p) => {
                const outstanding = Math.max(p.finalAmount - (p.amountPaid ?? p.finalAmount), 0);
                return (
                  <tr key={p._id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-medium">{p.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      {p.member ? `${p.member.memberId} - ${p.member.firstName} ${p.member.lastName || ''}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(p.finalAmount)}
                      {/* FIX: previously showed nothing to distinguish a partial payment's
                          collected amount from a fully-paid invoice — now shows the real
                          outstanding balance, computed off amountPaid. */}
                      {p.status === 'partial' && outstanding > 0 && (
                        <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">({formatCurrency(outstanding)} due)</span>
                      )}
                      {p.refund?.refundedAmount > 0 && (
                        <span className="ml-1 text-xs text-gray-400">({formatCurrency(p.refund.refundedAmount)} refunded)</span>
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
                        {/* FIX: refund eligibility must match the backend's REFUNDABLE_STATUSES
                            (paid / partial / partially_refunded) — previously this only
                            excluded 'refunded', which incidentally also hid the button for
                            'pending'/'failed' payments that have nothing to refund, but
                            didn't communicate WHY. RefundModal now explains that case too. */}
                        {user?.role === 'admin' && ['paid', 'partial', 'partially_refunded'].includes(p.status) && (
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
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && payments.length > 0 && (
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={fetchPayments} />
        )}
      </div>
      </>
      )}

      {tab === 'dues' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
          {duesLoading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : dues.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Everyone's paid up"
              description="No live membership currently has an outstanding balance."
            />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Invoiced</th>
                  <th className="px-4 py-3">Collected</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {dues.map((m) => {
                  const meta = billingStatusMeta(m.billing.status);
                  return (
                    <tr key={m._id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-3">
                        {m.member ? (
                          <div className="flex items-center gap-2.5">
                            <Avatar firstName={m.member.firstName} lastName={m.member.lastName} size="sm" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {m.member.firstName} {m.member.lastName || ''}
                              </p>
                              <p className="text-xs text-gray-400">{m.member.memberId}</p>
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">{m.plan?.name || '—'}</td>
                      <td className="px-4 py-3">{formatCurrency(m.billing.invoiced)}</td>
                      <td className="px-4 py-3">{formatCurrency(m.billing.collected)}</td>
                      <td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{formatCurrency(m.billing.outstanding)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setCollectPaymentFor(m)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                        >
                          <CreditCard size={12} /> Collect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <RecordPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} onSaved={() => fetchPayments(1)} />

      {/* Collecting directly from the Outstanding Dues tab — pre-scoped to the
          member/membership in that row so there's no re-searching involved. */}
      <RecordPaymentModal
        open={Boolean(collectPaymentFor)}
        onClose={() => setCollectPaymentFor(null)}
        onSaved={() => {
          fetchDues();
          fetchPayments(pagination.page);
        }}
        presetMember={collectPaymentFor?.member}
        presetMembership={collectPaymentFor}
        title="Collect Payment"
        helperNote={`${formatCurrency(collectPaymentFor?.billing?.outstanding || 0)} outstanding on ${
          collectPaymentFor?.plan?.name || 'this membership'
        }.`}
      />

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