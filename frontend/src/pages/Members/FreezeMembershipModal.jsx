import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Snowflake } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { membershipApi } from '../../services/membershipApi';

const FreezeMembershipModal = ({ open, onClose, onSaved, membership }) => {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDays(7);
      setReason('');
    }
  }, [open]);

  if (!membership) return null;

  const usedFreezeDays = (membership.freezeHistory || []).reduce((sum, f) => sum + (f.daysUsed || 0), 0);
  const remainingFreezeDays = Math.max((membership.plan?.freezeDays || 0) - usedFreezeDays, 0);

  const handleSubmit = async () => {
    if (!days || days <= 0) {
      toast.error('Enter a valid number of days');
      return;
    }
    setSubmitting(true);
    try {
      await membershipApi.freeze(membership._id, Number(days), reason || 'Requested by member');
      toast.success(`Membership frozen for ${days} day(s)`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Freeze failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800';

  return (
    <Modal open={open} onClose={onClose} title="Freeze Membership" size="sm">
      <p className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        <strong>{remainingFreezeDays}</strong> freeze day{remainingFreezeDays === 1 ? '' : 's'} remaining on this plan
        {usedFreezeDays > 0 && ` (${usedFreezeDays} already used)`}. The end date shifts forward by the number of days frozen.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Freeze for how many days? *</label>
          <input
            type="number"
            min={1}
            max={remainingFreezeDays || undefined}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Reason</label>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Optional" />
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
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <Snowflake size={14} />
          {submitting ? 'Freezing...' : 'Freeze membership'}
        </button>
      </div>
    </Modal>
  );
};

export default FreezeMembershipModal;
