import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ArrowRight, Users, CreditCard, Wallet, Dumbbell, UserCog,
  BarChart3, ClipboardList, ShieldCheck, Settings, LayoutDashboard, CornerDownLeft,
} from 'lucide-react';
import { memberApi } from '../../services/memberApi';

const NAV_SHORTCUTS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { to: '/members', label: 'Members', icon: Users, adminOnly: false },
  { to: '/payments', label: 'Payments', icon: CreditCard, adminOnly: false },
  { to: '/membership-plans', label: 'Membership Plans', icon: ClipboardList, adminOnly: true },
  { to: '/expenses', label: 'Expenses', icon: Wallet, adminOnly: true },
  { to: '/equipment', label: 'Equipment', icon: Dumbbell, adminOnly: false },
  { to: '/staff', label: 'Staff', icon: UserCog, adminOnly: true },
  { to: '/reports', label: 'Reports', icon: BarChart3, adminOnly: true },
  { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

/**
 * Global ⌘K / Ctrl+K palette. Mount once near the root of the authenticated
 * layout — it listens for the shortcut itself, no external open state needed.
 *
 *   <CommandPalette userRole={user?.role} />
 */
const CommandPalette = ({ userRole }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      const isTypingField = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      } else if (e.key === '/' && !isTypingField && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setMemberResults([]);
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(t);
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
    if (!query || query.trim().length < 2) {
      setMemberResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await memberApi.list({ q: query, limit: 5 });
        setMemberResults(data.data);
      } catch (err) {
        // Silent - palette just shows nav results
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const navResults = NAV_SHORTCUTS.filter((i) => !i.adminOnly || userRole === 'admin').filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase())
  );

  const results = [
    ...navResults.map((i) => ({ kind: 'nav', ...i })),
    ...memberResults.map((m) => ({ kind: 'member', ...m })),
  ];

  const select = (item) => {
    if (!item) return;
    if (item.kind === 'nav') navigate(item.to);
    if (item.kind === 'member') navigate(`/members/${item._id}`);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[activeIndex]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[10vh] backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl bg-white shadow-popover dark:bg-gray-900">
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3.5 dark:border-gray-800">
          <Search size={17} className="shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search members, or jump to a page..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:border-gray-700 sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-400">
              {query.length >= 2 ? 'No matches found' : 'Type to search members, or jump to a page'}
            </p>
          ) : (
            <>
              {navResults.length > 0 && (
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Pages</p>
              )}
              {results.map((item, idx) => {
                const Icon = item.kind === 'nav' ? item.icon : Users;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={item.kind === 'nav' ? item.to : item._id}
                    type="button"
                    onClick={() => select(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isActive ? 'bg-brand-100 dark:bg-brand-900/50' : 'bg-gray-100 dark:bg-gray-800'
                      }`}
                    >
                      <Icon size={14} />
                    </span>
                    <span className="flex-1 truncate">
                      {item.kind === 'nav' ? item.label : `${item.firstName} ${item.lastName || ''}`.trim()}
                      {item.kind === 'member' && (
                        <span className="ml-1.5 text-xs text-gray-400">{item.memberId} · {item.phone}</span>
                      )}
                    </span>
                    {isActive ? (
                      <CornerDownLeft size={13} className="shrink-0 text-gray-400" />
                    ) : (
                      <ArrowRight size={13} className="shrink-0 text-gray-300" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="hidden items-center gap-3 border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400 dark:border-gray-800 sm:flex">
          <span className="flex items-center gap-1"><kbd className="rounded border border-gray-200 px-1 dark:border-gray-700">↑</kbd><kbd className="rounded border border-gray-200 px-1 dark:border-gray-700">↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-gray-200 px-1 dark:border-gray-700">↵</kbd> select</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-gray-200 px-1 dark:border-gray-700">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;