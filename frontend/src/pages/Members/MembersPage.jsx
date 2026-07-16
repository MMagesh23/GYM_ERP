import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download, Upload, Pencil, Trash2, Snowflake, Ban, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { memberApi } from '../../services/memberApi';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import MemberFormModal from './MemberFormModal';

const STATUS_OPTIONS = ['active', 'expired', 'suspended', 'freeze', 'cancelled'];

const MembersPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importing, setImporting] = useState(false);

  const fetchMembers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await memberApi.list({ page, limit: 20, q: q || undefined, status: status || undefined });
      setMembers(data.data);
      setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const timeout = setTimeout(() => fetchMembers(1), 300); // debounce search
    return () => clearTimeout(timeout);
  }, [fetchMembers]);

  const handleStatusChange = async (member, newStatus) => {
    try {
      await memberApi.changeStatus(member._id, newStatus);
      toast.success(`Member ${newStatus}`);
      fetchMembers(pagination.page);
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Members</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => memberApi.export({ q: q || undefined, status: status || undefined })}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Download size={16} /> Export
          </button>
          {user?.role === 'admin' && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <Upload size={16} /> {importing ? 'Importing...' : 'Import'}
              <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
          )}
          <button
            onClick={() => {
              setEditingMember(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Add Member
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, email, or member ID"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800"
          />
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
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3">Member ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
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
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No members found. Try adjusting your search or filters.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/members/${m._id}`} className="text-brand-600 hover:underline">
                      {m.memberId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="px-4 py-3">{m.phone}</td>
                  <td className="px-4 py-3">{m.currentMembership?.plan?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge status={m.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
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
              ))
            )}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={fetchMembers} />
      </div>

      <MemberFormModal
        open={formOpen}
        member={editingMember}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchMembers(pagination.page)}
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
