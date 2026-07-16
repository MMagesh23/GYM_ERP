import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import { planApi, membershipApi } from '../../services/membershipApi';

const AssignMembershipModal = ({ open, onClose, onSaved, memberId }) => {
  const [plans, setPlans] = useState([]);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (open) {
      planApi.list().then(({ data }) => setPlans(data.data));
    }
  }, [open]);

  const selectedPlan = plans.find((p) => p._id === watch('planId'));

  const onSubmit = async (formData) => {
    try {
      await membershipApi.create({
        memberId,
        planId: formData.planId,
        startDate: formData.startDate || undefined,
      });
      toast.success('Membership assigned');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not assign membership');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Assign Membership">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Plan *</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            {...register('planId', { required: 'Please select a plan' })}
          >
            <option value="">Select a plan</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} — ₹{p.price} ({p.durationType.replace('_', ' ')})
              </option>
            ))}
          </select>
          {errors.planId && <p className="mt-1 text-xs text-red-500">{errors.planId.message}</p>}
        </div>

        {selectedPlan && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
            <p>Price: ₹{selectedPlan.price}</p>
            {selectedPlan.joiningFee > 0 && <p>Joining fee: ₹{selectedPlan.joiningFee}</p>}
            {selectedPlan.tax > 0 && <p>Tax: {selectedPlan.tax}%</p>}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Start Date</label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            {...register('startDate')}
          />
          <p className="mt-1 text-xs text-gray-400">Defaults to today if left blank.</p>
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
            {isSubmitting ? 'Assigning...' : 'Assign membership'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignMembershipModal;
