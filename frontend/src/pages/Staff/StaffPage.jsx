import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Ban, RotateCcw, KeyRound, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import { staffApi } from '../../services/staffApi';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StaffFormModal from './StaffFormModal';
import CredentialsModal from './CredentialsModal';
import PageHeader from '../../components/common/PageHeader';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

const StaffPage = () => {
  const [staff, setStaff] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const fetchStaff = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const { data } = await staffApi.list({ page, limit: 20, q: q || undefined });
        setStaff(data.data);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load staff');
      } finally {
        setLoading(false);
      }
    },
    [q]
  );

  useEffect(() => {
    const timeout = setTimeout(() => fetchStaff(1), 300);
    return () => clearTimeout(timeout);
  }, [fetchStaff]);

  const handleToggleDisable = async () => {
    const disable = disableTarget.status !== 'disabled';
    try {
      await staffApi.toggleDisable(disableTarget._id, disable);
      toast.success(disable ? 'Staff account disabled' : 'Staff account re-enabled');
      setDisableTarget(null);
      fetchStaff(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update account');
    }
  };

  const handleResetPassword = async () => {
    try {
      const { data } = await staffApi.resetPassword(resetTarget._id);
      setResetTarget(null);
      setCredentials({ email: resetTarget.email, password: data.temporaryPassword });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset password');
    }
  };

  const hasFilters = Boolean(q);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Staff"
        subtitle={!loading ? `${pagination.total} staff member${pagination.total === 1 ? '' : 's'} total` : undefined}
        actions={
          <button
            onClick={() => {
              setEditingStaff(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            <Plus size={16} /> Add Staff
          </button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, mobile, email, or ID"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : staff.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title={hasFilters ? 'No staff match your search' : 'No staff yet'}
            description={hasFilters ? 'Try a different search term.' : 'Add your first staff member to get started.'}
            action={
              !hasFilters && (
                <button
                  onClick={() => {
                    setEditingStaff(null);
                    setFormOpen(true);
                  }}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Add Staff
                </button>
              )
            }
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {staff.map((s) => (
                <tr key={s._id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium">{s.employeeId}</td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">{s.mobile}</td>
                  <td className="px-4 py-3">{s.designation}</td>
                  <td className="px-4 py-3">
                    <Badge status={s.status === 'disabled' ? 'disabled' : 'active'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        title="Edit"
                        onClick={() => {
                          setEditingStaff(s);
                          setFormOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Pencil size={16} />
                      </button>
                      {s.user && (
                        <button
                          title="Reset password"
                          onClick={() => setResetTarget(s)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <KeyRound size={16} />
                        </button>
                      )}
                      <button
                        title={s.status === 'disabled' ? 'Re-enable' : 'Disable'}
                        onClick={() => setDisableTarget(s)}
                        className={`rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 ${s.status === 'disabled' ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {s.status === 'disabled' ? <RotateCcw size={16} /> : <Ban size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && staff.length > 0 && (
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={fetchStaff} />
        )}
      </div>

      <StaffFormModal
        open={formOpen}
        staff={editingStaff}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchStaff(pagination.page)}
        onCredentialsIssued={setCredentials}
      />

      <ConfirmDialog
        open={Boolean(disableTarget)}
        title={disableTarget?.status === 'disabled' ? 'Re-enable staff account' : 'Disable staff account'}
        message={
          disableTarget?.status === 'disabled'
            ? `Re-enable ${disableTarget?.name}'s account? They'll be able to log in again.`
            : `Disable ${disableTarget?.name}'s account? They won't be able to log in until re-enabled.`
        }
        confirmLabel={disableTarget?.status === 'disabled' ? 'Re-enable' : 'Disable'}
        danger={disableTarget?.status !== 'disabled'}
        onConfirm={handleToggleDisable}
        onClose={() => setDisableTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Reset password"
        message={`Generate a new temporary password for ${resetTarget?.name}? Their current password will stop working immediately.`}
        confirmLabel="Reset password"
        onConfirm={handleResetPassword}
        onClose={() => setResetTarget(null)}
      />

      <CredentialsModal open={Boolean(credentials)} credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
};

export default StaffPage;