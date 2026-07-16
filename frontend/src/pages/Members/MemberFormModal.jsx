import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import { memberApi } from '../../services/memberApi';

const MemberFormModal = ({ open, onClose, onSaved, member }) => {
  const isEdit = Boolean(member);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (open) {
      reset(
        member
          ? {
              firstName: member.firstName,
              lastName: member.lastName,
              gender: member.gender,
              phone: member.phone,
              email: member.email,
              dob: member.dob ? member.dob.slice(0, 10) : '',
              address: member.address,
              height: member.height,
              weight: member.weight,
              occupation: member.occupation,
              medicalConditions: member.medicalConditions,
              notes: member.notes,
            }
          : {}
      );
    }
  }, [open, member, reset]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        height: data.height ? Number(data.height) : undefined,
        weight: data.weight ? Number(data.weight) : undefined,
      };
      if (isEdit) {
        await memberApi.update(member._id, payload);
        toast.success('Member updated');
      } else {
        await memberApi.create(payload);
        toast.success('Member added');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Member' : 'Add Member'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>First Name *</label>
          <input className={inputClass} {...register('firstName', { required: 'First name is required' })} />
          {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Last Name</label>
          <input className={inputClass} {...register('lastName')} />
        </div>

        <div>
          <label className={labelClass}>Gender *</label>
          <select className={inputClass} {...register('gender', { required: 'Gender is required' })}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          {errors.gender && <p className="mt-1 text-xs text-red-500">{errors.gender.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Date of Birth</label>
          <input type="date" className={inputClass} {...register('dob')} />
        </div>

        <div>
          <label className={labelClass}>Phone *</label>
          <input className={inputClass} {...register('phone', { required: 'Phone number is required' })} />
          {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" className={inputClass} {...register('email')} />
        </div>

        <div>
          <label className={labelClass}>Height (cm)</label>
          <input type="number" step="0.1" className={inputClass} {...register('height')} />
        </div>
        <div>
          <label className={labelClass}>Weight (kg)</label>
          <input type="number" step="0.1" className={inputClass} {...register('weight')} />
        </div>

        <div>
          <label className={labelClass}>Occupation</label>
          <input className={inputClass} {...register('occupation')} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Address</label>
          <input className={inputClass} {...register('address')} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Medical Conditions</label>
          <textarea rows={2} className={inputClass} {...register('medicalConditions')} />
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
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add member'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MemberFormModal;
