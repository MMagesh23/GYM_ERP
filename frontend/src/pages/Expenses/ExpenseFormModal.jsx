import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import { expenseApi } from '../../services/expenseApi';

const CATEGORIES = ['rent', 'electricity', 'salary', 'equipment', 'internet', 'maintenance', 'marketing', 'cleaning', 'miscellaneous'];
const METHODS = ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'];

const ExpenseFormModal = ({ open, onClose, onSaved, expense }) => {
  const isEdit = Boolean(expense);
  const [billFile, setBillFile] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (open) {
      setBillFile(null);
      reset(
        expense
          ? {
              title: expense.title,
              category: expense.category,
              amount: expense.amount,
              expenseDate: expense.expenseDate ? expense.expenseDate.slice(0, 10) : '',
              paymentMethod: expense.paymentMethod,
              vendor: expense.vendor,
              notes: expense.notes,
            }
          : { paymentMethod: 'cash', expenseDate: new Date().toISOString().slice(0, 10) }
      );
    }
  }, [open, expense, reset]);

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== '') formData.append(key, val);
      });
      if (billFile) formData.append('bill', billFile);

      if (isEdit) {
        await expenseApi.update(expense._id, formData);
        toast.success('Expense updated');
      } else {
        await expenseApi.create(formData);
        toast.success('Expense added');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Expense' : 'Add Expense'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className={labelClass}>Title *</label>
          <input className={inputClass} {...register('title', { required: 'Title is required' })} />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Category *</label>
            <select className={inputClass} {...register('category', { required: true })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Amount *</label>
            <input type="number" step="0.01" className={inputClass} {...register('amount', { required: 'Amount is required' })} />
            {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" className={inputClass} {...register('expenseDate')} />
          </div>
          <div>
            <label className={labelClass}>Payment Method</label>
            <select className={inputClass} {...register('paymentMethod')}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Vendor</label>
          <input className={inputClass} {...register('vendor')} />
        </div>

        <div>
          <label className={labelClass}>Bill / Receipt</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setBillFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
          {isEdit && expense.billUrl && !billFile && (
            <a href={expense.billUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-600 hover:underline">
              View current bill
            </a>
          )}
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea rows={2} className={inputClass} {...register('notes')} />
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
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ExpenseFormModal;
