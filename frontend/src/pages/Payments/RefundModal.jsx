import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Undo2, Receipt } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { paymentApi } from '../../services/paymentApi';
import { formatCurrency, formatDate } from '../../utils/memberHelpers';

const REASON_PRESETS = ['Member cancelled', 'Duplicate charge', 'Service issue', 'Billing error'];

const RefundModal = ({ open, onClose, onSaved, payment }) => {
  const [selectedReason, setSelectedReason] = useState(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { amount: '', reason: '' } });

  const remaining = payment ? payment.finalAmount - (payment.refund?.refundedAmount || 0) : 0;
  const amountValue = Number(watch('amount')) || 0;
  const remainingAfter = useMemo(() => Math.max(remaining - amountValue, 0), [remaining, amountValue]);

  useEffect(() => {
    if (open) {
      setSelectedReason(null);
      reset({ amount: '', reason: '' });
    }
  }, [open, reset]);

  if (!payment) return null;

  const applyPercent = (pct) => {
    const value = Math.round(remaining * pct * 100) / 100;
    setValue('amount', value, { shouldValidate: true });
  };

  const applyReason = (preset) => {
    setSelectedReason(preset);
    setValue('reason', preset);
  };

  const onSubmit = async (data) => {
    try {
      await paymentApi.refund(payment._id, Number(data.amount), data.reason);
      toast.success('Refund recorded');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800';

  return (
    <Modal open={open} onClose={onClose} title="Refund Payment" size="sm">
      {/* Original payment context, so staff don't have to back out to check it */}
      <div className="mb-4 flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        <Receipt size={14} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-gray-700 dark:text-gray-200">{payment.invoiceNumber}</p>
          <p>
            Paid {formatCurrency(payment.finalAmount)} on {formatDate(payment.paymentDate)}
            {payment.refund?.refundedAmount > 0 && ` · ${formatCurrency(payment.refund.refundedAmount)} already refunded`}
          </p>
        </div>
      </div>

      <p className="mb-3 text-sm text-gray-500">
        Remaining refundable: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(remaining)}</span>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Refund Amount *</label>
          <input
            type="number"
            step="0.01"
            max={remaining}
            className={inputClass}
            {...register('amount', {
              required: 'Amount is required',
              min: { value: 0.01, message: 'Must be greater than 0' },
              max: { value: remaining, message: `Cannot exceed ${formatCurrency(remaining)}` },
            })}
          />
          {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}

          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => applyPercent(0.25)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              25%
            </button>
            <button type="button" onClick={() => applyPercent(0.5)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              50%
            </button>
            <button type="button" onClick={() => applyPercent(1)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Full ({formatCurrency(remaining)})
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Reason</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASON_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                onClick={() => applyReason(preset)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  selectedReason === preset
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea rows={2} className={inputClass} {...register('reason')} placeholder="Optional detail" />
        </div>

        {amountValue > 0 && (
          <div className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-500 dark:bg-gray-800">
            After this refund, <span className="font-medium text-gray-700 dark:text-gray-200">{formatCurrency(remainingAfter)}</span> will remain refundable
            {remainingAfter === 0 && ' — payment will be marked fully refunded.'}
          </div>
        )}

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
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Undo2 size={14} />
            {isSubmitting ? 'Processing...' : 'Issue refund'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RefundModal;