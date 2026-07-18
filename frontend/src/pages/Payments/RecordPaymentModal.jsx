import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Banknote, Smartphone, CreditCard, Landmark, Wallet, AlertTriangle,
  CheckCircle2, Clock, MinusCircle, XCircle, Zap,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import MemberSearchSelect from '../../components/common/MemberSearchSelect';
import { paymentApi } from '../../services/paymentApi';
import { memberApi } from '../../services/memberApi';
import { formatCurrency } from '../../utils/memberHelpers';

const METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { value: 'debit_card', label: 'Debit Card', icon: CreditCard },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Landmark },
  { value: 'wallet', label: 'Wallet', icon: Wallet },
];

// 'refunded' is intentionally excluded - it's a terminal state only reachable
// via the refund flow, never set at creation time.
const STATUSES = [
  { value: 'paid', label: 'Paid', icon: CheckCircle2, tone: 'green' },
  { value: 'pending', label: 'Pending', icon: Clock, tone: 'amber' },
  { value: 'partial', label: 'Partial', icon: MinusCircle, tone: 'blue' },
  { value: 'failed', label: 'Failed', icon: XCircle, tone: 'red' },
];

const STATUS_TONE_CLASSES = {
  green: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  amber: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  blue: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  red: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const TXN_PLACEHOLDER = {
  upi: 'UPI reference / UTR number',
  credit_card: 'Card auth / approval code',
  debit_card: 'Card auth / approval code',
  bank_transfer: 'Bank transaction reference',
  wallet: 'Wallet transaction ID',
  cash: 'Optional — receipt number, if any',
};

const RecordPaymentModal = ({ open, onClose, onSaved }) => {
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);
  const [pendingForMember, setPendingForMember] = useState([]);
  const [loadingMemberContext, setLoadingMemberContext] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { amount: '', discount: 0, tax: 0, paymentMethod: 'cash', status: 'paid' } });

  const amount = Number(watch('amount')) || 0;
  const discount = Number(watch('discount')) || 0;
  const tax = Number(watch('tax')) || 0;
  const paymentMethod = watch('paymentMethod');
  const status = watch('status');

  const total = useMemo(() => {
    const t = Math.max(amount - discount, 0) + tax;
    return Math.round(t * 100) / 100;
  }, [amount, discount, tax]);

  useEffect(() => {
    if (!open) {
      setSelectedMember(null);
      setActiveMembership(null);
      setPendingForMember([]);
      reset({ amount: '', discount: 0, tax: 0, paymentMethod: 'cash', status: 'paid' });
    }
  }, [open, reset]);

  useEffect(() => {
    const loadMemberContext = async () => {
      if (!selectedMember) {
        setActiveMembership(null);
        setPendingForMember([]);
        return;
      }
      setLoadingMemberContext(true);
      try {
        const [{ data: memberRes }, { data: pendingRes }] = await Promise.all([
          memberApi.get(selectedMember._id),
          paymentApi.list({ memberId: selectedMember._id, status: 'pending', limit: 5 }),
        ]);
        const membership = memberRes.data.currentMembership;
        setActiveMembership(membership || null);
        setPendingForMember(pendingRes.data || []);
        if (membership) {
          setValue('amount', membership.finalAmount);
        }
      } catch (err) {
        // Non-critical - form still works without the context panel
      } finally {
        setLoadingMemberContext(false);
      }
    };
    loadMemberContext();
  }, [selectedMember, setValue]);

  const fillFullAmount = () => {
    if (!activeMembership) return;
    setValue('amount', activeMembership.finalAmount);
    setValue('discount', 0);
    setValue('tax', 0);
    setValue('status', 'paid');
  };

  const onSubmit = async (data) => {
    if (!selectedMember) {
      toast.error('Please select a member');
      return;
    }
    try {
      await paymentApi.create({
        memberId: selectedMember._id,
        membershipId: activeMembership?._id,
        amount: Number(data.amount),
        discount: Number(data.discount || 0),
        tax: Number(data.tax || 0),
        paymentMethod: data.paymentMethod,
        status: data.status,
        transactionNumber: data.transactionNumber,
        notes: data.notes,
      });
      toast.success('Payment recorded');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record payment');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800';
  const labelClass = 'mb-1 block text-sm font-medium';

  const pendingTotal = pendingForMember.reduce((sum, p) => sum + p.finalAmount, 0);

  return (
    <Modal open={open} onClose={onClose} title="Record Payment" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className={labelClass}>Member *</label>
          <MemberSearchSelect value={selectedMember} onChange={setSelectedMember} />
        </div>

        {loadingMemberContext && (
          <div className="skeleton h-14 rounded-lg" />
        )}

        {!loadingMemberContext && pendingForMember.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              This member already has {pendingForMember.length} pending payment{pendingForMember.length > 1 ? 's' : ''}{' '}
              totaling <strong>{formatCurrency(pendingTotal)}</strong>. Double-check this isn't a duplicate before continuing.
            </span>
          </div>
        )}

        {!loadingMemberContext && activeMembership && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
            <span>
              Active membership: <span className="font-medium">{activeMembership.plan?.name || 'Plan'}</span>{' '}
              <span className="text-gray-400">({formatCurrency(activeMembership.finalAmount)})</span>
            </span>
            <button
              type="button"
              onClick={fillFullAmount}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              <Zap size={12} /> Fill full amount
            </button>
          </div>
        )}

        {/* Payment method - visual icon grid instead of a plain select */}
        <div>
          <label className={labelClass}>Payment Method *</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {METHODS.map(({ value, label, icon: Icon }) => {
              const active = paymentMethod === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => setValue('paymentMethod', value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-[11px] font-medium transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500 dark:bg-brand-900/20 dark:text-brand-300'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </div>
          <input type="hidden" {...register('paymentMethod', { required: true })} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Amount *</label>
            <input type="number" step="0.01" className={inputClass} {...register('amount', { required: 'Amount is required', min: { value: 0, message: 'Must be positive' } })} />
            {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Discount</label>
            <input type="number" step="0.01" className={inputClass} {...register('discount')} />
          </div>
          <div>
            <label className={labelClass}>Tax</label>
            <input type="number" step="0.01" className={inputClass} {...register('tax')} />
          </div>
        </div>

        {/* Live breakdown — no submitting blind */}
        <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-3 text-sm dark:border-brand-800 dark:bg-brand-900/20">
          <div className="flex justify-between text-gray-500">
            <span>Amount</span>
            <span>{formatCurrency(amount)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Discount</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Tax</span>
              <span>+{formatCurrency(tax)}</span>
            </div>
          )}
          <div className="mt-1.5 flex justify-between border-t border-brand-200 pt-1.5 text-base font-semibold text-brand-700 dark:border-brand-800 dark:text-brand-300">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Status - color coded so an unpaid invoice can't slip through unnoticed */}
        <div>
          <label className={labelClass}>Status</label>
          <div className="grid grid-cols-4 gap-2">
            {STATUSES.map(({ value, label, icon: Icon, tone }) => {
              const active = status === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => setValue('status', value)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition ${
                    active ? STATUS_TONE_CLASSES[tone] : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
          <input type="hidden" {...register('status')} />
          {status !== 'paid' && (
            <p className="mt-1.5 text-xs text-gray-400">
              {status === 'pending' && "Nothing has been collected yet — this shows up under Pending Payments."}
              {status === 'partial' && 'Only part of the total above has been collected so far.'}
              {status === 'failed' && 'The transaction did not go through — kept for the record.'}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Transaction Reference</label>
          <input className={inputClass} {...register('transactionNumber')} placeholder={TXN_PLACEHOLDER[paymentMethod]} />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea rows={2} className={inputClass} {...register('notes')} />
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Recording...' : `Record ${formatCurrency(total)} payment`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RecordPaymentModal;