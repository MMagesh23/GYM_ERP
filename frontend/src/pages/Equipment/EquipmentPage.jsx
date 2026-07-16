import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { equipmentApi } from '../../services/equipmentApi';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EquipmentFormModal from './EquipmentFormModal';

const STATUS_OPTIONS = ['active', 'under_maintenance', 'damaged', 'repaired', 'retired'];

const EquipmentPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchItems = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const { data } = await equipmentApi.list({ page, limit: 20, q: q || undefined, status: status || undefined });
        setItems(data.data);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load equipment');
      } finally {
        setLoading(false);
      }
    },
    [q, status]
  );

  useEffect(() => {
    const timeout = setTimeout(() => fetchItems(1), 300);
    return () => clearTimeout(timeout);
  }, [fetchItems]);

  useEffect(() => {
    equipmentApi.warrantyAlerts(30).then(({ data }) => setAlerts(data.data));
  }, []);

  const handleDelete = async () => {
    try {
      await equipmentApi.remove(deleteTarget._id);
      toast.success('Equipment deleted');
      setDeleteTarget(null);
      fetchItems(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete equipment');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Equipment</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => equipmentApi.export()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Download size={16} /> Export
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={16} /> Add Equipment
            </button>
          )}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {alerts.length} item{alerts.length > 1 ? 's have' : ' has'} warranty expiring within 30 days:{' '}
            {alerts.map((a) => a.name).join(', ')}
          </span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, serial number, brand, or ID"
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
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3">Equipment ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Location</th>
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
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No equipment found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/equipment/${item._id}`} className="text-brand-600 hover:underline">
                      {item.equipmentId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className="px-4 py-3">{item.location || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge status={item.status} />
                  </td>
                  <td className="px-4 py-3">
                    {user?.role === 'admin' && (
                      <div className="flex justify-end gap-1">
                        <button
                          title="Edit"
                          onClick={() => {
                            setEditingItem(item);
                            setFormOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => setDeleteTarget(item)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={fetchItems} />
      </div>

      <EquipmentFormModal
        open={formOpen}
        equipment={editingItem}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchItems(pagination.page)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete equipment"
        message={`Delete "${deleteTarget?.name}"? This will also remove its maintenance history.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default EquipmentPage;
