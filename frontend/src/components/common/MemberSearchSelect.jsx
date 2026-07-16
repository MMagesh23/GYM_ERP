import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { memberApi } from '../../services/memberApi';

const MemberSearchSelect = ({ value, onChange }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await memberApi.list({ q: query, limit: 8 });
      setResults(data.data);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const selectMember = (member) => {
    onChange(member);
    setQuery(`${member.memberId} - ${member.firstName} ${member.lastName || ''}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search member by name, phone, or ID"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {results.map((m) => (
            <button
              type="button"
              key={m._id}
              onClick={() => selectMember(m)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span className="font-medium">{m.memberId}</span> — {m.firstName} {m.lastName} · {m.phone}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MemberSearchSelect;
