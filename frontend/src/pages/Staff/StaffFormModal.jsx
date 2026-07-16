import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import { staffApi } from '../../services/staffApi';

const StaffFormModal = ({ open, onClose, onSaved, staff, onCredentialsIssued }) => {
  const isEdit = Boolean(staff);
  const [photoFile, setPhotoFile] = useState(null);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  const createLogin = watch('createLogin');

  useEffect(() => {
    if (open) {
      setPhotoFile(null);
      reset(
        staff
          ? {
              name: staff.name,
              mobile: staff.mobile,
              email: staff.email,
              address: staff.address,
              designation: staff.designation,
              salary: staff.salary,
              joiningDate: staff.joiningDate ? staff.joiningDate.slice(0, 10) : '',
            }
          : { designation: 'Receptionist', joiningDate: new Date().toISOString().slice(0, 10) }
      );
    }
  }, [open, staff, reset]);

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== '' && val !== false) formData.append(key, val);
      });
      if (photoFile) formData.append('photo', photoFile);

      if (isEdit) {
        await staffApi.update(staff._id, formData);
        toast.success('Staff updated');
      } else {
        const { data: res } = await staffApi.create(formData);
        toast.success('Staff added');
        if (res.temporaryPassword) {
          onCredentialsIssued?.({ email: data.email, password: res.temporaryPassword });
        }
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Staff' : 'Add Staff'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Name *</label>
          <input className={inputClass} {...register('name', { required: 'Name is required' })} />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Mobile *</label>
          <input className={inputClass} {...register('mobile', { required: 'Mobile is required' })} />
          {errors.mobile && <p className="mt-1 text-xs text-red-500">{errors.mobile.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input type="email" className={inputClass} {...register('email')} />
        </div>
        <div>
          <label className={labelClass}>Designation</label>
          <input className={inputClass} {...register('designation')} />
        </div>

        <div>
          <label className={labelClass}>Salary (₹)</label>
          <input type="number" step="0.01" className={inputClass} {...register('salary')} />
        </div>
        <div>
          <label className={labelClass}>Joining Date</label>
          <input type="date" className={inputClass} {...register('joiningDate')} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Address</label>
          <input className={inputClass} {...register('address')} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Photo</label>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} className="w-full text-sm" />
        </div>

        {!isEdit && (
          <div className="sm:col-span-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4" {...register('createLogin')} />
              Create a login account for this staff member (Receptionist role)
            </label>
            {createLogin && (
              <p className="mt-1 text-xs text-gray-500">
                Requires an email address above. A temporary password will be generated and shown once — share it securely.
              </p>
            )}
          </div>
        )}

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
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add staff'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default StaffFormModal;
