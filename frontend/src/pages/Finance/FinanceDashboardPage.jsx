import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, Wallet, AlertCircle, RefreshCw, Lock, PiggyBank,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import { financeApi } from '../../services/financeApi';
import PageHeader from '../../components/common/PageHeader';
import DateRangePicker from '../../components/common/DateRangePicker';
import StatCard from '../../components/common/StatCard';
import { SkeletonCard } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency } from '../../utils/memberHelpers';

const METHOD_COLORS = {
  cash: '#10b981',
  upi: '#3390fa',
  credit_card: '#8b5cf6',
  debit_card: '#6366f1',
  bank_transfer: '#f59e0b',
  wallet: '#ec4899',
};

const toISO = (d) => d.toISOString().slice(0, 10);

const defaultRange = () => {
  const now = new Date();
  return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) };
};

const FinanceDashboardPage = () => {
  const [range, setRange] = useState(defaultRange());
  const [summary, setSummary] = useState(null);
  const [byPlan, setByPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: s }, { data: p }] = await Promise.all([
        financeApi.summary(range),
        financeApi.revenueByPlan(range),
      ]);
      setSummary(s.data);
      setByPlan(p.data);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load finance data';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load finance dashboard"
          description={error}
          action={
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <RefreshCw size={14} /> Retry
            </button>
          }
        />
      </div>
    );
  }

  const netForRange = summary
    ? summary.trend.reduce((sum, d) => sum + d.revenue, 0) - summary.trend.reduce((sum, d) => sum + d.expense, 0)
    : 0;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Finance"
        subtitle="Money in, money out, and what's still owed"
        actions={
          <Link
            to="/finance/cash-closing"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Lock size={15} /> Cash Closing
          </Link>
        }
      />

      <div className="mb-6">
        <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Today's Collection"
          value={loading ? '' : formatCurrency(summary?.todayCollection)}
          tone="green"
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          label="This Month"
          value={loading ? '' : formatCurrency(summary?.monthCollection)}
          tone="default"
          loading={loading}
        />
        <StatCard
          icon={TrendingDown}
          label="Net (selected range)"
          value={loading ? '' : formatCurrency(netForRange)}
          tone={netForRange >= 0 ? 'green' : 'red'}
          loading={loading}
        />
        <StatCard
          icon={AlertCircle}
          label="Outstanding Dues"
          value={loading ? '' : formatCurrency(summary?.outstanding)}
          hint={!loading && summary?.outstandingCount ? `${summary.outstandingCount} membership${summary.outstandingCount === 1 ? '' : 's'}` : undefined}
          tone="amber"
          loading={loading}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Revenue vs Expenses</h3>
          {loading ? (
            <SkeletonCard className="h-[260px]" />
          ) : !summary.trend.length ? (
            <p className="flex h-[260px] items-center justify-center text-sm text-gray-400">No activity in this range</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={summary.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" fontSize={11} stroke="#9ca3af" tickFormatter={(d) => d.slice(5)} />
                <YAxis fontSize={11} stroke="#9ca3af" />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="#10b98122" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="#ef444422" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Payment Methods</h3>
          {loading ? (
            <SkeletonCard className="h-[260px]" />
          ) : !summary.paymentMethodBreakdown.length ? (
            <p className="flex h-[260px] items-center justify-center text-sm text-gray-400">No payments in this range</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={summary.paymentMethodBreakdown}
                  dataKey="total"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(d) => d.method.replace('_', ' ')}
                >
                  {summary.paymentMethodBreakdown.map((m) => (
                    <Cell key={m.method} fill={METHOD_COLORS[m.method] || '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
          <PiggyBank size={15} /> Revenue by Membership Plan
        </h3>
        {loading ? (
          <SkeletonCard className="h-[220px]" />
        ) : byPlan.length === 0 ? (
          <p className="flex h-[220px] items-center justify-center text-sm text-gray-400">No membership revenue in this range</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byPlan} layout="vertical" margin={{ left: 24 }}>
              <XAxis type="number" fontSize={11} stroke="#9ca3af" tickFormatter={(v) => formatCurrency(v)} />
              <YAxis type="category" dataKey="plan" fontSize={12} width={120} stroke="#9ca3af" />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="total" fill="#3390fa" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default FinanceDashboardPage;