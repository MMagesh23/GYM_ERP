// frontend/src/pages/Settings/DashboardWidgetsPanel.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { settingsApi } from '../../services/settingsApi';

const WIDGET_LABELS = {
  totalMembers: 'Total Members', activeMembers: 'Active Members', expiredMembers: 'Expired Members',
  newMembersThisMonth: 'New This Month', monthlyRevenue: 'Monthly Revenue', monthlyExpenses: 'Monthly Expenses',
  netProfit: 'Net Profit', equipmentCount: 'Equipment Count', membershipsExpiringSoon: 'Expiring Soon',
  pendingPayments: 'Pending Payments', revenueChart: 'Revenue Chart', membershipGrowthChart: 'Membership Growth Chart',
  profitChart: 'Profit Chart', planDistributionChart: 'Plan Distribution Chart',
};

const DashboardWidgetsPanel = ({ initial, onSaved }) => {
  const [config, setConfig] = useState(initial || { admin: [], receptionist: [] });
  const [saving, setSaving] = useState(false);

  const toggle = (role, key) => {
    setConfig((prev) => {
      const list = prev[role] || [];
      const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
      return { ...prev, [role]: next };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await settingsApi.update({ dashboardWidgets: config });
      toast.success('Dashboard widgets saved');
      onSaved?.(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save widget config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Choose which cards and charts each role sees. A receptionist can only ever see widgets they
        also have module permission for — this list is a further narrowing, not an expansion.
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {['admin', 'receptionist'].map((role) => (
          <div key={role}>
            <h3 className="mb-2 text-sm font-semibold capitalize">{role}</h3>
            <div className="space-y-1.5">
              {Object.entries(WIDGET_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                  <input type="checkbox" className="h-4 w-4" checked={(config[role] || []).includes(key)} onChange={() => toggle(role, key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          <Save size={14} /> {saving ? 'Saving...' : 'Save widget config'}
        </button>
      </div>
    </div>
  );
};
export default DashboardWidgetsPanel;