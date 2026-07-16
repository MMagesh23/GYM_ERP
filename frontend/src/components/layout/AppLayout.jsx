import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Wallet,
  Dumbbell,
  UserCog,
  BarChart3,
  ClipboardList,
  ShieldCheck,
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import { toggleTheme } from '../../redux/slices/uiSlice';
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

const AppLayout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { theme } = useSelector((state) => state.ui);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="flex w-60 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="px-5 py-5 text-lg font-semibold">Gym ERP</div>
        <nav className="flex-1 space-y-1 px-3">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3 dark:border-gray-800">
          <button
            onClick={() => dispatch(toggleTheme())}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="flex justify-end border-b border-gray-200 bg-white px-6 py-2.5 dark:border-gray-800 dark:bg-gray-900">
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
