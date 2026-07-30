import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, CheckCircle2, XCircle } from 'lucide-react';
import { emailLogApi } from '../../services/emailApi';
import PaginationComp from '../../components/common/Pagination';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

const TEMPLATE_LABELS = {
  welcome: 'Welcome',
  membership_registration: 'Membership Registration',
  membership_renewal_reminder: 'Renewal Reminder',
  membership_expiry_notice: 'Expiry Notice',
  payment_receipt: 'Payment Receipt',
  payment_reminder: 'Payment Reminder',
  password_reset: 'Password Reset',
  announcement: 'Announcement',
  '': 'Manual / Test',
};

const StatusBadge = ({ status }) =>
  status === 'sent' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
      <CheckCircle2 size={13} /> Sent
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
      <XCircle size={13} /> Failed
    </span>
  );

const EmailHistoryPanel = () => {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ sent: 0, failed: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [status, setStatus] = useState('');
  const [templateType, setTemplateType] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const { data } = await emailLogApi.list({
          page,
          limit: 25,
          status: status || undefined,
          templateType: templateType || undefined,
          q: q || undefined,
        });
        setLogs(data.data);
        setSummary(data.summary);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load email history');
      } finally {
        setLoading(false);
      }
    },
    [status, templateType, q]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const hasFilters = Boolean(status || templateType || q);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipient or subject..."
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={templateType}
          onChange={(e) => setTemplateType(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All email types</option>
          {Object.entries(TEMPLATE_LABELS)
            .filter(([key]) => key)
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
        <div className="ml-auto flex gap-4 text-xs text-gray-500">
          <span>
            <span className="font-semibold text-green-600 dark:text-green-400">{summary.sent}</span> sent
          </span>
          <span>
            <span className="font-semibold text-red-600 dark:text-red-400">{summary.failed}</span> failed
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={hasFilters ? 'No emails match your filters' : 'No emails sent yet'}
            description={hasFilters ? 'Try a different status or type filter.' : 'Sent and failed emails will show up here.'}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date &amp; Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => (
                <tr key={log._id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3">{log.recipient}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{log.subject}</td>
                  <td className="px-4 py-3 text-gray-400">{TEMPLATE_LABELS[log.templateType] ?? log.templateType}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                    {log.status === 'failed' && log.errorMessage && (
                      <p className="mt-1 max-w-xs truncate text-xs text-red-500" title={log.errorMessage}>
                        {log.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && logs.length > 0 && (
          <PaginationComp page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={25} onChange={fetchLogs} />
        )}
      </div>
    </div>
  );
};

export default EmailHistoryPanel;
