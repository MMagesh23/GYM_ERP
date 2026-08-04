import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Camera, User, Phone, HeartPulse, StickyNote, X } from 'lucide-react';
import Modal from '../../components/common/Modal';
import Avatar from '../../components/common/Avatar';
import { memberApi } from '../../services/memberApi';

const SectionHeading = ({ icon: Icon, title, subtitle }) => (
  <div className="mb-3 flex items-center gap-2 sm:col-span-2">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
      <Icon size={15} />
    </span>
    <div>
      <h3 className="text-sm font-semibold leading-tight">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  </div>
);

const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_MB = 5;

const MemberFormModal = ({ open, onClose, onSaved, member }) => {
  const isEdit = Boolean(member);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const firstName = watch('firstName');
  const lastName = watch('lastName');

  useEffect(() => {
    if (open) {
      setPhotoFile(null);
      setPhotoPreview(null);
      setRemovePhoto(false);
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

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      toast.error('Only JPG, PNG, or WebP images are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast.error(`Photo must be ${MAX_PHOTO_MB}MB or smaller.`);
      e.target.value = '';
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
  };

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      Object.entries({
        ...data,
        height: data.height ? Number(data.height) : undefined,
        weight: data.weight ? Number(data.weight) : undefined,
      }).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          formData.append(key, val);
        }
      });
      if (photoFile) {
        formData.append('photo', photoFile);
      } else if (removePhoto) {
        formData.append('removePhoto', 'true');
      }

      if (isEdit) {
        await memberApi.update(member._id, formData);
        toast.success('Member updated');
      } else {
        await memberApi.create(formData);
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
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
          <div className="relative">
            <Avatar firstName={firstName} lastName={lastName} size="lg" photo={photoPreview || (!removePhoto ? member?.photo : null)} />
            <label className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-white shadow-sm hover:bg-brand-700">
              <Camera size={12} />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : 'New member'}</p>
            <p className="text-xs text-gray-400">{isEdit ? member.memberId : 'A member ID will be generated automatically'}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">JPG, PNG, or WebP · up to {MAX_PHOTO_MB}MB · optional</p>
          </div>
          {(photoPreview || (!removePhoto && member?.photo)) && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:border-gray-700 dark:hover:bg-red-950/40"
            >
              <X size={12} /> Remove photo
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <SectionHeading icon={User} title="Personal details" />

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
            <label className={labelClass}>Occupation</label>
            <input className={inputClass} {...register('occupation')} />
          </div>

          <div className="border-t border-gray-100 pt-4 dark:border-gray-800 sm:col-span-2" />

          <SectionHeading icon={Phone} title="Contact information" />

          <div>
            <label className={labelClass}>Phone *</label>
            <input className={inputClass} {...register('phone', { required: 'Phone number is required' })} />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} {...register('email')} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Address</label>
            <input className={inputClass} {...register('address')} />
          </div>

          <div className="border-t border-gray-100 pt-4 dark:border-gray-800 sm:col-span-2" />

          <SectionHeading icon={HeartPulse} title="Physical & health" subtitle="BMI is calculated automatically from height and weight" />

          <div>
            <label className={labelClass}>Height (cm)</label>
            <input type="number" step="0.1" className={inputClass} {...register('height')} />
          </div>
          <div>
            <label className={labelClass}>Weight (kg)</label>
            <input type="number" step="0.1" className={inputClass} {...register('weight')} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Medical Conditions</label>
            <textarea rows={2} className={inputClass} placeholder="Allergies, injuries, or conditions staff should be aware of" {...register('medicalConditions')} />
          </div>

          <div className="border-t border-gray-100 pt-4 dark:border-gray-800 sm:col-span-2" />

          <SectionHeading icon={StickyNote} title="Notes" />
          <div className="sm:col-span-2">
            <textarea rows={2} className={inputClass} placeholder="Internal notes about this member" {...register('notes')} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
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
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add member'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MemberFormModal;
