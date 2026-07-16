import { useEffect, useState, useCallback } from 'react';
import { Plus, Download, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { expenseApi } from '../../services/expenseApi';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ExpenseFormModal from './ExpenseFormModal';

const CATEGORIES = ['rent', 'electricity', 'salary', 'equipment', 'internet', 'maintenance', 'marketing', 'cleaning', 'miscellaneous'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_COLORS = ['#3390fa', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

const ExpensesPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({ byCategory: [], byMonth: [] });

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchExpenses = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const { data } = await expenseApi.list({ page, limit: 20, category: category || undefined });
        setExpenses(data.data);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load expenses');
      } finally {
        setLoading(false);
      }
    },
    [category]
  );

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data } = await expenseApi.analytics(new Date().getFullYear());
      setAnalytics(data.data);
    } catch (err) {
      // Non-critical - charts just won't render
    }
  }, []);

  useEffect(() => {
    fetchExpenses(1);
  }, [fetchExpenses]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleDelete = async () => {
    try {
      await expenseApi.remove(deleteTarget._id);
      toast.success('Expense deleted');
      setDeleteTarget(null);
      fetchExpenses(pagination.page);
      fetchAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete expense');
    }
  };

  const monthlyChartData = MONTH_LABELS.map((label, idx) => ({
    month: label,
    total: analytics.byMonth.find((m) => m.month === idx + 1)?.total || 0,
  }));

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => expenseApi.export({ category: category || undefined })}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => {
              setEditingExpense(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Monthly Expenses ({new Date().getFullYear()})</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChartData}>
              <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
              <YAxis fontSize={12} stroke="#9ca3af" />
              <Tooltip formatter={(v) => `₹${v}`} />
              <Bar dataKey="total" fill="#3390fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">By Category</h3>
          {analytics.byCategory.length === 0 ? (
            <p className="flex h-[220px] items-center justify-center text-sm text-gray-400">No expense data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={analytics.byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={80} label>
                  {analytics.byCategory.map((entry, idx) => (
                    <Cell key={entry.category} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `₹${v}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mb-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No expenses found.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium">{e.title}</td>
                  <td className="px-4 py-3 capitalize">{e.category}</td>
                  <td className="px-4 py-3">₹{e.amount}</td>
                  <td className="px-4 py-3">{e.vendor || '—'}</td>
                  <td className="px-4 py-3">{new Date(e.expenseDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        title="Edit"
                        onClick={() => {
                          setEditingExpense(e);
                          setFormOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => setDeleteTarget(e)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={fetchExpenses} />
      </div>

      <ExpenseFormModal
        open={formOpen}
        expense={editingExpense}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          fetchExpenses(pagination.page);
          fetchAnalytics();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete expense"
        message={`Delete "${deleteTarget?.title}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ExpensesPage;
