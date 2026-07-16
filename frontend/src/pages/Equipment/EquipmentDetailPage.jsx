import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, CheckCircle } from 'lucide-react';
import { equipmentApi, maintenanceApi } from '../../services/equipmentApi';
import Badge from '../../components/common/Badge';
import MaintenanceFormModal from './MaintenanceFormModal';

const EquipmentDetailPage = () => {
  const { id } = useParams();
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await equipmentApi.get(id);
      setEquipment(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const markComplete = async (recordId) => {
    try {
      await maintenanceApi.update(recordId, { status: 'completed' });
      toast.success('Marked as completed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update record');
    }
  };

  if (loading || !equipment) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="p-6">
      <Link to="/equipment" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to equipment
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h1 className="text-xl font-semibold">{equipment.name}</h1>
          <p className="text-sm text-gray-500">
            {equipment.equipmentId} · {equipment.category} {equipment.brand && `· ${equipment.brand}`}
          </p>
          <div className="mt-2">
            <Badge status={equipment.status} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-500">
          <span>Serial #</span>
          <span className="text-gray-900 dark:text-gray-100">{equipment.serialNumber || '—'}</span>
          <span>Location</span>
          <span className="text-gray-900 dark:text-gray-100">{equipment.location || '—'}</span>
          <span>Purchase Cost</span>
          <span className="text-gray-900 dark:text-gray-100">₹{equipment.purchaseCost || 0}</span>
          <span>Warranty Ends</span>
          <span className="text-gray-900 dark:text-gray-100">
            {equipment.warrantyEnd ? new Date(equipment.warrantyEnd).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Maintenance History</h2>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Log Record
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(equipment.maintenanceHistory || []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No maintenance records yet.
                </td>
              </tr>
            ) : (
              equipment.maintenanceHistory.map((m) => (
                <tr key={m._id}>
                  <td className="px-4 py-3 capitalize">{m.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{m.description || '—'}</td>
                  <td className="px-4 py-3">{new Date(m.serviceDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">₹{m.cost || 0}</td>
                  <td className="px-4 py-3">
                    <Badge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.status !== 'completed' && (
                      <button
                        title="Mark completed"
                        onClick={() => markComplete(m._id)}
                        className="inline-flex items-center gap-1 rounded-lg p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MaintenanceFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} equipmentId={id} />
    </div>
  );
};

export default EquipmentDetailPage;
