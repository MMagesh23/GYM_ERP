import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowUp, ArrowDown, Check } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { planApi, membershipApi } from '../../services/membershipApi';
import { formatCurrency, estimatePlanChangeAmount } from '../../utils/memberHelpers';

/**
 * Lets staff move a member's active membership to a different plan.
 * Direction (upgrade/downgrade) is inferred from the price difference,
 * matching the semantics the backend already expects.
 *
 * FIX: the price preview now mirrors the backend's real pricing
 * (utils/billing.js#calcPlanChangeAmount) — a full new-plan period starting
 * today, credited by the unused value of the current plan — instead of implying
 * the member simply keeps their remaining days at the new plan's full price.
 */
const ChangePlanModal = ({ open, onClose, onSaved, membership }) => {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedPlanId('');
      planApi.list().then(({ data }) => setPlans(data.data.filter((p) => p._id !== membership?.plan?._id)));
    }
  }, [open, membership]);

  if (!membership) return null;

  const currentPrice = membership.plan?.price || 0;
  const selectedPlan = plans.find((p) => p._id === selectedPlanId);
  const direction = selectedPlan ? (selectedPlan.price >= currentPrice ? 'upgrade' : 'downgrade') : null;
  const preview = selectedPlan ? estimatePlanChangeAmount(membership, selectedPlan) : null;

  const handleSubmit = async () => {
    if (!selectedPlanId || !direction) return;
    setSubmitting(true);
    try {
      await membershipApi.changePlan(membership._id, selectedPlanId, direction);
      toast.success(`Plan ${direction}d to ${selectedPlan.name}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change Plan" size="lg">
      <p className="mb-4 text-sm text-gray-500">
        Currently on <span className="font-medium text-gray-900 dark:text-gray-100">{membership.plan?.name}</span> at{' '}
        {formatCurrency(currentPrice)}. Switching starts a full new period today; unused value from the current
        plan is credited toward the new price.
      </p>

      {plans.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-800">No other active plans to switch to.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {plans.map((p) => {
            const active = p._id === selectedPlanId;
            const isUpgrade = p.price >= currentPrice;
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
                <span
                  className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    isUpgrade
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}
                >
                  {isUpgrade ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                  {isUpgrade ? 'Upgrade' : 'Downgrade'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-800/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Price breakdown</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">New plan price</span>
              <span>{formatCurrency(preview.newPlanCost)}</span>
            </div>
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Credit for {preview.remainingDays} unused day{preview.remainingDays === 1 ? '' : 's'}</span>
              <span>-{formatCurrency(preview.unusedCredit)}</span>
            </div>
            <div className="mt-1.5 flex justify-between border-t border-gray-200 pt-1.5 font-semibold dark:border-gray-700">
              <span>Amount due</span>
              <span className="text-brand-600 dark:text-brand-400">{formatCurrency(preview.amountDue)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !selectedPlanId}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Applying...' : `Confirm ${direction || 'change'}`}
        </button>
      </div>
    </Modal>
  );
};

export default ChangePlanModal;