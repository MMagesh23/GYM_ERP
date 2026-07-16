import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import { maintenanceApi } from '../../services/equipmentApi';

const MaintenanceFormModal = ({ open, onClose, onSaved, equipmentId }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { type: 'scheduled_service', serviceDate: new Date().toISOString().slice(0, 10) } });

  const onSubmit = async (data) => {
    try {
      await maintenanceApi.create(equipmentId, data);
      toast.success('Maintenance record added');
      onSaved();
      onClose();
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add record');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800';
  const labelClass = 'mb-1 block text-sm font-medium';

  return (
    <Modal open={open} onClose={onClose} title="Log Maintenance / Repair">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Type *</label>
            <select className={inputClass} {...register('type', { required: true })}>
              <option value="scheduled_service">Scheduled Service</option>
              <option value="repair">Repair</option>
              <option value="inspection">Inspection</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Service Date *</label>
            <input type="date" className={inputClass} {...register('serviceDate', { required: 'Service date is required' })} />
            {errors.serviceDate && <p className="mt-1 text-xs text-red-500">{errors.serviceDate.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea rows={2} className={inputClass} {...register('description')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Cost (₹)</label>
            <input type="number" step="0.01" className={inputClass} {...register('cost')} />
          </div>
          <div>
            <label className={labelClass}>Vendor</label>
            <input className={inputClass} {...register('vendor')} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Next Service Date</label>
          <input type="date" className={inputClass} {...register('nextServiceDate')} />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : 'Add record'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MaintenanceFormModal;
