import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { auditLogApi } from '../../services/reportApi';
import PaginationComp from '../../components/common/Pagination';

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
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [action, setAction] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const { data } = await auditLogApi.list({ page, limit: 30, action: action || undefined, module: moduleFilter || undefined });
        setLogs(data.data);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages });
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

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Audit Logs</h1>
      <p className="mb-6 text-sm text-gray-500">A record of who did what, and when.</p>

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

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
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
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
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
              ))
            )}
          </tbody>
        </table>
        <PaginationComp page={pagination.page} totalPages={pagination.totalPages} onChange={fetchLogs} />
      </div>
    </div>
  );
};

export default AuditLogsPage;
