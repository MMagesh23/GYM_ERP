import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { settingsApi } from '../../services/settingsApi';

const DAYS = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
];

const defaultRow = (day) => ({ day, open: '06:00', close: '22:00', closed: false });

const BusinessHoursPanel = ({ initial, onSaved }) => {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const map = new Map((initial || []).map((r) => [r.day, r]));
    setRows(DAYS.map(([key]) => map.get(key) || defaultRow(key)));
  }, [initial]);

  const update = (day, field, value) => {
    setRows((prev) => prev.map((r) => (r.day === day ? { ...r, [field]: value } : r)));
  };

  const applyToAll = () => {
    const first = rows[0];
    setRows((prev) => prev.map((r) => ({ ...r, open: first.open, close: first.close, closed: first.closed })));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await settingsApi.update({ businessHours: rows });
      toast.success('Business hours saved');
      onSaved?.(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save business hours');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">Set opening hours per day. Mark a day closed to hide it from booking/check-in windows.</p>
        <button onClick={applyToAll} className="text-xs text-brand-600 hover:underline">
          Copy Monday to all days
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
            <tr>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2">Open</th>
              <th className="px-3 py-2">Close</th>
              <th className="px-3 py-2 text-center">Closed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {DAYS.map(([key, label]) => {
              const row = rows.find((r) => r.day === key) || defaultRow(key);
              return (
                <tr key={key} className={row.closed ? 'opacity-50' : ''}>
                  <td className="px-3 py-2 font-medium">{label}</td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      disabled={row.closed}
                      value={row.open}
                      onChange={(e) => update(key, 'open', e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      disabled={row.closed}
                      value={row.close}
                      onChange={(e) => update(key, 'close', e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(e) => update(key, 'closed', e.target.checked)}
                      className="h-4 w-4"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Save size={14} /> {saving ? 'Saving...' : 'Save business hours'}
        </button>
      </div>
    </div>
  );
};

export default BusinessHoursPanel;