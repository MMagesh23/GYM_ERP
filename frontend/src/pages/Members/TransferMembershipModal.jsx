import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';
import Modal from '../../components/common/Modal';
import MemberSearchSelect from '../../components/common/MemberSearchSelect';
import { membershipApi } from '../../services/membershipApi';

const TransferMembershipModal = ({ open, onClose, onSaved, membership, currentMemberName }) => {
  const [toMember, setToMember] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setToMember(null);
  }, [open]);

  if (!membership) return null;

  const handleSubmit = async () => {
    if (!toMember) {
      toast.error('Select a member to transfer this membership to');
      return;
    }
    setSubmitting(true);
    try {
      await membershipApi.transfer(membership._id, toMember._id);
      toast.success(`Membership transferred to ${toMember.firstName}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Transfer Membership" size="sm">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          This moves the remaining membership duration from <strong>{currentMemberName}</strong> to another member and cancels it here.
          This can't be undone.
        </span>
      </div>

      <label className="mb-1 block text-sm font-medium">Transfer to *</label>
      <MemberSearchSelect value={toMember} onChange={setToMember} />

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
          disabled={submitting || !toMember}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowRightLeft size={14} />
          {submitting ? 'Transferring...' : 'Confirm transfer'}
        </button>
      </div>
    </Modal>
  );
};

export default TransferMembershipModal;
