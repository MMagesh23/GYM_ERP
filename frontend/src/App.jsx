import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';

import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/Auth/LoginPage';
import UnauthorizedPage from './pages/Auth/UnauthorizedPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import MembersPage from './pages/Members/MembersPage';
import MemberProfilePage from './pages/Members/MemberProfilePage';
import PlansPage from './pages/Memberships/PlansPage';
import PaymentsPage from './pages/Payments/PaymentsPage';
import ExpensesPage from './pages/Expenses/ExpensesPage';
import EquipmentPage from './pages/Equipment/EquipmentPage';
import EquipmentDetailPage from './pages/Equipment/EquipmentDetailPage';
import StaffPage from './pages/Staff/StaffPage';
import ReportsPage from './pages/Reports/ReportsPage';
import AuditLogsPage from './pages/AuditLogs/AuditLogsPage';
import SettingsPage from './pages/Settings/SettingsPage';
import FinanceDashboardPage from './pages/Finance/FinanceDashboardPage';
import CashClosingPage from './pages/Finance/CashClosingPage';
import { restoreSession } from './redux/slices/authSlice';
import { fetchSettings } from './redux/slices/settingsSlice';
import { applyBrandTheme } from './utils/branding';

function App() {
  const dispatch = useDispatch();
  const { data: settings } = useSelector((state) => state.settings);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await dispatch(restoreSession()).unwrap();
      } catch {
        // Session restore is best-effort; the app can still render the login route.
      } finally {
        dispatch(fetchSettings());
      }
    };

    initializeApp();
  }, [dispatch]);

  // Dynamically apply favicon + document title once branding settings load
  useEffect(() => {
    if (!settings) return;

    applyBrandTheme(settings);

    if (settings.favicon) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.favicon;
    }

    if (settings.gymName) {
      document.title = settings.gymName;
    }
  }, [settings]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          className: '!rounded-xl !shadow-popover !text-sm',
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/members/:id" element={<MemberProfilePage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            <Route path="/equipment/:id" element={<EquipmentDetailPage />} />

            {/* Finance: view is RBAC-gated server-side per user's permission
                matrix (finance.view); closing the cash drawer is gated
                server-side on finance.update. No route-level role restriction
                here so a receptionist granted finance.view can still see it. */}
            <Route path="/finance" element={<FinanceDashboardPage />} />
            <Route path="/finance/cash-closing" element={<CashClosingPage />} />

            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/membership-plans" element={<PlansPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default App;