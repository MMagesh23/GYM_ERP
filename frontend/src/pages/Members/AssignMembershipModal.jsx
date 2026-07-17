import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Check, Snowflake, RefreshCw } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { planApi, membershipApi } from '../../services/membershipApi';
import { estimateFinalAmount, formatCurrency } from '../../utils/memberHelpers';

const AssignMembershipModal = ({ open, onClose, onSaved, memberId }) => {
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  useEffect(() => {
    if (open) {
      setSelectedPlanId('');
      setPlansLoading(true);
      planApi
        .list()
        .then(({ data }) => setPlans(data.data))
        .finally(() => setPlansLoading(false));
    }
  }, [open]);

  const selectedPlan = plans.find((p) => p._id === selectedPlanId);
  const preview = selectedPlan ? estimateFinalAmount(selectedPlan, { isNew: true }) : 0;

  const onSubmit = async (formData) => {
    if (!selectedPlanId) {
      toast.error('Please select a plan');
      return;
    }
    try {
      await membershipApi.create({
        memberId,
        planId: selectedPlanId,
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
    <Modal open={open} onClose={onClose} title="Assign Membership" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Choose a plan *</label>
          {plansLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-xl" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-800">
              No active plans available. Create one from the Plans page first.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {plans.map((p) => {
                const active = p._id === selectedPlanId;
                return (
                  <button
                    type="button"
                    key={p._id}
                    onClick={() => setSelectedPlanId(p._id)}
                    className={`relative rounded-xl border p-3.5 text-left transition ${
                      active
                        ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 dark:bg-brand-900/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                  >
                    {active && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                        <Check size={12} />
                      </span>
                    )}
                    <p className="pr-6 font-semibold">{p.name}</p>
                    <p className="mt-0.5 text-xs capitalize text-gray-400">{p.durationType.replace('_', ' ')}</p>
                    <p className="mt-2 text-lg font-semibold text-brand-600 dark:text-brand-400">{formatCurrency(p.price)}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.joiningFee > 0 && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800">
                          +{formatCurrency(p.joiningFee)} joining
                        </span>
                      )}
                      {p.freezeAllowed && (
                        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                          <Snowflake size={10} /> {p.freezeDays}d freeze
                        </span>
                      )}
                      {p.maxRenewals > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800">
                          <RefreshCw size={10} /> max {p.maxRenewals}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedPlan && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-800/50">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Price breakdown</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Plan price</span>
                <span>{formatCurrency(selectedPlan.price)}</span>
              </div>
              {selectedPlan.joiningFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Joining fee</span>
                  <span>{formatCurrency(selectedPlan.joiningFee)}</span>
                </div>
              )}
              {selectedPlan.discount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Discount</span>
                  <span>
                    -{selectedPlan.discountType === 'percentage' ? `${selectedPlan.discount}%` : formatCurrency(selectedPlan.discount)}
                  </span>
                </div>
              )}
              {selectedPlan.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span>{selectedPlan.tax}%</span>
                </div>
              )}
              <div className="mt-1.5 flex justify-between border-t border-gray-200 pt-1.5 font-semibold dark:border-gray-700">
                <span>Estimated total</span>
                <span className="text-brand-600 dark:text-brand-400">{formatCurrency(preview)}</span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Start Date</label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800"
            {...register('startDate')}
          />
          <p className="mt-1 text-xs text-gray-400">Defaults to today if left blank.</p>
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
            disabled={isSubmitting || !selectedPlanId}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Assigning...' : 'Assign membership'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignMembershipModal;
