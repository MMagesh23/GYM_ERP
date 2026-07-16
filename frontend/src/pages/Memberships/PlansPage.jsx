import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { planApi } from '../../services/membershipApi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PlanFormModal from './PlanFormModal';

const PlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Membership Plans</h1>
        <button
          onClick={() => {
            setEditingPlan(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> New Plan
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-gray-400">No plans yet. Create your first membership plan.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p._id}
              className={`rounded-2xl border p-5 dark:border-gray-800 dark:bg-gray-900 ${
                p.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60 dark:bg-gray-800/40'
              }`}
            >
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingPlan(p); setFormOpen(true); }} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <Pencil size={15} />
                  </button>
                  {p.isActive && (
                    <button onClick={() => setDeactivateTarget(p)} className="rounded-lg p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40">
                      <Ban size={15} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-2xl font-semibold">
                ₹{p.price}
                <span className="text-sm font-normal text-gray-400"> / {p.durationType.replace('_', ' ')}</span>
              </p>
              <div className="mt-3 space-y-1 text-sm text-gray-500">
                {p.joiningFee > 0 && <p>Joining fee: ₹{p.joiningFee}</p>}
                {p.discount > 0 && <p>Discount: {p.discount}{p.discountType === 'percentage' ? '%' : '₹'}</p>}
                {p.tax > 0 && <p>Tax: {p.tax}%</p>}
                <p>Freeze: {p.freezeAllowed ? `Up to ${p.freezeDays} days` : 'Not allowed'}</p>
                <p>Renewals: {p.maxRenewals > 0 ? `Max ${p.maxRenewals}` : 'Unlimited'}</p>
              </div>
              {p.description && <p className="mt-3 text-sm text-gray-500">{p.description}</p>}
              {!p.isActive && <p className="mt-3 text-xs font-medium text-red-500">Inactive</p>}
            </div>
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
