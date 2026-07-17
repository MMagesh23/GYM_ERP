import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Ban, Snowflake, RefreshCw, Clock, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { planApi } from '../../services/membershipApi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import PlanFormModal from './PlanFormModal';
import { formatCurrency } from '../../utils/memberHelpers';

const DURATION_DAY_ESTIMATE = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  half_yearly: 182,
  annual: 365,
};

const PlanCard = ({ plan, onEdit, onDeactivate }) => {
  const perDay = DURATION_DAY_ESTIMATE[plan.durationType]
    ? plan.price / DURATION_DAY_ESTIMATE[plan.durationType]
    : plan.durationDays
    ? plan.price / plan.durationDays
    : null;

  return (
    <div
      className={`group relative rounded-2xl border p-5 transition hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900 ${
        plan.isActive ? 'border-gray-200 bg-white shadow-card' : 'border-dashed border-gray-200 bg-gray-50 opacity-70 dark:bg-gray-800/30'
      }`}
    >
      <div className="mb-1 flex items-start justify-between">
        <div>
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium capitalize text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <Clock size={10} /> {plan.durationType.replace('_', ' ')}
          </span>
          <h3 className="text-base font-semibold">{plan.name}</h3>
        </div>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={() => onEdit(plan)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Pencil size={15} />
          </button>
          {plan.isActive && (
            <button onClick={() => onDeactivate(plan)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40">
              <Ban size={15} />
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 text-3xl font-semibold tabular-nums">
        {formatCurrency(plan.price)}
        {perDay && <span className="ml-1 text-sm font-normal text-gray-400">≈ {formatCurrency(perDay)}/day</span>}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {plan.joiningFee > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800">
            +{formatCurrency(plan.joiningFee)} joining
          </span>
        )}
        {plan.discount > 0 && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
            {plan.discountType === 'percentage' ? `${plan.discount}% off` : `${formatCurrency(plan.discount)} off`}
          </span>
        )}
        {plan.tax > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800">{plan.tax}% tax</span>
        )}
      </div>

      <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-sm text-gray-500 dark:border-gray-800">
        <p className="flex items-center gap-1.5">
          <Snowflake size={13} className="text-gray-400" />
          {plan.freezeAllowed ? `Freeze up to ${plan.freezeDays} days` : 'Freezing not allowed'}
        </p>
        <p className="flex items-center gap-1.5">
          <RefreshCw size={13} className="text-gray-400" />
          {plan.maxRenewals > 0 ? `Max ${plan.maxRenewals} renewals` : 'Unlimited renewals'}
        </p>
      </div>

      {plan.description && <p className="mt-3 line-clamp-2 text-sm text-gray-500">{plan.description}</p>}
      {!plan.isActive && (
        <span className="absolute right-4 top-4 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-900/40 dark:text-red-300">
          Inactive
        </span>
      )}
    </div>
  );
};

const PlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await planApi.list(true);
      setPlans(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeactivate = async () => {
    try {
      await planApi.deactivate(deactivateTarget._id);
      toast.success('Plan deactivated');
      setDeactivateTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not deactivate plan');
    }
  };

  const visiblePlans = useMemo(() => (showInactive ? plans : plans.filter((p) => p.isActive)), [plans, showInactive]);
  const activeCount = plans.filter((p) => p.isActive).length;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Membership Plans"
        subtitle={!loading ? `${activeCount} active plan${activeCount === 1 ? '' : 's'}` : undefined}
        actions={
          <>
            <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700">
              <input type="checkbox" className="h-4 w-4" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
            <button
              onClick={() => {
                setEditingPlan(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              <Plus size={16} /> New Plan
            </button>
          </>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : visiblePlans.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No plans yet"
          description="Create your first membership plan to start assigning it to members."
          action={
            <button
              onClick={() => {
                setEditingPlan(null);
                setFormOpen(true);
              }}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              New Plan
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visiblePlans.map((p) => (
            <PlanCard
              key={p._id}
              plan={p}
              onEdit={(plan) => {
                setEditingPlan(plan);
                setFormOpen(true);
              }}
              onDeactivate={setDeactivateTarget}
            />
          ))}
        </div>
      )}

      <PlanFormModal open={formOpen} plan={editingPlan} onClose={() => setFormOpen(false)} onSaved={load} />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate plan"
        message={`Deactivate "${deactivateTarget?.name}"? Existing memberships on this plan are unaffected, but it won't be offered to new members.`}
        confirmLabel="Deactivate"
        danger
        onConfirm={handleDeactivate}
        onClose={() => setDeactivateTarget(null)}
      />
    </div>
  );
};

export default PlansPage;
