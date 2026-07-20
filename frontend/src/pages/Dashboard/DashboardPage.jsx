import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { AlertCircle, LayoutDashboard } from 'lucide-react';
import { dashboardApi } from '../../services/dashboardApi';
import { SkeletonCard } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import StatCard from '../../components/common/StatCard';
import { Users, UserCheck, UserX, UserPlus, Wallet, TrendingDown, TrendingUp, Dumbbell, Clock } from 'lucide-react';
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



const DashboardPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
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

  const cardKeys = Object.keys(summary || {}).filter((k) => WIDGET_META[k]?.type === 'card');
  const hasAnyWidget = cardKeys.length > 0 || Object.keys(charts || {}).some((k) => WIDGET_META[k]?.type === 'chart');

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
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {cardKeys.map((key) => (
              <StatCard key={key} {...WIDGET_META[key].cardProps(summary[key])} />
            ))}
          </div>
          {charts && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Revenue ({charts.year})</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
                    <YAxis fontSize={12} stroke="#9ca3af" />
                    <Tooltip formatter={(v) => currency(v)} />
                    <Line type="monotone" dataKey="total" stroke="#3390fa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Membership Growth ({charts.year})</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.membershipGrowth}>
                    <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
                    <YAxis fontSize={12} stroke="#9ca3af" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Profit Analysis ({charts.year})</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.profitByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
                    <YAxis fontSize={12} stroke="#9ca3af" />
                    <Tooltip formatter={(v) => currency(v)} />
                    <Line type="monotone" dataKey="profit" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Membership Type Distribution</h3>
                {charts.planDistribution.length === 0 ? (
                  <p className="flex h-[220px] items-center justify-center text-sm text-gray-400">No active memberships yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={charts.planDistribution} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={80} label>
                        {charts.planDistribution.map((entry, idx) => (
                          <Cell key={entry.plan} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}          
        </>
      )}
    </div>
  );
};

export default DashboardPage;
