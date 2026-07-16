import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import { paymentApi } from '../../services/paymentApi';

const RefundModal = ({ open, onClose, onSaved, payment }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  if (!payment) return null;

  const remaining = payment.finalAmount - (payment.refund?.refundedAmount || 0);

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

  return (
    <Modal open={open} onClose={onClose} title="Refund Payment" size="sm">
      <p className="mb-3 text-sm text-gray-500">
        Remaining refundable: <span className="font-medium text-gray-900 dark:text-gray-100">₹{remaining.toFixed(2)}</span>
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Refund Amount *</label>
          <input
            type="number"
            step="0.01"
            max={remaining}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            {...register('amount', { required: 'Amount is required', max: { value: remaining, message: `Cannot exceed ₹${remaining.toFixed(2)}` } })}
          />
          {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Reason</label>
          <textarea
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            {...register('reason')}
          />
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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Processing...' : 'Issue refund'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RefundModal;
