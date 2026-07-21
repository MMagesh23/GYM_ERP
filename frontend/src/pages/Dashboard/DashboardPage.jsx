import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertCircle, LayoutDashboard } from 'lucide-react';
import { dashboardApi } from '../../services/dashboardApi';
import { SkeletonCard } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import StatCard from '../../components/common/StatCard';
import { formatCurrency } from '../../utils/memberHelpers';
import {
  Users, UserCheck, UserX, UserPlus, Wallet, TrendingDown, TrendingUp,
  Dumbbell, Clock, CreditCard,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const CHART_COLORS = ['#3390fa', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

// Maps each widget key (as returned by the backend's `allowedWidgets` array) to
// how it should render. Keys/labels are kept in sync with:
//   backend/utils/dashboardWidgets.js#WIDGET_DEFS
//   frontend/src/pages/Settings/DashboardWidgetsPanel.jsx#WIDGET_LABELS
const WIDGET_META = {
  totalMembers: { type: 'card', cardProps: (v) => ({ icon: Users, label: 'Total Members', value: v ?? 0, tone: 'default' }) },
  activeMembers: { type: 'card', cardProps: (v) => ({ icon: UserCheck, label: 'Active Members', value: v ?? 0, tone: 'green' }) },
  expiredMembers: { type: 'card', cardProps: (v) => ({ icon: UserX, label: 'Expired Members', value: v ?? 0, tone: 'red' }) },
  newMembersThisMonth: { type: 'card', cardProps: (v) => ({ icon: UserPlus, label: 'New This Month', value: v ?? 0, tone: 'purple' }) },
  monthlyRevenue: { type: 'card', cardProps: (v) => ({ icon: TrendingUp, label: 'Monthly Revenue', value: formatCurrency(v), tone: 'green' }) },
  monthlyExpenses: { type: 'card', cardProps: (v) => ({ icon: TrendingDown, label: 'Monthly Expenses', value: formatCurrency(v), tone: 'red' }) },
  netProfit: { type: 'card', cardProps: (v) => ({ icon: Wallet, label: 'Net Profit', value: formatCurrency(v), tone: (v ?? 0) >= 0 ? 'green' : 'red' }) },
  equipmentCount: { type: 'card', cardProps: (v) => ({ icon: Dumbbell, label: 'Equipment', value: v ?? 0, tone: 'default' }) },
  membershipsExpiringSoon: { type: 'card', cardProps: (v) => ({ icon: Clock, label: 'Expiring in 7 Days', value: v ?? 0, tone: 'amber' }) },
  pendingPayments: {
    type: 'card',
    cardProps: (v, summary) => ({
      icon: CreditCard,
      label: 'Pending Payments',
      value: formatCurrency(v),
      hint: summary?.pendingPaymentsCount
        ? `${summary.pendingPaymentsCount} membership${summary.pendingPaymentsCount === 1 ? '' : 's'} owed on`
        : undefined,
      tone: 'amber',
    }),
  },
  revenueChart: { type: 'chart' },
  membershipGrowthChart: { type: 'chart' },
  profitChart: { type: 'chart' },
  planDistributionChart: { type: 'chart' },
};

const DashboardPage = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [allowedWidgets, setAllowedWidgets] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: s }, { data: c }] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.charts(new Date().getFullYear()),
      ]);
      setSummary(s.data);
      setCharts(c.data);
      // The backend already computes exactly which widgets this user/role is
      // allowed to see (role config intersected with their permission matrix) —
      // use that directly instead of trying to reverse-engineer it from the
      // shape of the response data.
      setAllowedWidgets(s.allowedWidgets || []);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load dashboard';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load the dashboard"
          description={error}
          action={
            <button onClick={load} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Retry
            </button>
          }
        />
      </div>
    );
  }

  const cardKeys = allowedWidgets.filter((k) => WIDGET_META[k]?.type === 'card' && summary && k in summary);
  const chartKeys = allowedWidgets.filter((k) => WIDGET_META[k]?.type === 'chart');
  const hasAnyWidget = cardKeys.length > 0 || chartKeys.length > 0;

  const revenueData = charts?.revenueByMonth || [];
  const membershipGrowthData = charts?.membershipGrowth || [];
  const profitData = charts?.profitByMonth || [];
  const planDistributionData = charts?.planDistribution || [];

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Welcome, {user?.name}</h1>
      <p className="mb-6 text-sm text-gray-500">Role: <span className="font-medium capitalize">{user?.role}</span></p>

      {!hasAnyWidget ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No dashboard widgets enabled for your role"
          description="Ask an admin to enable some under Settings → Dashboard Widgets."
        />
      ) : (
        <>
          {cardKeys.length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {cardKeys.map((key) => (
                <StatCard
                  key={key}
                  {...WIDGET_META[key].cardProps(summary[key], summary)}
                  onClick={key === 'pendingPayments' ? () => navigate('/payments?tab=dues') : undefined}
                />
              ))}
            </div>
          )}

          {chartKeys.length > 0 && charts && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {chartKeys.includes('revenueChart') && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Revenue ({charts.year})</h3>
                  {revenueData.length === 0 ? (
                    <p className="flex h-[220px] items-center justify-center text-sm text-gray-400">No revenue data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
                        <YAxis fontSize={12} stroke="#9ca3af" />
                        <Tooltip formatter={(v) => formatCurrency(v)} />
                        <Line type="monotone" dataKey="total" stroke="#3390fa" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {chartKeys.includes('membershipGrowthChart') && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Membership Growth ({charts.year})</h3>
                  {membershipGrowthData.length === 0 ? (
                    <p className="flex h-[220px] items-center justify-center text-sm text-gray-400">No new members yet this year</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={membershipGrowthData}>
                        <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
                        <YAxis fontSize={12} stroke="#9ca3af" allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {chartKeys.includes('profitChart') && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Profit Analysis ({charts.year})</h3>
                  {profitData.length === 0 ? (
                    <p className="flex h-[220px] items-center justify-center text-sm text-gray-400">No profit data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={profitData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
                        <YAxis fontSize={12} stroke="#9ca3af" />
                        <Tooltip formatter={(v) => formatCurrency(v)} />
                        <Line type="monotone" dataKey="profit" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {chartKeys.includes('planDistributionChart') && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Membership Type Distribution</h3>
                  {planDistributionData.length === 0 ? (
                    <p className="flex h-[220px] items-center justify-center text-sm text-gray-400">No active memberships yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={planDistributionData} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={80} label>
                          {planDistributionData.map((entry, idx) => (
                            <Cell key={entry.plan} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardPage;