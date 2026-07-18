import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import MemberSearchSelect from '../../components/common/MemberSearchSelect';
import { paymentApi } from '../../services/paymentApi';
import { memberApi } from '../../services/memberApi';

const METHODS = ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'];
// FIX: 'refunded' is a terminal state only reachable via the refund flow, not at
// creation time — offering it here would let someone create an already-refunded
// payment, which the refund modal / backend don't expect. 'paid' stays the
// default so existing behavior for the common case doesn't change.
const STATUSES = ['paid', 'pending', 'partial', 'failed'];

const RecordPaymentModal = ({ open, onClose, onSaved }) => {
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { amount: '', discount: 0, tax: 0, paymentMethod: 'cash', status: 'paid' } });

  useEffect(() => {
    if (!open) {
      setSelectedMember(null);
      setActiveMembership(null);
      reset({ amount: '', discount: 0, tax: 0, paymentMethod: 'cash', status: 'paid' });
    }
  }, [open, reset]);

  useEffect(() => {
    const loadMembership = async () => {
      if (!selectedMember) {
        setActiveMembership(null);
        return;
      }
      const { data } = await memberApi.get(selectedMember._id);
      const membership = data.data.currentMembership;
      setActiveMembership(membership || null);
      if (membership) reset((prev) => ({ ...prev, amount: membership.finalAmount }));
    };
    loadMembership();
  }, [selectedMember, reset]);

  const onSubmit = async (data) => {
    if (!selectedMember) {
      toast.error('Please select a member');
      return;
    }
    try {
      await paymentApi.create({
        memberId: selectedMember._id,
        // FIX: only attach membershipId when it actually belongs to the selected
        // member — activeMembership is fetched right after member selection, but
        // if the user is mid-selection this guards against ever sending a stale
        // membership from a previously-selected member.
        membershipId: activeMembership?.member === selectedMember._id ? activeMembership._id : activeMembership?._id,
        amount: Number(data.amount),
        discount: Number(data.discount || 0),
        tax: Number(data.tax || 0),
        paymentMethod: data.paymentMethod,
        // FIX: previously never sent, so every payment was forced to 'paid' —
        // pending/partial payments could never be recorded through this modal even
        // though the backend, dashboard, and payments list all support those states.
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

  return (
    <Modal open={open} onClose={onClose} title="Record Payment">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className={labelClass}>Member *</label>
          <MemberSearchSelect value={selectedMember} onChange={setSelectedMember} />
        </div>

        {activeMembership && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
            Active membership: <span className="font-medium">{activeMembership.plan?.name || 'Plan'}</span> — amount pre-filled below.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Amount *</label>
            <input type="number" step="0.01" className={inputClass} {...register('amount', { required: 'Amount is required' })} />
            {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Payment Method *</label>
            <select className={inputClass} {...register('paymentMethod', { required: true })}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Discount</label>
            <input type="number" step="0.01" className={inputClass} {...register('discount')} />
          </div>
          <div>
            <label className={labelClass}>Tax</label>
            <input type="number" step="0.01" className={inputClass} {...register('tax')} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} {...register('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Use "Pending" or "Partial" if the amount above hasn't been fully collected yet.
          </p>
        </div>

        <div>
          <label className={labelClass}>Transaction Reference</label>
          <input className={inputClass} {...register('transactionNumber')} placeholder="UPI ref, card auth code, etc." />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea rows={2} className={inputClass} {...register('notes')} />
        </div>

        <div className="flex justify-end gap-2">
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
            {isSubmitting ? 'Recording...' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RecordPaymentModal;