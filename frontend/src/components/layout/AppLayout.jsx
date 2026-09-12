import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, CreditCard, Wallet, Dumbbell, UserCog, BarChart3,
  ClipboardList, ShieldCheck, Settings as SettingsIcon, Sun, Moon, LogOut,
  Menu, X, ChevronsLeft, ChevronsRight, ChevronDown, Search, PiggyBank,
} from 'lucide-react';
import { toggleTheme, toggleSidebar } from '../../redux/slices/uiSlice';
import { logoutUser } from '../../redux/slices/authSlice';
import NotificationBell from './NotificationBell';
import CommandPalette from './CommandPalette';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'receptionist'] },
  { to: '/members', label: 'Members', icon: Users, roles: ['admin', 'receptionist'] },
  { to: '/membership-plans', label: 'Plans', icon: ClipboardList, roles: ['admin'] },
  { to: '/payments', label: 'Payments', icon: CreditCard, roles: ['admin', 'receptionist'] },
  { to: '/finance', label: 'Finance', icon: PiggyBank, roles: ['admin', 'receptionist'], feature: 'financeModule' },
  { to: '/expenses', label: 'Expenses', icon: Wallet, roles: ['admin'], feature: 'financeModule' },
  { to: '/equipment', label: 'Equipment', icon: Dumbbell, roles: ['admin', 'receptionist'], feature: 'equipmentModule' },
  { to: '/staff', label: 'Staff', icon: UserCog, roles: ['admin'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin'], feature: 'reportsModule' },
  { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin'] },
];

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const AppLayout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { theme, sidebarCollapsed } = useSelector((state) => state.ui);
  const { data: settings } = useSelector((state) => state.settings);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  const openCommandPalette = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: isMac, ctrlKey: !isMac }));
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.includes(user?.role) && (!item.feature || settings?.features?.[item.feature] !== false)
  );
  const currentPage = visibleItems.find((i) => location.pathname.startsWith(i.to));

  const gymName = settings?.gymName || 'Gym ERP';
  const gymLogo = settings?.gymLogo;

  const BrandMark = ({ collapsed }) => (
    <div className={`flex items-center gap-2.5 px-5 py-5 ${collapsed ? 'justify-center px-0' : ''}`}>
      {gymLogo ? (
        <img src={gymLogo} alt={gymName} className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-white/40" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white shadow-sm">
          {gymName.charAt(0).toUpperCase()}
        </div>
      )}
      {!collapsed && (
        <span className="truncate text-lg font-semibold tracking-tight" title={gymName}>
          {gymName}
        </span>
      )}
    </div>
  );

  const SidebarContent = ({ collapsed }) => (
    <>
      <BrandMark collapsed={collapsed} />

      <nav className="flex-1 space-y-1 px-3">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                collapsed ? 'justify-center px-0' : ''
              } ${
                isActive
                  ? 'glass-pill-active text-brand-700 dark:text-brand-300'
                  : 'text-gray-600 hover:bg-white/40 dark:text-gray-300 dark:hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/30 p-3 dark:border-white/10">
        <button
          onClick={() => dispatch(toggleTheme())}
          title={collapsed ? (theme === 'light' ? 'Dark mode' : 'Light mode') : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-white/40 dark:text-gray-300 dark:hover:bg-white/5 ${collapsed ? 'justify-center px-0' : ''}`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          {!collapsed && (theme === 'light' ? 'Dark mode' : 'Light mode')}
        </button>
      </div>
    </>
  );

  return (
    <div className="relative flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Ambient decorative gradient behind the whole app so glass surfaces
          have something to refract. Fixed, non-interactive. */}
      <div className="liquid-backdrop" />

      <CommandPalette userRole={user?.role} />

      <aside
        className={`relative z-10 hidden md:flex flex-col glass-nav border-r transition-all duration-200 ${
          sidebarCollapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        <SidebarContent collapsed={sidebarCollapsed} />
        <div className="border-t border-white/30 p-2 dark:border-white/10">
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="flex w-full items-center justify-center rounded-xl p-2 text-gray-400 hover:bg-white/40 hover:text-gray-600 dark:hover:bg-white/5"
          >
            {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 animate-slide-in-right flex-col glass-nav border-r">
            <div className="flex items-center justify-between px-4 pt-4">
              <div className="flex items-center gap-2">
                {gymLogo ? (
                  <img src={gymLogo} alt={gymName} className="h-7 w-7 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-bold text-white">
                    {gymName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="truncate text-lg font-semibold">{gymName}</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/40 dark:hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

            <div className="px-4 pt-3">
              <button
                onClick={() => {
                  setMobileOpen(false);
                  setTimeout(openCommandPalette, 150);
                }}
                className="flex w-full items-center gap-2 rounded-xl glass-input px-3 py-2 text-sm text-gray-400"
              >
                <Search size={15} /> Search members, pages...
              </button>
            </div>

            <div className="flex flex-1 flex-col pt-2">
              <nav className="flex-1 space-y-1 px-3 pt-2">
                {visibleItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? 'glass-pill-active text-brand-700 dark:text-brand-300'
                          : 'text-gray-600 hover:bg-white/40 dark:text-gray-300 dark:hover:bg-white/5'
                      }`
                    }
                  >
                    <Icon size={18} className="shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-white/30 p-3 dark:border-white/10">
                <button
                  onClick={() => dispatch(toggleTheme())}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-white/40 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                  {theme === 'light' ? 'Dark mode' : 'Light mode'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 glass-nav border-b px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-gray-500 hover:bg-white/40 dark:hover:bg-white/5 md:hidden">
              <Menu size={20} />
            </button>
            <span className="text-sm font-medium text-gray-500">{currentPage?.label || ''}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openCommandPalette}
              className="hidden items-center gap-1.5 rounded-xl glass-input px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 sm:flex"
            >
              <Search size={13} />
              <span>Search</span>
              <kbd className="rounded bg-white/50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-gray-400 dark:bg-white/10">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </button>

            <NotificationBell />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-white/40 dark:hover:bg-white/5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-semibold text-white shadow-sm">
                  {initials(user?.name) || 'U'}
                </div>
                <span className="hidden text-sm font-medium sm:block">{user?.name}</span>
                <ChevronDown size={14} className="hidden text-gray-400 sm:block" />
              </button>

              {userMenuOpen && (
                <div
                  onMouseLeave={() => setUserMenuOpen(false)}
                  className="glass-modal absolute right-0 z-20 mt-2 w-52 animate-scale-in rounded-2xl py-1.5"
                >
                  <div className="border-b border-white/30 px-3 py-2 dark:border-white/10">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs capitalize text-gray-400">{user?.role}</p>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 hover:bg-white/40 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    <SettingsIcon size={15} /> Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50/60 dark:hover:bg-red-950/30"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="route-transition">
            <Outlet />
          </div>
        </main>

        {/* NEW — lightweight glass footer, purely presentational */}
        <footer className="glass-nav border-t px-4 py-2 text-center text-[11px] text-gray-400 sm:px-6">
          {gymName} · Powered by Gym ERP
        </footer>
      </div>
    </div>
  );
};

export default AppLayout;
