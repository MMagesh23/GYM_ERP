import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';

const CredentialsModal = ({ open, onClose, credentials }) => {
  if (!credentials) return null;

  const copyPassword = () => {
    navigator.clipboard.writeText(credentials.password);
    toast.success('Password copied');
  };

  return (
    <Modal open={open} onClose={onClose} title="Login credentials" size="sm">
      <p className="mb-3 text-sm text-gray-500">
        Share these with the staff member securely. This password won't be shown again.
      </p>
      <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
        {credentials.email && (
          <p>
            <span className="text-gray-500">Email:</span> <span className="font-medium">{credentials.email}</span>
          </p>
        )}
        <div className="flex items-center justify-between">
          <p>
            <span className="text-gray-500">Password:</span> <span className="font-mono font-medium">{credentials.password}</span>
          </p>
          <button onClick={copyPassword} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Copy size={16} />
          </button>
        </div>
      </div>
      <button
        onClick={onClose}
        className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Done
      </button>
    </Modal>
  );
};

export default CredentialsModal;
