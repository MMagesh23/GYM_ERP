import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { auditLogApi } from '../../services/reportApi';
import PaginationComp from '../../components/common/Pagination';
import PageHeader from '../../components/common/PageHeader';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

const ACTIONS = ['login', 'logout', 'create', 'update', 'delete', 'payment', 'renewal', 'expense'];
const MODULES = ['members', 'memberships', 'payments', 'expenses', 'equipment', 'staff', 'settings', 'notifications', 'auth'];

const ACTION_COLORS = {
  login: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  logout: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  create: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  update: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  payment: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  renewal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  expense: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [action, setAction] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const { data } = await auditLogApi.list({ page, limit: 30, action: action || undefined, module: moduleFilter || undefined });
        setLogs(data.data);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    },
    [action, moduleFilter]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const hasFilters = Boolean(action || moduleFilter);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Audit Logs" subtitle="A record of who did what, and when." />

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All modules</option>
          {MODULES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <SkeletonTable rows={10} cols={6} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={hasFilters ? 'No log entries match your filters' : 'No audit log entries yet'}
            description={hasFilters ? 'Try a different action or module filter.' : 'Activity across the app will show up here.'}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => (
                <tr key={log._id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3">{log.user ? `${log.user.name} (${log.user.role})` : 'System'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ACTION_COLORS[log.action] || ''}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{log.module || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{log.description}</td>
                  <td className="px-4 py-3 text-gray-400">{log.ipAddress || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && logs.length > 0 && (
          <PaginationComp page={pagination.page} totalPages={pagination.totalPages} onChange={fetchLogs} />
        )}
      </div>
    </div>
  );
};

export default AuditLogsPage;