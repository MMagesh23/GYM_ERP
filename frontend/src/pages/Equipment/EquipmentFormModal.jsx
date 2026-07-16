import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import { equipmentApi } from '../../services/equipmentApi';

const EquipmentFormModal = ({ open, onClose, onSaved, equipment }) => {
  const isEdit = Boolean(equipment);
  const [photoFile, setPhotoFile] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (open) {
      setPhotoFile(null);
      reset(
        equipment
          ? {
              name: equipment.name,
              category: equipment.category,
              brand: equipment.brand,
              model: equipment.model,
              serialNumber: equipment.serialNumber,
              quantity: equipment.quantity,
              purchaseDate: equipment.purchaseDate ? equipment.purchaseDate.slice(0, 10) : '',
              purchaseCost: equipment.purchaseCost,
              supplier: equipment.supplier,
              warrantyStart: equipment.warrantyStart ? equipment.warrantyStart.slice(0, 10) : '',
              warrantyEnd: equipment.warrantyEnd ? equipment.warrantyEnd.slice(0, 10) : '',
              location: equipment.location,
              notes: equipment.notes,
            }
          : { quantity: 1 }
      );
    }
  }, [open, equipment, reset]);

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== '') formData.append(key, val);
      });
      if (photoFile) formData.append('photo', photoFile);

      if (isEdit) {
        await equipmentApi.update(equipment._id, formData);
        toast.success('Equipment updated');
      } else {
        await equipmentApi.create(formData);
        toast.success('Equipment added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800';
  const labelClass = 'mb-1 block text-sm font-medium';

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Equipment' : 'Add Equipment'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Name *</label>
          <input className={inputClass} {...register('name', { required: 'Name is required' })} />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Category *</label>
          <input className={inputClass} placeholder="e.g. Cardio, Strength" {...register('category', { required: 'Category is required' })} />
          {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Brand</label>
          <input className={inputClass} {...register('brand')} />
        </div>
        <div>
          <label className={labelClass}>Model</label>
          <input className={inputClass} {...register('model')} />
        </div>

        <div>
          <label className={labelClass}>Serial Number</label>
          <input className={inputClass} {...register('serialNumber')} />
        </div>
        <div>
          <label className={labelClass}>Quantity</label>
          <input type="number" className={inputClass} {...register('quantity')} />
        </div>

        <div>
          <label className={labelClass}>Purchase Date</label>
          <input type="date" className={inputClass} {...register('purchaseDate')} />
        </div>
        <div>
          <label className={labelClass}>Purchase Cost (₹)</label>
          <input type="number" step="0.01" className={inputClass} {...register('purchaseCost')} />
        </div>

        <div>
          <label className={labelClass}>Supplier</label>
          <input className={inputClass} {...register('supplier')} />
        </div>
        <div>
          <label className={labelClass}>Location</label>
          <input className={inputClass} placeholder="e.g. Floor 1, Cardio Zone" {...register('location')} />
        </div>

        <div>
          <label className={labelClass}>Warranty Start</label>
          <input type="date" className={inputClass} {...register('warrantyStart')} />
        </div>
        <div>
          <label className={labelClass}>Warranty End</label>
          <input type="date" className={inputClass} {...register('warrantyEnd')} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Photo</label>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} className="w-full text-sm" />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea rows={2} className={inputClass} {...register('notes')} />
        </div>

        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
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
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add equipment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EquipmentFormModal;
