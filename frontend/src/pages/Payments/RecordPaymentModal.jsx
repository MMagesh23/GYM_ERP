import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  Banknote, Smartphone, CreditCard, Landmark, Wallet, AlertTriangle,
  CheckCircle2, Clock, MinusCircle, XCircle, Zap, CircleCheck, HelpCircle,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Avatar from '../../components/common/Avatar';
import MemberSearchSelect from '../../components/common/MemberSearchSelect';
import { paymentApi } from '../../services/paymentApi';
import { memberApi } from '../../services/memberApi';
import { formatCurrency, billingStatusMeta } from '../../utils/memberHelpers';

// Icons for well-known methods; anything an admin adds via Settings falls
// back to a generic icon so the UI never breaks for a custom method.
const METHOD_ICONS = {
  cash: Banknote, upi: Smartphone, credit_card: CreditCard, debit_card: CreditCard,
  bank_transfer: Landmark, wallet: Wallet,
};
const prettify = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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

const RecordPaymentModal = ({ open, onClose, onSaved, presetMember, presetMembership, title, helperNote }) => {
  const { data: settings } = useSelector((state) => state.settings);
  const availableMethods = settings?.paymentMethods?.length ? settings.paymentMethods : ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'];

  const dueMode = Boolean(presetMembership);
  const outstanding = dueMode ? Number(presetMembership?.billing?.outstanding || 0) : null;
  const alreadySettled = dueMode && outstanding <= 0;

  const [selectedMember, setSelectedMember] = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);
  const [pendingForMember, setPendingForMember] = useState([]);
  const [loadingMemberContext, setLoadingMemberContext] = useState(false);

  // FIX (double-payment guard, part 2/2 — see Payment model + paymentController
  // for part 1): one key per modal-open session, reused across every submit
  // attempt within it. A double-click or a retried request after a
  // dropped/timed-out response sends the SAME key, and the backend's unique
  // index rejects the second insert outright rather than relying on a
  // read-then-write balance check that a race condition could slip past.
  const idempotencyKeyRef = useRef(null);
  useEffect(() => {
    if (open) idempotencyKeyRef.current = crypto.randomUUID();
  }, [open]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { amount: '', discount: 0, tax: 0, paymentMethod: 'cash', status: 'paid', amountPaid: '' } });

  const amount = Number(watch('amount')) || 0;
  const discount = Number(watch('discount')) || 0;
  const tax = Number(watch('tax')) || 0;
  const paymentMethod = watch('paymentMethod');
  const status = watch('status');
  const amountPaid = Number(watch('amountPaid')) || 0;

  const total = useMemo(() => {
    const t = Math.max(amount - discount, 0) + tax;
    return Math.round(t * 100) / 100;
  }, [amount, discount, tax]);

  useEffect(() => {
    if (!open) {
      setSelectedMember(null);
      setActiveMembership(null);
      setPendingForMember([]);
      reset({ amount: '', discount: 0, tax: 0, paymentMethod: availableMethods[0] || 'cash', status: 'paid', amountPaid: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    if (presetMember) setSelectedMember(presetMember);
    if (presetMembership) {
      setActiveMembership(presetMembership);
      if (outstanding > 0) {
        setValue('amount', outstanding);
        setValue('discount', 0);
        setValue('tax', 0);
        setValue('status', 'paid');
        setValue('amountPaid', '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetMember, presetMembership]);

  useEffect(() => {
    const loadMemberContext = async () => {
      if (!selectedMember) {
        if (!dueMode) setActiveMembership(null);
        setPendingForMember([]);
        return;
      }
      setLoadingMemberContext(true);
      try {
        const [{ data: pendingRes }, { data: partialRes }] = await Promise.all([
          paymentApi.list({ memberId: selectedMember._id, status: 'pending', limit: 5 }),
          paymentApi.list({ memberId: selectedMember._id, status: 'partial', limit: 5 }),
        ]);
        setPendingForMember([...(pendingRes.data || []), ...(partialRes.data || [])]);

        if (!dueMode) {
          const { data: memberRes } = await memberApi.get(selectedMember._id);
          const membership = memberRes.data.currentMembership;
          setActiveMembership(membership || null);
          if (membership) setValue('amount', membership.finalAmount);
        }
      } catch (err) {
        // Non-critical - form still works without the context panel
      } finally {
        setLoadingMemberContext(false);
      }
    };
    loadMemberContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMember, dueMode]);

  const fillSuggestedAmount = () => {
    const suggested = dueMode ? outstanding : activeMembership?.finalAmount;
    if (!suggested) return;
    setValue('amount', suggested);
    if (!dueMode) {
      setValue('discount', 0);
      setValue('tax', 0);
    }
    setValue('status', 'paid');
    setValue('amountPaid', '');
  };

  const onSubmit = async (data) => {
    if (!selectedMember) {
      toast.error('Please select a member');
      return;
    }
    if (dueMode && Number(data.amount) > outstanding + 0.01) {
      toast.error(`Amount can't exceed the outstanding balance of ${formatCurrency(outstanding)}.`);
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
        amountPaid: data.status === 'partial' ? Number(data.amountPaid) : undefined,
        transactionNumber: data.transactionNumber,
        notes: data.notes,
        idempotencyKey: idempotencyKeyRef.current,
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

  const pendingTotal = pendingForMember.reduce((sum, p) => sum + (p.finalAmount - (p.amountPaid || 0)), 0);
  const meta = dueMode ? billingStatusMeta(presetMembership?.billing?.status) : null;

  return (
    <Modal open={open} onClose={onClose} title={title || 'Record Payment'} size="lg">
      {helperNote && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{helperNote}</span>
        </div>
      )}

      {alreadySettled ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-green-300 bg-green-50/60 py-8 text-center dark:border-green-900 dark:bg-green-950/20">
          <CircleCheck size={32} className="text-green-500" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-300">This membership is already fully paid.</p>
            <p className="mt-0.5 text-sm text-green-700/80 dark:text-green-400/80">
              There's no outstanding balance left to collect — recording another payment here would double-charge it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className={labelClass}>Member *</label>
            {presetMember ? (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                <Avatar firstName={presetMember.firstName} lastName={presetMember.lastName} photo={presetMember.photo} size="sm" />
                <div>
                  <p className="text-sm font-medium">
                    {presetMember.firstName} {presetMember.lastName || ''}
                  </p>
                  <p className="text-xs text-gray-400">{presetMember.memberId}</p>
                </div>
              </div>
            ) : (
              <MemberSearchSelect value={selectedMember} onChange={setSelectedMember} />
            )}
          </div>

          {dueMode && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-sm dark:border-amber-900 dark:bg-amber-950/20">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-amber-900 dark:text-amber-200">
                  {presetMembership?.plan?.name || 'Membership'} — outstanding due
                </span>
                {meta && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}>{meta.label}</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-amber-800/90 dark:text-amber-300/90">
                <div>
                  <p className="text-amber-600/70 dark:text-amber-400/70">Invoiced</p>
                  <p className="font-semibold">{formatCurrency(presetMembership?.billing?.invoiced)}</p>
                </div>
                <div>
                  <p className="text-amber-600/70 dark:text-amber-400/70">Collected</p>
                  <p className="font-semibold">{formatCurrency(presetMembership?.billing?.collected)}</p>
                </div>
                <div>
                  <p className="text-amber-600/70 dark:text-amber-400/70">Outstanding</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(outstanding)}</p>
                </div>
              </div>
            </div>
          )}

          {loadingMemberContext && <div className="skeleton h-14 rounded-lg" />}

          {!loadingMemberContext && pendingForMember.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                This member already has {pendingForMember.length} payment{pendingForMember.length > 1 ? 's' : ''} with an
                outstanding balance totaling <strong>{formatCurrency(pendingTotal)}</strong>. Double-check this isn't a
                duplicate before continuing.
              </span>
            </div>
          )}

          {!loadingMemberContext && !dueMode && activeMembership && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
              <span>
                Active membership: <span className="font-medium">{activeMembership.plan?.name || 'Plan'}</span>{' '}
                <span className="text-gray-400">({formatCurrency(activeMembership.finalAmount)})</span>
              </span>
              <button
                type="button"
                onClick={fillSuggestedAmount}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
              >
                <Zap size={12} /> Fill full amount
              </button>
            </div>
          )}

          {/* Payment method - now sourced from Settings.paymentMethods, never hardcoded */}
          <div>
            <label className={labelClass}>Payment Method *</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {availableMethods.map((value) => {
                const Icon = METHOD_ICONS[value] || HelpCircle;
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
                    {prettify(value)}
                  </button>
                );
              })}
            </div>
            <input type="hidden" {...register('paymentMethod', { required: true })} />
          </div>

          <div className={`grid grid-cols-1 gap-4 ${dueMode ? '' : 'sm:grid-cols-3'}`}>
            <div>
              <label className={labelClass}>
                Amount * {dueMode && <span className="font-normal text-gray-400">(auto-filled from outstanding due)</span>}
              </label>
              <input
                type="number"
                step="0.01"
                max={dueMode ? outstanding : undefined}
                className={inputClass}
                {...register('amount', {
                  required: 'Amount is required',
                  min: { value: 0, message: 'Must be positive' },
                  max: dueMode ? { value: outstanding, message: `Cannot exceed the outstanding due of ${formatCurrency(outstanding)}` } : undefined,
                })}
              />
              {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
            </div>
            {!dueMode && (
              <>
                <div>
                  <label className={labelClass}>Discount</label>
                  <input type="number" step="0.01" className={inputClass} {...register('discount')} />
                </div>
                <div>
                  <label className={labelClass}>Tax</label>
                  <input type="number" step="0.01" className={inputClass} {...register('tax')} />
                </div>
              </>
            )}
          </div>

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
                {status === 'partial' && 'Only part of the total above has been collected so far — enter exactly how much below.'}
                {status === 'failed' && 'The transaction did not go through — kept for the record.'}
              </p>
            )}
          </div>

          {status === 'partial' && (
            <div>
              <label className={labelClass}>Amount Collected Now *</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                {...register('amountPaid', {
                  required: 'Enter how much was actually collected',
                  min: { value: 0.01, message: 'Must be greater than 0' },
                  validate: (v) => Number(v) < total || `Must be less than the total (${formatCurrency(total)}) — use "Paid" if collecting in full`,
                })}
              />
              {errors.amountPaid && <p className="mt-1 text-xs text-red-500">{errors.amountPaid.message}</p>}
              <p className="mt-1 text-xs text-gray-400">
                Outstanding after this payment: {formatCurrency(Math.max(total - amountPaid, 0))}
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>Transaction Reference</label>
            <input className={inputClass} {...register('transactionNumber')} placeholder={TXN_PLACEHOLDER[paymentMethod] || 'Optional reference'} />
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
              {isSubmitting
                ? 'Recording...'
                : status === 'partial'
                ? `Record ${formatCurrency(amountPaid)} of ${formatCurrency(total)}`
                : `Record ${formatCurrency(total)} payment`}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default RecordPaymentModal;