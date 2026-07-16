import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, CreditCard, Wallet, Dumbbell, UserCog, BarChart3,
  ClipboardList, ShieldCheck, Settings as SettingsIcon, Sun, Moon, LogOut,
  Menu, X, ChevronsLeft, ChevronsRight, ChevronDown,
} from 'lucide-react';
import { toggleTheme, toggleSidebar } from '../../redux/slices/uiSlice';
import { logoutUser } from '../../redux/slices/authSlice';
import NotificationBell from './NotificationBell';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'receptionist'] },
  { to: '/members', label: 'Members', icon: Users, roles: ['admin', 'receptionist'] },
  { to: '/membership-plans', label: 'Plans', icon: ClipboardList, roles: ['admin'] },
  { to: '/payments', label: 'Payments', icon: CreditCard, roles: ['admin', 'receptionist'] },
  { to: '/expenses', label: 'Expenses', icon: Wallet, roles: ['admin'] },
  { to: '/equipment', label: 'Equipment', icon: Dumbbell, roles: ['admin', 'receptionist'] },
  { to: '/staff', label: 'Staff', icon: UserCog, roles: ['admin'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin'] },
];

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

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

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));
  const currentPage = visibleItems.find((i) => location.pathname.startsWith(i.to));

  const gymName = settings?.gymName || 'Gym ERP';
  const gymLogo = settings?.gymLogo;

  const BrandMark = ({ collapsed }) => (
    <div className={`flex items-center gap-2.5 px-5 py-5 ${collapsed ? 'justify-center px-0' : ''}`}>
      {gymLogo ? (
        <img
          src={gymLogo}
          alt={gymName}
          className="h-8 w-8 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
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

      <nav className="flex-1 space-y-0.5 px-3">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                collapsed ? 'justify-center px-0' : ''
              } ${
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3 dark:border-gray-800">
        <button
          onClick={() => dispatch(toggleTheme())}
          title={collapsed ? (theme === 'light' ? 'Dark mode' : 'Light mode') : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 ${collapsed ? 'justify-center px-0' : ''}`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          {!collapsed && (theme === 'light' ? 'Dark mode' : 'Light mode')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <aside
        className={`hidden md:flex flex-col border-r border-gray-200 bg-white transition-all duration-200 dark:border-gray-800 dark:bg-gray-900 ${
          sidebarCollapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        <SidebarContent collapsed={sidebarCollapsed} />
        <div className="border-t border-gray-100 p-2 dark:border-gray-800">
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 animate-slide-in-right flex-col bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between px-4 pt-4">
              <div className="flex items-center gap-2">
                {gymLogo ? (
                  <img src={gymLogo} alt={gymName} className="h-7 w-7 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                    {gymName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="truncate text-lg font-semibold">{gymName}</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-1 flex-col pt-2">
              <nav className="flex-1 space-y-0.5 px-3 pt-2">
                {visibleItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`
                    }
                  >
                    <Icon size={18} className="shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-gray-100 p-3 dark:border-gray-800">
                <button
                  onClick={() => dispatch(toggleTheme())}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                  {theme === 'light' ? 'Dark mode' : 'Light mode'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden">
              <Menu size={20} />
            </button>
            <span className="text-sm font-medium text-gray-500">{currentPage?.label || ''}</span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                  {initials(user?.name) || 'U'}
                </div>
                <span className="hidden text-sm font-medium sm:block">{user?.name}</span>
                <ChevronDown size={14} className="hidden text-gray-400 sm:block" />
              </button>

              {userMenuOpen && (
                <div
                  onMouseLeave={() => setUserMenuOpen(false)}
                  className="absolute right-0 z-20 mt-2 w-52 animate-scale-in rounded-xl border border-gray-100 bg-white py-1.5 shadow-popover dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs capitalize text-gray-400">{user?.role}</p>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <SettingsIcon size={15} /> Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;