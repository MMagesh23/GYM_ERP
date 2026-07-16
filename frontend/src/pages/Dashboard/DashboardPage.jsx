import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Users, UserCheck, UserX, UserPlus, Wallet, TrendingDown, TrendingUp, Dumbbell, Clock, AlertCircle } from 'lucide-react';
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
import { dashboardApi } from '../../services/dashboardApi';
import { SkeletonCard  } from '../../components/common/Skeleton';

const CHART_COLORS = ['#3390fa', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const StatCard = ({ icon: Icon, label, value, tone = 'default' }) => {
  const tones = {
    default: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30',
    green: 'text-green-600 bg-green-50 dark:bg-green-900/30',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/30',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',
  };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`rounded-lg p-1.5 ${tones[tone]}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
};

const DashboardPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);

  useEffect(() => {
    dashboardApi
      .summary()
      .then(({ data }) => setSummary(data.data))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load dashboard summary'));
    dashboardApi
      .charts(new Date().getFullYear())
      .then(({ data }) => setCharts(data.data))
      .catch(() => {});
  }, []);

  const currency = (n) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Welcome, {user?.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        Role: <span className="font-medium capitalize">{user?.role}</span>
      </p>

      {!summary ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={Users} label="Total Members" value={summary.totalMembers} />
            <StatCard icon={UserCheck} label="Active Members" value={summary.activeMembers} tone="green" />
            <StatCard icon={UserX} label="Expired Members" value={summary.expiredMembers} tone="red" />
            <StatCard icon={UserPlus} label="New This Month" value={summary.newMembersThisMonth} />
            <StatCard icon={Dumbbell} label="Equipment" value={summary.equipmentCount} />
            <StatCard icon={TrendingUp} label="Monthly Revenue" value={currency(summary.monthlyRevenue)} tone="green" />
            <StatCard icon={TrendingDown} label="Monthly Expenses" value={currency(summary.monthlyExpenses)} tone="red" />
            <StatCard
              icon={Wallet}
              label="Net Profit"
              value={currency(summary.netProfit)}
              tone={summary.netProfit >= 0 ? 'green' : 'red'}
            />
            <StatCard icon={Clock} label="Expiring Soon" value={summary.membershipsExpiringSoon} tone="amber" />
            <StatCard
              icon={AlertCircle}
              label="Pending Payments"
              value={`${summary.pendingPayments.count} (${currency(summary.pendingPayments.total)})`}
              tone="amber"
            />
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
