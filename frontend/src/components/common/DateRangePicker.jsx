import { useState } from 'react';
import { Calendar } from 'lucide-react';

const toISO = (d) => d.toISOString().slice(0, 10);

const PRESETS = [
  {
    key: 'today',
    label: 'Today',
    range: () => { const d = new Date(); return [toISO(d), toISO(d)]; },
  },
  {
    key: 'week',
    label: 'This Week',
    range: () => {
      const now = new Date();
      const day = now.getDay() || 7;
      const start = new Date(now);
      start.setDate(now.getDate() - day + 1);
      return [toISO(start), toISO(now)];
    },
  },
  {
    key: 'month',
    label: 'This Month',
    range: () => {
      const now = new Date();
      return [toISO(new Date(now.getFullYear(), now.getMonth(), 1)), toISO(now)];
    },
  },
  {
    key: 'year',
    label: 'This Year',
    range: () => {
      const now = new Date();
      return [toISO(new Date(now.getFullYear(), 0, 1)), toISO(now)];
    },
  },
];

/**
 * Controlled date-range filter with quick presets.
 * @param {{ from: string, to: string, onChange: (range: {from: string, to: string}) => void }} props
 */
const DateRangePicker = ({ from, to, onChange }) => {
  const [activePreset, setActivePreset] = useState('month');

  const applyPreset = (preset) => {
    const [f, t] = preset.range();
    setActivePreset(preset.key);
    onChange({ from: f, to: t });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2 py-1.5 dark:border-gray-700">
        <Calendar size={14} className="text-gray-400" />
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => {
            setActivePreset(null);
            onChange({ from: e.target.value, to });
          }}
          className="bg-transparent text-sm outline-none dark:[color-scheme:dark]"
        />
        <span className="text-gray-300">–</span>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => {
            setActivePreset(null);
            onChange({ from, to: e.target.value });
          }}
          className="bg-transparent text-sm outline-none dark:[color-scheme:dark]"
        />
      </div>
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              activePreset === p.key
                ? 'bg-brand-600 text-white'
                : 'border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DateRangePicker;