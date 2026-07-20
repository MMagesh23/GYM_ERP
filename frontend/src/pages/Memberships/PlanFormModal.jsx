import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Tag, Snowflake } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { planApi } from '../../services/membershipApi';
import { estimateFinalAmount, formatCurrency } from '../../utils/memberHelpers';

const DURATION_OPTIONS = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['half_yearly', 'Half-Yearly'],
  ['annual', 'Annual'],
  ['lifetime', 'Lifetime'],
  ['custom', 'Custom'],
];

const SectionHeading = ({ icon: Icon, title }) => (
  <div className="mb-1 mt-2 flex items-center gap-2 sm:col-span-2">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
      <Icon size={15} />
    </span>
    <h3 className="text-sm font-semibold">{title}</h3>
  </div>
);

const PlanFormModal = ({ open, onClose, onSaved, plan }) => {
  const isEdit = Boolean(plan);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (open) reset(plan || { discountType: 'flat', durationType: 'monthly' });
  }, [open, plan, reset]);

  const durationType = watch('durationType');
  const watched = watch();
  const preview = estimateFinalAmount(
    {
      price: Number(watched.price) || 0,
      joiningFee: Number(watched.joiningFee) || 0,
      discount: Number(watched.discount) || 0,
      discountType: watched.discountType,
      tax: Number(watched.tax) || 0,
    },
    { isNew: true }
  );

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        price: Number(data.price),
        discount: Number(data.discount || 0),
        tax: Number(data.tax || 0),
        joiningFee: Number(data.joiningFee || 0),
        freezeDays: Number(data.freezeDays || 0),
        maxRenewals: Number(data.maxRenewals || 0),
        gracePeriodDays: Number(data.gracePeriodDays || 3),
        durationDays: data.durationDays ? Number(data.durationDays) : undefined,
        freezeAllowed: Boolean(data.freezeAllowed),
      };
      if (isEdit) {
        await planApi.update(plan._id, payload);
        toast.success('Plan updated');
      } else {
        await planApi.create(payload);
        toast.success('Plan created');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Plan' : 'New Plan'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <SectionHeading icon={Tag} title="Plan basics" />

        <div className="sm:col-span-2">
          <label className={labelClass}>Plan Name *</label>
          <input className={inputClass} {...register('name', { required: 'Plan name is required' })} />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Duration Type *</label>
          <select className={inputClass} {...register('durationType', { required: true })}>
            {DURATION_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Only shown for custom-duration plans — standard duration types
            (monthly, annual, etc.) have their durationDays computed server-side
            from a fixed lookup, see backend/controllers/membershipPlanController.js#DURATION_DAYS */}
        {durationType === 'custom' && (
          <div>
            <label className={labelClass}>Duration (days) *</label>
            <input
              type="number"
              className={inputClass}
              {...register('durationDays', {
                required: durationType === 'custom' ? 'Duration is required for a custom plan' : false,
                min: { value: 1, message: 'Must be at least 1 day' },
              })}
            />
            {errors.durationDays && <p className="mt-1 text-xs text-red-500">{errors.durationDays.message}</p>}
          </div>
        )}

        {/* FIX: Price used to be duplicated across two separate conditional
            branches (one rendered when durationType !== 'custom', a second,
            near-identical one rendered when it === 'custom') — same field,
            same register() call, same validation, just copy-pasted. Collapsed
            into a single field that's always visible regardless of duration
            type, since every plan needs a price no matter how its duration
            is set. */}
        <div className={durationType === 'custom' ? '' : 'sm:col-start-2'}>
          <label className={labelClass}>Price (₹) *</label>
          <input
            type="number"
            step="0.01"
            className={inputClass}
            {...register('price', {
              required: 'Price is required',
              min: { value: 0, message: 'Price cannot be negative' },
            })}
          />
          {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Joining Fee (₹)</label>
          <input type="number" step="0.01" className={inputClass} {...register('joiningFee')} />
        </div>

        <div>
          <label className={labelClass}>Discount</label>
          <input type="number" step="0.01" className={inputClass} {...register('discount')} />
        </div>
        <div>
          <label className={labelClass}>Discount Type</label>
          <select className={inputClass} {...register('discountType')}>
            <option value="flat">Flat (₹)</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Tax (%)</label>
          <input type="number" step="0.01" className={inputClass} {...register('tax')} />
        </div>

        {/* Live price preview - mirrors the backend's calcFinalAmount formula */}
        <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-3 text-sm dark:border-brand-800 dark:bg-brand-900/20 sm:col-span-2">
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-300">
            Estimated price for a new member
          </p>
          <p className="text-xl font-semibold text-brand-700 dark:text-brand-300">{formatCurrency(preview)}</p>
        </div>

        <SectionHeading icon={Snowflake} title="Renewals & freezing" />

        <div>
          <label className={labelClass}>Grace Period (days)</label>
          <input type="number" className={inputClass} {...register('gracePeriodDays')} />
        </div>
        <div>
          <label className={labelClass}>Max Renewals (0 = unlimited)</label>
          <input type="number" className={inputClass} {...register('maxRenewals')} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="freezeAllowed" className="h-4 w-4" {...register('freezeAllowed')} />
          <label htmlFor="freezeAllowed" className="text-sm font-medium">
            Allow freezing
          </label>
        </div>
        <div>
          <label className={labelClass}>Freeze Days Allowed</label>
          <input type="number" className={inputClass} {...register('freezeDays')} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Description</label>
          <textarea rows={2} className={inputClass} {...register('description')} />
        </div>

        <div className="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800 sm:col-span-2">
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
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PlanFormModal;