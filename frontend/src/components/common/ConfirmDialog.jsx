import Modal from './Modal';

const ConfirmDialog = ({ open, title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }) => (
  <Modal open={open} onClose={onClose} title={title} size="sm">
    <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
    <div className="mt-5 flex justify-end gap-2">
      <button
        onClick={onClose}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
          danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  </Modal>
);

export default ConfirmDialog;
