import { useState } from 'react';
import { X, Plus } from 'lucide-react';

const LABELS = {
  cash: 'Cash', upi: 'UPI', credit_card: 'Credit Card', debit_card: 'Debit Card',
  bank_transfer: 'Bank Transfer', wallet: 'Wallet',
};
const prettify = (key) => LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Editable tag list for Settings.paymentMethods. Local-only state — parent owns persistence via the surrounding form's Save button. */
const PaymentMethodsEditor = ({ value, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = () => {
    const key = draft.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || value.includes(key)) { setDraft(''); return; }
    onChange([...value, key]);
    setDraft('');
  };

  const remove = (key) => {
    if (value.length <= 1) return; // never allow emptying the list client-side either
    onChange(value.filter((m) => m !== key));
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {value.map((key) => (
          <span
            key={key}
            className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
          >
            {prettify(key)}
            {value.length > 1 && (
              <button type="button" onClick={() => remove(key)} className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-800">
                <X size={11} />
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="e.g. Cheque, Crypto..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
};

export default PaymentMethodsEditor;