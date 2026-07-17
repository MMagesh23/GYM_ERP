import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Download, Upload, Pencil, Trash2, Snowflake, Ban, RotateCcw,
  Users, UserCheck, UserPlus, Clock, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { memberApi } from '../../services/memberApi';
import { dashboardApi } from '../../services/dashboardApi';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import StatCard from '../../components/common/StatCard';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import MemberFormModal from './MemberFormModal';
import PageHeader from '../../components/common/PageHeader';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { daysUntil, membershipUrgency, expiryLabel, URGENCY_STYLES } from '../../utils/memberHelpers';

const STATUS_OPTIONS = ['active', 'expired', 'suspended', 'freeze', 'cancelled'];

const ExpiryChip = ({ membership }) => {
  if (!membership) {
    return <span className="text-xs text-gray-400">No active plan</span>;
  }
  const days = daysUntil(membership.endDate);
  const urgency = membershipUrgency(days);
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[urgency]}`}>
      {expiryLabel(days)}
    </span>
  );
};

const MembersPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true); // initial skeleton
  const [refreshing, setRefreshing] = useState(false); // subsequent fetches (smoother)
  const [summary, setSummary] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importing, setImporting] = useState(false);

  const fetchMembers = useCallback(
    async (page = 1) => {
      const isFirstLoad = pagination.total === 0 && !q && !status;
      isFirstLoad ? setLoading(true) : setRefreshing(true);
      try {
        const { data } = await memberApi.list({ page, limit: 20, q: q || undefined, status: status || undefined });
        setMembers(data.data);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load members');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [q, status] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await dashboardApi.summary();
      setSummary(data.data);
    } catch (err) {
      // Non-critical — the stat row just won't populate
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => fetchMembers(1), 300);
    return () => clearTimeout(timeout);
  }, [fetchMembers]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleStatusChange = async (member, newStatus) => {
    try {
      await memberApi.changeStatus(member._id, newStatus);
      toast.success(`${member.firstName} marked as ${newStatus}`);
      fetchMembers(pagination.page);
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update status');
    }
  };

  const handleDelete = async () => {
    try {
      await memberApi.remove(deleteTarget._id);
      toast.success('Member deleted');
      setDeleteTarget(null);
      fetchMembers(pagination.page);
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete member');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const { data } = await memberApi.import(file);
      toast.success(`Imported ${data.data.created} member(s)${data.data.failed.length ? `, ${data.data.failed.length} failed` : ''}`);
      fetchMembers(1);
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const clearFilters = () => {
    setQ('');
    setStatus('');
  };

  const hasFilters = Boolean(q || status);

  const statCards = useMemo(
    () => [
      { icon: Users, label: 'Total Members', value: summary?.totalMembers, tone: 'default' },
      { icon: UserCheck, label: 'Active', value: summary?.activeMembers, tone: 'green' },
      { icon: Clock, label: 'Expiring in 7 days', value: summary?.membershipsExpiringSoon, tone: 'amber' },
      { icon: UserPlus, label: 'New This Month', value: summary?.newMembersThisMonth, tone: 'purple' },
    ],
    [summary]
  );

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Members"
        subtitle={!loading ? `${pagination.total} member${pagination.total === 1 ? '' : 's'} total` : undefined}
        actions={
          <>
            <button
              onClick={() => memberApi.export({ q: q || undefined, status: status || undefined })}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <Download size={16} /> Export
            </button>
            {user?.role === 'admin' && (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <Upload size={16} /> {importing ? 'Importing...' : 'Import'}
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} disabled={importing} />
              </label>
            )}
            <button
              onClick={() => {
                setEditingMember(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 hover:shadow-card-hover"
            >
              <Plus size={16} /> Add Member
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} loading={!summary} />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, email, or member ID"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-brand-600">
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No members match your filters' : 'No members yet'}
            description={hasFilters ? 'Try a different search term or clear your filters.' : 'Add your first member to get started.'}
            action={
              hasFilters ? (
                <button onClick={clearFilters} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                  Clear filters
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditingMember(null);
                    setFormOpen(true);
                  }}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Add Member
                </button>
              )
            }
          />
        ) : (
          <div className={`transition-opacity duration-200 ${refreshing ? 'opacity-50' : 'opacity-100'}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Membership</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {members.map((m) => (
                  <tr key={m._id} className="group transition hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <Link to={`/members/${m._id}`} className="flex items-center gap-3">
                        <Avatar firstName={m.firstName} lastName={m.lastName} photo={m.photo} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900 group-hover:text-brand-600 dark:text-gray-100 dark:group-hover:text-brand-400">
                            {m.firstName} {m.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{m.memberId}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{m.phone}</p>
                      {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                    </td>
                    <td className="px-4 py-3">{m.currentMembership?.plan?.name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <ExpiryChip membership={m.currentMembership} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={m.status} dot />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          title="Edit"
                          onClick={() => {
                            setEditingMember(m);
                            setFormOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <Pencil size={16} />
                        </button>
                        {m.status !== 'freeze' ? (
                          <button
                            title="Freeze"
                            onClick={() => handleStatusChange(m, 'freeze')}
                            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <Snowflake size={16} />
                          </button>
                        ) : (
                          <button
                            title="Reactivate"
                            onClick={() => handleStatusChange(m, 'active')}
                            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        {m.status !== 'suspended' && (
                          <button
                            title="Suspend"
                            onClick={() => handleStatusChange(m, 'suspended')}
                            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button
                            title="Delete"
                            onClick={() => setDeleteTarget(m)}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && members.length > 0 && (
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={fetchMembers} />
        )}
      </div>

      <MemberFormModal
        open={formOpen}
        member={editingMember}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          fetchMembers(pagination.page);
          fetchSummary();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete member"
        message={`Are you sure you want to delete ${deleteTarget?.firstName}? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default MembersPage;
