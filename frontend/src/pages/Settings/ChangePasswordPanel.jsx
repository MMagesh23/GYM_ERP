import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { authApi } from '../../services/authApi';

const ChangePasswordPanel = () => {
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm();
  const newPassword = watch('newPassword');

  const onSubmit = async (data) => {
    try {
      await authApi.changePassword(data.currentPassword, data.newPassword);
      toast.success('Password changed. Other devices have been logged out.');
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800';
  const labelClass = 'mb-1 block text-sm font-medium';

  return (
    <div className="max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold">Change password</h3>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className={labelClass}>Current password</label>
          <input type="password" className={inputClass} {...register('currentPassword', { required: 'Current password is required' })} />
          {errors.currentPassword && <p className="mt-1 text-xs text-red-500">{errors.currentPassword.message}</p>}
        </div>
        <div>
          <label className={labelClass}>New password</label>
          <input
            type="password"
            className={inputClass}
            {...register('newPassword', {
              required: 'New password is required',
              minLength: { value: 8, message: 'Must be at least 8 characters' },
            })}
          />
          {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Confirm new password</label>
          <input
            type="password"
            className={inputClass}
            {...register('confirmPassword', {
              required: 'Please confirm your new password',
              validate: (v) => v === newPassword || 'Passwords do not match',
            })}
          />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Changing...' : 'Change password'}
        </button>
      </form>
    </div>
  );
};

export default ChangePasswordPanel;